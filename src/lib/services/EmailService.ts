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

  private getSmtpConfig() {
    const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
    const secureEnv = process.env.SMTP_SECURE?.trim().toLowerCase();

    let secure =
      secureEnv === "true" ? true : secureEnv === "false" ? false : port === 465;

    // Common SMTP ports:
    // 465 -> implicit TLS (`secure: true`)
    // 587 -> STARTTLS upgrade (`secure: false`)
    if (port === 587 && secure) {
      console.warn(
        "[EmailService] SMTP_SECURE=true is incompatible with port 587. Falling back to secure=false for STARTTLS."
      );
      secure = false;
    } else if (port === 465 && !secure) {
      console.warn(
        "[EmailService] SMTP_SECURE=false is incompatible with port 465. Falling back to secure=true."
      );
      secure = true;
    }

    return {
      host: process.env.SMTP_HOST,
      port,
      secure,
    };
  }

  /**
   * Lazily initialises the SMTP transporter on first use.
   */
  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      const smtpConfig = this.getSmtpConfig();

      this.transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        requireTLS: !smtpConfig.secure,
        tls: {
          minVersion: "TLSv1.2",
        },
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

  async sendTeamInvite(opts: {
    to: string;
    name: string;
    division: string;
    level: string;
    loginUrl: string;
    invitedBy: string;
    temporaryPassword: string;
    temporaryPin?: string;
  }): Promise<boolean> {
    return this.send({
      to: opts.to,
      subject: "You have been invited to join SixD Ops",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
          <div style="background: #E85122; padding: 24px 28px;">
            <h1 style="margin: 0; color: #ffffff; font-size: 24px;">Welcome to SixD Ops</h1>
            <p style="margin: 8px 0 0; color: #ffe4d8; font-size: 14px;">Your team access is ready.</p>
          </div>
          <div style="padding: 28px;">
            <p style="margin-top: 0;">Hi ${opts.name},</p>
            <p>You have been added to the SixD Engineering operations workspace by ${opts.invitedBy}.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
              <tr>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb; width: 35%;"><strong>Division</strong></td>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${opts.division}</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb;"><strong>Level</strong></td>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${opts.level}</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb;"><strong>Login Email</strong></td>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${opts.to}</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb;"><strong>Temporary Password</strong></td>
                <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${opts.temporaryPassword}</td>
              </tr>
              ${
                opts.temporaryPin
                  ? `
                    <tr>
                      <td style="padding: 10px 12px; border: 1px solid #e5e7eb;"><strong>Temporary PIN</strong></td>
                      <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${opts.temporaryPin}</td>
                    </tr>
                  `
                  : ""
              }
            </table>
            <p style="margin-bottom: 20px;">Use the link below to sign in and update your credentials after first login.</p>
            <a
              href="${opts.loginUrl}"
              style="display: inline-block; padding: 12px 18px; background: #E85122; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;"
            >
              Open SixD Ops
            </a>
            <p style="margin: 24px 0 0; color: #6b7280; font-size: 12px;">
              If you were not expecting this invitation, please contact your SixD administrator.
            </p>
          </div>
        </div>
      `,
      text: [
        `Hi ${opts.name},`,
        "",
        `You have been added to SixD Ops by ${opts.invitedBy}.`,
        `Division: ${opts.division}`,
        `Level: ${opts.level}`,
        `Login Email: ${opts.to}`,
        `Temporary Password: ${opts.temporaryPassword}`,
        opts.temporaryPin ? `Temporary PIN: ${opts.temporaryPin}` : null,
        "",
        `Sign in here: ${opts.loginUrl}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }
}

export const EmailService = new EmailServiceClass();
