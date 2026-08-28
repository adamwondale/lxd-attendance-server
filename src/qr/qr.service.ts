import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class QrService {
  private readonly secret = 'QtNDNr4Ii0x1Zaqw8geuV1ZE1wxhSqOSMCH9URZIXwS';

  generateQr(sessionId: string): string {
    const timestamp = Date.now();
    const data = `${sessionId}.${timestamp}`;
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('hex');

    return `${data}.${signature}`;
  }

  verifyQr(code: string, sessionId: string): boolean {
    const parts = code.split('.');
    if (parts.length !== 3) {
      throw new BadRequestException('Invalid QR code format');
    }

    const [extractedSessionId, timestampStr, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);

    if (extractedSessionId !== sessionId) {
      throw new BadRequestException('Session ID mismatch');
    }

    // Verify signature
    const data = `${extractedSessionId}.${timestamp}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new BadRequestException('Invalid QR signature');
    }

    // Verify 15-second sliding window
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 0 || diff > 15000) {
      throw new BadRequestException('QR code expired');
    }

    return true;
  }

  generateStudentQr(studentId: string): string {
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(studentId)
      .digest('hex');

    return `${studentId}.${signature}`;
  }

  verifyStudentQr(code: string): string {
    const parts = code.split('.');
    if (parts.length !== 2) {
      throw new BadRequestException('Invalid Student Badge format');
    }

    const [studentId, signature] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(studentId)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new BadRequestException('Invalid Student Badge signature');
    }

    return studentId;
  }
}
