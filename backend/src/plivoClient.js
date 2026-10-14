const plivo = require('plivo');
const config = require('./config');

let plivoClient = null;

try {
  if (config.plivo.authId && config.plivo.authToken) {
    plivoClient = new plivo.Client(config.plivo.authId, config.plivo.authToken);
    console.log('[Plivo] Client initialized with Auth ID:', config.plivo.authId.slice(0, 6) + '...');
  } else {
    console.warn('[Plivo] Missing PLIVO_AUTH_ID or PLIVO_AUTH_TOKEN in configuration.');
  }
} catch (error) {
  console.error('[Plivo] Error initializing Plivo client:', error.message);
}

module.exports = plivoClient;
