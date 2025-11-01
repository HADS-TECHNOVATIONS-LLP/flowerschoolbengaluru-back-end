import { type OrderNotificationData } from "../shared/schema";

/**
 * Generate SMS order confirmation message
 */
export function getSMSOrderConfirmationTemplate(data: OrderNotificationData): string {
  const deliveryDate = data.estimatedDeliveryDate 
    ? new Date(data.estimatedDeliveryDate).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      })
    : 'within 2-3 days';

  // Create item summary (limit to 2-3 items for SMS length)
  let itemSummary = '';
  const displayItems = data.items.slice(0, 2);
  if (displayItems.length > 0) {
    itemSummary = displayItems.map((item: any) => 
      `${item.quantity}x ${item.name}`
    ).join(', ');
    
    if (data.items.length > 2) {
      itemSummary += ` & ${data.items.length - 2} more item${data.items.length > 3 ? 's' : ''}`;
    }
  }

  // Payment status message
  const paymentMsg = data.paymentStatus === 'completed' 
    ? 'Payment confirmed' 
    : `Payment: ${data.paymentMethod}`;

  return `🌹 Order ${data.orderNumber} confirmed! Total: ₹${data.total}. ${data.paymentMethod} payment. Delivery: ${deliveryDate}. Address: ${data.deliveryAddress}. Thanks! -Bouquet Bar`;
}

/**
 * Generate SMS order status update message
 */
export function getSMSStatusUpdateTemplate(
  orderNumber: string,
  status: string,
  customerName: string,
  estimatedDelivery?: Date
): string {
  const statusMessages = {
    confirmed: '✅ Your order has been confirmed and is being prepared.',
    processing: '📦 Your order is being prepared by our florists.',
    shipped: '🚚 Your order is out for delivery!',
    delivered: '🎉 Your order has been delivered successfully!',
    cancelled: '❌ Your order has been cancelled.'
  };

  const statusMessage = statusMessages[status as keyof typeof statusMessages] || `Order status: ${status}`;
  
  let deliveryInfo = '';
  if (status === 'shipped' && estimatedDelivery) {
    const deliveryDate = new Date(estimatedDelivery).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
    deliveryInfo = `\nExpected delivery: ${deliveryDate}`;
  }

  return `🌸 Bouquet Bar Update

Hi ${customerName},

${statusMessage}

Order: ${orderNumber}${deliveryInfo}

Track: wa.me/919876543210
Support: +91-98765-43210`;
}

/**
 * Generate SMS delivery reminder message
 */
export function getSMSDeliveryReminderTemplate(
  orderNumber: string,
  customerName: string,
  deliveryDate: Date,
  deliveryAddress: string
): string {
  const deliveryDateStr = new Date(deliveryDate).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short'
  });

  return `🌸 Delivery Reminder - Bouquet Bar

Hi ${customerName},

Your order ${orderNumber} will be delivered TODAY (${deliveryDateStr}).

Delivery to: ${deliveryAddress}

Please ensure someone is available to receive the flowers.

Support: +91-98765-43210
Track: wa.me/919876543210`;
}

/**
 * Generate SMS payment reminder message
 */
export function getSMSPaymentReminderTemplate(
  orderNumber: string,
  customerName: string,
  amount: string,
  paymentMethod: string
): string {
  return `🌸 Payment Reminder - Bouquet Bar

Hi ${customerName},

Payment pending for order ${orderNumber}
Amount: ${amount}
Method: ${paymentMethod}

Please complete payment to proceed with delivery.

Pay now: wa.me/919876543210
Support: +91-98765-43210`;
}

/**
 * Generate SMS order cancellation message
 */
export function getSMSOrderCancellationTemplate(
  orderNumber: string,
  customerName: string,
  total: string,
  address: string,
  paymentMethod: string,
  refundAmount?: string,
  refundMethod?: string
): string {
  let refundInfo = '';
  if (refundAmount && refundMethod) {
    refundInfo = `\nRefund: ${refundAmount} via ${refundMethod} in 3-5 business days.`;
  }

  return `❌ Order ${orderNumber} cancelled successfully.
Order Total: ₹${total}
Payment Method: ${paymentMethod}
Delivery Address: ${address}${refundInfo}

We're sorry to see you cancel your order. We hope to serve you again soon!

Support: +91-98765-43210
-Bouquet Bar`;
}

/**
 * Generate SMS points awarded message
 */
export function getSMSPointsAwardedTemplate(
  customerName: string,
  pointsAwarded: number,
  totalPoints: number,
  orderNumber: string
): string {
  return `🎉 ${pointsAwarded} points earned!

Hi ${customerName}, you've earned ${pointsAwarded} reward points for order ${orderNumber}.

Total points: ${totalPoints}
Redeem at checkout for discounts!

Shop: wa.me/919876543210
-Bouquet Bar`;
}

/**
 * Generate SMS promotional message template
 */
export function getSMSPromotionalTemplate(
  customerName: string,
  offer: string,
  validUntil: Date,
  couponCode?: string
): string {
  const validDate = new Date(validUntil).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short'
  });

  let couponInfo = '';
  if (couponCode) {
    couponInfo = `\nCode: ${couponCode}`;
  }

  return `🌸 Special Offer - Bouquet Bar

Hi ${customerName},

${offer}${couponInfo}

Valid until: ${validDate}

Shop now: wa.me/919876543210
Call: +91-98765-43210

*T&C Apply`;
}