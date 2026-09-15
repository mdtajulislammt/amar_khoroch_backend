import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import * as path from "path";
import * as fs from "fs";

@Injectable()
export class AuthMailService {
  private readonly logger = new Logger(AuthMailService.name);

  constructor(private configService: ConfigService) {}

  private parseEnvFile(): Record<string, string> {
    const envPath = path.resolve(process.cwd(), ".env");
    const result: Record<string, string> = {};
    if (!fs.existsSync(envPath)) return result;
    try {
      const lines = fs.readFileSync(envPath, "utf8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          result[key] = val;
        }
      }
    } catch {}
    return result;
  }

  private getTransporter() {
    const env = this.parseEnvFile();
    const host = env.MAIL_HOST || env.SMTP_HOST || this.configService.get<string>("MAIL_HOST", "smtp.gmail.com");
    const port = parseInt(env.MAIL_PORT || env.SMTP_PORT || "465", 10);
    const user = env.MAIL_USERNAME || env.SMTP_USER || "";
    const pass = env.MAIL_PASSWORD || env.SMTP_PASS || "";

    if (!user || !pass) {
      this.logger.warn("SMTP credentials not configured in .env. Falling back to logger.");
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  async sendVerificationOtpEmail(recipientEmail: string, userName: string, otp: string): Promise<boolean> {
    try {
      const transporter = this.getTransporter();
      const env = this.parseEnvFile();
      const fromAddress = env.MAIL_FROM_ADDRESS || env.MAIL_USERNAME || "sazzadur.backbenchers@gmail.com";

      if (!transporter) {
        this.logger.warn(`[OTP DEMO FALLBACK] Verification code for ${recipientEmail} is ${otp}`);
        return true;
      }

      const mailOptions = {
        from: `"E-Khoroch | ই-খরচ" <${fromAddress}>`,
        to: recipientEmail,
        subject: `[${otp}] আপনার ইমেইল ভেরিফিকেশন কোড - E-Khoroch`,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #6366f1; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">E-Khoroch (ই-খরচ)</h2>
              <p style="color: #64748b; font-size: 13px; margin-top: 4px;">স্মার্ট অর্থ ব্যবস্থাপনা ও খরচের হিসাব</p>
            </div>

            <div style="background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <p style="font-size: 15px; margin: 0 0 12px 0; color: #334155;">
                প্রিয় <strong>${userName || "ব্যবহারকারী"}</strong>,
              </p>
              <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0;">
                E-Khoroch (ই-খরচ) প্ল্যাটফর্মে রেজিস্ট্রেশন করার জন্য ধন্যবাদ! আপনার অ্যাকাউন্ট সক্রিয় ও নিশ্চিত করতে নিচের <strong>৬-সংখ্যার ভেরিফিকেশন কোডটি (OTP)</strong> ব্যবহার করুন:
              </p>

              <div style="text-align: center; margin: 24px 0;">
                <div style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: 8px; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);">
                  ${otp}
                </div>
              </div>

              <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0;">
                ⏱️ এই কোডটির মেয়াদ <strong>১০ মিনিট</strong>।
              </p>
            </div>

            <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
              <p style="margin: 0 0 6px 0;">নিরাপত্তা সতর্কতা: এই কোডটি কাউকে বলবেন না।</p>
              <p style="margin: 0;">আপনি যদি অ্যাকাউন্ট খোলার অনুরোধ না করে থাকেন, তবে এই ইমেইলটি এড়িয়ে যান।</p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      this.logger.log(`Verification OTP email dispatched successfully to ${recipientEmail}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to dispatch verification email to ${recipientEmail}: ${err.message}`);
      return false;
    }
  }
}
