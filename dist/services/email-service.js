import sgMail from '@sendgrid/mail';
import { config } from '../config.js';
// Initialize SendGrid with API key
sgMail.setApiKey(config.sendgrid.apiKey);
export class EmailService {
    formatPrice(price) {
        const numPrice = typeof price === 'string' ? parseFloat(price) : price;
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(numPrice);
    }
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }
    async sendOrderConfirmationEmail(orderData) {
        try {
            console.log('[EMAIL] Sending order confirmation to:', orderData.customerEmail);
            console.log('[EMAIL] Full order data:', JSON.stringify(orderData, null, 2));
            console.log('[EMAIL] Items array:', orderData.items);
            console.log('[EMAIL] Items count:', orderData.items?.length || 0);
            const itemsHtml = orderData.items.map(item => {
                const productName = item.name || item.productName || 'Product';
                const quantity = Number(item.quantity || 1);
                // Show all items that have a product name, even if it's 'Product'
                console.log('[EMAIL DEBUG] Processing item:', { productName, quantity, originalItem: item });
                return `
        <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 15px;">
          ${item.image ? `<div style="text-align: center; margin-bottom: 10px;"><img src="${item.image}" alt="${productName}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0;"></div>` : ''}
          <div>
            <p style="margin: 0 0 8px 0; font-size: 16px;"><strong>${productName}</strong></p>
            <p style="margin: 0 0 5px 0; color: #666; font-size: 14px;">
              Quantity: ${quantity}
            </p>
            ${item.description ? `<p style="margin: 5px 0 5px 0; color: #666; font-size: 13px;">${item.description}</p>` : ''}
            ${item.color ? `<p style="margin: 5px 0 5px 0; color: #666; font-size: 13px;"><strong>Color:</strong> ${item.color}</p>` : ''}
          </div>
        </div>
        `;
            }).join('');
            console.log('[EMAIL DEBUG] Generated itemsHtml length:', itemsHtml.length);
            console.log('[EMAIL DEBUG] Items array:', orderData.items);
            const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Confirmation - Bouquet Bar Bengaluru</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); color: white; padding: 30px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #ec4899;">🌸 Bouquet Bar Bengaluru</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; color: #10b981;">Order Confirmation</p>
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
                <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 20px;">📋 Order Details</h2>
                <div style="background-color: #f9fafb; border-radius: 6px; padding: 16px;">
                  <p style="margin: 0 0 8px 0;"><strong>Order Number:</strong> ${orderData.orderNumber}</p>
                  <p style="margin: 0 0 8px 0;"><strong>Customer:</strong> ${orderData.customerName}</p>
                  <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${orderData.customerEmail}</p>
                  ${orderData.customerPhone ? `<p style="margin: 0 0 8px 0;"><strong>Phone:</strong> ${orderData.customerPhone}</p>` : ''}
                  ${orderData.paymentMethod && orderData.paymentMethod !== 'Not specified' ? `<p style="margin: 0 0 8px 0;"><strong>Payment Method:</strong> ${orderData.paymentMethod}</p>` : ''}
                  <p style="margin: 0;"><strong>Estimated Delivery:</strong> ${this.formatDate(orderData.estimatedDeliveryDate)}</p>
                </div>
              </div>

              <!-- Order Items -->
              <div style="margin-bottom: 24px;">
                <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 20px;">🛍️ Order Items</h2>
                <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px;">
                  ${itemsHtml || `
                    <div style="text-align: center; color: #666; font-style: italic;">
                      <p>Order items will be updated shortly.</p>
                      <p style="font-size: 12px; margin-top: 8px;">Items: ${orderData.items?.length || 0} product(s)</p>
                    </div>
                  `}
                </div>
              </div>

              <!-- Order Summary -->
              <div style="margin-bottom: 24px;">
                <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 20px;">💰 Order Summary</h2>
                <div style="background-color: #f9fafb; border-radius: 6px; padding: 16px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Price:</span>
                    <span>${this.formatPrice(orderData.subtotal || 0)}</span>
                  </div>
                  ${orderData.deliveryCharge && Number(orderData.deliveryCharge) > 0 ? `
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Delivery Charge:</span>
                    <span>${this.formatPrice(orderData.deliveryCharge)}</span>
                  </div>
                  ` : ''}
                  ${orderData.paymentCharges && Number(orderData.paymentCharges) > 0 ? `
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Payment Charges:</span>
                    <span>${this.formatPrice(orderData.paymentCharges)}</span>
                  </div>
                  ` : ''}
                  ${orderData.discountAmount && Number(orderData.discountAmount) > 0 ? `
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #059669;">
                    <span>Discount:</span>
                    <span>-${this.formatPrice(orderData.discountAmount)}</span>
                  </div>
                  ` : ''}
                  <hr style="border: none; border-top: 1px solid #d1d5db; margin: 12px 0;">
                  
                </div>
              </div>

              <!-- Delivery Address -->
              ${orderData.deliveryAddress && orderData.deliveryAddress !== 'Address not provided' ? `
              <div style="margin-bottom: 24px;">
                <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 20px;">🏠 Delivery Address</h2>
                <div style="background-color: #f9fafb; border-radius: 6px; padding: 16px;">
                  <p style="margin: 0; color: #374151; line-height: 1.6;">${orderData.deliveryAddress}</p>
                </div>
              </div>
              ` : ''}

              <!-- Footer Message -->
              <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 16px; text-align: center;">
                <h3 style="margin: 0 0 8px 0; color: #92400e;">What's Next?</h3>
                <p style="margin: 0; color: #78350f; font-size: 14px;">
                  We'll send you updates as your order is prepared and shipped. 
                  For any questions, contact us at ${config.sendgrid.fromEmail} or call +91 99728 03847
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #ec4899; font-size: 14px; font-weight: bold;">
                Thank you for choosing Bouquet Bar Bengaluru! 🌸
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
Order Confirmation - Bouquet Bar Bengaluru

Dear ${orderData.customerName},

Thank you for your order! Your payment has been processed successfully.

Order Details:
- Order Number: ${orderData.orderNumber}
${orderData.paymentMethod && orderData.paymentMethod !== 'Not specified' ? `- Payment Method: ${orderData.paymentMethod}\n` : ''}
- Estimated Delivery: ${this.formatDate(orderData.estimatedDeliveryDate)}

Order Items:
${orderData.items.map(item => {
                const productName = item.name || item.productName || 'Product';
                const quantity = Number(item.quantity || 1);
                return `- ${productName} (Quantity: ${quantity})`;
            }).join('\n')}

Order Summary:
- Subtotal: ${this.formatPrice(orderData.subtotal)}
${orderData.deliveryCharge && Number(orderData.deliveryCharge) > 0 ? `- Delivery Charge: ${this.formatPrice(orderData.deliveryCharge)}\n` : ''}${orderData.paymentCharges && Number(orderData.paymentCharges) > 0 ? `- Payment Charges: ${this.formatPrice(orderData.paymentCharges)}\n` : ''}${orderData.discountAmount && Number(orderData.discountAmount) > 0 ? `- Discount: -${this.formatPrice(orderData.discountAmount)}\n` : ''}- Total: ${this.formatPrice(orderData.total)}

${orderData.deliveryAddress && orderData.deliveryAddress !== 'Address not provided' ? `Delivery Address:\n${orderData.deliveryAddress}\n\n` : ''}
We'll send you updates as your order is prepared and shipped.

Thank you for choosing Bouquet Bar Bengaluru!

For any questions, contact us at ${config.sendgrid.fromEmail}
      `;
            const msg = {
                to: orderData.customerEmail,
                from: {
                    email: config.sendgrid.fromEmail,
                    name: 'Bouquet Bar Bengaluru'
                },
                subject: `Order Confirmation - ${orderData.orderNumber}`,
                text: emailText,
                html: emailHtml,
            };
            await sgMail.send(msg);
            console.log('[EMAIL] Order confirmation email sent successfully to:', orderData.customerEmail);
            return true;
        }
        catch (error) {
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
    async sendTestEmail(toEmail) {
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
        }
        catch (error) {
            console.error('[EMAIL] Error sending test email:', error);
            return false;
        }
    }
}
export const emailService = new EmailService();
