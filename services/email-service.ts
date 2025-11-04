import sgMail from '@sendgrid/mail';
import { config } from '../config.js';

// Initialize SendGrid with API key
sgMail.setApiKey(config.sendgrid.apiKey);

interface OrderData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    name: string;
    quantity: number;
    price: string | number;
  }>;
  subtotal: string | number;
  deliveryCharge: string | number;
  discountAmount: string | number;
  total: string | number;
  paymentMethod: string;
  deliveryAddress: string;
  estimatedDeliveryDate: string;
}

export class EmailService {
  private formatPrice(price: string | number): string {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numPrice);
  }

  private formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  async sendOrderConfirmationEmail(orderData: OrderData): Promise<boolean> {
    try {
      console.log('[EMAIL] Sending order confirmation to:', orderData.customerEmail);

      const itemsHtml = orderData.items.map(item => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px; text-align: left;">${item.name}</td>
          <td style="padding: 12px; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; text-align: right;">${this.formatPrice(item.price)}</td>
        </tr>
      `).join('');

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Confirmation - Flower School Bengaluru</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); color: white; padding: 30px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Order Confirmation</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Thank you for your order!</p>
            </div>

            <!-- Content -->
            <div style="padding: 30px 20px;">
              
              <!-- Success Message -->
              <div style="background-color: #d1fae5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
                <div style="display: flex; align-items: center;">
                  <span style="color: #059669; font-size: 20px; margin-right: 8px;">✅</span>
                  <div>
                    <h3 style="margin: 0; color: #047857; font-size: 18px;">Payment Successful!</h3>
                    <p style="margin: 4px 0 0 0; color: #065f46;">Your order has been confirmed and is being processed.</p>
                  </div>
                </div>
              </div>

              <!-- Order Details -->
              <div style="margin-bottom: 24px;">
                <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 20px;">Order Details</h2>
                <div style="background-color: #f9fafb; border-radius: 6px; padding: 16px;">
                  <p style="margin: 0 0 8px 0;"><strong>Order Number:</strong> ${orderData.orderNumber}</p>
                  <p style="margin: 0 0 8px 0;"><strong>Customer:</strong> ${orderData.customerName}</p>
                  <p style="margin: 0 0 8px 0;"><strong>Payment Method:</strong> ${orderData.paymentMethod}</p>
                  <p style="margin: 0;"><strong>Estimated Delivery:</strong> ${this.formatDate(orderData.estimatedDeliveryDate)}</p>
                </div>
              </div>

              <!-- Order Items -->
              <div style="margin-bottom: 24px;">
                <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 20px;">Order Items</h2>
                <table style="width: 100%; border-collapse: collapse; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
                  <thead>
                    <tr style="background-color: #f9fafb;">
                      <th style="padding: 12px; text-align: left; color: #374151; font-weight: 600;">Item</th>
                      <th style="padding: 12px; text-align: center; color: #374151; font-weight: 600;">Qty</th>
                      <th style="padding: 12px; text-align: right; color: #374151; font-weight: 600;">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                </table>
              </div>

              <!-- Order Summary -->
              <div style="margin-bottom: 24px;">
                <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 20px;">Order Summary</h2>
                <div style="background-color: #f9fafb; border-radius: 6px; padding: 16px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Subtotal:</span>
                    <span>${this.formatPrice(orderData.subtotal)}</span>
                  </div>
                  ${parseFloat(orderData.discountAmount.toString()) > 0 ? `
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #059669;">
                    <span>Discount:</span>
                    <span>-${this.formatPrice(orderData.discountAmount)}</span>
                  </div>
                  ` : ''}
                  <hr style="border: none; border-top: 1px solid #d1d5db; margin: 12px 0;">
                  <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; color: #1f2937;">
                    <span>Total:</span>
                    <span>${this.formatPrice(orderData.total)}</span>
                  </div>
                </div>
              </div>

              <!-- Delivery Address -->
              <div style="margin-bottom: 24px;">
                <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 20px;">Delivery Address</h2>
                <div style="background-color: #f9fafb; border-radius: 6px; padding: 16px;">
                  <p style="margin: 0; color: #374151; line-height: 1.6;">${orderData.deliveryAddress}</p>
                </div>
              </div>

              <!-- Footer Message -->
              <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 16px; text-align: center;">
                <h3 style="margin: 0 0 8px 0; color: #92400e;">What's Next?</h3>
                <p style="margin: 0; color: #78350f; font-size: 14px;">
                  We'll send you updates as your order is prepared and shipped. 
                  For any questions, contact us at ${config.sendgrid.fromEmail}
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
                Thank you for choosing Flower School Bengaluru!
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                This is an automated email. Please do not reply to this message.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const emailText = `
Order Confirmation - Flower School Bengaluru

Dear ${orderData.customerName},

Thank you for your order! Your payment has been processed successfully.

Order Details:
- Order Number: ${orderData.orderNumber}
- Payment Method: ${orderData.paymentMethod}
- Estimated Delivery: ${this.formatDate(orderData.estimatedDeliveryDate)}

Order Items:
${orderData.items.map(item => `- ${item.name} (Qty: ${item.quantity}) - ${this.formatPrice(item.price)}`).join('\n')}

Order Summary:
- Subtotal: ${this.formatPrice(orderData.subtotal)}
${parseFloat(orderData.discountAmount.toString()) > 0 ? `- Discount: -${this.formatPrice(orderData.discountAmount)}\n` : ''}
- Total: ${this.formatPrice(orderData.total)}

Delivery Address:
${orderData.deliveryAddress}

We'll send you updates as your order is prepared and shipped.

Thank you for choosing Flower School Bengaluru!

For any questions, contact us at ${config.sendgrid.fromEmail}
      `;

      const msg = {
        to: orderData.customerEmail,
        from: {
          email: config.sendgrid.fromEmail,
          name: 'Flower School Bengaluru'
        },
        subject: `Order Confirmation - ${orderData.orderNumber}`,
        text: emailText,
        html: emailHtml,
      };

      await sgMail.send(msg);
      console.log('[EMAIL] Order confirmation email sent successfully to:', orderData.customerEmail);
      return true;

    } catch (error) {
      console.error('[EMAIL] Error sending order confirmation email:', error);
      
      if (error instanceof Error) {
        console.error('[EMAIL] Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      
      // Don't throw error - we don't want email failure to break order processing
      return false;
    }
  }

  async sendTestEmail(toEmail: string): Promise<boolean> {
    try {
      console.log('[EMAIL] Sending test email to:', toEmail);

      const msg = {
        to: toEmail,
        from: {
          email: config.sendgrid.fromEmail,
          name: 'Flower School Bengaluru'
        },
        subject: 'Test Email - Flower School Bengaluru',
        text: 'This is a test email from Flower School Bengaluru e-commerce system.',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #ec4899;">Test Email</h1>
            <p>This is a test email from <strong>Flower School Bengaluru</strong> e-commerce system.</p>
            <p>If you receive this email, the SendGrid integration is working correctly!</p>
            <p>Time sent: ${new Date().toLocaleString()}</p>
          </div>
        `,
      };

      await sgMail.send(msg);
      console.log('[EMAIL] Test email sent successfully to:', toEmail);
      return true;

    } catch (error) {
      console.error('[EMAIL] Error sending test email:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
