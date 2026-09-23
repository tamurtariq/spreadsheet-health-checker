import { Resend } from 'resend';
import { generateDigestHtml, generateDigestText, DigestData } from './templates';

export interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private resend: Resend;
  private fromEmail: string;
  private fromName: string;

  constructor(config: EmailConfig) {
    this.resend = new Resend(config.apiKey);
    this.fromEmail = config.fromEmail;
    this.fromName = config.fromName;
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      if (result.error) {
        return { success: false, error: result.error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendWeeklyDigest(data: DigestData): Promise<{ success: boolean; error?: string }> {
    const subject = `Your Weekly Spreadsheet Health Digest — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    const html = generateDigestHtml(data);
    const text = generateDigestText(data);

    return this.sendEmail({
      to: data.userEmail,
      subject,
      html,
      text,
    });
  }
}

export function createEmailService(env: { RESEND_API_KEY: string; FROM_EMAIL: string; FROM_NAME: string }): EmailService {
  return new EmailService({
    apiKey: env.RESEND_API_KEY,
    fromEmail: env.FROM_EMAIL,
    fromName: env.FROM_NAME,
  });
}