const express = require('express');
const router = express.Router();
const config = require('../config');
const xmlTemplates = require('../services/xmlTemplates');
const callTracker = require('../services/callTracker');

/**
 * Middleware helper to extract call identifiers and input digits.
 */
function extractCallDetails(req) {
  const body = req.body || {};
  const query = req.query || {};
  const digits = (body.Digits || query.Digits || body.digits || query.digits || '').toString().trim();
  const callUuid = body.CallUUID || query.CallUUID || body.call_uuid || null;
  const fromNumber = body.From || query.From || null;
  const toNumber = body.To || query.To || null;
  const baseUrl = config.resolveBaseUrl(req);

  return { digits, callUuid, fromNumber, toNumber, baseUrl };
}

/**
 * Helper to respond with text/xml.
 */
function sendXml(res, xml) {
  res.set('Content-Type', 'text/xml');
  res.send(xml);
}

// -----------------------------------------------------------------------------
// Route: /ivr/otp-prompt (POST & GET)
// Purpose: Prompts caller to input their 4-digit OTP
// -----------------------------------------------------------------------------
router.all('/otp-prompt', (req, res) => {
  const { callUuid, baseUrl } = extractCallDetails(req);

  console.log(`[IVR] /otp-prompt reached. CallUUID: ${callUuid || 'N/A'}`);
  callTracker.addEvent(callUuid, 'IVR_OTP_PROMPT', 'Prompting caller for 4-digit OTP');

  const xml = xmlTemplates.otpPrompt(baseUrl);
  sendXml(res, xml);
});

// -----------------------------------------------------------------------------
// Route: /ivr/otp-verify (POST & GET)
// Purpose: Validates DTMF OTP against hardcoded birthdate (DDMM)
// -----------------------------------------------------------------------------
router.all('/otp-verify', (req, res) => {
  const { digits, callUuid, baseUrl } = extractCallDetails(req);
  const expectedOtp = config.ivr.hardcodedOtp;

  console.log(`[IVR] /otp-verify received Digits: "${digits}" (Expected: "${expectedOtp}") | CallUUID: ${callUuid || 'N/A'}`);

  if (digits === expectedOtp) {
    console.log('[IVR] OTP verification SUCCESS. Proceeding to Language Selection (Level 1).');
    callTracker.addEvent(
      callUuid,
      'OTP_VERIFIED_SUCCESS',
      `Correct OTP (${digits}) entered. Advancing to Level 1 Menu.`,
      { enteredDigits: digits }
    );
    const xml = xmlTemplates.otpSuccess(baseUrl);
    return sendXml(res, xml);
  }

  console.warn(`[IVR] OTP verification FAILED. Entered: "${digits}". Re-prompting caller.`);
  callTracker.addEvent(
    callUuid,
    'OTP_VERIFIED_FAILED',
    `Invalid OTP (${digits || 'None'}) entered. Re-prompting OTP.`,
    { enteredDigits: digits, expectedOtp }
  );
  const xml = xmlTemplates.otpFailed(baseUrl);
  return sendXml(res, xml);
});

// -----------------------------------------------------------------------------
// Route: /ivr/level1-lang (POST & GET)
// Purpose: Returns Plivo XML for Language selection (1: English, 2: Spanish)
// -----------------------------------------------------------------------------
router.all('/level1-lang', (req, res) => {
  const { callUuid, baseUrl } = extractCallDetails(req);

  console.log(`[IVR] /level1-lang presenting language menu. CallUUID: ${callUuid || 'N/A'}`);
  callTracker.addEvent(callUuid, 'IVR_LEVEL1_LANG_PROMPT', 'Presenting Level 1 Language menu (1: EN, 2: ES)');

  const xml = xmlTemplates.level1Lang(baseUrl);
  sendXml(res, xml);
});

