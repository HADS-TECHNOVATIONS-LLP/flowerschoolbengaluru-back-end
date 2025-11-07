import { storage } from "../storage.js";
import { notificationService } from "./notification-service.js";
import { getSMSStatusUpdateTemplate } from "../templates/sms-templates.js";
import { getWhatsAppStatusUpdateTemplate } from "../templates/whatsapp-templates.js";
import { config } from "../config.js";
// Define the order status progression rules - Expedited timing: 1 hour after order creation
const statusProgressions = [
    { currentStatus: "pending", nextStatus: "confirmed", progressionTime: 60 }, // 1 hour expedited
    { currentStatus: "confirmed", nextStatus: "processing", progressionTime: 60 },
    { currentStatus: "processing", nextStatus: "shipped", progressionTime: 120 },
    { currentStatus: "shipped", nextStatus: "delivered", progressionTime: 60 }
];
export class BackgroundScheduler {
    constructor() {
        this.timerHandle = null;
        this.interval = 30 * 60 * 1000; // 30 minutes
        this.isRunning = false;
        this.inProgress = false;
        this.lastRun = null;
        this.lastResult = null;
    }
    /**
     * Start running scheduler in background
     */
    start() {
        if (this.timerHandle) {
            return;
        }
        this.processOrderStatusProgression();
        this.timerHandle = setInterval(() => {
            this.processOrderStatusProgression();
        }, this.interval);
    }
    /**
     * Stop the background scheduler
     */
    stop() {
        if (this.timerHandle) {
            clearInterval(this.timerHandle);
            this.timerHandle = null;
        }
        this.isRunning = false;
    }
    /**
     * Check if the scheduler is running
     */
    getStatus() {
        return {
            running: this.isRunning,
            inProgress: this.inProgress,
            nextRun: this.isRunning ? new Date(Date.now() + 30 * 60 * 1000) : undefined,
            lastRun: this.lastRun || undefined,
            lastResult: this.lastResult || undefined
        };
    }
    /**
     * Process order status progression for all eligible orders
     */
    async processOrderStatusProgression() {
        if (this.inProgress)
            return;
        this.inProgress = true;
        this.lastRun = new Date();
        try {
            let totalAdvanced = 0;
            const now = new Date();
            for (const progression of statusProgressions) {
                try {
                    const cutoffDate = new Date(now.getTime() - progression.progressionTime * 60 * 1000);
                    const ordersToAdvance = await storage.listAdvancableOrders(cutoffDate, [progression.currentStatus]);
                    for (const order of ordersToAdvance) {
                        try {
                            // Advance the order status
                            const updatedOrder = await storage.advanceOrderStatus(order.id, progression.nextStatus);
                            // Send status update notification if Twilio is configured
                            if (config.twilio.accountSid && config.twilio.authToken && order.phone) {
                                await this.sendStatusUpdateNotification(updatedOrder, progression.nextStatus);
                            }
                            totalAdvanced++;
                        }
                        catch (error) {
                            continue;
                        }
                    }
                }
                catch (progressionError) {
                    continue;
                }
            }
            this.lastResult = `Advanced ${totalAdvanced} orders`;
        }
        catch (error) {
            this.lastResult = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
        finally {
            this.inProgress = false;
        }
    }
    /**
     * Send status update notification for an order
     */
    async sendStatusUpdateNotification(order, newStatus) {
        try {
            if (!order.phone)
                return;
            const customerName = order.customerName || "Valued Customer";
            // Generate notification messages
            const smsMessage = getSMSStatusUpdateTemplate(order.orderNumber, newStatus, customerName, order.estimatedDeliveryDate);
            const whatsappMessage = getWhatsAppStatusUpdateTemplate(order.orderNumber, newStatus, customerName, undefined, order.estimatedDeliveryDate);
            // Send notifications using the notification service's public methods
            if (notificationService.sendRawSMS) {
                await notificationService.sendRawSMS(order.phone, smsMessage);
            }
            if (notificationService.sendRawWhatsApp) {
                await notificationService.sendRawWhatsApp(order.phone, whatsappMessage);
            }
        }
        catch (error) {
            // Silently fail - notifications are not critical for order progression
        }
    }
    /**
     * Manual trigger for order status progression (useful for testing)
     */
    async triggerStatusProgression() {
        try {
            if (this.inProgress) {
                return { success: false, message: "Scheduler is already running" };
            }
            await this.processOrderStatusProgression();
            return { success: true, message: this.lastResult || "Completed" };
        }
        catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
// Export singleton instance
export const backgroundScheduler = new BackgroundScheduler();
