/**
 * EmailService — SMTP abstraction layer.
 *
 * All email sending goes through this service.
 * Swap the transport for SES, SendGrid, etc. by changing createTransport only.
 *
 * Usage:
 *   await EmailService.send({ to: "...", subject: "...", html: "..." });
 */

import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: {
    filename: string;
    content: Buffer;
    contentType: string;
  }[];
}

class EmailServiceClass {
  private transporter: nodemailer.Transporter | null = null;

  /**
   * Lazily initialises the SMTP transporter on first use.
   */
  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT ?? "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
    return this.transporter;
  }

  /**
   * Sends an email.
   *
   * @param options - Recipient, subject, HTML body, optional text and attachments
   * @returns true on success, false on failure (logs error but does not throw)
   */
  async send(options: SendEmailOptions): Promise<boolean> {
    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: process.env.EMAIL_FROM ?? "SixD Ops <noreply@sixdengineering.com>",
        to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      });
      return true;
    } catch (error) {
      console.error("[EmailService] Failed to send email:", error);
      return false;
    }
  }

  /**
   * Sends a payment reminder email.
   */
  async sendPaymentReminder(opts: {
    to: string;
    invoiceNumber: string;
    clientName: string;
    amount: string;
    dueDate: string;
    daysOverdue: number;
    body: string;
  }): Promise<boolean> {
    return this.send({
      to: opts.to,
      subject: `Payment Reminder — Invoice ${opts.invoiceNumber} | ${opts.clientName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #E85122; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">SixD Engineering Solutions</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <p>${opts.body}</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Invoice Number</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${opts.invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount Due</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${opts.amount}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Due Date</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${opts.dueDate}</td>
              </tr>
            </table>
            <p style="color: #666; font-size: 12px;">This is an automated reminder from SixD Operations Tool.</p>
          </div>
        </div>
      `,
    });
  }

  /**
   * Sends a compliance expiry alert email.
   */
  async sendComplianceAlert(opts: {
    to: string | string[];
    docTypeName: string;
    clientName: string;
    expiryDate: string;
    daysUntilExpiry: number;
  }): Promise<boolean> {
    const urgency = opts.daysUntilExpiry <= 7 ? "URGENT: " : "";
    return this.send({
      to: opts.to,
      subject: `${urgency}Compliance Doc Expiring — ${opts.docTypeName} | ${opts.clientName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <div style="background: #E85122; padding: 20px;">
            <h1 style="color: white; margin: 0;">Compliance Alert</h1>
          </div>
          <div style="padding: 20px;">
            <p>The following compliance document is expiring soon:</p>
            <ul>
              <li><strong>Document:</strong> ${opts.docTypeName}</li>
              <li><strong>Client:</strong> ${opts.clientName}</li>
              <li><strong>Expiry Date:</strong> ${opts.expiryDate}</li>
              <li><strong>Days Remaining:</strong> ${opts.daysUntilExpiry}</li>
            </ul>
            <p>Please renew and upload the document before it expires to avoid invoice submission being blocked.</p>
          </div>
        </div>
      `,
    });
  }
}

export const EmailService = new EmailServiceClass();
