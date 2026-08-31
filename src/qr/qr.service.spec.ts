process.env.SECRET = process.env.SECRET || 'test-secret';

import { Test, TestingModule } from '@nestjs/testing';
import { QrService } from './qr.service';
import { BadRequestException } from '@nestjs/common';

describe('QrService (15-Second Sliding Window)', () => {
  let service: QrService;
  
  beforeEach(async () => {
    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [QrService],
    }).compile();

    service = testingModule.get<QrService>(QrService);
    
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-27T10:00:00.000Z').getTime());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('QR-01: generateQr returns code with encoded timestamp & HMAC signature', () => {
    const sessionId = 'session-123';
    const code = service.generateQr(sessionId);
    
    expect(code).toBeDefined();
    const parts = code.split('.');
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe(sessionId);
    expect(Number(parts[1])).toBeGreaterThan(0); // Timestamp
    expect(parts[2]).toBeDefined(); // HMAC
  });

  it('QR-02: verifyQr handles valid code within 15s window', () => {
    const sessionId = 'session-123';
    const code = service.generateQr(sessionId);
    
    // Advance time by 10 seconds (Valid)
    jest.advanceTimersByTime(10 * 1000);
    
    const isValid = service.verifyQr(code, sessionId);
    expect(isValid).toBe(true);
  });

  it('QR-03: verifyQr rejects code older than 15s window', () => {
    const sessionId = 'session-123';
    const code = service.generateQr(sessionId);
    
    // Advance time by 16 seconds (Expired)
    jest.advanceTimersByTime(16 * 1000);
    
    expect(() => service.verifyQr(code, sessionId)).toThrow(BadRequestException);
    expect(() => service.verifyQr(code, sessionId)).toThrow('QR code expired');
  });

  it('QR-04: verifyQr rejects modified signature', () => {
    const sessionId = 'session-123';
    const code = service.generateQr(sessionId);
    
    const parts = code.split('.');
    const tamperedCode = `${parts[0]}.${parts[1]}.INVALID_SIGNATURE_TAMPERED`;
    
    expect(() => service.verifyQr(tamperedCode, sessionId)).toThrow(BadRequestException);
    expect(() => service.verifyQr(tamperedCode, sessionId)).toThrow('Invalid QR signature');
  });
});

describe('QrService (Static Student Badge)', () => {
  let service: QrService;
  const studentId = 'student-999';

  beforeEach(() => {
    service = new QrService();
  });

  it('QR-STATIC-01: generateStudentQr returns cryptographically signed static badge', () => {
    const code = service.generateStudentQr(studentId);
    expect(code).toBeDefined();
    
    const parts = code.split('.');
    expect(parts.length).toBe(2);
    expect(parts[0]).toBe(studentId);
    expect(parts[1]).toBeDefined(); // HMAC signature
  });

  it('QR-STATIC-02: verifyStudentQr correctly validates authentic badges and rejects forged ones', () => {
    const validCode = service.generateStudentQr(studentId);
    const isValid = service.verifyStudentQr(validCode);
    expect(isValid).toBe(studentId);

    const tamperedCode = `${studentId}.TAMPERED_HASH`;
    expect(() => service.verifyStudentQr(tamperedCode)).toThrow(BadRequestException);
    expect(() => service.verifyStudentQr(tamperedCode)).toThrow('Invalid Student Badge signature');

    const malformedCode = `just_a_string`;
    expect(() => service.verifyStudentQr(malformedCode)).toThrow(BadRequestException);
  });
});
