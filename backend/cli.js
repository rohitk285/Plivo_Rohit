#!/usr/bin/env node

/**
 * InspireWorks Plivo Outbound Call CLI Trigger
 * Usage:
 *   node cli.js <target_phone_number>
 * Example:
 *   node cli.js +919876543210
 */

require('dotenv').config();
const config = require('./src/config');
const plivoClient = require('./src/plivoClient');

async function main() {
  const targetNumber = process.argv[2];

  if (!targetNumber) {
    console.error('\n❌ Error: Please provide a destination phone number.');
    console.log('Usage:');
    console.log('  node cli.js <phoneNumber>');
    console.log('Example:');
    console.log('  node cli.js +919876543210\n');
    process.exit(1);
  }

  const cleanedNumber = targetNumber.replace(/[\s\-\(\)]/g, '');

  console.log('========================================================');
  console.log('  InspireWorks Plivo Outbound Call CLI');
  console.log('========================================================');
  console.log(`From (Plivo Caller ID): ${config.plivo.callerId}`);
  console.log(`To (Target Phone):      ${cleanedNumber}`);
  console.log(`Base URL:               ${config.baseUrl}`);
  console.log(`Answer URL:             ${config.baseUrl}/ivr/otp-prompt`);
  console.log('--------------------------------------------------------');

  if (!plivoClient) {
    console.error('❌ Plivo client could not be initialized. Check PLIVO_AUTH_ID & PLIVO_AUTH_TOKEN in .env');
    process.exit(1);
  }

  try {
    console.log('📞 Initiating outbound call via Plivo API...');
    const response = await plivoClient.calls.create(
      config.plivo.callerId,
      cleanedNumber,
      `${config.baseUrl}/ivr/otp-prompt`,
      {
        answer_method: 'POST',
        callback_url: `${config.baseUrl}/api/call-status`,
        callback_method: 'POST',
      }
    );

    console.log('\n✅ Call initiated successfully!');
    console.log(`Request UUID: ${response.requestUuid || response.callUuid || 'N/A'}`);
    console.log(`API Message:  ${response.message || 'Queued'}`);
    console.log('\nNext steps:');
    console.log('1. Answer the incoming call on your device.');
    console.log('2. When prompted, enter OTP: ' + config.ivr.hardcodedOtp);
    console.log('3. Select 1 for English or 2 for Spanish.');
    console.log('4. Select 1 for Audio or 2 to transfer to ' + config.ivr.liveAssociateNumber);
    console.log('========================================================\n');
  } catch (error) {
    console.error('\n❌ Failed to initiate call:', error.message || error);
    process.exit(1);
  }
}

main();
