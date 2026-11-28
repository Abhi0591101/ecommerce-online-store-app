const EmailSettings = require('../models/EmailSettings');

const DEFAULT_APPLICANT_HTML = `<!DOCTYPE html>
<html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">
  <table width="560" style="max-width:560px;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#0f766e,#059669);padding:28px;">
      <p style="margin:0;color:#ccfbf1;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Japto.in</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;">Franchise आवेदन प्राप्त</h1>
    </td></tr>
    <tr><td style="padding:28px;">
      <p style="margin:0 0 12px;font-size:15px;">नमस्ते <strong>{{ownerName}}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#334155;">आपका Japto.in फ्रेंचाइज़ी आवेदन सफलतापूर्वक प्राप्त हो गया है। Head Office जल्द संपर्क करेगा।</p>
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:14px;margin-bottom:18px;">
        <p style="margin:0;font-size:12px;color:#047857;font-weight:700;">APPLICATION ID</p>
        <p style="margin:6px 0 0;font-size:20px;font-family:monospace;color:#065f46;font-weight:800;">{{applicationId}}</p>
      </div>
      <p style="margin:0;font-size:13px;color:#475569;"><strong>मोबाइल:</strong> {{phone}}</p>
      <p style="margin:6px 0 0;font-size:13px;color:#475569;"><strong>ईमेल:</strong> {{email}}</p>
      <p style="margin:6px 0 0;font-size:13px;color:#475569;"><strong>शहर / PIN:</strong> {{city}} / {{pincode}}</p>
      <p style="margin:6px 0 0;font-size:13px;color:#475569;"><strong>पता:</strong> {{address}}</p>
      <p style="margin:16px 0 0;font-size:12px;color:#64748b;">नोट: फ्रेंचाइज़ी फीस Non-Refundable है। Agreement 5 वर्ष।</p>
    </td></tr>
  </table>
  </td></tr></table>
</body></html>`;

const DEFAULT_ADMIN_HTML = `<!DOCTYPE html>
<html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">
  <table width="560" style="max-width:560px;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#9a3412,#ea580c);padding:28px;">
      <p style="margin:0;color:#ffedd5;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Japto.in Admin</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;">नया Franchise आवेदन</h1>
    </td></tr>
    <tr><td style="padding:28px;">
      <p style="margin:0 0 14px;font-size:14px;color:#334155;">Admin Dashboard में नया आवेदन आया है — कृपया रिव्यू करें।</p>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px;margin-bottom:18px;">
        <p style="margin:0;font-size:12px;color:#c2410c;font-weight:700;">APPLICATION ID</p>
        <p style="margin:6px 0 0;font-size:18px;font-family:monospace;color:#9a3412;font-weight:800;">{{applicationId}}</p>
      </div>
      <p style="margin:0;font-size:13px;"><strong>आवेदक:</strong> {{ownerName}}</p>
      <p style="margin:6px 0 0;font-size:13px;"><strong>मोबाइल:</strong> {{phone}}</p>
      <p style="margin:6px 0 0;font-size:13px;"><strong>ईमेल:</strong> {{email}}</p>
      <p style="margin:6px 0 0;font-size:13px;"><strong>शहर / PIN:</strong> {{city}} / {{pincode}}</p>
      <p style="margin:6px 0 0;font-size:13px;"><strong>पता:</strong> {{address}}</p>
      <p style="margin:6px 0 0;font-size:13px;"><strong>Message:</strong> {{message}}</p>
      <p style="margin:6px 0 0;font-size:13px;"><strong>Promoters:</strong> {{promoters}}</p>
      <p style="margin:6px 0 0;font-size:13px;"><strong>Submitted:</strong> {{submittedAt}}</p>
    </td></tr>
  </table>
  </td></tr></table>
</body></html>`;

const getOrCreateEmailSettings = async () => {
  let s = await EmailSettings.findOne({ key: 'default' });
  if (!s) {
    s = await EmailSettings.create({
      key: 'default',
      adminEmail: process.env.ADMIN_EMAIL || 'abhishekdb13@gmail.com',
      smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
      smtpPort: Number(process.env.SMTP_PORT || 587),
      smtpUser: process.env.SMTP_USER || '',
      smtpPass: process.env.SMTP_PASS || '',
      smtpFrom: process.env.SMTP_FROM || '',
      templates: {
        franchiseApplicant: {
          subject: 'Japto.in Franchise — आवेदन प्राप्त ({{applicationId}})',
          html: DEFAULT_APPLICANT_HTML
        },
        franchiseAdmin: {
          subject: '[Japto] New Franchise Application {{applicationId}}',
          html: DEFAULT_ADMIN_HTML
        }
      }
    });
  } else {
    let dirty = false;
    if (!s.templates?.franchiseApplicant?.html) {
      s.templates = s.templates || {};
      s.templates.franchiseApplicant = {
        subject: s.templates.franchiseApplicant?.subject || 'Japto.in Franchise — आवेदन प्राप्त ({{applicationId}})',
        html: DEFAULT_APPLICANT_HTML
      };
      dirty = true;
    }
    if (!s.templates?.franchiseAdmin?.html) {
      s.templates = s.templates || {};
      s.templates.franchiseAdmin = {
        subject: s.templates.franchiseAdmin?.subject || '[Japto] New Franchise Application {{applicationId}}',
        html: DEFAULT_ADMIN_HTML
      };
      dirty = true;
    }
    if (dirty) await s.save();
  }
  return s;
};

const renderTemplate = (template, vars = {}) => {
  let out = String(template || '');
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g');
    out = out.replace(re, String(v ?? ''));
  }
  return out;
};

const publicEmailSettings = (s) => {
  const obj = s.toObject ? s.toObject() : { ...s };
  return {
    ...obj,
    smtpPassSet: !!(obj.smtpPass && String(obj.smtpPass).length),
    smtpPass: obj.smtpPass ? '********' : ''
  };
};

module.exports = {
  getOrCreateEmailSettings,
  renderTemplate,
  publicEmailSettings,
  DEFAULT_APPLICANT_HTML,
  DEFAULT_ADMIN_HTML
};
