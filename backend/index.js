const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./src/config');
const callRoutes = require('./src/routes/callRoutes');
const ivrRoutes = require('./src/routes/ivrRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[HTTP] ${timestamp} ${req.method} ${req.originalUrl}`);
  next();
});

// Serve frontend static assets from client/ (or public/ if present)
const clientDir = path.resolve(__dirname, '../client');
const publicDir = path.resolve(__dirname, 'public');
app.use(express.static(clientDir));
app.use(express.static(publicDir));

// Fallback route for root to guarantee index.html delivery
app.get('/', (req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Mount API routes
app.use('/api', callRoutes);

// Mount IVR webhook routes
app.use('/ivr', ivrRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const baseUrl = config.resolveBaseUrl(req);
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'InspireWorks Plivo IVR Application',
    detectedBaseUrl: baseUrl,
  });
});

// 404 handler for API/IVR requests
app.use((req, res, next) => {
  if (req.accepts('xml')) {
    res.status(404).set('Content-Type', 'text/xml').send('<Response><Speak>Endpoint not found.</Speak></Response>');
  } else {
    res.status(404).json({ error: 'Endpoint not found', path: req.path });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ServerError]', err);
  if (req.accepts('xml')) {
    res.status(500).set('Content-Type', 'text/xml').send('<Response><Speak>An internal server error occurred.</Speak></Response>');
  } else {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Start server
const PORT = config.port;
const server = app.listen(PORT, () => {
  console.log('====================================================');
  console.log(` InspireWorks Plivo IVR Server running on port ${PORT}`);
  console.log(` Local Dashboard:  http://localhost:${PORT}`);
  console.log(` Base Webhook URL: ${config.baseUrl}`);
  console.log(` Caller ID (From): ${config.plivo.callerId}`);
  console.log(` Live Associate:   ${config.ivr.liveAssociateNumber}`);
  console.log(` Hardcoded OTP:    ${config.ivr.hardcodedOtp}`);
  console.log('====================================================');
});

module.exports = { app, server };
