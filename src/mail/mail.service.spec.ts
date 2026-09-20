import { MailService } from './mail.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('MailService', () => {
  let service: MailService;
  let originalEnv: NodeJS.ProcessEnv;
  let mockTransporter: any;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };

    mockTransporter = {
      sendMail: jest.fn(),
    };
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    global.fetch = jest.fn();

    // Silence logger during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create transporter if SMTP_USER and SMTP_PASS are provided', () => {
      process.env.SMTP_USER = 'test_user';
      process.env.SMTP_PASS = 'test_pass';

      service = new MailService();

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: {
            user: 'test_user',
            pass: 'test_pass',
          },
        }),
      );
    });

    it('should not create transporter if SMTP credentials are not provided', () => {
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      service = new MailService();

      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });
  });

  describe('sendPasswordResetEmail', () => {
    const to = 'test@example.com';
    const resetToken = 'dummy-token';
    const role = 'STUDENT';

    beforeEach(() => {
      // Clear env vars that might affect routing
      delete process.env.BREVO_API_KEY;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
    });

    it('should use Brevo API if BREVO_API_KEY is configured and successful', async () => {
      process.env.BREVO_API_KEY = 'test_brevo_key';
      service = new MailService();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ messageId: 'brevo-123' }),
      });

      await service.sendPasswordResetEmail(to, resetToken, role);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.brevo.com/v3/smtp/email',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'api-key': 'test_brevo_key',
          }),
        }),
      );
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should fallback to SMTP if Brevo API fails and SMTP is configured', async () => {
      process.env.BREVO_API_KEY = 'test_brevo_key';
      process.env.SMTP_USER = 'test_user';
      process.env.SMTP_PASS = 'test_pass';
      service = new MailService();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValue('Invalid payload'),
      });

      mockTransporter.sendMail.mockResolvedValue({ messageId: 'smtp-123' });

      await service.sendPasswordResetEmail(to, resetToken, role);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Reset your Hulu Track password',
        }),
      );
    });

    it('should throw an error if Brevo API fails and SMTP is not configured', async () => {
      process.env.BREVO_API_KEY = 'test_brevo_key';
      service = new MailService(); // SMTP not configured

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('Server Error'),
      });

      await expect(service.sendPasswordResetEmail(to, resetToken, role)).rejects.toThrow(
        'Failed to send email. Please try again later.',
      );
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should throw an error if Brevo API throws network error and SMTP is not configured', async () => {
      process.env.BREVO_API_KEY = 'test_brevo_key';
      service = new MailService(); // SMTP not configured

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(service.sendPasswordResetEmail(to, resetToken, role)).rejects.toThrow(
        'Failed to send email. Please try again later.',
      );
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should use SMTP if Brevo API is not configured but SMTP is', async () => {
      process.env.SMTP_USER = 'test_user';
      process.env.SMTP_PASS = 'test_pass';
      service = new MailService();

      mockTransporter.sendMail.mockResolvedValue({ messageId: 'smtp-456' });

      await service.sendPasswordResetEmail(to, resetToken, role);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if SMTP is used but sendMail fails', async () => {
      process.env.SMTP_USER = 'test_user';
      process.env.SMTP_PASS = 'test_pass';
      service = new MailService();

      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(service.sendPasswordResetEmail(to, resetToken, role)).rejects.toThrow(
        'Failed to send email. Please try again later.',
      );

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    });

    it('should log a warning and not throw if neither Brevo nor SMTP is configured', async () => {
      service = new MailService();

      await service.sendPasswordResetEmail(to, resetToken, role);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
      // Test will fail if it throws, which satisfies the requirement that it shouldn't throw
    });
  });
});
