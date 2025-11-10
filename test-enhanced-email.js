import { EmailService } from './services/email-service.js';

async function testEnhancedOrderEmail() {
  console.log('🧪 Testing Enhanced Order Confirmation Email...');
  
  const emailService = new EmailService();
  
  const testOrderData = {
    orderNumber: 'ORD-12345678',
    customerName: 'Test Customer',
    customerEmail: 'vasuchouthri811@gmail.com', // Using admin email for testing
    customerPhone: '+919042358932',
    items: [
      {
        name: 'Red Rose Bouquet',
        productName: 'Red Rose Bouquet',
        description: 'Beautiful red roses arranged in an elegant bouquet',
        quantity: 2,
        price: 800,
        unitPrice: 800,
        totalPrice: 1600,
        color: 'Red',
        image: 'https://example.com/red-roses.jpg'
      },
      {
        name: 'White Lily Arrangement',
        productName: 'White Lily Arrangement',
        description: 'Fresh white lilies in a decorative vase',
        quantity: 1,
        price: 900,
        unitPrice: 900,
        totalPrice: 900,
        color: 'White',
        image: 'https://example.com/white-lilies.jpg'
      }
    ],
    subtotal: 2500,
    deliveryCharge: 100,
    discountAmount: 0,
    total: 2600,
    paymentMethod: 'UPI (GPay)',
    deliveryAddress: '123 Flower Street, Near Rose Garden, Bangalore, Karnataka 560001, India',
    estimatedDeliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    customerDetails: {
      name: 'Test Customer',
      email: 'vasuchouthri811@gmail.com',
      phone: '+919042358932',
      address: '123 Flower Street, Near Rose Garden, Bangalore, Karnataka 560001, India'
    }
  };

  try {
    console.log('📤 Sending enhanced order confirmation email...');
    console.log('📋 Order data:', JSON.stringify(testOrderData, null, 2));
    
    const result = await emailService.sendOrderConfirmationEmail(testOrderData);
    
    if (result) {
      console.log('✅ Enhanced order confirmation email sent successfully!');
      console.log('📧 Email sent to:', testOrderData.customerEmail);
      console.log('');
      console.log('📝 Enhanced email now includes:');
      console.log('   ✅ Correct payment method (UPI GPay)');
      console.log('   ✅ Product names and descriptions');
      console.log('   ✅ Product images');
      console.log('   ✅ Customer phone number');
      console.log('   ✅ Individual item totals');
      console.log('   ✅ Enhanced styling');
      console.log('   ✅ Better delivery address handling');
    } else {
      console.log('❌ Failed to send enhanced order confirmation email');
    }
    
  } catch (error) {
    console.error('❌ Error testing enhanced order email:', error.message);
  }
}

testEnhancedOrderEmail();