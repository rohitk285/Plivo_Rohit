const assert = require('assert');
const http = require('http');
const express = require('express');
const cors = require('cors');

const config = require('../src/config');
const callRoutes = require('../src/routes/callRoutes');
const ivrRoutes = require('../src/routes/ivrRoutes');

async function runTests() {
  console.log('--- Starting Plivo IVR Route & API Unit Tests ---');

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api', callRoutes);
  app.use('/ivr', ivrRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[Test Server] Running on ${baseUrl}`);

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(` PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(` FAIL: ${name}`);
      console.error(err);
      failed++;
    }
  }

  // 1. Health check / Config API
  await test('GET /api/config returns safe config and correct credentials info', async () => {
    const res = await fetch(`${baseUrl}/api/config`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.configured.callerId, '+918035454161');
    assert.strictEqual(data.configured.liveAssociateNumber, '02264236412');
    assert.strictEqual(data.configured.hardcodedOtp, '1503');
  });

  // 2. Outbound call validation
  await test('POST /api/make-call validates missing toNumber parameter', async () => {
    const res = await fetch(`${baseUrl}/api/make-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.error, /toNumber/i);
  });

  // 3. Level 0: OTP Prompt XML
  await test('POST /ivr/otp-prompt returns XML with GetDigits for OTP', async () => {
    const res = await fetch(`${baseUrl}/ivr/otp-prompt`, { method: 'POST' });
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.match(text, /<Response>/);
    assert.match(text, /<GetDigits.*action=".*\/ivr\/otp-verify"/);
    assert.match(text, /numDigits="4"/);
    assert.match(text, /<Redirect.*>.*\/ivr\/otp-prompt<\/Redirect>/);
  });

  // 4. OTP Verification: Failure branch (e.g. 0000)
  await test('POST /ivr/otp-verify with wrong OTP plays error and redirects to prompt', async () => {
    const res = await fetch(`${baseUrl}/ivr/otp-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Digits: '0000' }),
    });
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.match(text, /<Response>/);
    assert.match(text, /Invalid OTP\. Please try again\./);
    assert.match(text, /<Redirect.*>.*\/ivr\/otp-prompt<\/Redirect>/);
  });

  // 5. OTP Verification: Success branch (1503)
  await test('POST /ivr/otp-verify with valid OTP (1503) succeeds and redirects to level1-lang', async () => {
    const res = await fetch(`${baseUrl}/ivr/otp-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Digits: '1503' }),
    });
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.match(text, /<Response>/);
    assert.match(text, /<Redirect.*>.*\/ivr\/level1-lang<\/Redirect>/);
  });

  // 6. Level 1: Language selection XML
  await test('POST /ivr/level1-lang returns XML with GetDigits for language selection', async () => {
    const res = await fetch(`${baseUrl}/ivr/level1-lang`, { method: 'POST' });
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.match(text, /<GetDigits.*action=".*\/ivr\/level1-process"/);
    assert.match(text, /English.*español/i);
    assert.match(text, /<Redirect.*>.*\/ivr\/level1-lang<\/Redirect>/);
  });

  // 7. Level 1 Process: English (Digits = 1)
  await test('POST /ivr/level1-process with Digits=1 selects English and presents Level 2', async () => {
    const res = await fetch(`${baseUrl}/ivr/level1-process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Digits: '1' }),
    });
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.match(text, /<GetDigits.*action=".*\/ivr\/level2-process\?lang=en"/);
    assert.match(text, /You have selected English/i);
  });

  // 8. Level 1 Process: Spanish (Digits = 2)
  await test('POST /ivr/level1-process with Digits=2 selects Spanish and presents Level 2', async () => {
    const res = await fetch(`${baseUrl}/ivr/level1-process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Digits: '2' }),
    });
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.match(text, /<GetDigits.*action=".*\/ivr\/level2-process\?lang=es"/);
    assert.match(text, /Ha seleccionado español/i);
  });

  // 9. Level 1 Process: Invalid digit (Digits = 9)
  await test('POST /ivr/level1-process with invalid digit reprompts Level 1', async () => {
    const res = await fetch(`${baseUrl}/ivr/level1-process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Digits: '9' }),
    });
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.match(text, /Invalid selection/i);
    assert.match(text, /<Redirect.*>.*\/ivr\/level1-lang<\/Redirect>/);
  });

  // 10. Level 2 Process: Action 1 (Play Audio)
  await test('POST /ivr/level2-process with Digits=1 plays audio file', async () => {
    const res = await fetch(`${baseUrl}/ivr/level2-process?lang=en`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Digits: '1' }),
    });
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.match(text, /<Play>https:\/\/s3\.amazonaws\.com\/plivocloud\/Trumpet\.mp3<\/Play>/);
    assert.match(text, /<Hangup\/>/);
  });

  // 11. Level 2 Process: Action 2 (Transfer to Live Associate)
  await test('POST /ivr/level2-process with Digits=2 dials associate number (02264236412)', async () => {
    const res = await fetch(`${baseUrl}/ivr/level2-process?lang=en`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Digits: '2' }),
    });
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.match(text, /<Dial.*callerId="\+918035454161"/);
    assert.match(text, /<Number>02264236412<\/Number>/);
  });

  // 12. Level 2 Process: Invalid selection
  await test('POST /ivr/level2-process with invalid option reprompts Level 2 in selected language', async () => {
    const res = await fetch(`${baseUrl}/ivr/level2-process?lang=es`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Digits: '7' }),
    });
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.match(text, /Opción no válida/i);
    assert.match(text, /<Redirect.*>.*\/ivr\/level1-process\?lang=es<\/Redirect>/);
  });

  // 13. Call status callback endpoint
  await test('POST /api/call-status updates call lifecycle tracking', async () => {
    const res = await fetch(`${baseUrl}/api/call-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        CallUUID: 'test-uuid-1234',
        CallStatus: 'in-progress',
        From: '+918035454161',
        To: '+919999999999',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.received, true);

    const callRes = await fetch(`${baseUrl}/api/calls/test-uuid-1234`);
    const callData = await callRes.json();
    assert.strictEqual(callData.success, true);
    assert.strictEqual(callData.call.status, 'in-progress');
  });

  server.close();

  console.log(`\nTest Summary: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
