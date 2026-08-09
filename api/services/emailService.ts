import nodemailer, { Transporter } from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export class EmailService {
  private transporter: Transporter | null = null;
  private fromEmail: string;
  private isEnabled: boolean;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'noreply@spfit.com';
    this.isEnabled = process.env.EMAIL_ENABLED === 'true';
    
    if (this.isEnabled) {
      this.initializeTransporter();
    }
  }

  private initializeTransporter(): void {
    const config: EmailConfig = {
      host: process.env.EMAIL_HOST || process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER || process.env.SMTP_USER || '',
        pass: process.env.EMAIL_PASS || process.env.SMTP_PASS || ''
      }
    };

    this.transporter = nodemailer.createTransport(config);
  }

  async sendWelcomeEmail(to: string, name: string): Promise<boolean> {
    if (!this.isEnabled || !this.transporter) {
      console.warn('Email service is disabled or not initialized');
      return false;
    }

    try {
      const mailOptions = {
        from: this.fromEmail,
        to,
        subject: 'Selamat Datang ke SPFIT',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Selamat Datang ke SPFIT, ${name}!</h2>
            <p>Terima kasih kerana mendaftar dengan Sistem Pengurusan Freelance IT Tech (SPFIT).</p>
            <p>Dengan akaun anda, anda boleh:</p>
            <ul>
              <li>Menerima tugasan IT</li>
              <li>Mengesan status tugasan</li>
              <li>Menerima bayaran</li>
              <li>Dan banyak lagi</li>
            </ul>
            <p>Sekiranya anda mempunyai sebarang soalan, sila hubungi support kami.</p>
            <br>
            <p>Salam,<br>Team SPFIT</p>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Welcome email sent to ${to}`);
      return true;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return false;
    }
  }

  async sendPasswordResetEmail(to: string, name: string, resetToken: string): Promise<boolean> {
    if (!this.isEnabled || !this.transporter) {
      console.warn('Email service is disabled or not initialized');
      return false;
    }

    try {
      // In a real implementation, this would be a proper reset link
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
      
      const mailOptions = {
        from: this.fromEmail,
        to,
        subject: 'Reset Kata Laluan SPFIT',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Reset Kata Laluan SPFIT</h2>
            <p>Hai ${name},</p>
            <p>Kami menerima permintaan untuk menetapkan semula kata laluan akaun SPFIT anda.</p>
            <p>Sila klik pautan di bawah untuk menetapkan semula kata laluan anda:</p>
            <p>
              <a href="${resetLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Kata Laluan
              </a>
            </p>
            <p>Jika anda tidak meminta reset kata laluan, sila abaikan email ini.</p>
            <p><strong>Nota:</strong> Pautan ini akan tamat dalam 1 jam.</p>
            <br>
            <p>Salam,<br>Team SPFIT</p>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Password reset email sent to ${to}`);
      return true;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return false;
    }
  }

  async sendNotificationEmail(to: string, subject: string, message: string): Promise<boolean> {
    if (!this.isEnabled || !this.transporter) {
      console.warn('Email service is disabled or not initialized');
      return false;
    }

    try {
      const mailOptions = {
        from: this.fromEmail,
        to,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>${subject}</h2>
            <p>${message}</p>
            <br>
            <p>Salam,<br>Team SPFIT</p>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Notification email sent to ${to}: ${subject}`);
      return true;
    } catch (error) {
      console.error('Error sending notification email:', error);
      return false;
    }
  }
}