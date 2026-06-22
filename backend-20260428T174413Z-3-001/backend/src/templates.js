const TEMPLATE_VERSION = '2026-05-12';
const defaultSupportUrl = process.env.SUPPORT_URL || 'https://partnernotify.app/support';
const defaultTestingLocatorUrl = process.env.TESTING_LOCATOR_URL || 'https://gettested.cdc.gov/';

function withLinks(
  text,
  {
    supportUrl = defaultSupportUrl,
    testingLocatorUrl = defaultTestingLocatorUrl
  } = {}
) {
  return `${text} Find nearby testing: ${testingLocatorUrl} Help: ${supportUrl}`;
}

const templates = Object.freeze({
  STI: Object.freeze({
    NEUTRAL: 'A recent partner used Partner Notify to share that you may have been exposed to an STI. Consider testing or contacting a health care provider.',
    SUPPORTIVE: 'Health notice from Partner Notify: you may have been exposed to an STI. Testing can help you decide what to do next.',
    DIRECT: 'Partner Notify health notice: you may have been exposed to an STI. Consider getting tested.'
  }),
  SYPHILIS: Object.freeze({
    NEUTRAL: 'A recent partner used Partner Notify to share that you may have been exposed to syphilis. Syphilis is treatable; consider testing.',
    SUPPORTIVE: 'Health notice from Partner Notify: you may have been exposed to syphilis. Testing and treatment are available.',
    DIRECT: 'Partner Notify health notice: you may have been exposed to syphilis. Consider getting tested.'
  }),
  HIV: Object.freeze({
    NEUTRAL: 'A recent partner used Partner Notify to share that you may have been exposed to HIV. Consider HIV testing and health care guidance.',
    SUPPORTIVE: 'Health notice from Partner Notify: you may have been exposed to HIV. Testing, prevention, and care options are available.',
    DIRECT: 'Partner Notify health notice: you may have been exposed to HIV. Consider getting an HIV test.'
  }),
  OTHER: Object.freeze({
    NEUTRAL: 'A recent partner used Partner Notify to share that you may have been exposed to an STI. Consider getting tested.',
    SUPPORTIVE: 'Health notice from Partner Notify: you may have been exposed to an STI. Testing can help you decide what to do next.',
    DIRECT: 'Partner Notify health notice: you may have been exposed to an STI. Consider getting tested.'
  })
});

function getTemplate(templateType, tone, { supportUrl, testingLocatorUrl } = {}) {
  const template = templates[templateType]?.[tone] || null;
  return template ? withLinks(template, { supportUrl, testingLocatorUrl }) : null;
}

function getPublicTemplates({ supportUrl, testingLocatorUrl } = {}) {
  const publicTemplates = {};
  for (const [templateType, tones] of Object.entries(templates)) {
    publicTemplates[templateType] = {};
    for (const [tone, text] of Object.entries(tones)) {
      publicTemplates[templateType][tone] = withLinks(text, { supportUrl, testingLocatorUrl });
    }
  }

  return {
    version: TEMPLATE_VERSION,
    templates: publicTemplates
  };
}

module.exports = {
  TEMPLATE_VERSION,
  getPublicTemplates,
  getTemplate,
  templates
};
