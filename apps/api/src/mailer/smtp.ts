import nodemailer from 'nodemailer';
import { env } from '../env.js';
import type { Mailer } from './index.js';

export class SmtpMailer implements Mailer {
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor() {
    if (
      !env.SMTP_HOST ||
      !env.SMTP_PORT ||
      !env.SMTP_USER ||
      !env.SMTP_PASSWORD ||
      !env.SMTP_FROM
    ) {
      throw new Error('SMTP 設定が不完全です');
    }
    this.from = env.SMTP_FROM;
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    });
  }

  async sendTeamAccessLink(to: string, teamId: string, link: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: '[WiFiMan] チーム編集リンク',
      text: `以下のリンクからチームの編集画面にアクセスできます。\n\nチームID: ${teamId}\nリンク: ${link}\n\nこのリンクは長期間有効です。他者に共有しないでください。`,
      html: `
        <p>以下のリンクからチームの編集画面にアクセスできます。</p>
        <p><strong>チームID:</strong> ${teamId}</p>
        <p><a href="${link}">チーム編集画面を開く</a></p>
        <p><small>このリンクは長期間有効です。他者に共有しないでください。</small></p>
      `,
    });
  }
}

export function createMailer(): Mailer | null {
  if (!env.SMTP_HOST) return null;
  try {
    return new SmtpMailer();
  } catch (err) {
    console.warn('メーラーの初期化に失敗しました:', err);
    return null;
  }
}
