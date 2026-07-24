jest.mock('nodemailer');

describe('utils/email', () => {
  const ORIGINAL_ENV = { ...process.env };
  let sendMailMock;
  let verifyMock;
  let email;

  beforeEach(() => {
    // jest.resetModules() means the *next* require('nodemailer') (done
    // internally by utils/email below) returns a fresh mock instance,
    // distinct from any reference grabbed before this call — nodemailer
    // must be re-required here too, not just utils/email, or mutations
    // below configure a stale, disconnected copy.
    jest.resetModules();
    sendMailMock = jest.fn();
    verifyMock = jest.fn();
    const nodemailer = require('nodemailer');
    nodemailer.createTransport = jest.fn(() => ({ sendMail: sendMailMock, verify: verifyMock }));
    email = require('../utils/email');
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('with no SMTP configured', () => {
    beforeEach(() => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
    });

    it('logs to console and reports delivered: false without touching nodemailer', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const result = await email.sendMail({ to: 'a@example.com', subject: 'Hi', text: 'Body' });

      expect(result).toEqual({ delivered: false, reason: 'no-smtp-configured' });
      expect(sendMailMock).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('console-fallback'));
      logSpy.mockRestore();
    });

    it('verifySmtpConnection returns null (not false) when nothing is configured', async () => {
      const result = await email.verifySmtpConnection();
      expect(result).toBeNull();
    });
  });

  describe('with SMTP configured', () => {
    beforeEach(() => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';
      process.env.SMTP_PORT = '587';
    });

    it('sends via nodemailer and reports the messageId on success', async () => {
      sendMailMock.mockResolvedValue({ messageId: '<abc123@example.com>', response: '250 OK' });
      const result = await email.sendMail({ to: 'a@example.com', subject: 'Hi', text: 'Body' });

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'a@example.com', subject: 'Hi' })
      );
      expect(result).toEqual({ delivered: true, messageId: '<abc123@example.com>' });
    });

    it('never throws when the SMTP send itself fails, and reports the error instead', async () => {
      sendMailMock.mockRejectedValue(new Error('Connection refused'));
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await email.sendMail({ to: 'a@example.com', subject: 'Hi', text: 'Body' });

      expect(result).toEqual({ delivered: false, reason: 'send-error', error: 'Connection refused' });
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Connection refused'));
      errSpy.mockRestore();
    });

    it('verifySmtpConnection reports ok: true when the provider accepts the connection', async () => {
      verifyMock.mockResolvedValue(true);
      const result = await email.verifySmtpConnection();
      expect(result).toEqual({ ok: true });
    });

    it('verifySmtpConnection reports ok: false with the error when auth/connection fails', async () => {
      verifyMock.mockRejectedValue(new Error('535 Authentication failed'));
      const result = await email.verifySmtpConnection();
      expect(result).toEqual({ ok: false, error: '535 Authentication failed' });
    });
  });
});
