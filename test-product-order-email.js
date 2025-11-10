import fetch from 'node-fetch';

async function testProductOrderWithEmail() {
  console.log('🧪 Testing Product Order Payment API with Enhanced Email...');
  
  const testData = {
    amount: 2500, // ₹25.00 for testing
    currency: 'INR',
    receipt: `product_order_${Date.now()}`,
    notes: {
      test: 'true',
      purpose: 'Product order API testing'
    },
    paymentMethod: 'UPI (GPay)', // Testing payment method display
    orderDetails: {
      name: 'Test Customer',
      email: 'vasuchouthri811@gmail.com', // Using admin email for testing
      phone: '+919042358932'
    },
    deliveryAddress: {
      name: 'Test Customer',
      email: 'vasuchouthri811@gmail.com',
      phone: '+919042358932',
      addressLine1: '123 Flower Street',
      addressLine2: 'Near Rose Garden',
      landmark: 'Opposite Park',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'India'
    },
    orderItems: [
      {
        name: 'Red Rose Bouquet',
        productName: 'Red Rose Bouquet', // Fallback name
        description: 'Beautiful red roses arranged in a elegant bouquet',
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
    ]
  };

  try {
    console.log('📤 Sending product order request to payment/create-order API...');
    console.log('📋 Test data:', JSON.stringify(testData, null, 2));
    
    const response = await fetch('http://localhost:5000/api/payment/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API request failed:', response.status, errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ Product order payment created successfully!');
    console.log('📊 Response:', JSON.stringify(result, null, 2));
    console.log('🎯 Order ID:', result.order?.id);
    console.log('💰 Amount:', result.order?.amount);
    console.log('🛍️ Order Items Count:', testData.orderItems.length);
    console.log('💳 Payment Method:', testData.paymentMethod);
    console.log('📧 Enhanced emails should be sent to:');
    console.log('   - User: vasuchouthri811@gmail.com (with product details, images, address)');
    console.log('   - Admin: vasuchouthri811@gmail.com (with full order information)');
    console.log('');
    console.log('📝 Email should now include:');
    console.log('   ✅ Correct payment method (UPI GPay)');
    console.log('   ✅ Product names and descriptions');
    console.log('   ✅ Product images');
    console.log('   ✅ Customer details (name, email, phone)');
    console.log('   ✅ Delivery address');
    console.log('   ✅ Individual item totals');
    
  } catch (error) {
    console.error('❌ Error testing product order API:', error.message);
  }
}

testProductOrderWithEmail();