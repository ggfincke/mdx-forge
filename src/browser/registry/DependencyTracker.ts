// src/browser/registry/DependencyTracker.ts
// dependency graph & resolution map w/ O(k) cleanup via reverse indexes

// track module dependencies & import resolution
// use dual-index system for O(k) cleanup instead of O(n) full scan
export class DependencyTracker {
  // map (parentId, request) -> resolved fsPath for relative imports
  private resolutionMap: Map<string, string> = new Map();

  // reverse indexes for O(k) cleanup
  // - parentToResolutionKeys: moduleId -> Set of resolution keys where moduleId is parent
  // - targetToResolutionKeys: moduleId -> Set of resolution keys where moduleId is target (value)
  private parentToResolutionKeys: Map<string, Set<string>> = new Map();
  private targetToResolutionKeys: Map<string, Set<string>> = new Map();

  // reverse dependency graph: moduleId -> set of modules that depend on it
  private dependents: Map<string, Set<string>> = new Map();

  // forward index: moduleId -> set of modules it depends on (for O(deg) cleanup)
  private dependenciesOf: Map<string, Set<string>> = new Map();

  // create key for resolution map
  private makeResolutionKey(parentId: string, request: string): string {
    return `${parentId}\0${request}`;
  }

  // remove one resolution & both reverse-index entries
  private deleteResolutionKey(key: string): void {
    const target = this.resolutionMap.get(key);
    if (target === undefined) {
      return;
    }

    this.resolutionMap.delete(key);

    const separatorIndex = key.indexOf('\0');
    const parentId = key.slice(0, separatorIndex);
    const parentKeys = this.parentToResolutionKeys.get(parentId);
    parentKeys?.delete(key);
    if (parentKeys?.size === 0) {
      this.parentToResolutionKeys.delete(parentId);
    }

    const targetKeys = this.targetToResolutionKeys.get(target);
    targetKeys?.delete(key);
    if (targetKeys?.size === 0) {
      this.targetToResolutionKeys.delete(target);
    }
  }

  // register a resolved path for a (parent, request) pair
  // maintain reverse indexes for O(k) cleanup
  setResolution(parentId: string, request: string, fsPath: string): void {
    const key = this.makeResolutionKey(parentId, request);

    // clean up old target mapping if this key existed
    const oldTarget = this.resolutionMap.get(key);
    if (oldTarget) {
      const oldTargetKeys = this.targetToResolutionKeys.get(oldTarget);
      oldTargetKeys?.delete(key);
      if (oldTargetKeys?.size === 0) {
        this.targetToResolutionKeys.delete(oldTarget);
      }
    }

    // set the resolution
    this.resolutionMap.set(key, fsPath);

    // update parent index
    if (!this.parentToResolutionKeys.has(parentId)) {
      this.parentToResolutionKeys.set(parentId, new Set());
    }
    this.parentToResolutionKeys.get(parentId)!.add(key);

    // update target index
    if (!this.targetToResolutionKeys.has(fsPath)) {
      this.targetToResolutionKeys.set(fsPath, new Set());
    }
    this.targetToResolutionKeys.get(fsPath)!.add(key);
  }

  // get resolved fsPath for a (parent, request) pair
  getResolution(parentId: string, request: string): string | undefined {
    const key = this.makeResolutionKey(parentId, request);
    return this.resolutionMap.get(key);
  }

  // replace one parent's committed mappings after a successful reload
  replaceResolutions(
    parentId: string,
    resolutions: ReadonlyMap<string, string>
  ): void {
    for (const key of Array.from(
      this.parentToResolutionKeys.get(parentId) ?? []
    )) {
      this.deleteResolutionKey(key);
    }
    for (const [request, fsPath] of resolutions) {
      this.setResolution(parentId, request, fsPath);
    }
  }

