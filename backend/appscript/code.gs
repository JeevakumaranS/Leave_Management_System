function doGet() {
  return jsonResponse_({ ok: true, service: 'lms-email' });
}

function doPost(e) {
  var payload;

  try {
    payload = JSON.parse(e && e.postData ? e.postData.contents : '{}');
  } catch (error) {
    return jsonResponse_({ ok: false, error: 'Invalid JSON payload.' });
  }

  if (!payload || typeof payload !== 'object') {
    return jsonResponse_({ ok: false, error: 'Invalid JSON payload.' });
  }

  var expectedSecret = PropertiesService.getScriptProperties().getProperty('APPSCRIPT_SHARED_SECRET');
  if (!expectedSecret || payload.secret !== expectedSecret) {
    return jsonResponse_({ ok: false, error: 'Unauthorized.' });
  }

  var recipient = String(payload.to || '').trim();
  var subject = String(payload.subject || '').trim();
  var textBody = String(payload.textBody || '');
  var htmlBody = String(payload.htmlBody || '');

  if (!recipient || !subject || (!textBody && !htmlBody)) {
    return jsonResponse_({ ok: false, error: 'Recipient, subject, and message body are required.' });
  }

  try {
    var options = {
      to: recipient,
      subject: subject,
      body: textBody || stripHtml_(htmlBody),
    };
    if (htmlBody) options.htmlBody = htmlBody;

    MailApp.sendEmail(options);
    return jsonResponse_({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse_({ ok: false, error: 'Email delivery failed.' });
  }
}

function jsonResponse_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function stripHtml_(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
