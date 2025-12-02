// Order Status Update Email Template

export function getOrderStatusEmailTemplate({
  orderNumber,
  customerName,
  status,
  estimatedDeliveryDate,
  deliveryAddress,
  items,
  total
}: {
  orderNumber: string;
  customerName: string;
  status: string;
  estimatedDeliveryDate?: string;
  deliveryAddress?: string;
  items: Array<{ productName?: string; quantity: number }>;
  total: string | number;
}) {
  const statusMessages: Record<string, string> = {
    confirmed: 'Your order has been confirmed and is being prepared.',
    processing: 'Your order is being prepared by our florists.',
    shipped: 'Your order is out for delivery!',
    delivered: 'Your order has been delivered successfully!',
    cancelled: 'Your order has been cancelled.'
  };
  const statusMessage = statusMessages[status] || `Order status: ${status}`;
  const itemsHtml = items.map(item =>
    `<li>${item.productName || 'Product'} (Quantity: ${item.quantity})</li>`
  ).join('');
  return {
    subject: `Order ${orderNumber} Status Update: ${status}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ec4899;">Order Status Update</h2>
        <p>Hi ${customerName},</p>
        <p>${statusMessage}</p>
        <h3>Order Details</h3>
        <ul>
          <li><strong>Order Number:</strong> ${orderNumber}</li>
          ${estimatedDeliveryDate ? `<li><strong>Estimated Delivery:</strong> ${estimatedDeliveryDate}</li>` : ''}
          ${deliveryAddress ? `<li><strong>Delivery Address:</strong> ${deliveryAddress}</li>` : ''}
          <li><strong>Total:</strong> ₹${total}</li>
        </ul>
        <h3>Items</h3>
        <ul>${itemsHtml}</ul>
        <p>Thank you for shopping with Bouquet Bar Bengaluru!</p>
      </div>
    `,
    text: `Hi ${customerName},\n${statusMessage}\nOrder Number: ${orderNumber}\n${estimatedDeliveryDate ? `Estimated Delivery: ${estimatedDeliveryDate}\n` : ''}${deliveryAddress ? `Delivery Address: ${deliveryAddress}\n` : ''}Total: ₹${total}\nItems:\n${items.map(item => `- ${item.productName || 'Product'} (Quantity: ${item.quantity})`).join('\n')}\nThank you for shopping with Bouquet Bar Bengaluru!`
  };
}
