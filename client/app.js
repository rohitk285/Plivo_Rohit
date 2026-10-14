document.addEventListener('DOMContentLoaded', () => {
  const callForm = document.getElementById('call-form');
  const phoneInput = document.getElementById('phone-number');
  const btnTriggerCall = document.getElementById('btn-trigger-call');
  const btnText = btnTriggerCall.querySelector('.btn-text');
  const spinner = btnTriggerCall.querySelector('.spinner');
  const responsePanel = document.getElementById('call-response-panel');
  const responseBadge = document.getElementById('response-status-badge');
  const responseDetails = document.getElementById('response-details');
  const logsFeed = document.getElementById('logs-feed');
  const btnRefreshLogs = document.getElementById('btn-refresh-logs');
  const btnClearLogs = document.getElementById('btn-clear-logs');
  const xmlOutputBox = document.getElementById('xml-output-box');

  const cfgCallerId = document.getElementById('cfg-caller-id');
  const cfgAssociateNum = document.getElementById('cfg-associate-num');
  const cfgOtp = document.getElementById('cfg-otp');
  const cfgBaseUrl = document.getElementById('cfg-base-url');

  let activeCallUuid = null;

  // Determine API base URL (relative if served by backend, or localhost:3000 if served independently)
  const API_BASE = (window.location.port === '3000' || !window.location.port || window.location.protocol === 'https:')
    ? ''
    : 'http://localhost:3000';

  // 1. Fetch system configuration
  async function loadConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/config`);
      const data = await res.json();
      if (data.success && data.configured) {
        cfgCallerId.textContent = data.configured.callerId || 'Not set';
        cfgAssociateNum.textContent = data.configured.liveAssociateNumber || 'Not set';
        cfgOtp.textContent = `${data.configured.hardcodedOtp} (DDMM)`;
        cfgBaseUrl.textContent = data.configured.detectedBaseUrl || data.configured.configuredBaseUrl;
      }
    } catch (err) {
      console.error('Failed to load server config:', err);
    }
  }

  // 2. Fetch and render call logs
  async function loadLogs() {
    try {
      const res = await fetch(`${API_BASE}/api/calls`);
      const data = await res.json();
      if (!data.success || !data.calls || data.calls.length === 0) {
        return;
      }

      logsFeed.innerHTML = '';

      // Aggregate all events from all calls, sorted by timestamp descending
      const allEvents = [];
      data.calls.forEach((call) => {
        (call.events || []).forEach((ev) => {
          allEvents.push({
            ...ev,
            callUuid: call.callUuid,
            toNumber: call.toNumber,
            callStatus: call.status,
          });
        });
      });

      allEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      allEvents.forEach((ev) => {
        const entry = document.createElement('div');
        entry.className = 'log-entry';

        // Apply status colors
        if (ev.type.includes('SUCCESS') || ev.type.includes('COMPLETED')) {
          entry.classList.add('status-success');
        } else if (ev.type.includes('FAILED') || ev.type.includes('BUSY') || ev.type.includes('INVALID')) {
          entry.classList.add('status-fail');
        } else if (ev.type.includes('ACTION') || ev.type.includes('LANG')) {
          entry.classList.add('status-action');
        }

        const timeStr = new Date(ev.timestamp).toLocaleTimeString();
        entry.innerHTML = `
          <div class="log-header">
            <span class="log-type">${ev.type}</span>
            <span>${timeStr}</span>
          </div>
          <div class="log-msg">${escapeHtml(ev.message)}</div>
          <div class="log-uuid">Target: ${ev.toNumber} | UUID: ${ev.callUuid.slice(0, 16)}...</div>
        `;
        logsFeed.appendChild(entry);
      });
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  }

  // 3. Initiate outbound call form submission
  callForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const toNumber = phoneInput.value.trim();
    if (!toNumber) return;

    btnTriggerCall.disabled = true;
    btnText.textContent = 'Calling Plivo...';
    spinner.style.display = 'inline-block';
    responsePanel.style.display = 'none';

    try {
      const res = await fetch(`${API_BASE}/api/make-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toNumber }),
      });

      const data = await res.json();
      responsePanel.style.display = 'flex';

      if (data.success) {
        activeCallUuid = data.callUuid;
        responseBadge.textContent = 'Call Queued & Connecting';
        responseBadge.style.color = 'var(--accent-emerald)';
        responseDetails.innerHTML = `
          <strong>Call UUID:</strong> ${data.callUuid}<br>
          <strong>From:</strong> ${data.fromNumber}<br>
          <strong>To:</strong> ${data.toNumber}<br>
          <strong>Answer Webhook:</strong> ${data.answerUrl}
        `;
      } else {
        responseBadge.textContent = 'Failed to Trigger Call';
        responseBadge.style.color = 'var(--accent-rose)';
        responseDetails.textContent = data.error || 'Unknown error occurred.';
      }
    } catch (err) {
      responsePanel.style.display = 'flex';
      responseBadge.textContent = 'Network / Server Error';
      responseBadge.style.color = 'var(--accent-rose)';
      responseDetails.textContent = err.message;
    } finally {
      btnTriggerCall.disabled = false;
      btnText.textContent = 'Initiate Call via Plivo';
      spinner.style.display = 'none';
      loadLogs();
    }
  });

  // 4. Quick Simulator & XML Inspector
  document.querySelectorAll('.sim-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const url = btn.getAttribute('data-url');
      const bodyJson = btn.getAttribute('data-body');

      xmlOutputBox.textContent = `Fetching ${url}...`;

      try {
        const options = {
          method: 'POST',
          headers: bodyJson ? { 'Content-Type': 'application/json' } : {},
          body: bodyJson || undefined,
        };

        const res = await fetch(`${API_BASE}${url}`, options);
        const text = await res.text();
        xmlOutputBox.textContent = formatXml(text);
        loadLogs();
      } catch (err) {
        xmlOutputBox.textContent = `Error fetching XML: ${err.message}`;
      }
    });
  });

  // 5. Log controls
  btnRefreshLogs.addEventListener('click', loadLogs);
  btnClearLogs.addEventListener('click', () => {
    logsFeed.innerHTML = '<div class="empty-state"><p>Logs cleared from view.</p></div>';
  });

  // Utility helpers
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatXml(xml) {
    if (!xml) return '';
    // Format simple indentation for readable display
    let formatted = '';
    let indent = '';
    const tab = '  ';
    xml.split(/>\s*</).forEach((node) => {
      if (node.match(/^\/\w/)) indent = indent.substring(tab.length);
      formatted += indent + '<' + node + '>\r\n';
      if (node.match(/^<?\w[^>]*[^\/]$/)) indent += tab;
    });
    return formatted.substring(1, formatted.length - 3);
  }

  // Initial load
  loadConfig();
  loadLogs();

  // Auto-refresh logs every 3 seconds
  setInterval(loadLogs, 3000);
});
