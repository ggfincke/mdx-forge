// src/browser/internal/semaphore.ts
// async semaphore for concurrency limiting
// ! cross-repo duplicate: vsc-mdx-preview/packages/runtime-utils/src/async/semaphore.ts
// ! changes here must be mirrored (GPL licensing prevents shared dependency)

export class Semaphore {
  private permits: number;
  private waitQueue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise((resolve) => this.waitQueue.push(resolve));
  }

  release(): void {
    const next = this.waitQueue.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }
}
