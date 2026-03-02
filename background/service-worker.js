// Quill AI — Service Worker
// Handles context menu registration and Gemini API calls.

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL   = 'gemini-2.5-flash-lite';
const CONTEXT_MENU_ID = 'quill-improve';
const DEBUG           = false;
const MAX_INPUT_LENGTH = 8000;

// ─── Context Menu Registration ───────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id:       CONTEXT_MENU_ID,
    title:    chrome.i18n.getMessage('contextMenuTitle') || '✨ Improve with AI...',
    contexts: ['selection'],
  });
});

// ─── Context Menu Click ───────────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  if (!info.selectionText || !tab?.id) return;

  chrome.tabs.sendMessage(tab.id, {
    type: 'IMPROVE_TEXT',
    text: info.selectionText.trim(),
  });
});

// ─── Keyboard Shortcut ───────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'trigger-quill') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString()?.trim() || '',
    });
  } catch {
    return; // restricted page (chrome://, edge://, etc.)
  }

  const selectedText = results?.[0]?.result;
  if (!selectedText) return;

  chrome.tabs.sendMessage(tab.id, {
    type: 'IMPROVE_TEXT',
    text: selectedText,
  });
});

// ─── Message Listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CALL_GEMINI') {
    const tabId = sender.tab?.id;
    (async () => {
      // Try streaming first for progressive UI
      let result = tabId ? await handleGeminiCallStreaming(message.text, tabId) : null;
      // Fall back to non-streaming
      if (!result) result = await handleGeminiCall(message.text);
      sendResponse(result);
    })().catch(() => {
      sendResponse({ type: 'ERROR', code: 'UNKNOWN', message: chrome.i18n.getMessage('errorUnknown') || 'An unexpected error occurred.' });
    });
    return true; // keep channel open for async response
  }
  if (message.type === 'CALL_GEMINI_COMPLETE') {
    handleGeminiComplete(message.text)
      .then(result => sendResponse(result))
      .catch(() => sendResponse({ type: 'ERROR', code: 'UNKNOWN' }));
    return true;
  }
  if (message.type === 'ABORT_GEMINI_COMPLETE') {
    if (acAbortController) {
      acAbortController.abort();
      acAbortController = null;
    }
    return false;
  }
  if (message.type === 'ANALYZE_TEXT') {
    handleAnalyzeText(message.text)
      .then(result => sendResponse(result))
      .catch(() => sendResponse({ type: 'ERROR', code: 'UNKNOWN' }));
    return true;
  }
  if (message.type === 'ABORT_ANALYZE') {
    if (analysisAbortController) {
      analysisAbortController.abort();
      analysisAbortController = null;
    }
    return false;
  }
  if (message.type === 'TRACK_APPLY') {
    trackApply(message.label, message.charCount);
    // no response needed
  }
});

// ─── Gemini API Call ──────────────────────────────────────────────────────────

