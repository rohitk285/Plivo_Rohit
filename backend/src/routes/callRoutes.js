const express = require('express');
const router = express.Router();
const config = require('../config');
const plivoClient = require('../plivoClient');
const callTracker = require('../services/callTracker');

/**
 * Route: POST /api/make-call
 * Purpose: Initiates Plivo outbound call using Plivo Voice SDK.
 */
router.post('/make-call', async (req, res) => {
  try {
    const body = req.body || {};
    const rawNumber = body.toNumber || body.to || body.phone;
    if (!rawNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: "toNumber" (e.g., +919876543210)',
      });
    }

    // Clean phone number (strip spaces, hyphens, parentheses)
    const toNumber = rawNumber.toString().replace(/[\s\-\(\)]/g, '').trim();

    if (!plivoClient) {
      return res.status(500).json({
        success: false,
        error: 'Plivo client is not initialized. Please check PLIVO_AUTH_ID and PLIVO_AUTH_TOKEN in .env',
      });
    }

    const baseUrl = config.resolveBaseUrl(req);
    const answerUrl = `${baseUrl}/ivr/otp-prompt`;
    const callbackUrl = `${baseUrl}/api/call-status`;

    console.log(`[CallAPI] Initiating outbound call to ${toNumber} from ${config.plivo.callerId}`);
    console.log(`[CallAPI] Answer URL: ${answerUrl}`);

    const response = await plivoClient.calls.create(
      config.plivo.callerId,
      toNumber,
      answerUrl,
      {
        answer_method: 'POST',
        callback_url: callbackUrl,
        callback_method: 'POST',
      }
    );

    const callUuid = response.requestUuid || response.callUuid || `req_${Date.now()}`;

    // Track call initiation in memory
    callTracker.registerCall(callUuid, {
      toNumber,
      fromNumber: config.plivo.callerId,
      requestUuid: response.requestUuid,
      apiMessage: response.message,
    });

    return res.status(200).json({
      success: true,
      message: 'Outbound call initiated successfully',
      callUuid,
      toNumber,
      fromNumber: config.plivo.callerId,
      answerUrl,
      rawResponse: response,
    });
  } catch (error) {
    console.error('[CallAPI] Error initiating call:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to initiate outbound call',
      details: error,
    });
  }
});

/**
 * Route: POST & GET /api/call-status
 * Purpose: Webhook endpoint for Plivo call lifecycle status callbacks.
 */
router.all('/call-status', (req, res) => {
  const callUuid = req.body.CallUUID || req.query.CallUUID || req.body.call_uuid || null;
  const status = req.body.CallStatus || req.query.CallStatus || req.body.status || 'unknown';

  console.log(`[CallAPI] Status callback received: ${status} for CallUUID: ${callUuid}`);

  if (callUuid) {
    callTracker.updateStatus(callUuid, status, req.body || req.query);
  }

  res.status(200).json({ success: true, received: true });
});

/**
 * Route: GET /api/calls
 * Purpose: Returns all tracked calls and their timeline events for frontend dashboard.
 */
router.get('/calls', (req, res) => {
  const calls = callTracker.getAllCalls();
  res.json({ success: true, count: calls.length, calls });
});

/**
 * Route: GET /api/calls/:callUuid
 * Purpose: Returns timeline and details for a specific call.
 */
router.get('/calls/:callUuid', (req, res) => {
  const call = callTracker.getCall(req.params.callUuid);
  if (!call) {
    return res.status(404).json({ success: false, error: 'Call record not found' });
  }
  res.json({ success: true, call });
});

/**
 * Route: GET /api/config
 * Purpose: Returns application configuration status (excluding sensitive tokens).
 */
router.get('/config', (req, res) => {
  const baseUrl = config.resolveBaseUrl(req);
  res.json({
    success: true,
    configured: {
      authIdConfigured: Boolean(config.plivo.authId),
      authTokenConfigured: Boolean(config.plivo.authToken),
      callerId: config.plivo.callerId,
      liveAssociateNumber: config.ivr.liveAssociateNumber,
      hardcodedOtp: config.ivr.hardcodedOtp,
      audioUrl: config.ivr.audioUrl,
      port: config.port,
      configuredBaseUrl: config.baseUrl,
      detectedBaseUrl: baseUrl,
    },
  });
});

module.exports = router;
