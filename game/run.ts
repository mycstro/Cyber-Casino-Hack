/** Owns asynchronous gameplay work; elapsed time stops while menus are open. */
export class GameRun {
  paused = false;
  private disposed = false;
  private pending = new Set<() => void>();

  get active() {return !this.disposed;}

  wait(milliseconds: number): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    return new Promise(resolve => {
      let remaining = milliseconds;
      let last = performance.now();
      let timer: ReturnType<typeof setTimeout>;
      const finish = (ok: boolean) => {
        clearTimeout(timer);
        this.pending.delete(cancel);
        resolve(ok);
      };
      const cancel = () => finish(false);
      const tick = () => {
        const now = performance.now();
        if (!this.paused) remaining -= now - last;
        last = now;
        if (remaining <= 0) finish(true);
        else timer = setTimeout(tick, Math.min(20, remaining));
      };
      this.pending.add(cancel);
      timer = setTimeout(tick, Math.min(20, remaining));
    });
  }

  dispose() {
    this.disposed = true;
    for (const cancel of [...this.pending]) cancel();
  }
}