async function handleGeminiCall(selectedText) {
  // Guard: reject excessively long input that would waste tokens or timeout
  if (selectedText.length > MAX_INPUT_LENGTH) {
    return {
      type:    'ERROR',
      code:    'INPUT_TOO_LONG',
      message: chrome.i18n.getMessage('errorInputTooLong', [String(selectedText.length), String(MAX_INPUT_LENGTH)]) ||
               `Selection too long (${selectedText.length} chars). Please select fewer than ${MAX_INPUT_LENGTH} characters.`,
    };
  }

  // Load settings
  const { apiKey, model, styles, customPrompt, styleDescriptions } = await chrome.storage.local.get({
    apiKey: '',
    model:  DEFAULT_MODEL,
    styles: ['Professional', 'Concise', 'Enhanced'],
    customPrompt: '',
    styleDescriptions: {},
  });

  if (!apiKey) {
    return {
      type:    'ERROR',
      code:    'NO_API_KEY',
      message: chrome.i18n.getMessage('errorNoApiKey') || 'No API key set — open Quill AI Settings to add one.',
    };
  }

  const styleList = styles.slice(0, 3).map(s => {
    const desc = styleDescriptions?.[s];
    return desc ? `${s} (${desc})` : s;
  }).join(', ');
  const url       = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const systemText = customPrompt ||
    'You are an expert writing assistant. Given a snippet of text, return ' +
    'exactly 3 improved versions as a JSON object with a "suggestions" array. ' +
    'Each item must have a "label" (style name) and "text" (the improved version). ' +
    'Fix spelling, grammar, and clarity. Preserve meaning. ' +
    'Do not explain. Respond only with valid JSON.';

  const body = {
    system_instruction: {
      parts: [{ text: systemText }],
    },
    contents: [{
      role:  'user',
      parts: [{
        text: `Improve this text using these 3 styles: ${styleList}.\nText: "${selectedText}"`,
      }],
    }],
    generationConfig: {
      temperature:      0.7,
      maxOutputTokens:  4096,
      responseMimeType: 'application/json',
    },
  };

  let response;
  try {
    response = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
  } catch (networkErr) {
    return {
      type:    'ERROR',
      code:    'NETWORK',
      message: chrome.i18n.getMessage('errorNetwork') || 'Network error — check your connection.',
    };
  }

  if (!response.ok) {
    return { type: 'ERROR', ...httpErrorInfo(response.status) };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { type: 'ERROR', code: 'PARSE', message: chrome.i18n.getMessage('errorReadResponse') || 'Could not read API response.' };
  }

  // Thinking models (Gemini 2.5+, Gemini 3) return one or more parts with
  // thought:true (internal reasoning) followed by parts with thought:false
  // (the actual output). Concatenate all non-thought text parts to get the
  // full response regardless of how many output parts the model emits.
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  if (DEBUG) console.log('[Quill AI] All parts from API:', JSON.stringify(parts, null, 2));

  const raw = parts.filter(p => p.text && !p.thought).map(p => p.text).join('');
  if (DEBUG) console.log('[Quill AI] Extracted raw text:', raw);

  if (!raw) {
    return { type: 'ERROR', code: 'EMPTY', message: chrome.i18n.getMessage('errorEmptyResponse') || 'Gemini returned an empty response.' };
  }

  const suggestions = parseGeminiSuggestions(raw);
  if (!suggestions) {
    console.error('[Quill AI] Parse failed. Raw response was:', raw);
    return { type: 'ERROR', code: 'PARSE', message: chrome.i18n.getMessage('errorParse') || 'Could not parse AI response.' };
  }

  return { type: 'SUGGESTIONS', suggestions };
}

// ─── Streaming Gemini API Call ────────────────────────────────────────────────

