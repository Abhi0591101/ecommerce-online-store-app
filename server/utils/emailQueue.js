const EmailQueue = require('../models/EmailQueue');

const queueEmail = async ({ to, cc, subject, html, text, template, meta }) => {
  if (!to) throw new Error('email "to" required');
  const doc = await EmailQueue.create({
    to: String(to).trim().toLowerCase(),
    cc: Array.isArray(cc) ? cc.filter(Boolean).map((x) => String(x).trim().toLowerCase()) : [],
    subject,
    html,
    text: text || '',
    template: template || '',
    meta: meta || {},
    status: 'queued'
  });
  return doc;
};

module.exports = { queueEmail };
