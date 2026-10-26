const crypto = require('crypto');
const nodemailer = require('nodemailer');

/**
 * Generates a cryptographically secure, single-use random verification token,
 * its SHA-256 hash for database storage, and an expiration timestamp (24 hours).
 */
function generateVerificationToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = hashToken(rawToken);
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  return {
    rawToken,
    hashedToken,
    expires,
  };
}

/**
 * Hashes a raw token with SHA-256 before database lookup or storage.
 * @param {string} rawToken
 * @returns {string} SHA-256 hex digest
 */
function hashToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return '';
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Resolves the frontend base URL for verification links.
 */
function getFrontendUrl() {
  if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.trim()) {
    return process.env.FRONTEND_URL.trim().replace(/\/+$/, '');
  }
  if (process.env.LOCAL_FRONTEND_URL_1 && process.env.LOCAL_FRONTEND_URL_1.trim()) {
    return process.env.LOCAL_FRONTEND_URL_1.trim().replace(/\/+$/, '');
  }
  return 'http://localhost:5173';
}

/**
 * Creates a reusable Nodemailer transporter using environment variables.
 */
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = port === 465;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  return null;
}

/**
 * Sends an email verification link to the student.
 * Never throws an unhandled error to prevent crashing parent request handlers.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} [options.name] - Recipient name
 * @param {string} options.token - Raw verification token
 * @param {boolean} [options.isChange] - True if verifying a new pending email address
 * @returns {Promise<boolean>} True if sent successfully, false otherwise
 */
async function sendVerificationEmail({ to, name, token, isChange = false }) {
  try {
    const frontendUrl = getFrontendUrl();
    const verificationUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const subject = isChange
      ? 'Confirm your new email address - Campus Lost & Found'
      : 'Verify your Campus Lost & Found account';

    const greetingName = name ? String(name).trim() : 'Student';
    const actionText = isChange
      ? 'You recently requested to update your email address for Campus Lost & Found. Please confirm ownership of this email to complete the change:'
      : 'Welcome to Campus Lost & Found! Please verify your college email address to unlock full privileges including reporting lost/found items and claiming items:';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 24px; background-color: #f9fafb; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 16px; }
    .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 24px 0; }
    .notice { font-size: 13px; color: #6b7280; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    .url { font-size: 12px; word-break: break-all; color: #4b5563; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">Campus Lost & Found</div>
    <p>Hello ${greetingName},</p>
    <p>${actionText}</p>
    <p style="text-align: center;">
      <a href="${verificationUrl}" class="button" target="_blank">Verify Email Address</a>
    </p>
    <p>Or paste this link into your browser:</p>
    <p class="url">${verificationUrl}</p>
    <div class="notice">
      <p><strong>Note:</strong> This verification link will expire in 24 hours.</p>
      <p>If you did not create an account or request this change, please disregard this email. Your account remains secure.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const textContent = `
Hello ${greetingName},

${actionText}

Verify your email: ${verificationUrl}

This link will expire in 24 hours.

If you did not request this, you can safely ignore this email.
    `.trim();

    const transporter = createTransporter();
    const fromAddress = process.env.EMAIL_FROM || '"Campus Lost & Found" <noreply@campus.edu>';

    if (transporter) {
      await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text: textContent,
        html: htmlContent,
      });
      return true;
    }

    // Development / fallback mode: safe simulation
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[email:dev] Verification link for ${to}: ${verificationUrl}`);
    } else {
      console.log(`[email] Verification email queued for: ${to}`);
    }
    return true;
  } catch (err) {
    console.error('[email] Failed to send verification email:', err?.message || err);
    return false;
  }
}

/**
 * Sends a security alert to the old email when an email change was requested.
 */
async function sendEmailChangeNotification({ to, name, newEmail }) {
  try {
    const transporter = createTransporter();
    const fromAddress = process.env.EMAIL_FROM || '"Campus Lost & Found" <noreply@campus.edu>';
    const subject = 'Notice: Email address change requested - Campus Lost & Found';
    const greetingName = name ? String(name).trim() : 'Student';

    const textContent = `
Hello ${greetingName},

A request was recently submitted to change your Campus Lost & Found email address to: ${newEmail}.

If you authorized this request, no action is needed; the new email will become active once verified.
If you did NOT request this change, please log in immediately and change your password to secure your account.
    `.trim();

    if (transporter) {
      await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text: textContent,
      });
      return true;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[email:dev] Email change notification queued for old email: ${to}`);
    }
    return true;
  } catch (err) {
    console.error('[email] Failed to send email change notification:', err?.message || err);
    return false;
  }
}

module.exports = {
  generateVerificationToken,
  hashToken,
  sendVerificationEmail,
  sendEmailChangeNotification,
};
