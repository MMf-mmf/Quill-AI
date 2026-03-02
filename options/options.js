// Quill AI — Options Page Logic

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL   = 'gemini-2.5-flash-lite';
const DEFAULT_STYLES  = ['Professional', 'Concise', 'Enhanced'];

// ─── DOM References ───────────────────────────────────────────────────────────

const apiKeyInput       = document.getElementById('api-key-input');
const toggleKeyBtn      = document.getElementById('toggle-key-btn');
const testConnectionBtn = document.getElementById('test-connection-btn');
const connectionStatus  = document.getElementById('connection-status');
const modelRadios       = document.querySelectorAll('input[name="model"]');
const themeRadios       = document.querySelectorAll('input[name="theme"]');
const styleCheckboxes   = document.querySelectorAll('input[name="style"]');
const stylesError       = document.getElementById('styles-error');
const customPromptEl    = document.getElementById('custom-prompt');
const autocompleteToggle = document.getElementById('autocomplete-toggle');
const acSettingsPanel    = document.getElementById('ac-settings');
const acDelayRadios      = document.querySelectorAll('input[name="ac-delay"]');
const acMinCharsInput    = document.getElementById('ac-min-chars');
const acHintsToggle      = document.getElementById('ac-hints-toggle');
const saveBtn           = document.getElementById('save-btn');
const saveFeedback      = document.getElementById('save-status');

// ─── Load Settings on Page Open ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const stored = await chrome.storage.local.get({
    apiKey: '',
    model:  DEFAULT_MODEL,
    styles: DEFAULT_STYLES,
    theme:  'auto',
    customPrompt: '',
    styleDescriptions: {},
    autocompleteEnabled: false,
    autocompleteDelay: 300,
    autocompleteMinChars: 10,
    autocompleteHints: true,
  });

  apiKeyInput.value = stored.apiKey;

  // Set model radio
  modelRadios.forEach(radio => {
    radio.checked = (radio.value === stored.model);
  });

  // Set style checkboxes
  styleCheckboxes.forEach(cb => {
    cb.checked = stored.styles.includes(cb.value);
  });

  // Set theme radio and apply
  themeRadios.forEach(r => { r.checked = (r.value === stored.theme); });
  applyTheme(stored.theme);

  // Set custom prompt
  customPromptEl.value = stored.customPrompt || '';
  buildStyleDescriptions(stored.styles, stored.styleDescriptions || {});

  // Set autocomplete toggle and sub-settings
  autocompleteToggle.checked = stored.autocompleteEnabled || false;
  acSettingsPanel.hidden = !autocompleteToggle.checked;
  acDelayRadios.forEach(r => { r.checked = (r.value === String(stored.autocompleteDelay)); });
  acMinCharsInput.value = stored.autocompleteMinChars || 10;
  acHintsToggle.checked = stored.autocompleteHints !== false;

  // Apply i18n to data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const msg = chrome.i18n.getMessage(el.dataset.i18n);
    if (msg) el.textContent = msg;
  });
});

// ─── Theme Live-Switching ─────────────────────────────────────────────────────

themeRadios.forEach(r => {
  r.addEventListener('change', () => { if (r.checked) applyTheme(r.value); });
});

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

function getSelectedTheme() {
  for (const r of themeRadios) {
    if (r.checked) return r.value;
  }
  return 'auto';
}

// ─── Show/Hide API Key ────────────────────────────────────────────────────────

toggleKeyBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type         = isPassword ? 'text' : 'password';
  toggleKeyBtn.textContent = isPassword ? 'Hide' : 'Show';
});

// ─── Test Connection ──────────────────────────────────────────────────────────

testConnectionBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    showConnectionStatus('error', chrome.i18n.getMessage('connectionNoKey') || '✗ No API key entered');
    return;
  }

  testConnectionBtn.disabled      = true;
  testConnectionBtn.textContent   = chrome.i18n.getMessage('testingBtn') || 'Testing…';
  connectionStatus.className      = 'status-badge';
  connectionStatus.textContent    = '';
  connectionStatus.classList.remove('visible');

  const model = getSelectedModel();
  const url   = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;

  try {
    const resp = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Reply with the single word OK' }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });

    if (resp.ok) {
      showConnectionStatus('success', chrome.i18n.getMessage('connectionSuccess') || '✓ Connected');
    } else {
      const msg = httpErrorShort(resp.status);
      showConnectionStatus('error', `✗ ${msg}`);
    }
  } catch {
    showConnectionStatus('error', chrome.i18n.getMessage('connectionNetworkError') || '✗ Network error');
  } finally {
    testConnectionBtn.disabled    = false;
    testConnectionBtn.textContent = chrome.i18n.getMessage('testConnectionBtn') || 'Test Connection';
  }
});

// ─── Save Settings ────────────────────────────────────────────────────────────

