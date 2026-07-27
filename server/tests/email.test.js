jest.mock('nodemailer');
jest.mock('resend');

describe('utils/email', () => {
  const ORIGINAL_ENV = { ...process.env };
  let sendMailMock;
  let verifyMock;
  let resendSendMock;
  let resendDomainsListMock;
  let email;

  beforeEach(() => {
    // jest.resetModules() means the *next* require('nodemailer'/'resend')
    // (done internally by utils/email below) returns a fresh mock
    // instance, distinct from any reference grabbed before this call —
    // both must be re-required here too, not just utils/email, or
    // mutations below configure a stale, disconnected copy.
    jest.resetModules();
    sendMailMock = jest.fn();
    verifyMock = jest.fn();
    const nodemailer = require('nodemailer');
    nodemailer.createTransport = jest.fn(() => ({ sendMail: sendMailMock, verify: verifyMock }));

    resendSendMock = jest.fn();
    resendDomainsListMock = jest.fn();
    const { Resend } = require('resend');
    Resend.mockImplementation(() => ({
      emails: { send: resendSendMock },
      domains: { list: resendDomainsListMock },
    }));

    email = require('../utils/email');
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('with no provider configured', () => {
    beforeEach(() => {
      delete process.env.RESEND_API_KEY;
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
      delete process.env.RESEND_API_KEY;
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

  describe('with Resend configured', () => {
    beforeEach(() => {
      process.env.RESEND_API_KEY = 're_test_key';
    });

    it('sends via Resend and reports the message id on success, without touching SMTP', async () => {
      resendSendMock.mockResolvedValue({ data: { id: 'msg_123' }, error: null });
      const result = await email.sendMail({ to: 'a@example.com', subject: 'Hi', text: 'Body' });

      expect(resendSendMock).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'a@example.com', subject: 'Hi' })
      );
      expect(sendMailMock).not.toHaveBeenCalled();
      expect(result).toEqual({ delivered: true, messageId: 'msg_123' });
    });

    it('reports a Resend API error without throwing', async () => {
      resendSendMock.mockResolvedValue({ data: null, error: { message: 'Invalid API key' } });
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await email.sendMail({ to: 'a@example.com', subject: 'Hi', text: 'Body' });

      expect(result).toEqual({ delivered: false, reason: 'send-error', error: 'Invalid API key' });
      errSpy.mockRestore();
    });

    it('never throws when the Resend request itself rejects, and reports the error instead', async () => {
      resendSendMock.mockRejectedValue(new Error('Network error'));
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await email.sendMail({ to: 'a@example.com', subject: 'Hi', text: 'Body' });

      expect(result).toEqual({ delivered: false, reason: 'send-error', error: 'Network error' });
      errSpy.mockRestore();
    });

    it('verifySmtpConnection reports ok: true when Resend accepts the API key', async () => {
      resendDomainsListMock.mockResolvedValue({ data: [], error: null });
      const result = await email.verifySmtpConnection();
      expect(result).toEqual({ ok: true });
    });

    it('verifySmtpConnection reports ok: false when the Resend API key is rejected', async () => {
      resendDomainsListMock.mockResolvedValue({ data: null, error: { message: 'Invalid API key' } });
      const result = await email.verifySmtpConnection();
      expect(result).toEqual({ ok: false, error: 'Invalid API key' });
    });
  });
});
