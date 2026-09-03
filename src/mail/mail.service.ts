import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS, // App Password
      },
    });
  }

  async sendPasswordResetEmail(to: string, resetToken: string, role: 'ADMIN' | 'STUDENT') {
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:3001';
    
    // We can point both to the same reset-password page, or separate ones if needed.
    // Let's use a unified /reset-password page for now.
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}&role=${role}`;

    const mailOptions = {
      from: `"Hulu Track" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e4;">
          <h2 style="color: #0a0a0a;">Password Reset Request</h2>
          <p style="color: #4a4a4a; line-height: 1.5;">
            We received a request to reset the password for your Hulu Track account.
            If you made this request, please click the button below to choose a new password:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #0a0a0a; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #878786; font-size: 12px; text-align: center; margin-top: 40px;">
            If you did not request a password reset, you can safely ignore this email. This link will expire in 1 hour.
          </p>
        </div>
      `,
    };

    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        this.logger.warn('SMTP credentials not configured! Logging reset link to console instead:');
        this.logger.warn(`RESET LINK FOR ${to}: ${resetLink}`);
        return;
      }
      
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent to ${to}: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}`, error);
      throw new Error('Failed to send email. Please try again later.');
    }
  }
}