// -----------------------------------------------------------------------------
// Route: /ivr/level1-process (POST & GET)
// Purpose: Evaluates selected language; presents Level 2 Action Menu
// -----------------------------------------------------------------------------
router.all('/level1-process', (req, res) => {
  const { digits, callUuid, baseUrl } = extractCallDetails(req);
  const queryLang = (req.query.lang || req.body.lang || '').toString().toLowerCase().trim();

  let selectedLang = null;
  if (digits === '1' || queryLang === 'en') {
    selectedLang = 'en';
  } else if (digits === '2' || queryLang === 'es') {
    selectedLang = 'es';
  }

  if (selectedLang) {
    const langLabel = selectedLang === 'en' ? 'English' : 'Spanish';
    console.log(`[IVR] Language chosen: ${langLabel} (${selectedLang}). Presenting Level 2 Menu.`);
    callTracker.addEvent(
      callUuid,
      'IVR_LANG_SELECTED',
      `Language selected: ${langLabel}`,
      { selectedLang, digits }
    );
    const xml = xmlTemplates.level2Menu(baseUrl, selectedLang);
    return sendXml(res, xml);
  }

  console.warn(`[IVR] Invalid language selection: "${digits}". Re-prompting Level 1.`);
  callTracker.addEvent(
    callUuid,
    'IVR_LEVEL1_INVALID',
    `Invalid language choice: "${digits}". Re-prompting Level 1.`,
    { enteredDigits: digits }
  );
  const xml = xmlTemplates.level1Invalid(baseUrl);
  return sendXml(res, xml);
});

// -----------------------------------------------------------------------------
// Route: /ivr/level2-process (POST & GET)
// Purpose: Executes Level 2 Action: 1 = <Play> audio, 2 = <Dial> associate
// -----------------------------------------------------------------------------
router.all('/level2-process', (req, res) => {
  const { digits, callUuid, baseUrl } = extractCallDetails(req);
  const lang = (req.query.lang || req.body.lang || 'en').toString().toLowerCase().trim();

  console.log(`[IVR] /level2-process received Digits: "${digits}", Lang: "${lang}" | CallUUID: ${callUuid || 'N/A'}`);

  if (digits === '1') {
    // Action 1: Play MP3 audio file
    console.log(`[IVR] Action 1 selected: Play audio (${config.ivr.audioUrl})`);
    callTracker.addEvent(
      callUuid,
      'IVR_ACTION_PLAY_AUDIO',
      `Option 1 selected: Playing audio file (${config.ivr.audioUrl})`,
      { audioUrl: config.ivr.audioUrl, lang }
    );
    const xml = xmlTemplates.level2PlayAudio(config.ivr.audioUrl, lang);
    return sendXml(res, xml);
  }

  if (digits === '2') {
    // Action 2: Transfer Call via Dial to Live Associate
    console.log(`[IVR] Action 2 selected: Transfer call to ${config.ivr.liveAssociateNumber}`);
    callTracker.addEvent(
      callUuid,
      'IVR_ACTION_DIAL_ASSOCIATE',
      `Option 2 selected: Transferring call to live associate (${config.ivr.liveAssociateNumber})`,
      { associateNumber: config.ivr.liveAssociateNumber, callerId: config.plivo.callerId, lang }
    );
    const xml = xmlTemplates.level2DialAssociate(
      config.ivr.liveAssociateNumber,
      config.plivo.callerId,
      lang
    );
    return sendXml(res, xml);
  }

  // Invalid input for Level 2
  console.warn(`[IVR] Invalid Level 2 selection: "${digits}". Re-prompting Level 2.`);
  callTracker.addEvent(
    callUuid,
    'IVR_LEVEL2_INVALID',
    `Invalid option chosen in Level 2: "${digits}". Re-prompting.`,
    { enteredDigits: digits, lang }
  );
  const xml = xmlTemplates.level2Invalid(baseUrl, lang);
  return sendXml(res, xml);
});

module.exports = router;
