import { emailService } from './dist/services/email-service.js';

// Test order data matching your exact API response
const testOrderData = {
  orderNumber: "ORD-04c29f67",
  customerName: "sivaranjani.v@hadstechnovations.com",
  customerEmail: "sivaranjani.v@hadstechnovations.com",
  customerPhone: "+918754201900",
  items: [
    {
      quantity: 1,
      productId: "68ae7a81-5a8a-412f-8543-9257506e5772",
      unitPrice: 2,
      totalPrice: 2,
      productName: "Mixed Roses"
    }
  ],
  total: "7",
  deliveryAddress: "Delivery address here",
  subtotal: "2",
  deliveryCharge: "0",
  discountAmount: "0",
  paymentMethod: "Card",
  paymentCharges: "5",
  estimatedDeliveryDate: "2025-11-09T08:09:27.493Z"
};

async function testEmail() {
  console.log('Testing email template with exact order data...');
  console.log('Order data:', JSON.stringify(testOrderData, null, 2));
  
  try {
    const result = await emailService.sendOrderConfirmationEmail(testOrderData);
    console.log('Email sent successfully:', result);
  } catch (error) {
    console.error('Email test failed:', error);
  }
}

testEmail();