async function handleGeminiCallStreaming(selectedText, tabId) {
  // Same validation as non-streaming
  if (selectedText.length > MAX_INPUT_LENGTH) return null; // let non-streaming handle the error

  const { apiKey, model, styles, customPrompt, styleDescriptions } = await chrome.storage.local.get({
    apiKey: '', model: DEFAULT_MODEL,
    styles: ['Professional', 'Concise', 'Enhanced'],
    customPrompt: '', styleDescriptions: {},
  });

  if (!apiKey) return null; // let non-streaming handle

  const styleList = styles.slice(0, 3).map(s => {
    const desc = styleDescriptions?.[s];
    return desc ? `${s} (${desc})` : s;
  }).join(', ');

  const systemText = customPrompt ||
    'You are an expert writing assistant. Given a snippet of text, return ' +
    'exactly 3 improved versions as a JSON object with a "suggestions" array. ' +
    'Each item must have a "label" (style name) and "text" (the improved version). ' +
    'Fix spelling, grammar, and clarity. Preserve meaning. ' +
    'Do not explain. Respond only with valid JSON.';

  const url = `${GEMINI_BASE_URL}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: [{ text: `Improve this text using these 3 styles: ${styleList}.\nText: "${selectedText}"` }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096, responseMimeType: 'application/json' },
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return null; // fall back to non-streaming
  }

  if (!response.ok || !response.body) return null;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let lastSentCount = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE format: lines starting with "data: " followed by JSON
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const chunk = JSON.parse(jsonStr);
          const parts = chunk?.candidates?.[0]?.content?.parts ?? [];
          const text = parts.filter(p => p.text && !p.thought).map(p => p.text).join('');
          fullText += text;
        } catch {
          // ignore unparseable chunks
        }
      }

      // Try to parse accumulated text as suggestions and send partial updates
      const suggestions = parseGeminiSuggestions(fullText);
      if (suggestions && suggestions.length > lastSentCount) {
        lastSentCount = suggestions.length;
        chrome.tabs.sendMessage(tabId, {
          type: 'SUGGESTION_PARTIAL',
          suggestions: suggestions,
        });
      }
    }
  } catch {
    // Stream reading failed — try to salvage what we have
    if (fullText) {
      const suggestions = parseGeminiSuggestions(fullText);
      if (suggestions) return { type: 'SUGGESTIONS', suggestions };
    }
    return null;
  }

  // Final parse
  const suggestions = parseGeminiSuggestions(fullText);
  if (suggestions) return { type: 'SUGGESTIONS', suggestions };
  return null;
}

// ─── JSON Parsing with Fallback ───────────────────────────────────────────────
// Gemini models return suggestions in several formats depending on the model
// version and whether thinking is active. We try each normalisation in order:
//
//   Format A  {"suggestions":[{"label":"...","text":"..."},...]}   ← standard
//   Format B  [{"label":"...","text":"..."},...]                   ← direct array
//   Format C  {"Professional":"...","Concise":"...","Enhanced":"..."} ← flat map
//   All of the above may be wrapped in ```json … ``` fences.
//   All of the above may appear after leading prose (extract first JSON token).

function normaliseToSuggestions(parsed) {
  // Format A
  if (Array.isArray(parsed?.suggestions)) return parsed.suggestions;
  // Format B
  if (Array.isArray(parsed)) return parsed;
  // Format C — plain object whose values are all strings
  if (parsed && typeof parsed === 'object') {
    const entries = Object.entries(parsed);
    if (entries.length > 0 && entries.every(([, v]) => typeof v === 'string')) {
      return entries.map(([label, text]) => ({ label, text }));
    }
  }
  return null;
}

function parseGeminiSuggestions(raw) {
  // Attempt 1: direct parse
  try {
    const result = normaliseToSuggestions(JSON.parse(raw));
    if (result) return result;
  } catch { /* fall through */ }

  // Attempt 2: strip markdown code fences (```json … ```) then parse
  try {
    const stripped = raw.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim();
    const result = normaliseToSuggestions(JSON.parse(stripped));
    if (result) return result;
  } catch { /* fall through */ }

  // Attempt 3: extract the first complete JSON object or array from mixed text
  try {
    const objStart = raw.indexOf('{');
    const arrStart = raw.indexOf('[');
    const start = objStart === -1 ? arrStart
                : arrStart === -1 ? objStart
                : Math.min(objStart, arrStart);
    if (start !== -1) {
      const isArr = raw[start] === '[';
      const end   = isArr ? raw.lastIndexOf(']') : raw.lastIndexOf('}');
      if (end > start) {
        const result = normaliseToSuggestions(JSON.parse(raw.slice(start, end + 1)));
        if (result) return result;
      }
    }
  } catch { /* fall through */ }

  return null;
}

// ─── HTTP Error Messages ──────────────────────────────────────────────────────

function httpErrorInfo(status) {
  const msg = (key, fallback) => chrome.i18n.getMessage(key) || fallback;
  switch (status) {
    case 400: return { code: '400', message: msg('error400', 'Request error — please try again.') };
    case 401: return { code: '401', message: msg('error401', 'Invalid API key — check Settings.') };
    case 403: return { code: '403', message: msg('error403', 'API key not authorized — check AI Studio.') };
    case 429: return { code: '429', message: msg('error429', 'Too many requests — try again in a moment.') };
    case 500: return { code: '500', message: msg('error500', 'Gemini is unavailable — try again shortly.') };
    default:  return { code: String(status), message: chrome.i18n.getMessage('errorUnexpectedStatus', [String(status)]) || `Unexpected error (${status}).` };
  }
}

// ─── Inline Autocomplete ─────────────────────────────────────────────────────

let acAbortController = null;

// Response cache: Map<textKey, { completion, timestamp }>
const acCache = new Map();
const AC_CACHE_MAX_SIZE = 50;
const AC_CACHE_TTL_MS   = 5 * 60 * 1000; // 5 minutes

// Exponential backoff state for autocomplete errors
let acBackoffUntil    = 0;     // timestamp — don't request before this
let acConsecutiveFails = 0;
const AC_BACKOFF_MAX_MS = 8000;

function acCacheGet(key) {
  const entry = acCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > AC_CACHE_TTL_MS) {
    acCache.delete(key);
    return null;
  }
  return entry.completion;
}

function acCacheSet(key, completion) {
  // Evict oldest entries if at capacity
  if (acCache.size >= AC_CACHE_MAX_SIZE) {
    const oldest = acCache.keys().next().value;
    acCache.delete(oldest);
  }
  acCache.set(key, { completion, timestamp: Date.now() });
}

async function handleGeminiComplete(textBeforeCursor) {
  // Check backoff
  if (Date.now() < acBackoffUntil) {
    return { type: 'ERROR', code: 'BACKOFF' };
  }

  // Check cache
  const cacheKey = textBeforeCursor.slice(-500); // use last 500 chars as key
  const cached = acCacheGet(cacheKey);
  if (cached !== null) {
    return { type: 'COMPLETION', completion: cached };
  }

  const { apiKey, model } = await chrome.storage.local.get({
    apiKey: '', model: DEFAULT_MODEL,
  });

  if (!apiKey) return { type: 'ERROR', code: 'NO_API_KEY' };

  // Create AbortController for this request
  if (acAbortController) acAbortController.abort();
  acAbortController = new AbortController();
  const { signal } = acAbortController;

  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: {
      parts: [{
        text: 'You are an inline text completion assistant. Given partial text, ' +
              'predict the most natural continuation. Return ONLY the completion text, ' +
              'no quotes, no explanation, no markdown. Keep it brief (1-2 sentences max). ' +
              'Match the language and writing style of the input. ' +
              'Do not repeat any text the user already wrote. ' +
              'If the text appears complete, return an empty string.',
      }],
    },
    contents: [{
      role: 'user',
      parts: [{ text: `Complete this text:\n${textBeforeCursor}` }],
    }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 128,
    },
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') return { type: 'ERROR', code: 'ABORTED' };
    acConsecutiveFails++;
    return { type: 'ERROR', code: 'NETWORK' };
  }

  if (!response.ok) {
    acConsecutiveFails++;
    // Exponential backoff for rate limits and server errors
    if (response.status === 429 || response.status >= 500) {
      const delay = Math.min(AC_BACKOFF_MAX_MS, 1000 * Math.pow(2, acConsecutiveFails - 1));
      acBackoffUntil = Date.now() + delay;
    }
    return { type: 'ERROR', code: String(response.status) };
  }

  let data;
  try { data = await response.json(); } catch { return { type: 'ERROR', code: 'PARSE' }; }

  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const completion = parts.filter(p => p.text && !p.thought).map(p => p.text).join('').trim();

  // Reset backoff on success
  acConsecutiveFails = 0;
  acBackoffUntil = 0;

  // Cache the result
  if (completion) acCacheSet(cacheKey, completion);

  return { type: 'COMPLETION', completion };
}

// ─── Usage Analytics ─────────────────────────────────────────────────────────

async function trackApply(label, charCount) {
  const { analytics, model } = await chrome.storage.local.get({
    analytics: { totalImprovements: 0, totalChars: 0, styleUsage: {}, modelUsage: {}, firstUsed: null, lastUsed: null },
    model: DEFAULT_MODEL,
  });

  analytics.totalImprovements += 1;
  analytics.totalChars += (charCount || 0);
  analytics.styleUsage[label] = (analytics.styleUsage[label] || 0) + 1;
  analytics.modelUsage[model] = (analytics.modelUsage[model] || 0) + 1;
  const now = new Date().toISOString();
  if (!analytics.firstUsed) analytics.firstUsed = now;
  analytics.lastUsed = now;

  await chrome.storage.local.set({ analytics });
}

// ─── Writing Analysis (Grammarly-style) ─────────────────────────────────────

let analysisAbortController = null;

// Analysis cache: Map<textHash, { issues, timestamp }>
const analysisCache = new Map();
const ANALYSIS_CACHE_MAX = 30;
const ANALYSIS_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

// Exponential backoff for analysis
let analysisBackoffUntil = 0;
let analysisConsecutiveFails = 0;

function analysisSimpleHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return String(hash);
}

function analysisCacheGet(key) {
  const entry = analysisCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ANALYSIS_CACHE_TTL) {
    analysisCache.delete(key);
    return null;
  }
  return entry.issues;
}

function analysisCacheSet(key, issues) {
  if (analysisCache.size >= ANALYSIS_CACHE_MAX) {
    const oldest = analysisCache.keys().next().value;
    analysisCache.delete(oldest);
  }
  analysisCache.set(key, { issues, timestamp: Date.now() });
}

async function handleAnalyzeText(text) {
  if (!text || text.trim().length < 10) {
    return { type: 'ANALYSIS', issues: [] };
  }

  if (text.length > MAX_INPUT_LENGTH) {
    text = text.substring(0, MAX_INPUT_LENGTH);
  }

  // Check backoff
  if (Date.now() < analysisBackoffUntil) {
    return { type: 'ERROR', code: 'BACKOFF' };
  }

  // Check cache
  const cacheKey = analysisSimpleHash(text);
  const cached = analysisCacheGet(cacheKey);
  if (cached !== null) {
    return { type: 'ANALYSIS', issues: cached };
  }

  const { apiKey, model } = await chrome.storage.local.get({
    apiKey: '', model: DEFAULT_MODEL,
  });

  if (!apiKey) {
    return {
      type: 'ERROR',
      code: 'NO_API_KEY',
      message: chrome.i18n.getMessage('errorNoApiKey') || 'No API key set — open Quill AI Settings to add one.',
    };
  }

  // Create AbortController
  if (analysisAbortController) analysisAbortController.abort();
  analysisAbortController = new AbortController();
  const { signal } = analysisAbortController;

  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const systemPrompt =
    'You are a precise writing analysis engine. Analyze the following text and return a JSON array of issues found.\n\n' +
    'Each issue object must have:\n' +
    '- "type": one of "correctness", "clarity", "engagement", "delivery"\n' +
    '- "original": the EXACT substring from the text that has the issue (must match verbatim, case-sensitive)\n' +
    '- "replacement": the suggested fix\n' +
    '- "explanation": a brief 1-sentence explanation\n\n' +
    'Rules:\n' +
    '- "original" MUST be a verbatim substring of the input text (case-sensitive, exact match)\n' +
    '- Return an empty array [] if no issues are found\n' +
    '- Maximum 20 issues\n' +
    '- Prioritize correctness issues first, then clarity, then engagement, then delivery\n\n' +
    'Categories:\n' +
    '- correctness: spelling errors, grammar mistakes, punctuation issues\n' +
    '- clarity: wordy phrases, passive voice, unclear sentences, redundancy\n' +
    '- engagement: weak vocabulary, repetitive words, flat tone\n' +
    '- delivery: formality mismatches, tone inconsistency, hedging language';

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [{
      role: 'user',
      parts: [{ text: `Analyze this text:\n\n${text}` }],
    }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') return { type: 'ERROR', code: 'ABORTED' };
    analysisConsecutiveFails++;
    return { type: 'ERROR', code: 'NETWORK', message: 'Network error — check your connection.' };
  }

  if (!response.ok) {
    analysisConsecutiveFails++;
    if (response.status === 429 || response.status >= 500) {
      const delay = Math.min(8000, 1000 * Math.pow(2, analysisConsecutiveFails - 1));
      analysisBackoffUntil = Date.now() + delay;
    }
    return { type: 'ERROR', ...httpErrorInfo(response.status) };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { type: 'ERROR', code: 'PARSE', message: 'Could not read API response.' };
  }

  // Extract text (filter thinking model parts)
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const raw = parts.filter(p => p.text && !p.thought).map(p => p.text).join('');

  if (!raw) {
    return { type: 'ANALYSIS', issues: [] };
  }

  // Reset backoff on success
  analysisConsecutiveFails = 0;
  analysisBackoffUntil = 0;

  // Parse the JSON array of issues
  const issues = parseAnalysisResponse(raw, text);

  // Cache
  analysisCacheSet(cacheKey, issues);

  return { type: 'ANALYSIS', issues };
}

function parseAnalysisResponse(raw, originalText) {
  let parsed = null;

  // Attempt 1: direct parse
  try { parsed = JSON.parse(raw); } catch { /* fall through */ }

  // Attempt 2: strip markdown fences
  if (!parsed) {
    try {
      const stripped = raw.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim();
      parsed = JSON.parse(stripped);
    } catch { /* fall through */ }
  }

  // Attempt 3: extract first JSON array
  if (!parsed) {
    try {
      const arrStart = raw.indexOf('[');
      const arrEnd = raw.lastIndexOf(']');
      if (arrStart !== -1 && arrEnd > arrStart) {
        parsed = JSON.parse(raw.slice(arrStart, arrEnd + 1));
      }
    } catch { /* fall through */ }
  }

  if (!parsed) return [];

  // Normalize: could be { issues: [...] } or direct array
  let issues = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.issues) ? parsed.issues : []);

  // Validate and filter: each issue must have original as an exact substring
  const validTypes = ['correctness', 'clarity', 'engagement', 'delivery'];
  issues = issues.filter(issue => {
    if (!issue || typeof issue !== 'object') return false;
    if (!issue.original || !issue.replacement) return false;
    if (!validTypes.includes(issue.type)) issue.type = 'correctness'; // default
    // Verify original exists in the text
    if (!originalText.includes(issue.original)) return false;
    return true;
  });

  return issues.slice(0, 20); // Max 20 issues
}
