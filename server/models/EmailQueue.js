const mongoose = require('mongoose');

const EmailQueueSchema = new mongoose.Schema(
  {
    to: { type: String, required: true, index: true },
    cc: [{ type: String }],
    subject: { type: String, required: true },
    html: { type: String, required: true },
    text: { type: String, default: '' },
    template: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['queued', 'sending', 'sent', 'failed'],
      default: 'queued',
      index: true
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
    sentAt: Date
  },
  { timestamps: true }
);

EmailQueueSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('EmailQueue', EmailQueueSchema);
