import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string, role: 'ADMIN' | 'STUDENT') {
    const baseUrl = process.env.CLIENT_URL || 'https://hulu-track.vercel.app';
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}&role=${role}`;

    const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || 'adamsnewcontact@gmail.com';
    const senderName = process.env.BREVO_SENDER_NAME || 'Hulu Track';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset your Hulu Track password</title>
      </head>
      <body style="margin: 0; padding: 40px 16px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);">
          <!-- Header Bar -->
          <div style="background: linear-gradient(135deg, #36AC86 0%, #2A9E80 100%); padding: 28px 32px; text-align: left;">
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.02em;">Hulu Track</h1>
            <p style="margin: 4px 0 0 0; color: rgba(255, 255, 255, 0.85); font-size: 13px;">Attendance & Cohort Management</p>
          </div>

          <!-- Body Content -->
          <div style="padding: 32px;">
            <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 600; letter-spacing: -0.01em;">Password Reset Request</h2>
            <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 1.6;">
              We received a request to reset the password for your Hulu Track account. Click the button below to choose a new secure password:
            </p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetLink}" style="background-color: #36AC86; color: #ffffff; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 15px; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(54, 172, 134, 0.25);">
                Reset Password
              </a>
            </div>

            <p style="margin: 24px 0 0 0; color: #64748b; font-size: 13px; line-height: 1.5;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="margin: 6px 0 0 0; word-break: break-all; font-size: 12px; font-family: monospace; color: #36AC86;">
              <a href="${resetLink}" style="color: #36AC86; text-decoration: underline;">${resetLink}</a>
            </p>

            <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 32px 0 20px 0;" />

            <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
              If you didn't request a password reset, you can safely ignore this email. This link will expire in <strong>1 hour</strong>.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // 1. Try Brevo HTTP API first (Recommended for Render and production)
    if (process.env.BREVO_API_KEY) {
      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': process.env.BREVO_API_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: {
              name: senderName,
              email: senderEmail,
            },
            to: [{ email: to }],
            subject: 'Reset your Hulu Track password',
            htmlContent,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          this.logger.error(`Brevo API returned error (${response.status}): ${errorText}`);
          throw new Error(`Brevo error: ${response.statusText}`);
        }

        const data: any = await response.json();
        this.logger.log(`Password reset email sent via Brevo to ${to}: ${data?.messageId || 'Success'}`);
        return;
      } catch (err: any) {
        this.logger.error(`Failed sending email via Brevo HTTP API: ${err.message}`, err);
        // Fall through to SMTP if configured, or throw
        if (!this.transporter) {
          throw new Error('Failed to send email. Please try again later.');
        }
      }
    }

    // 2. Fallback to Nodemailer SMTP (e.g. for local dev)
    if (this.transporter && process.env.SMTP_USER) {
      try {
        const info = await this.transporter.sendMail({
          from: `"${senderName}" <${process.env.SMTP_USER}>`,
          to,
          subject: 'Reset your Hulu Track password',
          html: htmlContent,
        });
        this.logger.log(`Password reset email sent via SMTP to ${to}: ${info.messageId}`);
        return;
      } catch (error) {
        this.logger.error(`Failed to send password reset email via SMTP to ${to}`, error);
        throw new Error('Failed to send email. Please try again later.');
      }
    }

    // 3. If neither Brevo nor SMTP is configured
    this.logger.warn('Neither BREVO_API_KEY nor SMTP credentials configured! Logging reset link to console:');
    this.logger.warn(`RESET LINK FOR ${to}: ${resetLink}`);
  }
}
