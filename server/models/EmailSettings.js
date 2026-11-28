const mongoose = require('mongoose');

const EmailSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    adminEmail: { type: String, default: 'abhishekdb13@gmail.com' },
    smtpHost: { type: String, default: 'smtp.gmail.com' },
    smtpPort: { type: Number, default: 587 },
    smtpUser: { type: String, default: '' },
    /** Stored for Admin UI; prefer App Password */
    smtpPass: { type: String, default: '' },
    smtpFrom: { type: String, default: '' },
    smtpSecure: { type: Boolean, default: false },
    templates: {
      franchiseApplicant: {
        subject: {
          type: String,
          default: 'Japto.in Franchise — आवेदन प्राप्त ({{applicationId}})'
        },
        html: { type: String, default: '' }
      },
      franchiseAdmin: {
        subject: {
          type: String,
          default: '[Japto] New Franchise Application {{applicationId}}'
        },
        html: { type: String, default: '' }
      }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmailSettings', EmailSettingsSchema);
