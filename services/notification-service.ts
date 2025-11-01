import twilio from "twilio";
import { type Order } from "../shared/schema.js";
import { MessageQueue } from "./message-queue.js";
import { config } from "../config.js";

interface OrderNotificationData {
  orderNumber: string;
  customerName: string;
  phone: string;
  total: string;
  estimatedDeliveryDate?: Date;
  items: Array<{
    name: string;
    quantity: number;
    price: string;
  }>;
  deliveryAddress: string;
  paymentMethod: string;
  paymentStatus: string;
}

import { getSMSOrderConfirmationTemplate } from "../templates/sms-templates.js";
import { getWhatsAppOrderConfirmationTemplate } from "../templates/whatsapp-templates.js";

export interface NotificationResult {
  success: boolean;
  channel: 'sms' | 'whatsapp';
  messageId?: string;
  error?: string;
}

export class NotificationService {
  private twilioClient: twilio.Twilio | undefined;
  private whatsappFromNumber: string;
  private smsFromNumber: string;
  private messageQueue: MessageQueue;

  /**
   * Mask phone number for privacy-safe logging
   */
  private maskPhoneNumber(phone: string): string {
    if (!phone || phone.length < 7) return '***';
    // For +91XXXXXXXXXX, show +91******last4
    if (phone.startsWith('+91') && phone.length === 13) {
      return `+91******${phone.slice(-4)}`;
    }
    // For other formats, show first 3 and last 4 with stars in between
    if (phone.length >= 7) {
      return `${phone.slice(0, 3)}******${phone.slice(-4)}`;
    }
    return '***';
  }

  constructor() {
    // Initialize message queue with bound send function
    this.messageQueue = new MessageQueue(this.sendRawMessage.bind(this));
    
    console.log('[NOTIFICATION] Initializing notification service...');
    
    // Check if Twilio credentials are properly configured
    const accountSid = config.twilio.accountSid;
    const authToken = config.twilio.authToken;
    console.log('[NOTIFICATION] Twilio Config:',config )

    if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
      console.error('[NOTIFICATION] Twilio credentials missing or invalid:', {
        hasSid: !!accountSid,
        hasToken: !!authToken,
        isValidSid: accountSid?.startsWith('AC')
      });
      this.twilioClient = undefined;
      this.whatsappFromNumber = '';
      this.smsFromNumber = '';
      return;
    }

