import "dotenv/config";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// ---------------------
// Send Password Reset OTP
// ---------------------
export const sendResetEmail = async (email: string, otp: number) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <body style="font-family: Arial, sans-serif; background-color: #f0f2f5; padding: 20px;">
      <div style="max-width: 600px; margin: auto; background: #fff; padding: 30px; border-radius: 8px; text-align: center;">
        <h2 style="color: #333;">Password Reset OTP</h2>
        <p style="font-size: 16px; color: #555;">Your OTP code is:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #4CAF50; margin: 20px 0;">
          ${otp}
        </p>
        <p style="font-size: 14px; color: #999;">This OTP is valid for 10 minutes.</p>
      </div>
    </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: "AltCare <noreply@altcare.site>",
      to: email,
      subject: "Reset Password OTP",
      html,
    });

    console.log("✅ Password reset email sent to:", email);
    return { success: true };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw error;
  }
};

// ---------------------
// Send Patient Verification OTP
// ---------------------
export const sendUserEmail = async (email: string, otp: number) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <body style="font-family: Arial, sans-serif; background-color: #f0f2f5; padding: 20px;">
      <div style="max-width: 600px; margin: auto; background: #fff; padding: 30px; border-radius: 8px; text-align: center;">
        <h2 style="color: #333;">Verify Your Account</h2>
        <p style="font-size: 16px; color: #555;">Use the OTP below to verify your account:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #4CAF50; margin: 20px 0;">
          ${otp}
        </p>
        <p style="font-size: 14px; color: #999;">This OTP is valid for 10 minutes.</p>
      </div>
    </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: "AltCare <noreply@altcare.site>",
      to: email,
      subject: "Verify Your Account",
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw error;
  }
};

export const sendWelcome = async (email: string) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <body style="font-family: Arial, sans-serif; background-color: #f0f2f5; padding: 20px;">
      <div style="max-width: 600px; margin: auto; background: #fff; padding: 30px; border-radius: 8px; text-align: center;">
        <h2 style="color: #333;">Welcome</h2>
        <p style="font-size: 16px; color: #555;">Welcome to our E-commerce web app. we are glad you are here.</p>
      </div>
    </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: "E-commerce <noreply@e-commerce.site>",
      to: email,
      subject: "Welcome",
      html,
    });

    // return { success: true };
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw error;
  }
};
