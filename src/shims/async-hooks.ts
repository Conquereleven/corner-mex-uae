// Browser shim for `node:async_hooks`.
// Some TanStack Start internals import AsyncLocalStorage at module top-level,
// which crashes the browser bundle. This shim provides a minimal no-op impl
// so client code can load. It is never used on the server (real node module wins).
export class AsyncLocalStorage<T = unknown> {
  private store: T | undefined;
  run<R>(store: T, fn: (...args: any[]) => R, ...args: any[]): R {
    const prev = this.store;
    this.store = store;
    try { return fn(...args); } finally { this.store = prev; }
  }
  getStore(): T | undefined { return this.store; }
  enterWith(store: T): void { this.store = store; }
  disable(): void { this.store = undefined; }
  exit<R>(fn: (...args: any[]) => R, ...args: any[]): R {
    const prev = this.store; this.store = undefined;
    try { return fn(...args); } finally { this.store = prev; }
  }
}
export default { AsyncLocalStorage };