  // record that moduleId depends on dependsOnId
  addDependency(moduleId: string, dependsOnId: string): void {
    if (!this.dependents.has(dependsOnId)) {
      this.dependents.set(dependsOnId, new Set());
    }
    this.dependents.get(dependsOnId)!.add(moduleId);

    // maintain forward index for O(deg) cleanup
    if (!this.dependenciesOf.has(moduleId)) {
      this.dependenciesOf.set(moduleId, new Set());
    }
    this.dependenciesOf.get(moduleId)!.add(dependsOnId);
  }

  // get number of dependency relationships tracked
  get dependentsCount(): number {
    return this.dependents.size;
  }

  // check if any tracked module depends on moduleId
  // used to protect live dependencies from lru eviction
  hasDependents(moduleId: string): boolean {
    return (this.dependents.get(moduleId)?.size ?? 0) > 0;
  }

  // get number of resolution mappings
  get resolutionsCount(): number {
    return this.resolutionMap.size;
  }

  // remove all resolutionMap entries for moduleId (as parent or target)
  // O(k) via reverse indexes instead of O(n) full scan
  cleanResolutionMapFor(moduleId: string): void {
    // clean entries where moduleId is parent
    for (const key of Array.from(
      this.parentToResolutionKeys.get(moduleId) ?? []
    )) {
      this.deleteResolutionKey(key);
    }

    // clean entries where moduleId is target
    for (const key of Array.from(
      this.targetToResolutionKeys.get(moduleId) ?? []
    )) {
      this.deleteResolutionKey(key);
    }
  }

  // remove module from the dependents sets it appears in & delete its own entry
  // O(deg) via forward index instead of O(n) full scan
  cleanDependentsFor(moduleId: string): void {
    // remove this module's entry as a dependency target
    this.dependents.delete(moduleId);

    // remove this module from the dependent sets of modules it depends on
    const dependencies = this.dependenciesOf.get(moduleId);
    if (dependencies) {
      for (const dependsOnId of dependencies) {
        this.dependents.get(dependsOnId)?.delete(moduleId);
      }
      this.dependenciesOf.delete(moduleId);
    }
  }

  // collect all modules that transitively depend on the given module
  // & clean up all tracking metadata for those modules
  // return a Set of all module IDs that were invalidated
  invalidateWithDependents(
    moduleId: string,
    canRetainResolutionTarget: (targetId: string) => boolean
  ): Set<string> {
    const invalidated = new Set<string>();
    const queue = [moduleId];

    // first pass: collect all modules to invalidate
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (invalidated.has(current)) {
        continue;
      }

      invalidated.add(current);

      // queue all modules that depend on this one
      const deps = this.dependents.get(current);
      if (deps) {
        for (const dep of deps) {
          if (!invalidated.has(dep)) {
            queue.push(dep);
          }
        }
      }
    }

    // remove graph edges before retaining stable request identities
    for (const id of invalidated) {
      this.cleanDependentsFor(id);
    }

    for (const parentId of invalidated) {
      for (const key of Array.from(
        this.parentToResolutionKeys.get(parentId) ?? []
      )) {
        const targetId = this.resolutionMap.get(key);
        if (
          targetId !== undefined &&
          !invalidated.has(targetId) &&
          canRetainResolutionTarget(targetId)
        ) {
          continue;
        }
        this.deleteResolutionKey(key);
      }
    }

    // invalidated targets must never remain usable as reload hints
    for (const targetId of invalidated) {
      for (const key of Array.from(
        this.targetToResolutionKeys.get(targetId) ?? []
      )) {
        this.deleteResolutionKey(key);
      }
    }

    return invalidated;
  }

  // clear the dependency graph (but keep resolution map)
  clearDependencies(): void {
    this.dependents.clear();
    this.dependenciesOf.clear();
  }

  // clear all tracking data
  clear(): void {
    this.resolutionMap.clear();
    this.parentToResolutionKeys.clear();
    this.targetToResolutionKeys.clear();
    this.dependents.clear();
    this.dependenciesOf.clear();
  }

  // get statistics for debugging/monitoring
  getStats(): { resolutions: number; dependents: number } {
    return {
      resolutions: this.resolutionMap.size,
      dependents: this.dependents.size,
    };
  }
}
