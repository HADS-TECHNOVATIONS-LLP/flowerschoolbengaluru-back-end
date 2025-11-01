import { NotificationResult } from './notification-service';

interface QueuedMessage {
  id: string;
  phone: string;
  message: string;
  type: 'whatsapp' | 'sms';
  retries: number;
  lastAttempt?: Date;
  nextRetry?: Date;
}

export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private processing: boolean = false;
  private maxRetries: number = 3;
  private retryDelays: number[] = [30000, 60000, 300000]; 

  constructor(private sendMessage: (phone: string, message: string, type: 'whatsapp' | 'sms') => Promise<NotificationResult>) {}

  async enqueue(phone: string, message: string, type: 'whatsapp' | 'sms'): Promise<string> {
    const id = Math.random().toString(36).substring(7);
    this.queue.push({
      id,
      phone,
      message,
      type,
      retries: 0
    });

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }

    return id;
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const now = new Date();
      const message = this.queue[0];

      // Skip messages that are scheduled for retry later
      if (message.nextRetry && message.nextRetry > now) {
        this.queue.push(this.queue.shift()!); // Move to end of queue
        continue;
      }

      try {
        console.log(`[QUEUE] Processing ${message.type} message to ${message.phone}`);
        const result = await this.sendMessage(message.phone, message.message, message.type);

        if (result.success) {
          // Message sent successfully, remove from queue
          this.queue.shift();
          console.log(`[QUEUE] Successfully sent ${message.type} message ${message.id}`);
        } else {
          console.log(`[QUEUE] Failed to send ${message.type} message ${message.id}: ${result.error}`);
          message.retries++;
          message.lastAttempt = new Date();

          if (message.retries >= this.maxRetries) {
            // Max retries reached, remove from queue
            console.error(`[QUEUE] Max retries reached for ${message.type} message ${message.id}`);
            this.queue.shift();
          } else {
            // Schedule retry
            const delay = this.retryDelays[message.retries - 1] || this.retryDelays[this.retryDelays.length - 1];
            message.nextRetry = new Date(Date.now() + delay);
            this.queue.push(this.queue.shift()!); // Move to end of queue
          }
        }
      } catch (error) {
        console.error(`[QUEUE] Error processing ${message.type} message ${message.id}:`, error);
        message.retries++;
        message.lastAttempt = new Date();

        if (message.retries >= this.maxRetries) {
          this.queue.shift();
        } else {
          const delay = this.retryDelays[message.retries - 1] || this.retryDelays[this.retryDelays.length - 1];
          message.nextRetry = new Date(Date.now() + delay);
          this.queue.push(this.queue.shift()!);
        }
      }

      // Add a small delay between messages to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.processing = false;
  }

  getQueueStatus(): { queued: number; processing: boolean } {
    return {
      queued: this.queue.length,
      processing: this.processing
    };
  }
}