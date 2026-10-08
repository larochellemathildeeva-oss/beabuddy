/** A mounted workflow can retry confirmed writes without repeating them.
 * This is not server-side idempotency: an ambiguous network failure still
 * needs reconciliation, and checkpoints do not survive a page reload.
 */
export class SaveAttempt {
  private completed = new Map<string, unknown>();
  private running: Promise<void> | null = null;
  private task: (() => Promise<void>) | null = null;

  get hasConfirmedWrites(): boolean {
    return this.completed.size > 0;
  }

  async step<T>(key: string, write: () => Promise<T>): Promise<T> {
    if (this.completed.has(key)) return this.completed.get(key) as T;
    const result = await write();
    this.completed.set(key, result);
    return result;
  }

  run(task: () => Promise<void>): Promise<void> {
    if (this.running) return this.running;
    // Keep the original reviewed payload and callbacks on every retry.
    this.task ??= task;
    this.running = Promise.resolve()
      .then(this.task)
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }
}
