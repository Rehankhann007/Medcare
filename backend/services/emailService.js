let SibApiV3Sdk = null;
let sdkLoadError = null;
try {
  SibApiV3Sdk = require('@getbrevo/brevo');
} catch (err) {
  sdkLoadError = err;
  console.error('Failed to load @getbrevo/brevo SDK:', err.message);
}

const brevoApiKey = process.env.BREVO_API_KEY;
const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@medcare.com';
const senderName = process.env.BREVO_SENDER_NAME || 'MedCare';

const hasBrevoConfig = Boolean(brevoApiKey) && Boolean(SibApiV3Sdk) && !sdkLoadError;

const getBrevoClient = () => {
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  // Different SDK versions expose the auth object slightly differently.
  // Try the documented v2.x/v3.x patterns, falling back safely.
  if (apiInstance.authentications && apiInstance.authentications['apiKey']) {
    apiInstance.authentications['apiKey'].apiKey = brevoApiKey;
  } else if (apiInstance.authentications && apiInstance.authentications['api-key']) {
    apiInstance.authentications['api-key'].apiKey = brevoApiKey;
  } else if (typeof apiInstance.setApiKey === 'function' && SibApiV3Sdk.TransactionalEmailsApiApiKeys) {
    apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoApiKey);
  } else {
    // Last resort: directly patch the default headers used by the underlying client
    apiInstance.defaultHeaders = { ...(apiInstance.defaultHeaders || {}), 'api-key': brevoApiKey };
  }
  return apiInstance;
};

exports.sendOtpEmail = async (email, otpCode, recipientName = '') => {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; background: #f9fafb; padding: 32px; border-radius: 18px; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#0f172a; margin-bottom: 8px;">MedCare Verification Code</h2>
      <p style="margin:0 0 16px; color:#475569;">
        Hello ${recipientName || 'User'},<br/>
        Use the secure one-time code below to complete your sign-up. It expires in <strong>5 minutes</strong>.
      </p>
      <div style="display:inline-block; padding:18px 32px; border-radius:18px; background:#e0f2fe; color:#0369a1; font-size:30px; letter-spacing:0.3em; font-weight:700;">${otpCode}</div>
      <p style="margin-top:24px; color:#64748b; font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;

  if (!hasBrevoConfig) {
    console.log(`\n========================================`);
    console.log(`[OTP Email - Brevo NOT configured]`);
    console.log(`To: ${email}`);
    console.log(`OTP CODE: ${otpCode}`);
    console.log(`========================================\n`);
    return { success: false, message: 'Brevo API key not configured. OTP logged to console.' };
  }

  try {
    const apiInstance = getBrevoClient();
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = 'Your MedCare OTP Code';
    sendSmtpEmail.htmlContent = htmlContent;
    sendSmtpEmail.sender = { name: senderName, email: senderEmail };
    sendSmtpEmail.to = [{ email, name: recipientName || email }];

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true, message: 'OTP email sent via Brevo.' };
  } catch (error) {
    console.error('Brevo sendOtpEmail error:', error?.response?.text || error.message);
    return { success: false, message: 'Failed to send OTP email via Brevo.' };
  }
};
