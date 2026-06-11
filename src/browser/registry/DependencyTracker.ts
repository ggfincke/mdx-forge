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

  // register a resolved path for a (parent, request) pair
  // maintain reverse indexes for O(k) cleanup
  setResolution(parentId: string, request: string, fsPath: string): void {
    const key = this.makeResolutionKey(parentId, request);

    // clean up old target mapping if this key existed
    const oldTarget = this.resolutionMap.get(key);
    if (oldTarget) {
      this.targetToResolutionKeys.get(oldTarget)?.delete(key);
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

  // get number of resolution mappings
  get resolutionsCount(): number {
    return this.resolutionMap.size;
  }

  // remove all resolutionMap entries for moduleId (as parent or target)
  // O(k) via reverse indexes instead of O(n) full scan
  cleanResolutionMapFor(moduleId: string): void {
    // clean entries where moduleId is parent
    const parentKeys = this.parentToResolutionKeys.get(moduleId);
    if (parentKeys) {
      for (const key of parentKeys) {
        const target = this.resolutionMap.get(key);
        if (target) {
          this.targetToResolutionKeys.get(target)?.delete(key);
        }
        this.resolutionMap.delete(key);
      }
      this.parentToResolutionKeys.delete(moduleId);
    }

    // clean entries where moduleId is target
    const targetKeys = this.targetToResolutionKeys.get(moduleId);
    if (targetKeys) {
      for (const key of targetKeys) {
        const parentId = key.split('\0')[0];
        this.parentToResolutionKeys.get(parentId)?.delete(key);
        this.resolutionMap.delete(key);
      }
      this.targetToResolutionKeys.delete(moduleId);
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
  invalidateWithDependents(moduleId: string): Set<string> {
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

    // second pass: clean up all metadata for ALL invalidated modules (batch cleanup)
    for (const id of invalidated) {
      this.cleanDependentsFor(id);
      this.cleanResolutionMapFor(id);
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
