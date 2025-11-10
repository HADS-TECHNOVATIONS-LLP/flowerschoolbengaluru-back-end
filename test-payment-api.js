import fetch from 'node-fetch';

async function testPaymentCreateOrder() {
  console.log('🧪 Testing Payment Create Order API with Email...');
  
  const testData = {
    amount: 1500, // ₹15.00 for testing
    currency: 'INR',
    receipt: `test_receipt_${Date.now()}`,
    notes: {
      test: 'true',
      purpose: 'API testing'
    },
    courseDetails: {
      full_name: 'Test Student',
      email_address: 'vasuchouthri811@gmail.com', // Using the admin email for testing
      phone_number: '+919042358932',
      courses_or_workshops: 'Flower Arrangement Basics',
      questions_or_comments: 'This is a test enrollment via API'
    }
  };

  try {
    console.log('📤 Sending request to payment/create-order API...');
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
    console.log('✅ Payment order created successfully!');
    console.log('📊 Response:', JSON.stringify(result, null, 2));
    console.log('🎯 Order ID:', result.order?.id);
    console.log('💰 Amount:', result.order?.amount);
    console.log('📧 Emails should be sent to:');
    console.log('   - User: vasuchouthri811@gmail.com');
    console.log('   - Admin: vasuchouthri811@gmail.com');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testPaymentCreateOrder();