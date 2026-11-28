/**
 * Process queued emails using Admin Panel Email settings (DB),
 * falling back to server/.env SMTP_* if DB empty.
 *
 *   npm run emails:send
 *   npm run emails:send --prefix server
 */
require('dotenv').config();
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const EmailQueue = require('../models/EmailQueue');
const { getOrCreateEmailSettings } = require('../utils/emailSettingsStore');

const buildTransport = async () => {
  const cfg = await getOrCreateEmailSettings();
  const host = cfg.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(cfg.smtpPort || process.env.SMTP_PORT || 587);
  const user = cfg.smtpUser || process.env.SMTP_USER;
  const pass = cfg.smtpPass || process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error(
      'SMTP user/password missing. Set them in Admin Panel → Email, then run this command again.'
    );
  }

  return {
    transport: nodemailer.createTransport({
      host,
      port,
      secure: port === 465 || !!cfg.smtpSecure,
      auth: { user, pass }
    }),
    from: cfg.smtpFrom || process.env.SMTP_FROM || `Japto.in <${user}>`
  };
};

const run = async () => {
  await connectDB();
  const { transport, from } = await buildTransport();

  const pending = await EmailQueue.find({ status: { $in: ['queued', 'failed'] } })
    .sort({ createdAt: 1 })
    .limit(50);

  if (!pending.length) {
    console.log('No queued emails.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Sending ${pending.length} email(s)...`);
  let ok = 0;
  let fail = 0;

  for (const job of pending) {
    job.status = 'sending';
    job.attempts = (job.attempts || 0) + 1;
    await job.save();

    try {
      const info = await transport.sendMail({
        from,
        to: job.to,
        cc: job.cc?.length ? job.cc : undefined,
        subject: job.subject,
        html: job.html,
        text: job.text || undefined
      });
      job.status = 'sent';
      job.sentAt = new Date();
      job.lastError = '';
      job.meta = { ...(job.meta || {}), messageId: info.messageId };
      await job.save();
      ok += 1;
      console.log(`✓ sent → ${job.to} | ${job.subject}`);
    } catch (err) {
      job.status = 'failed';
      job.lastError = err.message || String(err);
      await job.save();
      fail += 1;
      console.error(`✗ fail → ${job.to}: ${job.lastError}`);
    }
  }

  console.log(`Done. sent=${ok} failed=${fail}`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
};

run().catch(async (err) => {
  console.error(err.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
