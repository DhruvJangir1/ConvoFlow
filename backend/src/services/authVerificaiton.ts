import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();
if (!process.env.APP_URL){
  throw new Error('app url not found')
}

const senderEmail = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASSWORD;

const transporter = nodemailer.createTransport({
  service:'gmail',
  port: 587,
  secure: false, 
  auth: { user:senderEmail, pass },
});

function getTransporter() {
  if (transporter) return transporter;
 
  if (!senderEmail || !pass) {
    console.warn('[email] EMAIL_USER or EMAIL_PASSWORD not set — email sending disabled');
    return null;
  }

  const transporterBackUp = nodemailer.createTransport({
    service:'gmail',
    port: 587,
    secure: false, 
    auth: { user:senderEmail, pass },
  });

  return transporterBackUp;
}

const VERIFICATION_EMAIL_HTML = (code: string) => `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 24px; color: #111827; max-width: 600px; margin: 0 auto; border-radius: 8px;">
  <div style="padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; margin-bottom: 24px;">
    <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #4f46e5; letter-spacing: -0.025em;">ConvoFlow</h2>
  </div>
  <div style="background-color: #ffffff; padding: 32px; border-radius: 6px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);">
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; text-align: center; color: #111827;">Verify your email</h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #4b5563; text-align: center;">
      Use the verification code below to secure your account. This code is only valid for the next 15 minutes.
    </p>
    <div style="background-color: #f3f4f6; border-radius: 6px; padding: 16px; text-align: center; margin-bottom: 24px;">
      <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1f2937; padding-left: 6px;">${code}</span>
    </div>
    <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #9ca3af; text-align: center;">
      If you didn't request this verification, you can safely ignore this email.
    </p>
  </div>
  <div style="padding-top: 24px; text-align: center;">
    <p style="margin: 0; font-size: 12px; color: #9ca3af;">&copy; 2026 ConvoFlow. All rights reserved.</p>
  </div>
</div>`;

const FRIEND_REQUEST_EMAIL_HTML = (fromName: string, fromTag: string) => `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 24px; color: #111827; max-width: 600px; margin: 0 auto; border-radius: 8px;">
  <div style="padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; margin-bottom: 24px;">
    <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #4f46e5; letter-spacing: -0.025em;">ConvoFlow</h2>
  </div>
  <div style="background-color: #ffffff; padding: 32px; border-radius: 6px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);">
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; text-align: center; color: #111827;">Friend Request</h1>
    <p style="margin: 0 0 8px 0; font-size: 15px; line-height: 1.5; color: #4b5563; text-align: center;">
      <strong style="color: #111827;">${fromName}</strong> (<span style="font-family: monospace;">${fromTag}</span>) wants to connect with you on ConvoFlow.
    </p>
    <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.5; color: #6b7280; text-align: center;">
      Log in to accept or reject this request.
    </p>
  </div>
  <div style="padding-top: 24px; text-align: center;">
    <p style="margin: 0; font-size: 12px; color: #9ca3af;">&copy; 2026 ConvoFlow. All rights reserved.</p>
  </div>
</div>`;

export async function sendUserVerificationCode(email: string, code: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  console.log('[email] sending verification code');
  try {
    const info = await transporter.sendMail({
      from: senderEmail,
      to: email,
      subject: 'Your ConvoFlow verification code',
      html: VERIFICATION_EMAIL_HTML(code),
    });
   
    console.log("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  } 
  catch (err) {
    console.error("Error while sending mail:", err);
  }
}

export async function sendFriendRequestEmail(fromName: string, fromTag: string, toEmail: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  console.log('[email] sending friend request email');
  try {
    const info = await transporter.sendMail({
      from: senderEmail,
      to: toEmail,
      subject: `${fromName} wants to be your friend on ConvoFlow`,
      html: FRIEND_REQUEST_EMAIL_HTML(fromName, fromTag),
    });

   console.log("Message sent: %s", info.messageId);
   console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  }
  catch (err) {
    console.error("Error while sending mail:", err);
  }
}