saveBtn.addEventListener('click', async () => {
  // Validate: need exactly 3 styles
  const selectedStyles = getSelectedStyles();
  if (selectedStyles.length !== 3) {
    stylesError.hidden = false;
    stylesError.textContent = chrome.i18n.getMessage('stylesError', [String(selectedStyles.length)]) ||
      `Please select exactly 3 styles (${selectedStyles.length} selected).`;
    return;
  }
  stylesError.hidden = true;

  const settings = {
    apiKey: apiKeyInput.value.trim(),
    model:  getSelectedModel(),
    styles: selectedStyles,
    theme:  getSelectedTheme(),
    customPrompt: customPromptEl.value.trim(),
    styleDescriptions: getCurrentStyleDescriptions(),
    autocompleteEnabled: autocompleteToggle.checked,
    autocompleteDelay: getSelectedAcDelay(),
    autocompleteMinChars: parseInt(acMinCharsInput.value, 10) || 10,
    autocompleteHints: acHintsToggle.checked,
  };

  await chrome.storage.local.set(settings);
  showSaveFeedback();
});

// Hide styles error on any checkbox change + rebuild style description inputs
styleCheckboxes.forEach(cb => {
  cb.addEventListener('change', () => {
    stylesError.hidden = true;
    buildStyleDescriptions(getSelectedStyles(), getCurrentStyleDescriptions());
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSelectedModel() {
  for (const radio of modelRadios) {
    if (radio.checked) return radio.value;
  }
  return DEFAULT_MODEL;
}

function getSelectedAcDelay() {
  for (const radio of acDelayRadios) {
    if (radio.checked) return parseInt(radio.value, 10);
  }
  return 300;
}

// Toggle autocomplete sub-settings visibility
autocompleteToggle.addEventListener('change', () => {
  acSettingsPanel.hidden = !autocompleteToggle.checked;
});

function getSelectedStyles() {
  return Array.from(styleCheckboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value);
}

function showConnectionStatus(type, text) {
  connectionStatus.className   = `status-badge ${type} visible`;
  connectionStatus.textContent = text;
}

function showSaveFeedback() {
  saveFeedback.textContent = chrome.i18n.getMessage('savedFeedback') || '✓ Saved';
  saveFeedback.classList.add('visible');
  setTimeout(() => {
    saveFeedback.classList.remove('visible');
  }, 2500);
}

function httpErrorShort(status) {
  switch (status) {
    case 401: return 'Invalid API key';
    case 403: return 'Not authorized — check AI Studio';
    case 429: return 'Rate limit hit';
    case 500: return 'Gemini server error';
    default:  return `HTTP ${status}`;
  }
}

// ─── Custom Prompt Helpers ───────────────────────────────────────────────────

function buildStyleDescriptions(selectedStyles, descriptions) {
  const container = document.getElementById('style-descriptions');
  if (!container) return;
  container.innerHTML = '';
  selectedStyles.forEach(style => {
    const row = document.createElement('div');
    row.className = 'style-desc-row';

    const label = document.createElement('span');
    label.className = 'style-desc-label';
    label.textContent = style;

    const input = document.createElement('input');
    input.className = 'style-desc-input';
    input.dataset.style = style;
    input.placeholder = 'Optional description...';
    input.value = descriptions[style] || '';

    row.appendChild(label);
    row.appendChild(input);
    container.appendChild(row);
  });
}

// ─── Usage Analytics ──────────────────────────────────────────────────────────

async function loadStats() {
  const { analytics } = await chrome.storage.local.get({
    analytics: { totalImprovements: 0, totalChars: 0, styleUsage: {}, modelUsage: {} },
  });
  const grid = document.getElementById('stats-grid');
  if (!grid) return;

  let html = `
    <div class="stat-item">
      <span class="stat-value">${analytics.totalImprovements}</span>
      <span class="stat-label">Total Improvements</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">${formatNumber(analytics.totalChars)}</span>
      <span class="stat-label">Characters Improved</span>
    </div>
  `;

  const styleEntries = Object.entries(analytics.styleUsage || {});
  if (styleEntries.length > 0) {
    html += '<div class="stat-breakdown"><div class="stat-breakdown-title">Style Usage</div>';
    styleEntries.sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
      html += `<div class="stat-breakdown-row"><span>${escapeHtml(name)}</span><span class="stat-breakdown-count">${count}</span></div>`;
    });
    html += '</div>';
  }

  const modelEntries = Object.entries(analytics.modelUsage || {});
  if (modelEntries.length > 0) {
    html += '<div class="stat-breakdown"><div class="stat-breakdown-title">Model Usage</div>';
    modelEntries.sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
      html += `<div class="stat-breakdown-row"><span>${escapeHtml(name)}</span><span class="stat-breakdown-count">${count}</span></div>`;
    });
    html += '</div>';
  }

  grid.innerHTML = html;
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.getElementById('reset-stats-btn').addEventListener('click', async () => {
  if (!confirm('Are you sure you want to reset all usage statistics? This cannot be undone.')) {
    return;
  }
  await chrome.storage.local.remove('analytics');
  loadStats();
});

// Load stats on page open
loadStats();

function getCurrentStyleDescriptions() {
  const descs = {};
  document.querySelectorAll('.style-desc-input').forEach(input => {
    const val = input.value.trim();
    if (val) descs[input.dataset.style] = val;
  });
  return descs;
}
