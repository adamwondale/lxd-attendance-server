import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class QrService {
  private readonly secret = process.env.SECRET || 'fallback-secret-for-dev';

  generateQr(cohortId: string, sessionId?: string): string {
    const timestamp = Date.now();
    const data = sessionId
      ? `${cohortId}.${sessionId}.${timestamp}`
      : `${cohortId}.${timestamp}`;
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('hex');

    return `${data}.${signature}`;
  }

  verifyQr(code: string, cohortId: string, expectedSessionId?: string): {
    cohortId: string;
    sessionId?: string;
    timestamp: number;
  } {
    const parts = code.split('.');
    if (parts.length !== 3 && parts.length !== 4) {
      throw new BadRequestException('Invalid QR code format');
    }

    const hasSession = parts.length === 4;
    const extractedCohortId = parts[0];
    const extractedSessionId = hasSession ? parts[1] : undefined;
    const timestampStr = hasSession ? parts[2] : parts[1];
    const signature = hasSession ? parts[3] : parts[2];
    const timestamp = parseInt(timestampStr, 10);

    if (extractedCohortId !== cohortId) {
      throw new BadRequestException('Cohort ID mismatch');
    }

    if (expectedSessionId && extractedSessionId !== expectedSessionId) {
      throw new BadRequestException('Session ID mismatch');
    }

    // Verify signature over exactly the payload that was issued.
    const data = hasSession
      ? `${extractedCohortId}.${extractedSessionId}.${timestamp}`
      : `${extractedCohortId}.${timestamp}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new BadRequestException('Invalid QR signature');
    }

    // Verify the same 20-second sliding window used by the projector.
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 0 || diff > 20000) {
      throw new BadRequestException('QR code expired');
    }

    return {
      cohortId: extractedCohortId,
      sessionId: extractedSessionId,
      timestamp,
    };
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
