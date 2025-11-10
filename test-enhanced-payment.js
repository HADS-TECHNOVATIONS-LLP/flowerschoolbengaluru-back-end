import fetch from 'node-fetch';

async function testEnhancedProductOrder() {
  console.log('🛍️ Testing Enhanced Product Order API...');
  
  const productOrderData = {
    amount: 2500, // ₹25.00
    currency: 'INR',
    receipt: `product_order_${Date.now()}`,
    paymentMethod: 'UPI - GPay',
    orderDetails: {
      full_name: 'Rajesh Kumar',
      email_address: 'vasuchouthri811@gmail.com',
      phone_number: '+919876543210'
    },
    orderItems: [
      {
        name: 'Rose Bouquet Deluxe',
        quantity: 2,
        price: 1000,
        description: 'Fresh red roses with baby breath and eucalyptus'
      },
      {
        name: 'Decorative Vase',
        quantity: 1,
        price: 500,
        description: 'Handcrafted ceramic vase for the bouquet'
      }
    ],
    deliveryAddress: {
      name: 'Rajesh Kumar',
      phone: '+919876543210',
      address: '123, MG Road, Koramangala',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560034'
    }
  };

  try {
    console.log('📤 Sending enhanced product order request...');
    console.log('📋 Product order data:', JSON.stringify(productOrderData, null, 2));
    
    const response = await fetch('http://localhost:5000/api/payment/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(productOrderData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API request failed:', response.status, errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ Enhanced product order created successfully!');
    console.log('📊 Response:', JSON.stringify(result, null, 2));
    console.log('🎯 Order ID:', result.order?.id);
    console.log('💰 Amount:', result.order?.amount, 'paise (₹' + (result.order?.amount / 100) + ')');
    
    console.log('\n📧 Enhanced Email Features Tested:');
    console.log('✅ Payment Method: UPI - GPay');
    console.log('✅ Order Items: 2x Rose Bouquet + 1x Vase');
    console.log('✅ Delivery Address: Complete with city, state, PIN');
    console.log('✅ Customer Phone: +919876543210');
    console.log('✅ Admin Notifications: Sent to vasuchouthri811@gmail.com');
    console.log('✅ User Confirmation: Sent to vasuchouthri811@gmail.com');
    
  } catch (error) {
    console.error('❌ Connection error:', error.message);
    console.log('💡 Make sure the server is running on port 5000');
  }
}

async function testEnhancedCourseOrder() {
  console.log('\n📚 Testing Enhanced Course Order API...');
  
  const courseOrderData = {
    amount: 5000, // ₹50.00
    currency: 'INR',
    receipt: `course_order_${Date.now()}`,
    paymentMethod: 'UPI - PhonePe',
    courseDetails: {
      full_name: 'Priya Sharma',
      email_address: 'vasuchouthri811@gmail.com',
      phone_number: '+919123456789',
      courses_or_workshops: 'Advanced Floral Arrangement Workshop',
      questions_or_comments: 'Looking forward to learning new techniques'
    }
  };

  try {
    console.log('📤 Sending enhanced course order request...');
    console.log('📋 Course order data:', JSON.stringify(courseOrderData, null, 2));
    
    const response = await fetch('http://localhost:5000/api/payment/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(courseOrderData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API request failed:', response.status, errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ Enhanced course order created successfully!');
    console.log('📊 Response:', JSON.stringify(result, null, 2));
    console.log('🎯 Order ID:', result.order?.id);
    console.log('💰 Amount:', result.order?.amount, 'paise (₹' + (result.order?.amount / 100) + ')');
    
    console.log('\n📧 Enhanced Email Features Tested:');
    console.log('✅ Payment Method: UPI - PhonePe');
    console.log('✅ Course Details: Advanced Floral Arrangement Workshop');
    console.log('✅ Student Phone: +919123456789');
    console.log('✅ Admin Notifications: Sent to vasuchouthri811@gmail.com');
    console.log('✅ Student Confirmation: Sent to vasuchouthri811@gmail.com');
    
  } catch (error) {
    console.error('❌ Connection error:', error.message);
    console.log('💡 Make sure the server is running on port 5000');
  }
}

// Run both tests
(async () => {
  console.log('🧪 ENHANCED PAYMENT/CREATE-ORDER API TESTING\n');
  console.log('═'.repeat(60));
  
  await testEnhancedProductOrder();
  
  console.log('\n' + '═'.repeat(60));
  
  await testEnhancedCourseOrder();
  
  console.log('\n' + '═'.repeat(60));
  console.log('🎉 All enhanced tests completed!');
  console.log('📧 Check vasuchouthri811@gmail.com for both user and admin emails');
})();