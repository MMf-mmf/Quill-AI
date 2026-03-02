// Quill AI — Shared Utilities
// Loaded first by all content scripts. Exposes window.__quillShared.

(function () {
  'use strict';

  if (window.__quillShared) return; // Already loaded

  // ─── Theme State ──────────────────────────────────────────────────────────

  let _currentTheme = 'auto';
  chrome.storage.local.get({ theme: 'auto' }, (r) => { _currentTheme = r.theme; });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.theme) _currentTheme = changes.theme.newValue;
  });

  function isDarkMode() {
    return _currentTheme === 'dark' ||
      (_currentTheme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  // ─── Per-Site Disable Check ───────────────────────────────────────────────

  let _disabledSites = [];
  let _siteEnabled = true;

  chrome.storage.local.get({ disabledSites: [] }, (r) => {
    _disabledSites = r.disabledSites || [];
    _siteEnabled = !_disabledSites.includes(location.hostname);
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.disabledSites) {
      _disabledSites = changes.disabledSites.newValue || [];
      _siteEnabled = !_disabledSites.includes(location.hostname);
      // Notify listeners
      _siteToggleCallbacks.forEach((cb) => cb(_siteEnabled));
    }
  });

  const _siteToggleCallbacks = [];

  function onSiteToggle(cb) {
    _siteToggleCallbacks.push(cb);
  }

  function isSiteEnabled() {
    return _siteEnabled;
  }

  // ─── Deep Active Element ──────────────────────────────────────────────────

  function getDeepActiveElement() {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) {
      el = el.shadowRoot.activeElement;
    }
    return el;
  }

  // ─── Field Detection ──────────────────────────────────────────────────────

  function isEditableField(el) {
    if (!el) return false;
    if (el.nodeName === 'TEXTAREA') return true;
    if (el.nodeName === 'INPUT') {
      const t = (el.type || 'text').toLowerCase();
      return ['text', 'search', 'url', 'email'].includes(t);
    }
    if (el.contentEditable === 'true' || el.contentEditable === 'plaintext-only') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  // ─── Node Attachment Check ────────────────────────────────────────────────

  function isNodeAttached(node) {
    if (!node) return false;
    const root = node.getRootNode({ composed: false });
    if (root === document) return true;
    if (root instanceof ShadowRoot) return !!root.host && document.contains(root.host);
    return false;
  }

  // ─── HTML Escape ──────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Text Replacement: Input/Textarea ─────────────────────────────────────

  function replaceInInput(element, newText, start, end) {
    try {
      element.focus();
      element.setRangeText(newText, start, end, 'end');
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (err) {
      console.warn('[Quill AI] Input replacement failed:', err);
      return false;
    }
  }

  // ─── Text Replacement: Contenteditable ────────────────────────────────────
  // Async because React-based editors need rAF delays between steps.

  async function replaceInContentEditable(element, range, newText) {
    try {
      element.focus({ preventScroll: true });
      await new Promise((r) => requestAnimationFrame(r));

      if (!range || !isNodeAttached(range.startContainer)) {
        console.warn('[Quill AI] Range is stale — cannot replace.');
        return false;
      }

      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      await new Promise((r) => requestAnimationFrame(r));

      // Attempt 0: EditContext API (Chrome 121+)
      if (element.editContext) {
        try {
          const ec = element.editContext;
          const selStart = ec.selectionStart;
          const selEnd = ec.selectionEnd;
          ec.updateText(selStart, selEnd, newText);
          ec.updateSelection(selStart + newText.length, selStart + newText.length);
          if (typeof TextUpdateEvent !== 'undefined') {
            ec.dispatchEvent(new TextUpdateEvent('textupdate', {
              updateRangeStart: selStart,
              updateRangeEnd: selEnd,
              text: newText,
              selectionStart: selStart + newText.length,
              selectionEnd: selStart + newText.length,
            }));
          }
          element.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        } catch { /* fall through */ }
      }

      // Attempt 1: execCommand
      const inserted = document.execCommand('insertText', false, newText);
      if (inserted) {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }

      // Attempt 1.5: CKEditor paste simulation
      const isCKEditor = element.classList.contains('ck-editor__editable') ||
        element.classList.contains('ck-content') ||
        element.dataset.tid === 'ckeditor';
      if (isCKEditor) {
        try {
          const textBefore = element.textContent;
          const dt = new DataTransfer();
          dt.setData('text/plain', newText);
          element.dispatchEvent(new ClipboardEvent('paste', {
            bubbles: true, cancelable: true, clipboardData: dt,
          }));
          if (element.textContent !== textBefore) {
            element.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
        } catch { /* fall through */ }
      }

      // Attempt 2: Synthetic InputEvent
      try {
        const evt = new InputEvent('beforeinput', {
          bubbles: true, cancelable: true, inputType: 'insertText', data: newText,
        });
        const notCancelled = element.dispatchEvent(evt);
        if (notCancelled) {
          element.dispatchEvent(new InputEvent('input', {
            bubbles: true, inputType: 'insertText', data: newText,
          }));
          return true;
        }
      } catch { /* fall through */ }

      // Attempt 3: Direct Range API
      range.deleteContents();
      const textNode = document.createTextNode(newText);
      range.insertNode(textNode);
      const afterRange = document.createRange();
      afterRange.setStartAfter(textNode);
      afterRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(afterRange);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      return true;

    } catch (err) {
      console.warn('[Quill AI] Contenteditable replacement failed:', err);
      return false;
    }
  }

  // ─── Shadow DOM Host Creation Helper ──────────────────────────────────────

  function createShadowHost(id, css, extraStyles) {
    const host = document.createElement('div');
    host.id = id;
    if (isDarkMode()) host.classList.add('qp-dark');
    if (extraStyles) host.style.cssText = extraStyles;
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = css;
    shadow.appendChild(style);
    document.documentElement.appendChild(host);
    return { host, shadow };
  }

  // ─── Theme sync for shadow hosts ──────────────────────────────────────────

  const _shadowHosts = [];

  function registerShadowHost(host) {
    _shadowHosts.push(host);
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.theme) {
      const dark = isDarkMode();
      _shadowHosts.forEach((h) => {
        if (h && h.isConnected) h.classList.toggle('qp-dark', dark);
      });
    }
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (_currentTheme !== 'auto') return;
    const dark = isDarkMode();
    _shadowHosts.forEach((h) => {
      if (h && h.isConnected) h.classList.toggle('qp-dark', dark);
    });
  });

  // ─── Analysis Settings State ──────────────────────────────────────────────

  let _analysisMode = 'manual';
  let _analysisDelay = 2000;
  let _analysisCategories = ['correctness', 'clarity', 'engagement', 'delivery'];

  chrome.storage.local.get({
    analysisMode: 'manual',
    analysisDelay: 2000,
    analysisCategories: ['correctness', 'clarity', 'engagement', 'delivery'],
  }, (r) => {
    _analysisMode = r.analysisMode;
    _analysisDelay = r.analysisDelay;
    _analysisCategories = r.analysisCategories;
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.analysisMode) _analysisMode = changes.analysisMode.newValue;
    if (changes.analysisDelay) _analysisDelay = changes.analysisDelay.newValue;
    if (changes.analysisCategories) _analysisCategories = changes.analysisCategories.newValue;
  });

  // ─── Category Colors ─────────────────────────────────────────────────────

  const CATEGORY_COLORS = {
    correctness: { color: '#EF4444', label: 'Correctness', darkColor: '#F87171' },
    clarity:     { color: '#3B82F6', label: 'Clarity',     darkColor: '#60A5FA' },
    engagement:  { color: '#10B981', label: 'Engagement',  darkColor: '#34D399' },
    delivery:    { color: '#8B5CF6', label: 'Delivery',    darkColor: '#A78BFA' },
  };

  // ─── Expose API ───────────────────────────────────────────────────────────

  window.__quillShared = {
    isDarkMode,
    isSiteEnabled,
    onSiteToggle,
    getDeepActiveElement,
    isEditableField,
    isNodeAttached,
    escapeHtml,
    replaceInInput,
    replaceInContentEditable,
    createShadowHost,
    registerShadowHost,
    get analysisMode()       { return _analysisMode; },
    get analysisDelay()      { return _analysisDelay; },
    get analysisCategories() { return _analysisCategories; },
    CATEGORY_COLORS,
  };

})();
