export class TaskQueue {
  public isProcessing = false;
  private tasks: (() => Promise<unknown>)[] = [];

  addTask(task: () => Promise<unknown>) {
    this.tasks.push(task);
    if (!this.isProcessing) {
      this.isProcessing = true;
      this.processQueue();
    }
  }

  private async processQueue() {
    while (this.tasks.length > 0) {
      const task = this.tasks.shift();
      if (!task) {
        continue;
      }

      await task();
    }
    this.isProcessing = false;
  }
}
