interface UploadTask {
  id: string;
  file: File;
  onProgress: (progress: number) => void;
  onSuccess: (result: any) => void;
  onError: (error: Error) => void;
}

interface ConcurrentUploadManagerOptions {
  maxConcurrent: number;
  retryAttempts: number;
  retryDelay: number;
}

export class ConcurrentUploadManager {
  private queue: UploadTask[] = [];
  private active: Set<string> = new Set();
  private completed: Set<string> = new Set();
  private failed: Set<string> = new Set();
  private options: ConcurrentUploadManagerOptions;

  constructor(options: Partial<ConcurrentUploadManagerOptions> = {}) {
    this.options = {
      maxConcurrent: options.maxConcurrent || 3,
      retryAttempts: options.retryAttempts || 2,
      retryDelay: options.retryDelay || 1000,
    };
  }

  async addTask(task: UploadTask): Promise<void> {
    this.queue.push(task);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.active.size < this.options.maxConcurrent) {
      const task = this.queue.shift();
      if (!task) break;

      this.active.add(task.id);
      this.uploadWithRetry(task);
    }
  }

  private async uploadWithRetry(task: UploadTask, attempt: number = 0): Promise<void> {
    try {
      await this.uploadSingle(task);
      this.completed.add(task.id);
      this.active.delete(task.id);
      this.processQueue(); // Process next item in queue
    } catch (error) {
      if (attempt < this.options.retryAttempts) {
        console.log(`Upload failed for ${task.file.name}, retrying in ${this.options.retryDelay}ms (attempt ${attempt + 1}/${this.options.retryAttempts})`);
        setTimeout(() => {
          this.uploadWithRetry(task, attempt + 1);
        }, this.options.retryDelay);
      } else {
        console.error(`Upload failed permanently for ${task.file.name}:`, error);
        this.failed.add(task.id);
        this.active.delete(task.id);
        task.onError(error as Error);
        this.processQueue(); // Process next item in queue
      }
    }
  }

  private async uploadSingle(task: UploadTask): Promise<void> {
    // This will be implemented to call the actual upload API
    // For now, we'll simulate the upload process
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', task.file);
      
      // Simulate upload progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 100) {
          progress = 100;
          clearInterval(progressInterval);
          task.onSuccess({ id: Math.random(), filename: task.file.name });
          resolve();
        }
        task.onProgress(progress);
      }, 100);
    });
  }

  getStats() {
    return {
      total: this.queue.length + this.active.size + this.completed.size + this.failed.size,
      queued: this.queue.length,
      active: this.active.size,
      completed: this.completed.size,
      failed: this.failed.size,
    };
  }

  isComplete(): boolean {
    return this.queue.length === 0 && this.active.size === 0;
  }
}

