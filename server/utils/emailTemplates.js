const {
  getOrCreateEmailSettings,
  renderTemplate
} = require('./emailSettingsStore');

const buildVars = (app = {}) => ({
  applicationId: app.applicationId || '',
  ownerName: app.ownerName || '',
  phone: app.phone || '',
  email: app.email || '',
  city: app.city || '',
  pincode: app.pincode || '',
  address: app.address || '',
  businessExperience:
    app.businessExperience === 'experienced' ? 'अनुभव है' : 'नया व्यवसाय',
  message: app.message || '',
  promoters: (app.promoters || [])
    .map((p) => `${p.name || '—'} (${p.phone || '—'})`)
    .join(' · '),
  submittedAt: app.createdAt
    ? new Date(app.createdAt).toLocaleString('en-IN')
    : new Date().toLocaleString('en-IN')
});

const franchiseApplicationConfirmation = async (app) => {
  const settings = await getOrCreateEmailSettings();
  const vars = buildVars(app);
  const subjectTpl =
    settings.templates?.franchiseApplicant?.subject ||
    'Japto.in Franchise — आवेदन प्राप्त ({{applicationId}})';
  const htmlTpl = settings.templates?.franchiseApplicant?.html || '';
  return {
    subject: renderTemplate(subjectTpl, vars),
    html: renderTemplate(htmlTpl, vars),
    text: `Japto.in Franchise आवेदन प्राप्त। Application ID: ${vars.applicationId}. नमस्ते ${vars.ownerName}.`
  };
};

const franchiseApplicationAdminAlert = async (app) => {
  const settings = await getOrCreateEmailSettings();
  const vars = buildVars(app);
  const subjectTpl =
    settings.templates?.franchiseAdmin?.subject ||
    '[Japto] New Franchise Application {{applicationId}}';
  const htmlTpl = settings.templates?.franchiseAdmin?.html || '';
  return {
    subject: renderTemplate(subjectTpl, vars),
    html: renderTemplate(htmlTpl, vars),
    text: `New franchise application ${vars.applicationId} from ${vars.ownerName} (${vars.phone}).`
  };
};

module.exports = {
  franchiseApplicationConfirmation,
  franchiseApplicationAdminAlert,
  buildVars
};
