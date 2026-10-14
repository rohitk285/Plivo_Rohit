require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  plivo: {
    authId: process.env.PLIVO_AUTH_ID || 'MAMTAWMGIOMZCTNTYZZS',
    authToken: process.env.PLIVO_AUTH_TOKEN || 'NDc4YTBIMTQtM2E1MS00ZDBILWI3YjgtNjQ3NDUW',
    callerId: process.env.PLIVO_NUMBER || '+918035454161',
  },
  ivr: {
    liveAssociateNumber: process.env.LIVE_ASSOCIATE_NUMBER || '02264236412',
    hardcodedOtp: (process.env.HARDCODED_OTP || '1503').trim(),
    audioUrl: process.env.AUDIO_URL || 'https://s3.amazonaws.com/plivocloud/Trumpet.mp3',
  },
  /**
   * Helper to resolve the correct base URL.
   * If a public domain/ngrok URL is defined in env, it is preferred.
   * If running behind a reverse proxy (like ngrok), it extracts protocol and host from headers.
   */
  resolveBaseUrl(req) {
    if (config.baseUrl && !config.baseUrl.includes('localhost') && !config.baseUrl.includes('127.0.0.1')) {
      return config.baseUrl.replace(/\/$/, '');
    }

    if (req) {
      const forwardedProto = req.headers['x-forwarded-proto'];
      const forwardedHost = req.headers['x-forwarded-host'];
      if (forwardedHost) {
        const proto = forwardedProto || 'https';
        return `${proto}://${forwardedHost}`;
      }
      const host = req.get('host');
      if (host) {
        return `${req.protocol}://${host}`;
      }
    }

    return config.baseUrl.replace(/\/$/, '');
  }
};

module.exports = config;