    try {
      console.log('[NOTIFICATION] Initializing Twilio client...');
      this.twilioClient = twilio(accountSid, authToken);
      
      // Twilio WhatsApp Business number configuration
      const rawWhatsAppNumber = config.twilio.whatsapp.fromNumber;
      if (!rawWhatsAppNumber) {
        console.error('[WHATSAPP] No WhatsApp number configured in config');
        throw new Error('WhatsApp number not configured');
      }

      // Format WhatsApp number
      let formattedWhatsAppNumber = rawWhatsAppNumber;
      if (!formattedWhatsAppNumber.startsWith('+')) {
        formattedWhatsAppNumber = `+${formattedWhatsAppNumber}`;
      }
      this.whatsappFromNumber = `whatsapp:${formattedWhatsAppNumber}`;
      
      console.log('[WHATSAPP] Configured with number:', this.maskPhoneNumber(this.whatsappFromNumber));
      
      console.log('[NOTIFICATION] Initialized WhatsApp with number:', this.whatsappFromNumber);
      
      // Twilio SMS number - ensure it's properly formatted with country code
      const rawSmsNumber = config.twilio.sms.fromNumber || config.twilio.sms.phoneNumber || '';
      this.smsFromNumber = rawSmsNumber.startsWith('+') ? rawSmsNumber : (rawSmsNumber ? `+${rawSmsNumber}` : '');
    } catch (error) {
      console.error('[NOTIFICATION] Failed to initialize Twilio client:', error);
      this.twilioClient = undefined;
      this.whatsappFromNumber = '';
      this.smsFromNumber = '';
    }
  }

  /**
   * Validate and format phone number for Indian market
   */
  private formatPhoneNumber(phone: string): string | null {
    if (!phone) return null;

    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // Extract only digits for validation
    const digitsOnly = cleaned.replace(/\D/g, '');
    
    // Handle Indian numbers - mobile numbers start with 6, 7, 8, or 9
    if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) {
      // Indian mobile number without country code
      return `+91${digitsOnly}`;
    } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91') && /^91[6-9]/.test(digitsOnly)) {
      // Indian number with country code (91XXXXXXXXXX)
      return `+${digitsOnly}`;
    } else if (phone.startsWith('+91') && digitsOnly.length === 12 && /^91[6-9]/.test(digitsOnly)) {
      // Already formatted Indian number (+91XXXXXXXXXX)
      console.log('[PHONE] Using properly formatted number:', phone);
      return phone;
    } else if (phone.startsWith('+') && digitsOnly.length >= 10) {
      // International number with + prefix
      console.log('[PHONE] Using international number:', cleaned);
      return cleaned;
    }
    
    console.log('[PHONE] Invalid phone number format:', phone);
    return null;
    
    return null;
  }

  /**
   * Extract phone number from order data
   */
  private extractPhoneFromOrder(order: Order): string | null {
    // Try to get phone from the order's phone field first
    if (order.phone) {
      return this.formatPhoneNumber(order.phone);
    }
    
    // Try to extract from delivery address if it contains phone info
    if (order.deliveryAddress) {
      // Look for phone patterns in delivery address string
      const phoneMatch = order.deliveryAddress.match(/\+?[\d\s\-\(\)]{10,}/);
      if (phoneMatch) {
        return this.formatPhoneNumber(phoneMatch[0]);
      }
    }
    
    return null;
  }

  /**
   * Prepare order notification data from order object
   */
  private prepareOrderNotificationData(order: Order): OrderNotificationData | null {
    const phone = this.extractPhoneFromOrder(order);
    if (!phone) {
      console.error(`[NOTIFICATION] No valid phone number found for order: ${order.orderNumber}`);
      return null;
    }

    // Parse items from order.items jsonb field
    const orderItems = Array.isArray(order.items) ? order.items : [];
    
    return {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      phone,
      total: `₹${parseFloat(order.total).toLocaleString('en-IN')}`,
      estimatedDeliveryDate: order.estimatedDeliveryDate || undefined,
      items: orderItems.map((item: any) => ({
        name: item.name || 'Unknown Item',
        quantity: item.quantity || 1,
        price: `₹${parseFloat(item.price || '0').toLocaleString('en-IN')}`
      })),
      deliveryAddress: order.deliveryAddress || 'Address not provided',
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus || 'pending'
    };
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(notificationData: OrderNotificationData): Promise<NotificationResult> {
    try {
      if (!this.twilioClient || !this.smsFromNumber) {
        console.log(`[SMS] Skipping SMS for order ${notificationData.orderNumber} - Twilio not configured`);
        return {
          success: false,
          channel: 'sms',
          error: 'SMS notifications not configured'
        };
      }


      // Use the new template as requested by the user
      // Template:
      // Thank you for choosing Bouquet Bar, Bengaluru.
      // Dear {customerName}, your order #{orderNumber} has been successfully placed, with a total amount of ₹{totalAmount}.
      // We appreciate your business and look forward to serving you again.

      // Ensure correct data mapping
  const orderNumber = notificationData.orderNumber || '';
  const customerName = notificationData.customerName || '';
      // Remove any currency symbol from total if present, then add ₹
      let totalAmount = notificationData.total;
      if (typeof totalAmount === 'string') {
        totalAmount = totalAmount.replace(/[^\d.]/g, '');
      }
      totalAmount = `₹${Number(totalAmount).toLocaleString('en-IN')}`;

      const messageBody = `Thank you for choosing Bouquet Bar, Bengaluru.\n\nDear ${customerName}, your order #${orderNumber} has been successfully placed, with a total amount of ${totalAmount}.\n\nWe appreciate your business and look forward to serving you again.`;
      const formattedPhone = notificationData.phone.startsWith('+') ? notificationData.phone : `+${notificationData.phone}`;

      console.log(`[SMS] Queueing order confirmation to ${this.maskPhoneNumber(notificationData.phone)} for order ${orderNumber}`);

      // Add message to queue instead of sending directly
      const messageId = await this.messageQueue.enqueue(
        formattedPhone,
        messageBody,
        'sms'
      );

      console.log(`[SMS] Message queued successfully. Order: ${notificationData.orderNumber}, Queue ID: ${messageId}`);
      
      return {
        success: true,
        channel: 'sms',
        messageId: messageId
      };
    } catch (error) {
      console.error(`[SMS] Failed to send SMS for order ${notificationData.orderNumber}:`, error instanceof Error ? error.message : 'Unknown SMS error');
      return {
        success: false,
        channel: 'sms',
        error: error instanceof Error ? error.message : 'Unknown SMS error'
      };
    }
  }

  /**
   * Send WhatsApp notification
   */
  private async sendWhatsAppWithMedia(notificationData: OrderNotificationData, mediaUrl?: string): Promise<NotificationResult> {
    try {
      if (!this.twilioClient || !this.whatsappFromNumber) {
        console.log(`[WHATSAPP] Skipping WhatsApp for order ${notificationData.orderNumber} - Twilio not configured`);
        return {
          success: false,
          channel: 'whatsapp',
          error: 'WhatsApp notifications not configured'
        };
      }

      const messageBody = getWhatsAppOrderConfirmationTemplate(notificationData);
      const formattedPhone = notificationData.phone.startsWith('+') ? notificationData.phone : `+${notificationData.phone}`;
      
      console.log(`[WHATSAPP] Sending WhatsApp message to ${this.maskPhoneNumber(notificationData.phone)} for order ${notificationData.orderNumber}`);
      
      // Send WhatsApp message directly through Twilio for immediate delivery
      return await this.sendRawWhatsApp(formattedPhone, messageBody, mediaUrl);
    } catch (error) {
      console.error(`[WHATSAPP] Failed to send WhatsApp message for order ${notificationData.orderNumber}:`, error instanceof Error ? error.message : 'Unknown WhatsApp error');
      return {
        success: false,
        channel: 'whatsapp',
        error: error instanceof Error ? error.message : 'Unknown WhatsApp error'
      };
    }
  }

  /**
   * Send order confirmation notifications via multiple channels
   */
  async sendOrderConfirmation(order: Order, mediaUrls?: { whatsapp?: string }): Promise<{
    sms: NotificationResult;
    whatsapp: NotificationResult;
    notificationData: OrderNotificationData | null;
  }> {
    const notificationData = this.prepareOrderNotificationData(order);
    
    if (!notificationData) {
      const errorResult: NotificationResult = {
        success: false,
        channel: 'sms',
        error: 'No valid phone number found in order'
      };
      
      return {
        sms: errorResult,
        whatsapp: { ...errorResult, channel: 'whatsapp' },
        notificationData: null
      };
    }

    console.log(`[NOTIFICATION] Sending order confirmation for ${order} to ${this.maskPhoneNumber(notificationData.phone)}`);

    // Send both SMS and WhatsApp in parallel for better performance
    const [smsResult, whatsappResult] = await Promise.all([
      this.sendSMS(notificationData),
      this.sendWhatsAppWithMedia(notificationData, mediaUrls?.whatsapp)
    ]);

    // Log results
    if (smsResult.success) {
      console.log(`[NOTIFICATION] SMS sent successfully for order ${order.orderNumber}, SID: ${smsResult.messageId}`);
    } else {
      console.error(`[NOTIFICATION] SMS failed for order ${order.orderNumber}:`, smsResult.error);
    }

    if (whatsappResult.success) {
      console.log(`[NOTIFICATION] WhatsApp sent successfully for order ${order.orderNumber}, SID: ${whatsappResult.messageId}`);
    } else {
      console.error(`[NOTIFICATION] WhatsApp failed for order ${order.orderNumber}:`, whatsappResult.error);
    }

    return {
      sms: smsResult,
      whatsapp: whatsappResult,
      notificationData
    };
  }

  /**
   * Send SMS only (fallback option)
   */
  async sendSMSOnly(order: Order): Promise<NotificationResult> {
    const notificationData = this.prepareOrderNotificationData(order);
    
    if (!notificationData) {
      return {
        success: false,
        channel: 'sms',
        error: 'No valid phone number found in order'
      };
    }

    return await this.sendSMS(notificationData);
  }

  /**
   * Send WhatsApp only
   */
  async sendWhatsAppOnly(order: Order): Promise<NotificationResult> {
    const notificationData = this.prepareOrderNotificationData(order);
    
    if (!notificationData) {
      return {
        success: false,
        channel: 'whatsapp',
        error: 'No valid phone number found in order'
      };
    }

    return await this.sendWhatsAppWithMedia(notificationData);
  }

  /**
   * Send raw SMS message
   */
  private async sendRawSMS(phone: string, message: string): Promise<NotificationResult> {
    try {
      if (!this.twilioClient || !this.smsFromNumber) {
        console.log(`[SMS] Skipping SMS to ${this.maskPhoneNumber(phone)} - Twilio not configured`);
        return {
          success: false,
          channel: 'sms',
          error: 'SMS notifications not configured'
        };
      }

      console.log(`[SMS] Sending message to ${this.maskPhoneNumber(phone)}`);
      
      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.smsFromNumber,
        to: phone
      });

      console.log(`[SMS] Message sent successfully. SID: ${result.sid}`);
      
      return {
        success: true,
        channel: 'sms',
        messageId: result.sid
      };
    } catch (error) {
      console.error(`[SMS] Failed to send SMS:`, error instanceof Error ? error.message : 'Unknown SMS error');
      return {
        success: false,
        channel: 'sms',
        error: error instanceof Error ? error.message : 'Unknown SMS error'
      };
    }
  }

  /**
   * Generic message sender for the queue
   */
  private async sendRawMessage(phone: string, message: string, type: 'whatsapp' | 'sms'): Promise<NotificationResult> {
    if (type === 'whatsapp') {
      return this.sendRawWhatsApp(phone, message);
    } else {
      return this.sendRawSMS(phone, message);
    }
  }

  /**
   * Send raw WhatsApp message
   */
  private async sendRawWhatsApp(phone: string, message: string, mediaUrl?: string): Promise<NotificationResult> {
    try {
      // 1. Validate Twilio configuration
      console.log('[WHATSAPP] Checking Twilio configuration...');
      if (!this.twilioClient || !this.whatsappFromNumber) {
        const error = {
          hasClient: !!this.twilioClient,
          whatsappNumber: this.whatsappFromNumber,
          accountSid: config.twilio.accountSid?.substring(0, 8) + '...',
          error: 'WhatsApp configuration incomplete'
        };
        console.error(`[WHATSAPP] Configuration Error:`, error);
        return {
          success: false,
          channel: 'whatsapp',
          error: 'WhatsApp notifications not configured properly'
        };
      }

      // 2. Format phone number for WhatsApp
      console.log('[WHATSAPP] Processing phone number:', this.maskPhoneNumber(phone));
      let formattedPhone = phone.trim();
      
      // Remove any existing WhatsApp: prefix if present
      formattedPhone = formattedPhone.replace(/^whatsapp:/, '');
      
      // Ensure proper country code format for Indian numbers
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone.replace(/^91/, '');
      }
      if (!formattedPhone.startsWith('+91')) {
        formattedPhone = '+91' + formattedPhone.replace(/^\+/, '');
      }

      // Validate the final format
      if (!/^\+91[6-9]\d{9}$/.test(formattedPhone)) {
        console.error('[WHATSAPP] Invalid phone number format after processing:', this.maskPhoneNumber(formattedPhone));
        throw new Error('Invalid phone number format for WhatsApp');
      }
      
      console.log('[WHATSAPP] Formatted phone number:', this.maskPhoneNumber(formattedPhone));
      
      // 3. Format WhatsApp number
      const whatsappTo = `whatsapp:${formattedPhone}`;
      const whatsappFrom = this.whatsappFromNumber.startsWith('whatsapp:') 
        ? this.whatsappFromNumber 
        : `whatsapp:${this.whatsappFromNumber}`;
      
      console.log('[WHATSAPP] Sending configuration:', {
        to: this.maskPhoneNumber(whatsappTo),
        from: this.maskPhoneNumber(whatsappFrom),
        messageLength: message.length,
        hasMedia: !!mediaUrl
      });
      
      // 4. Prepare message options with sandbox template format
      // Format message for sandbox requirements
      let formattedMessage = message;
      
      // Add template prefix if not already present
      if (!message.startsWith('Your ') && 
          !message.startsWith('Thank you') && 
          !message.startsWith('Hello') && 
          !message.startsWith('Hi')) {
        formattedMessage = 'Hello! ' + message;
      }

      // Add sandbox footer
      formattedMessage += '\n\n_This message was sent from a Twilio Sandbox._';

      const messageOptions: any = {
        body: formattedMessage,
        from: whatsappFrom,
        to: whatsappTo
      };

      // Add media if provided
      if (mediaUrl) {
        messageOptions.mediaUrl = mediaUrl;
      }
      
      console.log('[WHATSAPP] Sandbox Configuration:', {
        isSandbox: true,
        sandboxNumber: '+14155238886',
        twilioConfigured: !!this.twilioClient,
        hasFromNumber: !!this.whatsappFromNumber,
        messageLength: formattedMessage.length,
        fromNumber: this.maskPhoneNumber(whatsappFrom),
        toNumber: this.maskPhoneNumber(whatsappTo)
      });
      
      console.log('[WHATSAPP] Attempting to send message...');
      
      try {
        // 5. Send the message
        console.log('[WHATSAPP] Calling Twilio API...');
        const result = await this.twilioClient.messages.create(messageOptions);
        
        // 6. Log detailed response
        console.log('[WHATSAPP] Message sent successfully:', {
          sid: result.sid,
          status: result.status,
          direction: result.direction,
          timestamp: new Date().toISOString()
        });

        // 7. Additional status checks
        if (result.status === 'failed' || result.errorCode) {
          console.error('[WHATSAPP] Message status indicates failure:', {
            status: result.status,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage
          });
          throw new Error(`Twilio Error: ${result.errorMessage || 'Unknown error'}`);
        }

        // 8. Success case
        console.log('[WHATSAPP] Message delivered successfully');
        return {
          success: true,
          channel: 'whatsapp',
          messageId: result.sid
        };
      } catch (twilioError) {
        // 9. Handle Twilio specific errors
        const errorDetails = {
          message: twilioError instanceof Error ? twilioError.message : 'Unknown error',
          code: (twilioError as any)?.code,
          moreInfo: (twilioError as any)?.moreInfo,
          statusCode: (twilioError as any)?.statusCode
        };
        
        console.error('[WHATSAPP] Twilio API Error:', errorDetails);
        
        // 10. Provide specific error guidance
        let errorMessage = 'Failed to send WhatsApp message';
        if (errorDetails.code === 63018) {
          errorMessage = 'Invalid WhatsApp number. Make sure the customer has opted in to the WhatsApp sandbox.';
        } else if (errorDetails.code === 63016) {
          errorMessage = 'Customer needs to join the WhatsApp sandbox first.';
        }
        
        return {
          success: false,
          channel: 'whatsapp',
          error: errorMessage
        };
      }
    } catch (error) {
      // 11. General error handling
      console.error('[WHATSAPP] General error in WhatsApp sending:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return {
        success: false,
        channel: 'whatsapp',
        error: error instanceof Error ? error.message : 'Unknown WhatsApp error'
      };
    }
  }

  /**
   * Send order cancellation notification via SMS and WhatsApp
   */
  // Additional phone number for cancellation notifications
  private readonly CANCELLATION_NOTIFICATION_NUMBER = '+919042358932';

  async sendOrderCancellationNotification(data: {
    orderId: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    total: string;
    deliveryAddress: string;
    paymentMethod: string;
    refundAmount?: string;
    refundMethod?: string;
  }): Promise<{
    sms: NotificationResult;
    whatsapp: NotificationResult;
    additionalSms: NotificationResult;
  }> {
    console.log('[CANCELLATION] Processing cancellation notifications for order:', data.orderNumber);
    
    const phone = this.formatPhoneNumber(data.customerPhone);
    
    if (!phone) {
      const errorResult: NotificationResult = {
        success: false,
        channel: 'sms',
        error: 'Invalid phone number format'
      };
      return {
        sms: errorResult,
        whatsapp: { ...errorResult, channel: 'whatsapp' },
        additionalSms: errorResult
      };
    }

    // Import templates dynamically to avoid circular dependencies
    const { getSMSOrderCancellationTemplate } = await import("../templates/sms-templates.js");
    const { getWhatsAppOrderCancellationTemplate } = await import("../templates/whatsapp-templates.js");

    // Generate messages
    const smsMessage = getSMSOrderCancellationTemplate(
      data.orderNumber,
      data.customerName,
      data.total,
      data.deliveryAddress,
      data.paymentMethod,
      data.refundAmount,
      data.refundMethod
    );

    const whatsappMessage = getWhatsAppOrderCancellationTemplate(
      data.orderNumber,
      data.customerName,
      data.total,
      data.deliveryAddress,
      data.paymentMethod,
      data.refundAmount,
      data.refundMethod,
      5 // estimated refund days
    );

    console.log(`[CANCELLATION] Sending notifications to customer (${this.maskPhoneNumber(phone)})`);

    // Send all notifications in parallel for better performance
    const [smsResult, whatsappResult] = await Promise.all([
      this.sendRawSMS(phone, smsMessage),
      this.sendRawWhatsApp(phone, whatsappMessage)
    ]);

    // Send additional SMS to the cancellation notification number
    const additionalSmsResult = await this.sendRawSMS(
      this.CANCELLATION_NOTIFICATION_NUMBER,
      `🚫 ORDER CANCELLED\nOrder: ${data.orderNumber}\nCustomer: ${data.customerName}\nTotal: ₹${data.total}\nPayment: ${data.paymentMethod}\nAddress: ${data.deliveryAddress}`
    );

    // Log results
    if (smsResult.success) {
      console.log(`[CANCELLATION] SMS sent successfully to customer for order ${data.orderNumber}, SID: ${smsResult.messageId}`);
    } else {
      console.error(`[CANCELLATION] SMS failed for order ${data.orderNumber}:`, smsResult.error);
    }

    if (whatsappResult.success) {
      console.log(`[CANCELLATION] WhatsApp sent successfully to customer for order ${data.orderNumber}, SID: ${whatsappResult.messageId}`);
    } else {
      console.error(`[CANCELLATION] WhatsApp failed for order ${data.orderNumber}:`, whatsappResult.error);
    }

    if (additionalSmsResult.success) {
      console.log(`[CANCELLATION] Additional SMS notification sent successfully for order ${data.orderNumber}, SID: ${additionalSmsResult.messageId}`);
    } else {
      console.error(`[CANCELLATION] Additional SMS notification failed for order ${data.orderNumber}:`, additionalSmsResult.error);
    }

    return {
      sms: smsResult,
      whatsapp: whatsappResult,
      additionalSms: additionalSmsResult
    };
  }

  /**
   * Send event enrollment notifications to student and admin
   */
  async sendEventEnrollmentNotifications(params: {
    studentPhone: string;
    studentName: string;
    studentEmail: string;
    eventTitle: string;
    eventDate: string;
    eventTime: string;
    adminPhone: string;
  }): Promise<{
    studentNotification: NotificationResult;
    adminNotification: NotificationResult;
  }> {
    console.log('[EVENT ENROLLMENT] Processing event enrollment notification:', {
      event: params.eventTitle,
      date: params.eventDate,
      time: params.eventTime,
      student: params.studentName,
      studentPhone: this.maskPhoneNumber(params.studentPhone)
    });

    // Validate and format phone numbers
    const studentPhoneFormatted = this.formatPhoneNumber(params.studentPhone);
    const adminPhoneFormatted = this.formatPhoneNumber(params.adminPhone);

    if (!studentPhoneFormatted || !adminPhoneFormatted) {
      const errorResult: NotificationResult = {
        success: false,
        channel: 'whatsapp',
        error: 'Invalid phone number format'
      };

      console.error('[EVENT ENROLLMENT] Invalid phone numbers:', {
        studentPhone: this.maskPhoneNumber(params.studentPhone),
        adminPhone: this.maskPhoneNumber(params.adminPhone),
        studentValid: !!studentPhoneFormatted,
        adminValid: !!adminPhoneFormatted
      });

      return {
        studentNotification: errorResult,
        adminNotification: errorResult
      };
    }

    const studentMessage = `Hello! Thank you for enrolling in ${params.eventTitle}! 🌸\n\n` +
      `Date: ${params.eventDate}\n` +
      `Time: ${params.eventTime}\n\n` +
      'We look forward to seeing you at the event!\n\n' +
      'For any questions, please reach out to us at any time.\n\n' +
      'Welcome to the Bouquet Bar family! 🌸';

    const adminMessage = `Hello! 🌸 New Event Enrollment!\n\n` +
      `Event: ${params.eventTitle}\n` +
      `Date: ${params.eventDate}\n` +
      `Time: ${params.eventTime}\n` +
      `Student: ${params.studentName}\n` +
      `Phone: ${params.studentPhone}\n` +
      `Email: ${params.studentEmail}`;

    console.log('[EVENT ENROLLMENT] Sending notifications...');

    try {
      const [studentResult, adminResult] = await Promise.all([
        this.sendRawWhatsApp(studentPhoneFormatted, studentMessage),
        this.sendRawWhatsApp(adminPhoneFormatted, adminMessage)
      ]);

      // Log results
      if (studentResult.success) {
        console.log(`[EVENT ENROLLMENT] Student notification sent successfully, SID: ${studentResult.messageId}`);
      } else {
        console.error(`[EVENT ENROLLMENT] Student notification failed:`, studentResult.error);
      }

      if (adminResult.success) {
        console.log(`[EVENT ENROLLMENT] Admin notification sent successfully, SID: ${adminResult.messageId}`);
      } else {
        console.error(`[EVENT ENROLLMENT] Admin notification failed:`, adminResult.error);
      }

      return {
        studentNotification: studentResult,
        adminNotification: adminResult
      };
    } catch (error) {
      console.error('[EVENT ENROLLMENT] Error sending notifications:', error);
      const errorResult: NotificationResult = {
        success: false,
        channel: 'whatsapp',
        error: error instanceof Error ? error.message : 'Unknown error sending notifications'
      };
      return {
        studentNotification: errorResult,
        adminNotification: errorResult
      };
    }
  }

  /**
   * Send enrollment notifications to student and admin
   */
  async sendEnrollmentNotifications(params: {
    studentPhone: string;
    studentName: string;
    studentEmail: string;
    courseTitle: string;
    batch: string;
    adminPhone: string;
    questions?: string;
  }): Promise<{
    studentNotification: NotificationResult;
    adminNotification: NotificationResult;
  }> {
    console.log('[ENROLLMENT] Processing enrollment notification:', {
      course: params.courseTitle,
      batch: params.batch,
      student: params.studentName,
      studentPhone: this.maskPhoneNumber(params.studentPhone)
    });

    // Validate and format phone numbers
    const studentPhoneFormatted = this.formatPhoneNumber(params.studentPhone);
    const adminPhoneFormatted = this.formatPhoneNumber(params.adminPhone);

    if (!studentPhoneFormatted || !adminPhoneFormatted) {
      const errorResult: NotificationResult = {
        success: false,
        channel: 'whatsapp',
        error: 'Invalid phone number format'
      };

      console.error('[ENROLLMENT] Invalid phone numbers:', {
        studentPhone: this.maskPhoneNumber(params.studentPhone),
        adminPhone: this.maskPhoneNumber(params.adminPhone),
        studentValid: !!studentPhoneFormatted,
        adminValid: !!adminPhoneFormatted
      });

      return {
        studentNotification: errorResult,
        adminNotification: errorResult
      };
    }

    const studentMessage = `Hello! Thank you for enrolling in ${params.courseTitle}! 🎓\n\n` +
      `Batch: ${params.batch}\n\n` +
      'Our team will contact you shortly with payment details and next steps.\n\n' +
      'For any questions, please reach out to us at any time.\n\n' +
      'Welcome to the Bouquet Bar family! 🌸';

    const adminMessage = `Hello! 🎓 New Course Enrollment!\n\n` +
      `Course: ${params.courseTitle}\n` +
      `Batch: ${params.batch}\n` +
      `Student: ${params.studentName}\n` +
      `Phone: ${params.studentPhone}\n` +
      `Email: ${params.studentEmail}\n` +
      (params.questions ? `\nQuestions: ${params.questions}` : '') +
      '\n\nPlease follow up with payment details.';

    console.log('[ENROLLMENT] Sending notifications...');

    try {
      const [studentResult, adminResult] = await Promise.all([
        this.sendRawWhatsApp(studentPhoneFormatted, studentMessage),
        this.sendRawWhatsApp(adminPhoneFormatted, adminMessage)
      ]);

      // Log results
      if (studentResult.success) {
        console.log(`[ENROLLMENT] Student notification sent successfully, SID: ${studentResult.messageId}`);
      } else {
        console.error(`[ENROLLMENT] Student notification failed:`, studentResult.error);
      }

      if (adminResult.success) {
        console.log(`[ENROLLMENT] Admin notification sent successfully, SID: ${adminResult.messageId}`);
      } else {
        console.error(`[ENROLLMENT] Admin notification failed:`, adminResult.error);
      }

      return {
        studentNotification: studentResult,
        adminNotification: adminResult
      };
    } catch (error) {
      console.error('[ENROLLMENT] Error sending notifications:', error);
      const errorResult: NotificationResult = {
        success: false,
        channel: 'whatsapp',
        error: error instanceof Error ? error.message : 'Unknown error sending notifications'
      };
      return {
        studentNotification: errorResult,
        adminNotification: errorResult
      };
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();