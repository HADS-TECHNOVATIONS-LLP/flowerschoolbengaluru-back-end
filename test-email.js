import sgMail from '@sendgrid/mail';

// Use the SendGrid API key directly
const API_KEY = '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';
sgMail.setApiKey(API_KEY);

async function testEmail() {
  console.log('🧪 Testing SendGrid Email Configuration...');
  console.log('📧 API Key configured:', API_KEY ? 'Yes (length: ' + API_KEY.length + ')' : 'No');
  console.log('📨 From email: info@flowerschoolbengaluru.com');
  console.log('📬 To email: info@flowerschoolbengaluru.com');
  
  const msg = {
    to: 'info@flowerschoolbengaluru.com',
    from: {
      email: 'info@flowerschoolbengaluru.com',
      name: 'Flower School Bengaluru'
    },
    subject: '🧪 Test Email - Flower School Bengaluru',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Test Email</title>
      </head>
      <body style="margin: 0; padding: 20px; background-color: #f3f4f6; font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 16px rgba(15,23,42,0.06);">
          <div style="padding: 28px 32px; text-align: center; background: linear-gradient(90deg, #fee2e2 0%, #fca5a5 100%);">
            <h1 style="margin: 0; color: #0f172a; font-size: 22px;">🧪 Email Test</h1>
            <p style="margin: 8px 0 0 0; color: #334155; font-size: 13px;">Flower School Bengaluru</p>
          </div>
          
          <div style="padding: 20px 32px;">
            <h3 style="margin: 0 0 10px 0; color:#0b1220; font-size:16px;">✅ Email Configuration Test</h3>
            <p style="margin: 0; color:#334155; line-height:1.6;">
              This is a test email to verify that the SendGrid email configuration is working correctly.
              If you receive this email, the email system is functioning properly.
            </p>
            
            <div style="background-color: #f8fafc; padding: 14px; border-radius: 6px; border: 1px solid #e2e8f0; margin: 18px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Test Date:</strong> ${new Date().toLocaleString()}</p>
              <p style="margin: 0 0 8px 0;"><strong>API Key Status:</strong> Configured</p>
              <p style="margin: 0;"><strong>From Email:</strong> info@flowerschoolbengaluru.com</p>
            </div>
            
            <div style="text-align:center; margin-top: 20px;">
              <p style="margin:0; font-size:14px; color:#475569;">
                <strong>Email system is working! 🎉</strong>
              </p>
            </div>
          </div>
          
          <div style="background:#f8fafc; padding:12px 20px; text-align:center; font-size:12px; color:#6b7280;">
            <div>Flower School Bengaluru - Email Test 🌸</div>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    console.log('⏳ Sending test email...');
    const response = await sgMail.send(msg);
    console.log('✅ Email sent successfully!');
    console.log('📊 Response status:', response[0].statusCode);
    console.log('📋 Response headers:', JSON.stringify(response[0].headers, null, 2));
    console.log('🔗 Message ID:', response[0].headers['x-message-id']);
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📋 Headers:', error.response.headers);
      console.error('📄 Body:', error.response.body);
    }
  }
}

testEmail();