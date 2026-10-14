const plivo = require('plivo');
const config = require('../config');

/**
 * Service to generate Plivo XML responses using the official Plivo SDK Response Builder.
 */
class XmlTemplates {
  /**
   * Generates Level 0: Prompt user to enter 4-digit OTP.
   */
  otpPrompt(baseUrl) {
    const response = new plivo.Response();
    const getDigits = response.addGetDigits({
      action: `${baseUrl}/ivr/otp-verify`,
      method: 'POST',
      numDigits: 4,
      timeout: 10,
      retries: 1,
    });
    getDigits.addSpeak('Welcome to InspireWorks. Please enter your four digit OTP using your phone keypad.');

    response.addSpeak('We did not receive any input.');
    response.addRedirect(`${baseUrl}/ivr/otp-prompt`, { method: 'POST' });
    return response.toXML();
  }

  /**
   * Generates response when OTP verification fails.
   * Plan requirement:
   * <Response><Speak>Invalid OTP. Please try again.</Speak><Redirect>${BASE_URL}/ivr/otp-prompt</Redirect></Response>
   */
  otpFailed(baseUrl) {
    const response = new plivo.Response();
    response.addSpeak('Invalid OTP. Please try again.');
    response.addRedirect(`${baseUrl}/ivr/otp-prompt`, { method: 'POST' });
    return response.toXML();
  }

  /**
   * Generates response when OTP verification succeeds.
   * Plan requirement:
   * <Response><Redirect>${BASE_URL}/ivr/level1-lang</Redirect></Response>
   */
  otpSuccess(baseUrl) {
    const response = new plivo.Response();
    response.addSpeak('OTP verified successfully.');
    response.addRedirect(`${baseUrl}/ivr/level1-lang`, { method: 'POST' });
    return response.toXML();
  }

  /**
   * Generates Level 1: Language selection (1 for English, 2 for Spanish).
   */
  level1Lang(baseUrl) {
    const response = new plivo.Response();
    const getDigits = response.addGetDigits({
      action: `${baseUrl}/ivr/level1-process`,
      method: 'POST',
      numDigits: 1,
      timeout: 10,
      retries: 1,
    });
    getDigits.addSpeak('For English, press 1. Para español, presione 2.');

    response.addSpeak('We did not receive any input.');
    response.addRedirect(`${baseUrl}/ivr/level1-lang`, { method: 'POST' });
    return response.toXML();
  }

  /**
   * Generates error reprompt for Level 1 when invalid key is pressed.
   */
  level1Invalid(baseUrl) {
    const response = new plivo.Response();
    response.addSpeak('Invalid selection. For English, press 1. Para español, presione 2.');
    response.addRedirect(`${baseUrl}/ivr/level1-lang`, { method: 'POST' });
    return response.toXML();
  }

  /**
   * Generates Level 2 Action menu in the selected language.
   * 1 -> Play audio
   * 2 -> Forward to live associate
   */
  level2Menu(baseUrl, lang = 'en') {
    const response = new plivo.Response();
    const actionUrl = `${baseUrl}/ivr/level2-process?lang=${lang}`;

    if (lang === 'es') {
      const getDigits = response.addGetDigits({
        action: actionUrl,
        method: 'POST',
        numDigits: 1,
        timeout: 10,
        retries: 1,
      });
      getDigits.addSpeak('Ha seleccionado español. Presione 1 para escuchar un mensaje grabado. Presione 2 para hablar con un agente en vivo.', {
        language: 'es-ES',
        voice: 'WOMAN',
      });

      response.addSpeak('No recibimos ninguna respuesta.', { language: 'es-ES', voice: 'WOMAN' });
      response.addRedirect(`${baseUrl}/ivr/level1-process?lang=es`, { method: 'POST' });
    } else {
      const getDigits = response.addGetDigits({
        action: actionUrl,
        method: 'POST',
        numDigits: 1,
        timeout: 10,
        retries: 1,
      });
      getDigits.addSpeak('You have selected English. Press 1 to listen to an audio message. Press 2 to talk to a live associate.', {
        language: 'en-US',
        voice: 'WOMAN',
      });

      response.addSpeak('We did not receive any input.', { language: 'en-US', voice: 'WOMAN' });
      response.addRedirect(`${baseUrl}/ivr/level1-process?lang=en`, { method: 'POST' });
    }

    return response.toXML();
  }

  /**
   * Generates Level 2 Action 1: Play MP3 audio file.
   */
  level2PlayAudio(audioUrl, lang = 'en') {
    const response = new plivo.Response();
    response.addPlay(audioUrl || config.ivr.audioUrl);

    if (lang === 'es') {
      response.addSpeak('Gracias por llamar a InspireWorks. Hasta luego.', {
        language: 'es-ES',
        voice: 'WOMAN',
      });
    } else {
      response.addSpeak('Thank you for calling InspireWorks. Goodbye.', {
        language: 'en-US',
        voice: 'WOMAN',
      });
    }
    response.addHangup();
    return response.toXML();
  }

  /**
   * Generates Level 2 Action 2: Transfer call to Live Associate.
   */
  level2DialAssociate(associateNumber, callerId, lang = 'en') {
    const response = new plivo.Response();

    if (lang === 'es') {
      response.addSpeak('Por favor espere mientras le comunicamos con un agente en vivo.', {
        language: 'es-ES',
        voice: 'WOMAN',
      });
    } else {
      response.addSpeak('Please hold while we transfer you to a live associate.', {
        language: 'en-US',
        voice: 'WOMAN',
      });
    }

    const dial = response.addDial({
      callerId: callerId || config.plivo.callerId,
      timeout: 30,
    });
    dial.addNumber(associateNumber || config.ivr.liveAssociateNumber);

    return response.toXML();
  }

  /**
   * Generates Level 2 invalid choice reprompt.
   */
  level2Invalid(baseUrl, lang = 'en') {
    const response = new plivo.Response();

    if (lang === 'es') {
      response.addSpeak('Opción no válida. Por favor, inténtelo de nuevo.', {
        language: 'es-ES',
        voice: 'WOMAN',
      });
    } else {
      response.addSpeak('Invalid selection. Please try again.', {
        language: 'en-US',
        voice: 'WOMAN',
      });
    }

    response.addRedirect(`${baseUrl}/ivr/level1-process?lang=${lang}`, { method: 'POST' });
    return response.toXML();
  }
}

module.exports = new XmlTemplates();
