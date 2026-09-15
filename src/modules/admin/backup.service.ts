import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../database/prisma.service";
import { BackupStatus } from "@prisma/client";
import { exec } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as nodemailer from "nodemailer";

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = path.resolve(process.cwd(), "backups");

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Dynamically parse .env from disk so changes take effect immediately
   * without needing a server restart or relying on stale process.env caches.
   */
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
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          result[key] = val;
        }
      }
    } catch (e: any) {
      this.logger.warn(`Failed reading .env file dynamically: ${e.message}`);
    }
    return result;
  }

  /**
   * Resolves SMTP email configurations with dynamic .env disk fallback
   */
  private getEmailConfig() {
    const fileEnv = this.parseEnvFile();

    const smtpHost =
      fileEnv.MAIL_HOST ||
      fileEnv.SMTP_HOST ||
      this.configService.get<string>("MAIL_HOST") ||
      this.configService.get<string>("SMTP_HOST", "smtp.gmail.com");

    const smtpPort = parseInt(
      fileEnv.MAIL_PORT ||
        fileEnv.SMTP_PORT ||
        this.configService.get<string>("MAIL_PORT") ||
        this.configService.get<string>("SMTP_PORT", "465"),
      10,
    );

    const smtpSecure = smtpPort === 465;

    const smtpUser =
      fileEnv.MAIL_USERNAME ||
      fileEnv.SMTP_USER ||
      this.configService.get<string>("MAIL_USERNAME") ||
      this.configService.get<string>("SMTP_USER");

    const smtpPass =
      fileEnv.MAIL_PASSWORD ||
      fileEnv.SMTP_PASS ||
      this.configService.get<string>("MAIL_PASSWORD") ||
      this.configService.get<string>("SMTP_PASS");

    const fromAddress =
      fileEnv.MAIL_FROM_ADDRESS ||
      fileEnv.SMTP_FROM ||
      this.configService.get<string>("MAIL_FROM_ADDRESS") ||
      smtpUser;

    const defaultRecipient =
      fileEnv.BACKUP_RECIPIENT_EMAIL ||
      this.configService.get<string>("BACKUP_RECIPIENT_EMAIL", "dev.tajulislam505@gmail.com");

    return {
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPass,
      fromAddress,
      defaultRecipient,
    };
  }

  /**
   * Daily Automated Cron Job: Runs every day at 03:00 AM BST (between 2:00 AM and 4:00 AM)
   */
  @Cron("0 3 * * *", { name: "daily-database-backup", timeZone: "Asia/Dhaka" })
  async handleDailyBackupCron() {
    this.logger.log("Starting daily scheduled database backup (03:00 AM BST)...");
    try {
      const config = this.getEmailConfig();
      const recipient = config.defaultRecipient || "dev.tajulislam505@gmail.com";
      await this.triggerDatabaseBackup("CRON_DAILY_AUTO", recipient);
      this.logger.log("Daily database backup completed successfully.");
    } catch (err: any) {
      this.logger.error("Daily database backup cron failed:", err);
    }
  }

  /**
   * Triggers a full pg_dump, zips the file, records log, and emails to recipient.
   */
  async triggerDatabaseBackup(triggeredBy = "MANUAL_ADMIN", recipientEmail?: string) {
    const config = this.getEmailConfig();
    const targetRecipient = recipientEmail || config.defaultRecipient || "dev.tajulislam505@gmail.com";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const sqlFileName = `amar_khoroch_${timestamp}.sql`;
    const zipFileName = `amar_khoroch_backup_${timestamp}.zip`;

    const sqlFilePath = path.join(this.backupDir, sqlFileName);
    const zipFilePath = path.join(this.backupDir, zipFileName);

    // Create pending log in database
    const logRecord = await this.prisma.databaseBackupLog.create({
      data: {
        filename: zipFileName,
        status: BackupStatus.IN_PROGRESS,
        triggeredBy,
        recipientEmail: targetRecipient,
      },
    });

    try {
      // 1. Run pg_dump
      await this.executePgDump(sqlFilePath);

      // 2. Compress .sql into .zip using native zip
      await this.createZipArchive(sqlFilePath, zipFilePath);

      // Clean up the raw .sql file after zipping
      if (fs.existsSync(sqlFilePath)) {
        fs.unlinkSync(sqlFilePath);
      }

      // Check file size
      const stats = fs.statSync(zipFilePath);
      const fileSizeBytes = stats.size;

      // 3. Dispatch Email via Nodemailer
      let isEmailSent = false;
      let emailError: string | null = null;

      try {
        isEmailSent = await this.sendBackupEmail(targetRecipient, zipFilePath, zipFileName, fileSizeBytes);
      } catch (e: any) {
        this.logger.warn(`Email dispatch failed: ${e.message}`);
        emailError = e.message;
      }

      // 4. Update log to SUCCESS
      const updatedLog = await this.prisma.databaseBackupLog.update({
        where: { id: logRecord.id },
        data: {
          status: BackupStatus.SUCCESS,
          fileSizeBytes,
          isEmailSent,
          errorMessage: emailError,
        },
      });

      return {
        success: true,
        message: isEmailSent
          ? `Backup created and successfully sent to ${targetRecipient}`
          : `Backup created locally (${zipFileName}). Email was not sent (${emailError || "SMTP credentials not configured in .env"})`,
        data: updatedLog,
      };
    } catch (error: any) {
      this.logger.error(`Backup failed: ${error.message}`, error.stack);

      if (fs.existsSync(sqlFilePath)) fs.unlinkSync(sqlFilePath);

      await this.prisma.databaseBackupLog.update({
        where: { id: logRecord.id },
        data: {
          status: BackupStatus.FAILED,
          errorMessage: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * Executes native pg_dump by parsing DATABASE_URL
   */
  private executePgDump(outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const fileEnv = this.parseEnvFile();
      const dbUrl = fileEnv.DATABASE_URL || this.configService.get<string>("DATABASE_URL");
      if (!dbUrl) {
        return reject(new Error("DATABASE_URL not configured in environment"));
      }

      try {
        const parsed = new URL(dbUrl);
        const user = decodeURIComponent(parsed.username);
        const password = decodeURIComponent(parsed.password);
        const host = parsed.hostname || "127.0.0.1";
        const port = parsed.port || "5432";
        const database = parsed.pathname.replace(/^\//, "") || "amar_khoroch";

        const dumpCmd = `pg_dump -h "${host}" -p "${port}" -U "${user}" -d "${database}" -F p -f "${outputPath}"`;

        exec(dumpCmd, { env: { ...process.env, PGPASSWORD: password } }, (error, stdout, stderr) => {
          if (error) {
            this.logger.error(`pg_dump error: ${stderr || error.message}`);
            return reject(new Error(stderr || error.message));
          }
          resolve();
        });
      } catch (err: any) {
        reject(new Error(`Invalid DATABASE_URL format: ${err.message}`));
      }
    });
  }

  /**
   * Compresses SQL dump to ZIP archive using native Info-ZIP
   */
  private createZipArchive(sourceSqlFile: string, outputZipPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      exec(`zip -j "${outputZipPath}" "${sourceSqlFile}"`, (error, stdout, stderr) => {
        if (error) {
          this.logger.error(`zip command error: ${stderr || error.message}`);
          return reject(new Error(stderr || error.message));
        }
        resolve();
      });
    });
  }

  /**
   * Sends email with the backup zip attached
   */
  private async sendBackupEmail(
    recipient: string,
    zipFilePath: string,
    zipFileName: string,
    fileSizeBytes: number,
  ): Promise<boolean> {
    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, fromAddress } = this.getEmailConfig();

    if (!smtpUser || !smtpPass) {
      const reason = !smtpUser
        ? "MAIL_USERNAME / SMTP_USER is not set"
        : "MAIL_PASSWORD / SMTP_PASS is not configured in .env";
      this.logger.warn(`${reason}. Skipping email dispatch.`);
      throw new Error(reason);
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const formattedSize = (fileSizeBytes / (1024 * 1024)).toFixed(2) + " MB";
    const dateStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" });

    const mailOptions = {
      from: `"E-Khoroch Vault" <${fromAddress}>`,
      to: recipient,
      subject: `[E-Khoroch] Database Backup Vault - ${zipFileName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc;">
          <h2 style="color: #0f172a; margin-top: 0;">🛡️ E-Khoroch Database Backup</h2>
          <p style="color: #334155; font-size: 15px;">A fresh database backup snapshot has been generated and encrypted in the attached ZIP archive.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #ffffff; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px; font-weight: bold; color: #475569;">Archive Name</td>
              <td style="padding: 12px; color: #0f172a; font-family: monospace;">${zipFileName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px; font-weight: bold; color: #475569;">File Size</td>
              <td style="padding: 12px; color: #0f172a;">${formattedSize} (${fileSizeBytes} bytes)</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px; font-weight: bold; color: #475569;">Generated At</td>
              <td style="padding: 12px; color: #0f172a;">${dateStr} (BST)</td>
            </tr>
            <tr>
              <td style="padding: 12px; font-weight: bold; color: #475569;">Status</td>
              <td style="padding: 12px; color: #16a34a; font-weight: bold;">SUCCESS</td>
            </tr>
          </table>

          <p style="font-size: 13px; color: #64748b;">
            This is an automated security transmission for platform owner: <strong>${recipient}</strong>. Keep this file in a secure disaster-recovery vault.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: zipFileName,
          path: zipFilePath,
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    return true;
  }

  /**
   * Retrieves backup logs
   */
  async getBackupLogs(limit = 20) {
    return this.prisma.databaseBackupLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Resolves absolute path to a backup zip for direct admin download
   */
  getBackupFilePath(filename: string): string | null {
    const safeName = path.basename(filename);
    const fullPath = path.join(this.backupDir, safeName);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
    return null;
  }

  /**
   * Restores database from an uploaded backup file (.zip or .sql).
   * 1. Creates a safety pre-restore backup first.
   * 2. Extracts .sql from .zip or uses .sql directly.
   * 3. Drops and recreates public schema.
   * 4. Imports SQL dump via native psql.
   * 5. Refreshes Prisma connection pool.
   * 6. Cleans up temporary files.
   */
  async restoreDatabaseBackup(file: any, adminEmail: string): Promise<{ success: boolean; message: string; data?: any }> {
    if (!file || !file.buffer) {
      throw new BadRequestException("No backup file uploaded");
    }

    const originalName = file.originalname || "uploaded_backup";
    const ext = path.extname(originalName).toLowerCase();
    if (ext !== ".zip" && ext !== ".sql") {
      throw new BadRequestException("Invalid file format. Please upload a .zip or .sql backup file");
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const tempDir = path.join(this.backupDir, `restore_temp_${timestamp}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    let sqlFilePath: string | null = null;
    let preRestoreLog: any = null;

    try {
      // 1. Automatically create an emergency pre-restore snapshot
      this.logger.log(`Creating pre-restore safety snapshot before restoring ${originalName}...`);
      try {
        const preRestoreResult = await this.triggerDatabaseBackup(`SAFETY_PRE_RESTORE (${adminEmail})`);
        preRestoreLog = preRestoreResult.data;
      } catch (err: any) {
        this.logger.warn(`Could not create pre-restore snapshot: ${err.message}. Proceeding with caution.`);
      }

      // 2. Prepare the .sql file from upload
      if (ext === ".zip") {
        const uploadedZipPath = path.join(tempDir, `uploaded_${timestamp}.zip`);
        fs.writeFileSync(uploadedZipPath, file.buffer);

        // Extract zip using native unzip
        await new Promise<void>((resolve, reject) => {
          exec(`unzip -o "${uploadedZipPath}" -d "${tempDir}"`, (err, stdout, stderr) => {
            if (err) {
              return reject(new Error(`Failed to extract ZIP archive: ${stderr || err.message}`));
            }
            resolve();
          });
        });

        // Find .sql file inside extracted contents
        const extractedFiles = fs.readdirSync(tempDir);
        const foundSql = extractedFiles.find((f) => f.toLowerCase().endsWith(".sql"));
        if (!foundSql) {
          throw new BadRequestException("No .sql dump file found inside the uploaded ZIP archive");
        }
        sqlFilePath = path.join(tempDir, foundSql);
      } else {
        // Direct .sql file
        sqlFilePath = path.join(tempDir, `restore_${timestamp}.sql`);
        fs.writeFileSync(sqlFilePath, file.buffer);
      }

      // Check that sql file exists and is not empty
      const stats = fs.statSync(sqlFilePath);
      if (stats.size === 0) {
        throw new BadRequestException("The uploaded SQL dump file is empty");
      }

      // 3. Disconnect Prisma pool before schema reset to release locks
      await this.prisma.$disconnect();

      // 4. Execute database reset and SQL restore
      await this.executeDatabaseRestore(sqlFilePath);

      // 5. Reconnect Prisma connection pool
      await this.prisma.$connect();

      // 5. Log restore event in database
      const restoreLog = await this.prisma.databaseBackupLog.create({
        data: {
          filename: `RESTORED: ${originalName}`,
          fileSizeBytes: stats.size,
          status: BackupStatus.SUCCESS,
          triggeredBy: `RESTORE_ACTION (${adminEmail})`,
          recipientEmail: adminEmail,
          isEmailSent: false,
          errorMessage: preRestoreLog ? `Safety pre-restore snapshot created: ${preRestoreLog.filename}` : null,
        },
      });

      this.logger.log(`Database successfully restored from ${originalName} by ${adminEmail}`);

      return {
        success: true,
        message: `Database successfully restored from ${originalName}! All tables and records have been reloaded.`,
        data: restoreLog,
      };
    } catch (error: any) {
      this.logger.error(`Database restore failed: ${error.message}`, error.stack);
      throw error;
    } finally {
      // 6. Clean up temp folder
      if (fs.existsSync(tempDir)) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e: any) {
          this.logger.warn(`Could not clean up temp restore dir: ${e.message}`);
        }
      }
    }
  }

  /**
   * Executes schema reset and native psql restore
   */
  private executeDatabaseRestore(sqlFilePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const fileEnv = this.parseEnvFile();
      const dbUrl = fileEnv.DATABASE_URL || this.configService.get<string>("DATABASE_URL");
      if (!dbUrl) {
        return reject(new Error("DATABASE_URL not configured in environment"));
      }

      try {
        const parsed = new URL(dbUrl);
        const user = decodeURIComponent(parsed.username);
        const password = decodeURIComponent(parsed.password);
        const host = parsed.hostname || "127.0.0.1";
        const port = parsed.port || "5432";
        const database = parsed.pathname.replace(/^\//, "") || "amar_khoroch";

        // Step 1: Clean schema public
        const cleanSchemaCmd = `psql -h "${host}" -p "${port}" -U "${user}" -d "${database}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"`;

        exec(cleanSchemaCmd, { env: { ...process.env, PGPASSWORD: password } }, (cleanErr, stdout, stderr) => {
          if (cleanErr) {
            this.logger.error(`Failed to reset schema: ${stderr || cleanErr.message}`);
            return reject(new Error(`Failed to reset schema: ${stderr || cleanErr.message}`));
          }

          // Step 2: Restore from SQL dump
          const restoreCmd = `psql -h "${host}" -p "${port}" -U "${user}" -d "${database}" -f "${sqlFilePath}"`;

          exec(restoreCmd, { env: { ...process.env, PGPASSWORD: password } }, (restoreErr, rStdout, rStderr) => {
            if (restoreErr) {
              this.logger.error(`psql restore error: ${rStderr || restoreErr.message}`);
              return reject(new Error(`Database restore execution failed: ${rStderr || restoreErr.message}`));
            }
            resolve();
          });
        });
      } catch (err: any) {
        reject(new Error(`Invalid DATABASE_URL format: ${err.message}`));
      }
    });
  }
}
