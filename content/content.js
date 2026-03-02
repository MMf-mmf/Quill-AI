// Quill AI — Content Script
// Handles the suggestion panel UI and text replacement.

// Guard against double-injection
if (window.__quillAILoaded) {
  // Already loaded — do nothing
} else {
  window.__quillAILoaded = true;

  // ─── Embedded Panel CSS (injected into Shadow Root) ───────────────────────
  // Manifest-loaded CSS does not apply inside Shadow DOM. The full content.css
  // (with Shadow DOM selectors) is inlined here and injected via a <style>
  // element inside the shadow root created by createPanel().

  const PANEL_CSS = `
@keyframes quill-slide-in {
  from { opacity: 0; transform: translateY(-8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes quill-shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position:  400px 0; }
}
@keyframes quill-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes quill-toast-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

:host {
  /* ── Light theme tokens (default) ── */
  --qp-bg: #FFFFFF;
  --qp-text: #111827;
  --qp-text-secondary: #374151;
  --qp-text-muted: #9CA3AF;
  --qp-text-muted-alt: #6B7280;
  --qp-border: #E5E7EB;
  --qp-card-border: #F3F4F6;
  --qp-card-hover-bg: #FDFAFF;
  --qp-card-hover-border: #DDD6FE;
  --qp-close-hover-bg: #F3F4F6;
  --qp-purple: #7C3AED;
  --qp-purple-dark: #5B21B6;
  --qp-purple-light: #EDE9FE;
  --qp-success: #10B981;
  --qp-success-bg: #ECFDF5;
  --qp-error: #EF4444;
  --qp-error-bg: #FEF2F2;
  --qp-skeleton-a: #F3F4F6;
  --qp-skeleton-b: #E9EAED;
  --qp-toast-bg: #111827;
  --qp-toast-text: #ffffff;
  --qp-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08);

  position: fixed !important;
  z-index: 2147483647 !important;
  display: block !important;
  width: 440px !important;
  max-height: 80vh !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  background: var(--qp-bg) !important;
  border: 1px solid var(--qp-border) !important;
  border-radius: 16px !important;
  box-shadow: var(--qp-shadow) !important;
  padding: 0 !important;
  font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif !important;
  font-size: 14px !important;
  line-height: 1.5 !important;
  color: var(--qp-text) !important;
  box-sizing: border-box !important;
  animation: quill-slide-in 0.18s ease-out both !important;
  pointer-events: auto !important;
}

/* ── Dark theme overrides ── */
:host(.qp-dark) {
  --qp-bg: #1F2937;
  --qp-text: #F9FAFB;
  --qp-text-secondary: #D1D5DB;
  --qp-text-muted: #9CA3AF;
  --qp-text-muted-alt: #9CA3AF;
  --qp-border: #374151;
  --qp-card-border: #374151;
  --qp-card-hover-bg: #2D3748;
  --qp-card-hover-border: #4C1D95;
  --qp-close-hover-bg: #374151;
  --qp-purple-light: #2E1065;
  --qp-skeleton-a: #374151;
  --qp-skeleton-b: #4B5563;
  --qp-toast-bg: #F9FAFB;
  --qp-toast-text: #111827;
  --qp-error-bg: #7F1D1D;
  --qp-success-bg: #064E3B;
  --qp-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.25);
}

:host::-webkit-scrollbar { width: 6px; }
:host::-webkit-scrollbar-track { background: transparent; }
:host::-webkit-scrollbar-thumb { background: var(--qp-border); border-radius: 3px; }

.qp-inner { all: unset; display: block; padding: 20px; box-sizing: border-box; }

.qp-header { all: unset; display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }

.qp-title { all: unset; display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: var(--qp-text); font-family: "Segoe UI", system-ui, sans-serif; }

.qp-title-icon { all: unset; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: var(--qp-purple); color: #fff; border-radius: 8px; font-size: 14px; }

.qp-close { all: unset; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; color: var(--qp-text-muted); font-size: 18px; line-height: 1; cursor: pointer; transition: background 0.12s, color 0.12s; box-sizing: border-box; }
.qp-close:hover { background: var(--qp-close-hover-bg); color: var(--qp-text-secondary); }

.qp-loading-label { all: unset; display: block; font-size: 12px; color: var(--qp-text-muted); font-family: "Segoe UI", system-ui, sans-serif; margin-bottom: 10px; }

.qp-skeleton-cards { all: unset; display: flex; flex-direction: column; gap: 10px; }

.qp-skeleton-card { all: unset; display: block; height: 84px; background: linear-gradient(90deg, var(--qp-skeleton-a) 25%, var(--qp-skeleton-b) 50%, var(--qp-skeleton-a) 75%); background-size: 800px 100%; border-radius: 10px; animation: quill-shimmer 1.4s infinite linear; box-sizing: border-box; }

.qp-cards { all: unset; display: flex; flex-direction: column; gap: 10px; animation: quill-fade-in 0.2s ease-out both; }

.qp-card { all: unset; display: block; border: 1.5px solid var(--qp-card-border); border-radius: 10px; padding: 14px 16px; cursor: default; transition: border-color 0.15s, box-shadow 0.15s, background 0.15s; box-sizing: border-box; background: var(--qp-bg); }
.qp-card:hover { border-color: var(--qp-card-hover-border); box-shadow: 0 2px 8px rgba(124, 58, 237, 0.10); background: var(--qp-card-hover-bg); }

.qp-card-top { all: unset; display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }

.qp-badge { all: unset; display: inline-block; padding: 3px 8px; background: var(--qp-purple-light); color: var(--qp-purple-dark); border-radius: 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; font-family: "Segoe UI", system-ui, sans-serif; line-height: 1.4; }

.qp-apply-btn, .qp-copy-btn { all: unset; display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; background: var(--qp-purple); color: #ffffff; border-radius: 6px; font-size: 12px; font-weight: 600; font-family: "Segoe UI", system-ui, sans-serif; cursor: pointer; transition: background 0.12s, transform 0.1s; line-height: 1; box-sizing: border-box; white-space: nowrap; }
.qp-apply-btn:hover, .qp-copy-btn:hover { background: var(--qp-purple-dark); }
.qp-apply-btn:active, .qp-copy-btn:active { transform: scale(0.95); }
.qp-apply-btn.copied, .qp-copy-btn.copied { background: var(--qp-success); }

.qp-card-text { all: unset; display: block; font-size: 13px; line-height: 1.6; color: var(--qp-text-secondary); font-family: "Segoe UI", system-ui, sans-serif; }

.qp-card-actions { all: unset; display: inline-flex; align-items: center; gap: 6px; }

.qp-copy-fallback-btn { all: unset; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; color: var(--qp-text-muted-alt); font-size: 14px; cursor: pointer; transition: background 0.12s, color 0.12s, border-color 0.12s; box-sizing: border-box; border: 1.5px solid var(--qp-border); background: transparent; }
.qp-copy-fallback-btn:hover { background: var(--qp-close-hover-bg); color: var(--qp-text-secondary); }
.qp-copy-fallback-btn.copied { color: var(--qp-success); border-color: var(--qp-success); background: var(--qp-success-bg); }

.qp-footer { all: unset; display: block; margin-top: 14px; font-size: 11px; color: var(--qp-text-muted); font-family: "Segoe UI", system-ui, sans-serif; text-align: center; }

.qp-error { all: unset; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 0 4px; text-align: center; animation: quill-fade-in 0.2s ease-out both; }

.qp-error-icon { all: unset; display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: var(--qp-error-bg); border-radius: 50%; color: var(--qp-error); font-size: 18px; line-height: 1; }

.qp-error-msg { all: unset; display: block; font-size: 13px; color: var(--qp-text-secondary); font-family: "Segoe UI", system-ui, sans-serif; line-height: 1.5; }

.qp-error-hint { all: unset; display: block; font-size: 11px; color: var(--qp-text-muted); font-family: "Segoe UI", system-ui, sans-serif; }

.qp-toast { all: unset; position: fixed !important; bottom: 24px !important; left: 50% !important; transform: translateX(-50%) !important; z-index: 2147483647 !important; display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; background: var(--qp-toast-bg); color: var(--qp-toast-text); border-radius: 24px; font-size: 13px; font-weight: 500; font-family: "Segoe UI", system-ui, sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,0.2); animation: quill-toast-in 0.2s ease-out both; pointer-events: none; white-space: nowrap; }

.qp-toast-check { all: unset; display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; background: var(--qp-success); border-radius: 50%; color: #fff; font-size: 11px; line-height: 1; flex-shrink: 0; }
`;

  // ─── Theme Detection (delegated to shared.js) ───────────────────────────
  // Uses window.__quillShared.isDarkMode() — shared.js is loaded first.

  function isDarkMode() {
    return window.__quillShared?.isDarkMode() || false;
  }

  // ─── State ────────────────────────────────────────────────────────────────

  let storedRange          = null;  // The Range of the user's selection
  let storedEditInfo       = null;  // { type, element, start, end } for input/textarea
  let panelEl              = null;  // The shadow host DOM element
  let toastEl              = null;  // The floating success toast
  let capturedInputContext = null;  // { element, start, end } snapped at right-click
  let storedPositionRect   = null;  // The rect used to anchor the panel

  // ─── Message Listener ─────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'IMPROVE_TEXT') {
      handleImproveText(message.text);
    }
    if (message.type === 'SUGGESTIONS') {
      showSuggestions(message.suggestions, false);
    }
    if (message.type === 'SUGGESTION_PARTIAL') {
      showSuggestions(message.suggestions, true);
    }
    if (message.type === 'ERROR') {
      showError(message.message || 'Something went wrong.');
    }
  });

  // ─── Deep Active Element Helper (delegated to shared.js) ─────────────────

  function getDeepActiveElement() {
    return window.__quillShared?.getDeepActiveElement() || document.activeElement;
  }

  // ─── Capture Input Selection at Right-Click ───────────────────────────────
  // window.getSelection() is always empty for <input>/<textarea>.
  // Capture selectionStart/End at right-click time, before the context menu
  // steals focus and the selection is lost.

  document.addEventListener('contextmenu', () => {
    const el = getDeepActiveElement();
    if (el && (el.nodeName === 'INPUT' || el.nodeName === 'TEXTAREA')) {
      capturedInputContext = {
        element: el,
        start:   el.selectionStart,
        end:     el.selectionEnd,
      };
    } else {
      capturedInputContext = null;
    }
  }, true);

  // ─── SPA Navigation State Invalidation ───────────────────────────────────
  // On SPA navigation (React Router, Vue Router, etc.), stored Range and
  // EditInfo references point to DOM nodes that may have been unmounted.
  // Clear them proactively so a stale apply attempt cannot corrupt state.

  function clearStoredState() {
    storedRange          = null;
    storedEditInfo       = null;
    storedPositionRect   = null;
    capturedInputContext = null;
    // Do NOT close an open panel — the user may still want the result.
  }

  window.addEventListener('popstate',   clearStoredState);
  window.addEventListener('hashchange', clearStoredState);

  // Intercept history.pushState / replaceState (used by all modern SPAs)
  if (!history.__quillAIPatched) {
    history.__quillAIPatched = true;
    const _origPush    = history.pushState.bind(history);
    const _origReplace = history.replaceState.bind(history);
    history.pushState    = function(...args) { _origPush(...args);    clearStoredState(); };
    history.replaceState = function(...args) { _origReplace(...args); clearStoredState(); };
  }

  // ─── Handle Improve Text ──────────────────────────────────────────────────

  function handleImproveText(text) {
    // Dismiss any existing panel first
    removePanel();

    // Capture selection before it can be lost
    const selection = window.getSelection();
    let selectionRect = null;

    if (selection && selection.rangeCount > 0) {
      storedRange    = selection.getRangeAt(0).cloneRange();
      selectionRect  = selection.getRangeAt(0).getBoundingClientRect();

      // Detect editable context for later replacement
      storedEditInfo = getEditableContext(storedRange);
    }

    // For <input>/<textarea>, window.getSelection() is always empty.
    // Use the selection state captured at right-click time (before focus was lost).
    if ((!storedEditInfo || storedEditInfo.type === 'readonly') && capturedInputContext) {
      const { element, start, end } = capturedInputContext;
      storedEditInfo = {
        type:    element.nodeName.toLowerCase(),
        element: element,
        start:   start,
        end:     end,
      };
    }

    // Position the panel relative to the full element bounds for input/textarea
    // so it appears completely above or below — never overlapping the field.
    if (storedEditInfo && (storedEditInfo.type === 'input' || storedEditInfo.type === 'textarea')) {
      selectionRect = storedEditInfo.element.getBoundingClientRect();
    }

    // Create and position panel
    panelEl = createPanel();
    positionPanel(panelEl, selectionRect);
    showLoading();
    attachPanelListeners();

    // Send to service worker and handle response via callback
    chrome.runtime.sendMessage({ type: 'CALL_GEMINI', text }, (response) => {
      if (chrome.runtime.lastError) {
        showError(chrome.runtime.lastError.message || chrome.i18n.getMessage('somethingWentWrong') || 'Something went wrong.');
        return;
      }
      if (response?.type === 'SUGGESTIONS') {
        showSuggestions(response.suggestions, false);
      } else if (response?.type === 'ERROR') {
        showError(response.message || chrome.i18n.getMessage('somethingWentWrong') || 'Something went wrong.');
      }
    });
  }

  // ─── Panel Creation (Shadow DOM) ──────────────────────────────────────────
  // The panel is hosted inside a Shadow Root attached to <html> (not <body>).
  //
  // Why <html>? Sites like Jira apply transform/will-change/isolation to
  // <body> or their root app container, creating CSS stacking contexts that
  // cap z-index for all descendants. The <html> element has no such
  // transforms, so a fixed-position child anchors directly to the viewport
  // and renders above all page content.
  //
  // Why Shadow Root? It provides native CSS encapsulation — no page CSS bleeds
  // into the panel, and the panel CSS doesn't affect the page.

  function createPanel() {
    const host = document.createElement('div');
    host.id = 'quill-ai-host';
    if (isDarkMode()) host.classList.add('qp-dark');
    // Inline base positioning on the host so it's correctly placed before
    // the Shadow Root's stylesheet has parsed and applied.
    host.style.cssText = [
      'position: fixed',
      'z-index: 2147483647',
      'top: 0',
      'left: 0',
      'width: 440px',
      'max-height: 80vh',
      'pointer-events: auto',
      'display: block',
      'border-radius: 16px',
    ].join('; ');

    // Attach shadow root — "open" mode lets DevTools inspect it
    const shadow = host.attachShadow({ mode: 'open' });

    // Inject the panel CSS into the shadow root
    const style = document.createElement('style');
    style.textContent = PANEL_CSS;
    shadow.appendChild(style);

    // Build the panel DOM inside the shadow root
    const inner = document.createElement('div');
    inner.className = 'qp-inner';

    const header = document.createElement('div');
    header.className = 'qp-header';

    const title = document.createElement('div');
    title.className = 'qp-title';
    title.innerHTML = `<span class="qp-title-icon">✦</span> ${chrome.i18n.getMessage('panelTitle') || 'Quill AI'}`;

    const closeBtn = document.createElement('button');
    closeBtn.className   = 'qp-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', chrome.i18n.getMessage('closePanelLabel') || 'Close panel');
    closeBtn.addEventListener('click', removePanel);

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Content slot (will be filled by showLoading / showSuggestions / showError)
    const content = document.createElement('div');
    content.className = 'qp-content';

    inner.appendChild(header);
    inner.appendChild(content);
    shadow.appendChild(inner);

    // Attach to <html>, not <body> — escapes all body-level stacking contexts
    document.documentElement.appendChild(host);

    return host;
  }

  // ─── Panel Positioning (position: fixed) ──────────────────────────────────
  // With position:fixed the panel anchors to the viewport.
  // getBoundingClientRect() already returns viewport-relative coordinates,
  // so NO scroll offsets are added — doing so would misplace the panel.

  const PANEL_WIDTH           = 440;
  const PANEL_MARGIN          = 16;
  const PANEL_HEIGHT_FALLBACK = 300;

  function positionPanel(panel, rect) {
    storedPositionRect = rect;

    // Horizontal: align to selection left edge, clamped to stay in viewport
    let left;
    if (rect && rect.width > 0) {
      left = rect.left;
    } else {
      left = Math.max(0, (window.innerWidth - PANEL_WIDTH) / 2);
    }
    const maxLeft = window.innerWidth - PANEL_WIDTH - PANEL_MARGIN;
    left = Math.min(left, Math.max(PANEL_MARGIN, maxLeft));
    panel.style.setProperty('left', `${Math.round(left)}px`, 'important');

    // Vertical: always above the anchor — computed after layout
    repositionAbove();
  }

  // Place the panel directly above the anchor rect.
  // Called after every content change so the height is remeasured each time.
  function repositionAbove() {
    if (!panelEl) return;
    requestAnimationFrame(() => {
      if (!panelEl) return;
      const rect    = storedPositionRect;
      // anchorY is viewport-relative top of the selection/element (no scrollY needed)
      const anchorY = (rect && rect.width > 0) ? rect.top : (window.innerHeight * 0.4);
      const panelH  = panelEl.offsetHeight || PANEL_HEIGHT_FALLBACK;
      let top       = anchorY - panelH - 8;  // 8px gap above anchor
      top           = Math.max(PANEL_MARGIN, top);
      panelEl.style.setProperty('top', `${Math.round(top)}px`, 'important');
    });
  }

  // ─── Loading Skeleton ──────────────────────────────────────────────────────

  function showLoading() {
    const content = panelEl.shadowRoot.querySelector('.qp-content');
    if (!content) return;

    content.innerHTML = `
      <div class="qp-loading-label">${chrome.i18n.getMessage('generatingSuggestions') || 'Generating suggestions…'}</div>
      <div class="qp-skeleton-cards">
        <div class="qp-skeleton-card"></div>
        <div class="qp-skeleton-card"></div>
        <div class="qp-skeleton-card"></div>
      </div>
    `;
    repositionAbove();
  }

  // ─── Suggestion Cards ──────────────────────────────────────────────────────

  function showSuggestions(suggestions, partial = false) {
    if (!panelEl) return;
    const content = panelEl.shadowRoot.querySelector('.qp-content');
    if (!content) return;

    const isEditable = storedEditInfo && storedEditInfo.type !== 'readonly';
    const btnLabel   = isEditable
      ? (chrome.i18n.getMessage('applyBtn') || 'Apply')
      : (chrome.i18n.getMessage('copyBtn') || 'Copy');

    const cards = document.createElement('div');
    cards.className = 'qp-cards';

    suggestions.forEach((item) => {
      const card    = document.createElement('div');
      card.className = 'qp-card';
      card.style.setProperty('cursor', 'pointer', 'important');

      const top     = document.createElement('div');
      top.className  = 'qp-card-top';

      const badge   = document.createElement('span');
      badge.className   = 'qp-badge';
      badge.textContent = item.label;

      // Action buttons grouped on the right
      const actions = document.createElement('div');
      actions.className = 'qp-card-actions';

      const btn     = document.createElement('button');
      btn.className  = isEditable ? 'qp-apply-btn' : 'qp-copy-btn';
      btn.textContent = btnLabel;

      actions.appendChild(btn);

      // Always show a clipboard icon as a manual fallback (especially useful on
      // JS-heavy sites like Teams where direct replacement may not work)
      if (isEditable) {
        const copyFallbackBtn = document.createElement('button');
        copyFallbackBtn.className   = 'qp-copy-fallback-btn';
        copyFallbackBtn.textContent = '⎘';
        copyFallbackBtn.title       = chrome.i18n.getMessage('copyToClipboard') || 'Copy to clipboard';
        copyFallbackBtn.addEventListener('click', (e) => {
          e.stopPropagation(); // Don't also trigger the card's Apply handler
          navigator.clipboard.writeText(item.text).then(() => {
            copyFallbackBtn.textContent = '✓';
            copyFallbackBtn.classList.add('copied');
            setTimeout(() => {
              copyFallbackBtn.textContent = '⎘';
              copyFallbackBtn.classList.remove('copied');
            }, 1500);
          }).catch(() => {
            copyFallbackBtn.textContent = '✕';
            setTimeout(() => { copyFallbackBtn.textContent = '⎘'; }, 1500);
          });
        });
        actions.appendChild(copyFallbackBtn);
      }

      top.appendChild(badge);
      top.appendChild(actions);

      const body    = document.createElement('div');
      body.className   = 'qp-card-text';
      body.textContent = item.text;

      card.appendChild(top);
      card.appendChild(body);

      // Entire card row is clickable
      card.addEventListener('click', () => handleApply(item.text, item.label, btn, isEditable));

      cards.appendChild(card);
    });

    // Add skeleton placeholders for remaining slots when streaming partial results
    if (partial) {
      const remaining = 3 - suggestions.length;
      for (let i = 0; i < remaining; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'qp-skeleton-card';
        cards.appendChild(skeleton);
      }
    }

    content.innerHTML = '';
    content.appendChild(cards);

    if (!partial) {
      const footer = document.createElement('div');
      footer.className = 'qp-footer';
      footer.textContent = isEditable
        ? (chrome.i18n.getMessage('footerEditable') || 'Click a suggestion to replace your selected text')
        : (chrome.i18n.getMessage('footerReadonly') || 'Click a suggestion to copy — text is read-only on this page');
      content.appendChild(footer);
    }

    repositionAbove();
  }

  // ─── Error State ──────────────────────────────────────────────────────────

  function showError(message) {
    if (!panelEl) return;
    const content = panelEl.shadowRoot.querySelector('.qp-content');
    if (!content) return;

    content.innerHTML = `
      <div class="qp-error">
        <span class="qp-error-icon">✕</span>
        <span class="qp-error-msg">${escapeHtml(message)}</span>
        <span class="qp-error-hint">${chrome.i18n.getMessage('pressEscToClose') || 'Press Esc to close'}</span>
      </div>
    `;
  }

  // ─── Apply / Copy ──────────────────────────────────────────────────────────
  // handleApply is async because contenteditable replacement now uses
  // requestAnimationFrame delays to let the host editor's focus/selection
  // handlers settle before we attempt to insert text.

  function handleApply(newText, label, btn, isEditable) {
    if (!isEditable) {
      // Read-only page: copy to clipboard
      navigator.clipboard.writeText(newText).then(() => {
        const original  = btn.textContent;
        btn.textContent = chrome.i18n.getMessage('copiedBtn') || 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1500);
      }).catch(() => {
        btn.textContent = chrome.i18n.getMessage('failedBtn') || 'Failed';
        setTimeout(() => { btn.textContent = chrome.i18n.getMessage('copyBtn') || 'Copy'; }, 1500);
      });
      return;
    }

    // For editable content: input/textarea is handled synchronously;
    // contenteditable goes through the async path.
    if (!storedEditInfo) {
      _clipboardFallback(newText);
      return;
    }

    const { type } = storedEditInfo;

    if (type === 'input' || type === 'textarea') {
      const ok = _replaceInputSync(newText);
      if (ok) {
        _trackApply(label, newText.length);
        showSuccessToast(chrome.i18n.getMessage('textReplaced') || 'Text replaced!');
        setTimeout(removePanel, 2000);
      } else {
        _clipboardFallback(newText);
      }
    } else {
      // contenteditable: async with RAF timing
      _replaceContenteditableAsync(newText).then((ok) => {
        if (!panelEl) return; // panel was dismissed while we waited
        if (ok) {
          _trackApply(label, newText.length);
          showSuccessToast(chrome.i18n.getMessage('textReplaced') || 'Text replaced!');
          setTimeout(removePanel, 2000);
        } else {
          _clipboardFallback(newText);
        }
      });
    }
  }

  function _trackApply(label, charCount) {
    chrome.runtime.sendMessage({ type: 'TRACK_APPLY', label, charCount });
  }

  function _clipboardFallback(newText) {
    navigator.clipboard.writeText(newText).then(() => {
      showSuccessToast(chrome.i18n.getMessage('copiedPasteCtrlV') || 'Copied — paste with Ctrl+V');
      setTimeout(removePanel, 4000);
    }).catch(() => {
      showSuccessToast(chrome.i18n.getMessage('applyFailedManual') || 'Apply failed — copy the text manually');
    });
  }

  // ─── Sync replacement for <input> / <textarea> ────────────────────────────

  function _replaceInputSync(newText) {
    if (!storedEditInfo) return false;
    const { element, start, end } = storedEditInfo;
    try {
      element.focus();
      element.setRangeText(newText, start, end, 'end');
      element.dispatchEvent(new Event('input',  { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (err) {
      console.warn('[Quill AI] Input replacement failed:', err);
      return false;
    }
  }

  // ─── Async replacement for contenteditable ────────────────────────────────
  // Why async? React-based editors (Teams, Outlook, Slack, Notion) run their
  // focus and selectionchange handlers asynchronously — they fire in a
  // microtask or rAF callback AFTER element.focus() returns. If we restore
  // the selection and call execCommand synchronously, the editor's focus
  // handler may overwrite our selection later, causing the insertion to land
  // at the wrong position or be silently reverted.
  //
  // The fix: await one requestAnimationFrame between each step so every queued
  // handler has time to run before we proceed.
  //
  // Replacement chain (tried in order):
  //   0. EditContext API     — new Teams (Chrome 121+), VS Code
  //   1. execCommand         — generates a *trusted* beforeinput; most editors
  //   2. Synthetic InputEvent — Slate/ProseMirror beforeinput handler
  //   3. Direct Range API    — plain contenteditable, no framework

  async function _replaceContenteditableAsync(newText) {
    if (!storedEditInfo) return false;
    const { element } = storedEditInfo;

    try {
      // Step 1: give focus back to the editor
      element.focus({ preventScroll: true });

      // Step 2: wait for the editor's focus handler to run (React effects, etc.)
      await new Promise(r => requestAnimationFrame(r));
      if (!panelEl) return false; // panel was closed while we waited

      // Step 3: validate stored Range is still in the live DOM
      if (!storedRange || !isNodeAttached(storedRange.startContainer)) {
        console.warn('[Quill AI] Stored range is stale — cannot replace text.');
        return false;
      }

      // Step 4: restore the browser's selection to the originally selected text
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(storedRange);

      // Step 5: wait for selectionchange handlers to run (editor internal model sync)
      await new Promise(r => requestAnimationFrame(r));
      if (!panelEl) return false;

      // ── Attempt 0: EditContext API ───────────────────────────────────────
      // New Teams (teams.cloud.microsoft) and VS Code may use the EditContext
      // API (Chrome 121 / Edge 121, Jan 2024). When an element has an
      // associated EditContext, execCommand and DOM Range manipulation are
      // completely ignored — text input is routed through the EditContext.
      // We dispatch a synthetic TextUpdateEvent to trigger the app's handler.
      if (element.editContext) {
        try {
          const ec       = element.editContext;
          const selStart = ec.selectionStart;
          const selEnd   = ec.selectionEnd;

          // Update the internal text buffer
          ec.updateText(selStart, selEnd, newText);
          ec.updateSelection(selStart + newText.length, selStart + newText.length);

          // Dispatch TextUpdateEvent so the app re-renders (if it listens)
          if (typeof TextUpdateEvent !== 'undefined') {
            ec.dispatchEvent(new TextUpdateEvent('textupdate', {
              updateRangeStart: selStart,
              updateRangeEnd:   selEnd,
              text:             newText,
              selectionStart:   selStart + newText.length,
              selectionEnd:     selStart + newText.length,
            }));
          }

          element.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        } catch (ecErr) {
          console.warn('[Quill AI] EditContext approach failed:', ecErr);
          // fall through to traditional approaches
        }
      }

      // ── Attempt 1: execCommand ───────────────────────────────────────────
      // Still the most broadly compatible approach — generates a *trusted*
      // beforeinput event internally (isTrusted:true), which frameworks like
      // Lexical and ProseMirror process correctly. Kept as Attempt 1 despite
      // deprecation for exactly this reason.
      // eslint-disable-next-line no-restricted-syntax
      const inserted = document.execCommand('insertText', false, newText);
      if (inserted) {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }

      // ── Attempt 1.5: CKEditor paste simulation ───────────────────────────
      // Teams web (teams.cloud.microsoft) uses CKEditor 5, which filters out
      // synthetic InputEvents (isTrusted:false). execCommand may also return
      // false. CKEditor 5 DOES handle ClipboardEvent('paste') via its internal
      // ClipboardObserver — this updates both the DOM and its internal model.
      // CKEditor renders synchronously during the paste handler, so we can
      // verify success immediately by comparing textContent.
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
        } catch (ckErr) {
          console.warn('[Quill AI] CKEditor paste simulation failed:', ckErr);
        }
      }

      // ── Attempt 2: Synthetic InputEvent ─────────────────────────────────
      // Slate.js, ProseMirror, TipTap listen to 'beforeinput' events and
      // drive their virtual-DOM state update from those events. Note that
      // event.isTrusted will be false here, so editors that guard against
      // untrusted input (e.g. new Teams) will ignore this.
      try {
        const beforeInputEvt = new InputEvent('beforeinput', {
          bubbles:    true,
          cancelable: true,
          inputType:  'insertText',
          data:       newText,
        });
        const notCancelled = element.dispatchEvent(beforeInputEvt);
        if (notCancelled) {
          element.dispatchEvent(new InputEvent('input', {
            bubbles:   true,
            inputType: 'insertText',
            data:      newText,
          }));
          return true;
        }
      } catch (inputEventErr) {
        console.warn('[Quill AI] InputEvent dispatch failed:', inputEventErr);
      }

      // ── Attempt 3: Direct Range manipulation ─────────────────────────────
      // Last resort for plain contenteditable divs with no framework.
      storedRange.deleteContents();
      const textNode = document.createTextNode(newText);
      storedRange.insertNode(textNode);
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

  // ─── Utility: Range Node Attachment Check ────────────────────────────────
  // document.contains() returns false for nodes inside a Shadow Root (e.g. Teams,
  // Outlook, many modern SPAs).  Walk the composed tree instead.

  function isNodeAttached(node) {
    if (!node) return false;
    const root = node.getRootNode({ composed: false });
    if (root === document) return true;
    // Shadow Root: check that its host element is itself in the document
    if (root instanceof ShadowRoot) return !!root.host && document.contains(root.host);
    return false;
  }

  // ─── Editable Context Detection ──────────────────────────────────────────
  // Walk up the DOM (crossing Shadow DOM boundaries) to find the editable root.
  //
  // Key fixes vs. naive implementation:
  //   1. Use node.contentEditable === 'true' (the property on THIS element) instead
  //      of node.isContentEditable (which is inherited by ALL children).
  //      The old code returned a <span> or <p> child instead of the root <div>,
  //      causing element.focus() to fail on non-focusable nodes.
  //   2. Cross shadow DOM boundaries: parentElement returns null at a shadow root
  //      boundary. When that happens, jump to the shadow host and continue up.
  //      Without this, any editor inside a Shadow DOM returned { type:'readonly' }
  //      and the clipboard fallback fired immediately without attempting replacement.

  function getEditableContext(range) {
    let node = range.startContainer;

    // For text nodes, start from parent element
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

    while (node && node !== document.body) {
      if (node.nodeName === 'INPUT' || node.nodeName === 'TEXTAREA') {
        return {
          type:    node.nodeName.toLowerCase(),
          element: node,
          start:   node.selectionStart,
          end:     node.selectionEnd,
        };
      }
      // Check the property on THIS element only (not inherited from an ancestor).
      // 'plaintext-only' is a newer contenteditable value (Chrome 112+).
      if (node.contentEditable === 'true' || node.contentEditable === 'plaintext-only') {
        return {
          type:    'contenteditable',
          element: node,
          start:   null,
          end:     null,
        };
      }

      // Traverse up — cross shadow DOM boundaries when needed.
      const next = node.parentElement;
      if (!next) {
        // parentElement is null: we may be at the root of a shadow tree.
        // Jump to the shadow host element and continue up the light DOM.
        const root = node.getRootNode({ composed: false });
        if (root instanceof ShadowRoot) {
          node = root.host;
        } else {
          break; // true document root — give up
        }
      } else {
        node = next;
      }
    }

    return { type: 'readonly', element: null, start: null, end: null };
  }

  // ─── Success Toast ────────────────────────────────────────────────────────

  function showSuccessToast(message) {
    if (toastEl) toastEl.remove();

    toastEl = document.createElement('div');
    toastEl.className = 'qp-toast';
    toastEl.innerHTML = `<span class="qp-toast-check">✓</span> ${escapeHtml(message)}`;

    // Append toast inside the shadow root so the shadow-scoped CSS applies to it
    panelEl.shadowRoot.appendChild(toastEl);

    setTimeout(() => {
      if (toastEl) toastEl.remove();
      toastEl = null;
    }, 2000);
  }

  // ─── Panel Cleanup ────────────────────────────────────────────────────────

  function removePanel() {
    if (panelEl) {
      panelEl.remove();  // Removes shadow host + entire shadow tree from <html>
      panelEl = null;
    }
    if (toastEl) {
      toastEl.remove();
      toastEl = null;
    }
    storedRange        = null;
    storedEditInfo     = null;
    storedPositionRect = null;
    document.removeEventListener('keydown', onEscKey);
    document.removeEventListener('mousedown', onOutsideClick);
  }

  function attachPanelListeners() {
    // Use a short delay so the click that opened the context menu doesn't
    // immediately trigger the outside-click handler.
    setTimeout(() => {
      document.addEventListener('keydown',   onEscKey,       { once: false });
      document.addEventListener('mousedown', onOutsideClick, { once: false });
    }, 150);
  }

  function onEscKey(e) {
    if (e.key === 'Escape') removePanel();
  }

  function onOutsideClick(e) {
    if (!panelEl) return;
    // composedPath() returns the full event path including through shadow roots.
    // If panelEl (the shadow host) is in the path, the click was inside the panel.
    // Using panelEl.contains(e.target) would fail because clicks inside the shadow
    // DOM are retargeted to the shadow host, making contains() always return false.
    const path = e.composedPath();
    if (!path.includes(panelEl)) {
      removePanel();
    }
  }

  // ─── Utility (delegated to shared.js) ────────────────────────────────────

  function escapeHtml(str) {
    return window.__quillShared?.escapeHtml(str) || String(str);
  }

  // ─── Debug Hook ───────────────────────────────────────────────────────────

  window.__quillAIDebug = function(opts = {}) {
    const fakeText = opts.text || 'Hello world, this is a test sentence.';
    // Use viewport-relative top coordinate (position:fixed, no scroll offset)
    const fakeRect = opts.rect || { top: 300, left: 200, width: 200, height: 20 };
    removePanel();
    panelEl = createPanel();
    positionPanel(panelEl, fakeRect);
    showLoading();
    attachPanelListeners();

    // After 1.5s inject fake suggestions
    setTimeout(() => {
      showSuggestions([
        { label: 'Professional', text: 'This is a professional rewrite of: ' + fakeText },
        { label: 'Concise',      text: 'Concise: ' + fakeText.split(' ').slice(0, 5).join(' ') + '…' },
        { label: 'Enhanced',     text: 'This enhanced version elaborates on: ' + fakeText },
      ]);
    }, 1500);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // INLINE AUTOCOMPLETE SUBSYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Key design decisions:
  //  • Ghost text is ALWAYS rendered inside a dedicated Shadow DOM container
  //    attached to <html>. This provides full CSS isolation from the page.
  //  • The completion text is stored in a separate variable (acCompletionText)
  //    so we never depend on the ghost element surviving framework mutations.
  //  • Field detection walks into Shadow DOM via acGetDeepActiveElement().
  //  • A rAF-based reposition loop keeps the ghost aligned with the cursor.
  //  • IME composition events are tracked to avoid triggering during CJK input.
  //  • Ctrl+Right / Cmd+Right accepts one word at a time.
  //  • AbortController cancels stale in-flight requests.
  //  • A MutationObserver watches for the active field being removed from DOM.

  // ── Autocomplete CSS (injected into Shadow DOM) ──

  const AUTOCOMPLETE_CSS = `
@keyframes qac-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes qac-dot-pulse {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}

:host {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 0 !important;
  height: 0 !important;
  overflow: visible !important;
  z-index: 2147483646 !important;
  pointer-events: none !important;
  border: none !important;
  margin: 0 !important;
  padding: 0 !important;
  background: none !important;
}

.qac-ghost {
  position: fixed;
  z-index: 2147483646;
  pointer-events: none;
  color: #9CA3AF;
  white-space: pre;
  overflow: hidden;
  text-overflow: ellipsis;
  animation: qac-fade-in 150ms ease-out;
  transform: translateZ(0);
}

:host(.qp-dark) .qac-ghost {
  color: #6B7280;
}

.qac-ghost.qac-multiline {
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 4.8em;
  overflow: hidden;
}

.qac-hint {
  display: inline-block;
  margin-left: 6px;
  padding: 0 5px;
  font-size: 10px;
  font-weight: 500;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 16px;
  color: #7C3AED;
  background: rgba(124, 58, 237, 0.08);
  border-radius: 3px;
  vertical-align: middle;
  white-space: nowrap;
  pointer-events: none;
}

:host(.qp-dark) .qac-hint {
  color: #A78BFA;
  background: rgba(167, 139, 250, 0.12);
}

.qac-loading {
  position: fixed;
  z-index: 2147483646;
  pointer-events: none;
  display: flex;
  gap: 3px;
  align-items: center;
  padding: 2px 0;
}

.qac-loading span {
  display: block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #7C3AED;
  animation: qac-dot-pulse 1.2s ease-in-out infinite;
}

:host(.qp-dark) .qac-loading span {
  background: #A78BFA;
}

.qac-loading span:nth-child(2) { animation-delay: 0.15s; }
.qac-loading span:nth-child(3) { animation-delay: 0.3s; }

/* Screen-reader-only live region */
.qac-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
`;

  // ── State ──

  let acEnabled          = false;
  let acDebounceTimer    = null;
  let acActiveField      = null;      // the editable element being completed
  let acCompletionText   = '';        // full remaining completion text
  let acRequestId        = 0;         // monotonic counter to ignore stale responses
  let acIsComposing      = false;     // IME composition in progress
  let acIsRequesting     = false;     // an API request is in-flight
  let acLastRequestedText = '';       // deduplication: last text sent to API
  let acFieldObserver    = null;      // MutationObserver watching for field removal
  let acRafId            = null;      // requestAnimationFrame ID for repositioning

  // Shadow DOM container
  let acShadowHost       = null;
  let acShadowRoot       = null;
  let acGhostEl          = null;      // .qac-ghost element inside shadow root
  let acLoadingEl        = null;      // .qac-loading element inside shadow root
  let acSrLive           = null;      // screen-reader live region

  // Settings (loaded from storage, kept in sync)
  let acDebounceMs       = 300;
  let acMinTextLength    = 10;
  let acShowHints        = true;

  // ── Settings sync ──

  function acLoadSettings() {
    chrome.storage.local.get({
      autocompleteEnabled: false,
      autocompleteDelay: 300,
      autocompleteMinChars: 10,
      autocompleteHints: true,
    }, (r) => {
      acEnabled = r.autocompleteEnabled;
      acDebounceMs = r.autocompleteDelay || 300;
      acMinTextLength = r.autocompleteMinChars || 10;
      acShowHints = r.autocompleteHints !== false;
      if (acEnabled) acStartObserver();
    });
  }
  acLoadSettings();

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.autocompleteEnabled) {
      acEnabled = changes.autocompleteEnabled.newValue;
      if (acEnabled) acStartObserver();
      else acStopObserver();
    }
    if (changes.autocompleteDelay)    acDebounceMs    = changes.autocompleteDelay.newValue || 300;
    if (changes.autocompleteMinChars) acMinTextLength  = changes.autocompleteMinChars.newValue || 10;
    if (changes.autocompleteHints)    acShowHints      = changes.autocompleteHints.newValue !== false;
  });

  // ── Shadow DOM container (lazy init) ──

  function acEnsureShadowHost() {
    if (acShadowHost && document.documentElement.contains(acShadowHost)) return;

    const q = window.__quillShared;
    if (!q) return;

    const created = q.createShadowHost('quill-ac-host', AUTOCOMPLETE_CSS,
      'position:fixed!important;z-index:2147483646!important;top:0!important;left:0!important;width:0!important;height:0!important;overflow:visible!important;pointer-events:none!important;');
    acShadowHost = created.host;
    acShadowRoot = created.shadow;
    q.registerShadowHost(acShadowHost);

    // Add ARIA attributes for accessibility
    acShadowHost.setAttribute('role', 'status');
    acShadowHost.setAttribute('aria-live', 'polite');
    acShadowHost.setAttribute('aria-atomic', 'true');

    // Screen-reader live region
    acSrLive = document.createElement('div');
    acSrLive.className = 'qac-sr-only';
    acSrLive.setAttribute('aria-live', 'polite');
    acShadowRoot.appendChild(acSrLive);
  }

  // ── Deep active element (walks Shadow DOM) ──

  // Reuse shared.js getDeepActiveElement
  function acGetDeepActiveElement() {
    return window.__quillShared?.getDeepActiveElement() || document.activeElement;
  }

  // ── Observer start/stop ──

  function acStartObserver() {
    document.addEventListener('input',            acOnInput,            true);
    document.addEventListener('keydown',          acOnKeydown,          true);
    document.addEventListener('focusout',         acOnFocusOut,         true);
    document.addEventListener('compositionstart', acOnCompositionStart, true);
    document.addEventListener('compositionend',   acOnCompositionEnd,   true);
  }

  function acStopObserver() {
    document.removeEventListener('input',            acOnInput,            true);
    document.removeEventListener('keydown',          acOnKeydown,          true);
    document.removeEventListener('focusout',         acOnFocusOut,         true);
    document.removeEventListener('compositionstart', acOnCompositionStart, true);
    document.removeEventListener('compositionend',   acOnCompositionEnd,   true);
    acDismiss();
  }

  // ── Field detection ──

  function acIsEditableField(el) {
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

  // ── IME composition handling ──

  function acOnCompositionStart() {
    acIsComposing = true;
    acDismiss();
  }

  function acOnCompositionEnd() {
    acIsComposing = false;
    // After composition ends, schedule a completion check
    clearTimeout(acDebounceTimer);
    acDebounceTimer = setTimeout(() => {
      const el = acGetDeepActiveElement();
      if (acIsEditableField(el)) acRequestCompletion(el);
    }, acDebounceMs);
  }

  // ── Input handler ──

  function acOnInput(e) {
    if (!acEnabled || acIsComposing) return;

    let el = e.target;
    if (!acIsEditableField(el)) {
      el = acGetDeepActiveElement();
      if (!acIsEditableField(el)) return;
    }

    // Dismiss existing ghost on any new input
    acDismiss();
    clearTimeout(acDebounceTimer);

    // Cancel any in-flight request
    chrome.runtime.sendMessage({ type: 'ABORT_GEMINI_COMPLETE' });

    acDebounceTimer = setTimeout(() => {
      const current = acGetDeepActiveElement();
      if (current === el || current === document.activeElement) {
        acRequestCompletion(el);
      }
    }, acDebounceMs);
  }

  // ── Focus out ──

  function acOnFocusOut() {
    setTimeout(() => {
      if ((acGhostEl || acLoadingEl) && acActiveField) {
        const active = acGetDeepActiveElement();
        if (active !== acActiveField) {
          acDismiss();
        }
      }
    }, 100);
  }

  // ── Keyboard handler ──

  function acOnKeydown(e) {
    if (!acCompletionText || !acActiveField) return;

    // Tab: accept full completion
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      acAcceptFull();
      return false;
    }

    // Ctrl+Right (Win/Linux) or Cmd+Right (Mac): accept one word
    if (e.key === 'ArrowRight' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      acAcceptWord();
      return false;
    }

    // Escape: dismiss
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      acDismiss();
      return;
    }

    // Modifier-only keys don't dismiss
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;

    // Any other typing dismisses ghost text (the input handler will re-trigger)
    acDismiss();
  }

  // ── Request completion ──

  function acRequestCompletion(el) {
    let textBeforeCursor = '';
    let textAfterCursor = '';

    if (el.nodeName === 'INPUT' || el.nodeName === 'TEXTAREA') {
      const pos = el.selectionStart;
      if (pos == null) return;
      textBeforeCursor = el.value.substring(0, pos);
      textAfterCursor = el.value.substring(pos);
    } else {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      try {
        const preRange = range.cloneRange();
        preRange.selectNodeContents(el);
        preRange.setEnd(range.startContainer, range.startOffset);
        textBeforeCursor = preRange.toString();

        const postRange = range.cloneRange();
        postRange.selectNodeContents(el);
        postRange.setStart(range.endContainer, range.endOffset);
        textAfterCursor = postRange.toString();
      } catch {
        return;
      }
    }

    // Only show completions when cursor is at or near the end of the text.
    // Inserting ghost text in the middle of existing content is confusing.
    if (textAfterCursor.trim().length > 0) return;

    if (textBeforeCursor.length < acMinTextLength) return;

    const textToSend = textBeforeCursor.slice(-2000);

    // Deduplication: don't re-request the same text
    if (textToSend === acLastRequestedText && acIsRequesting) return;
    acLastRequestedText = textToSend;

    const thisRequestId = ++acRequestId;
    acActiveField = el;
    acIsRequesting = true;

    // Show loading indicator
    acShowLoading(el);

    // Watch for field removal from DOM
    acWatchField(el);

    chrome.runtime.sendMessage({
      type: 'CALL_GEMINI_COMPLETE',
      text: textToSend,
    }, (response) => {
      acIsRequesting = false;
      if (chrome.runtime.lastError) { acHideLoading(); return; }
      if (thisRequestId !== acRequestId) { acHideLoading(); return; }

      acHideLoading();

      // Verify field still has focus
      const current = acGetDeepActiveElement();
      if (current !== el && current !== acActiveField) return;

      // Verify field still in DOM
      if (!document.documentElement.contains(el)) return;

      if (response?.type === 'COMPLETION' && response.completion) {
        acShowGhost(el, response.completion);
      }
    });
  }

  // ── Field removal watcher ──

  function acWatchField(el) {
    acUnwatchField();
    if (!el.parentNode) return;

    acFieldObserver = new MutationObserver(() => {
      if (!document.documentElement.contains(el)) {
        acDismiss();
      }
    });
    acFieldObserver.observe(el.parentNode, { childList: true, subtree: true });
  }

  function acUnwatchField() {
    if (acFieldObserver) {
      acFieldObserver.disconnect();
      acFieldObserver = null;
    }
  }

  // ── Loading indicator ──

  function acShowLoading(el) {
    acHideLoading();
    acEnsureShadowHost();

    const pos = acGetCaretPosition(el);
    if (!pos) return;

    acLoadingEl = document.createElement('div');
    acLoadingEl.className = 'qac-loading';
    acLoadingEl.style.top = `${pos.top}px`;
    acLoadingEl.style.left = `${pos.left}px`;
    acLoadingEl.innerHTML = '<span></span><span></span><span></span>';
    acShadowRoot.appendChild(acLoadingEl);
  }

  function acHideLoading() {
    if (acLoadingEl) {
      acLoadingEl.remove();
      acLoadingEl = null;
    }
  }

  // ── Ghost Text Rendering (inside Shadow DOM) ──

  function acShowGhost(el, completion) {
    acDismissGhost();
    acHideLoading();
    acEnsureShadowHost();

    acCompletionText = completion;
    acActiveField = el;

    const pos = acGetCaretPosition(el);
    if (!pos) return;

    const computed = getComputedStyle(el);
    const isMultiline = el.nodeName === 'TEXTAREA' ||
      (el.contentEditable === 'true' || el.isContentEditable);

    // Build ghost element
    acGhostEl = document.createElement('div');
    acGhostEl.className = 'qac-ghost' + (isMultiline ? ' qac-multiline' : '');

    // Match field typography
    acGhostEl.style.fontFamily = computed.fontFamily;
    acGhostEl.style.fontSize = computed.fontSize;
    acGhostEl.style.fontWeight = computed.fontWeight;
    acGhostEl.style.letterSpacing = computed.letterSpacing;
    acGhostEl.style.lineHeight = computed.lineHeight;
    acGhostEl.style.top = `${pos.top}px`;
    acGhostEl.style.left = `${pos.left}px`;

    if (pos.maxWidth) {
      acGhostEl.style.maxWidth = `${pos.maxWidth}px`;
    }
    if (!isMultiline) {
      const lh = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.2;
      acGhostEl.style.height = `${lh}px`;
    }

    // Completion text span
    const textSpan = document.createElement('span');
    textSpan.className = 'qac-text';
    textSpan.textContent = completion;
    acGhostEl.appendChild(textSpan);

    // Keyboard hint badge
    if (acShowHints) {
      const hint = document.createElement('span');
      hint.className = 'qac-hint';
      hint.textContent = 'Tab';
      acGhostEl.appendChild(hint);
    }

    acShadowRoot.appendChild(acGhostEl);

    // Screen reader announcement
    if (acSrLive) {
      acSrLive.textContent = `Suggestion: ${completion.substring(0, 80)}. Press Tab to accept.`;
    }

    // Start rAF-based repositioning
    acStartReposition();

    // Watch for field removal
    acWatchField(el);
  }

  // ── Caret position helpers ──

  function acGetCaretPosition(el) {
    if (el.nodeName === 'INPUT' || el.nodeName === 'TEXTAREA') {
      return acGetCaretPositionForInput(el);
    }
    return acGetCaretPositionForContentEditable(el);
  }

  function acGetCaretPositionForInput(el) {
    const computed = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    // Measure text width up to cursor using a hidden mirror
    const mirror = document.createElement('span');
    mirror.style.cssText = [
      'position:absolute', 'visibility:hidden', 'white-space:pre',
      `font-family:${computed.fontFamily}`,
      `font-size:${computed.fontSize}`,
      `font-weight:${computed.fontWeight}`,
      `letter-spacing:${computed.letterSpacing}`,
      `padding-left:${computed.paddingLeft}`,
    ].join(';');
    mirror.textContent = el.value.substring(0, el.selectionStart);
    document.body.appendChild(mirror);
    const textWidth = mirror.offsetWidth;
    mirror.remove();

    const scrollLeft = el.scrollLeft || 0;
    const top = rect.top + parseFloat(computed.paddingTop) + parseFloat(computed.borderTopWidth);
    const left = rect.left + parseFloat(computed.paddingLeft) + parseFloat(computed.borderLeftWidth)
               + Math.min(textWidth - scrollLeft, rect.width - 20);
    const maxWidth = rect.right - left - 4;

    return maxWidth > 10 ? { top, left, maxWidth } : null;
  }

  function acGetCaretPositionForContentEditable(el) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(false);

    let caretRect = range.getBoundingClientRect();

    // Some browsers return a zero-rect for collapsed ranges; use a temp marker
    if (!caretRect || (caretRect.width === 0 && caretRect.height === 0 &&
        caretRect.top === 0 && caretRect.left === 0)) {
      const marker = document.createTextNode('\u200B');
      range.insertNode(marker);
      const markerRange = document.createRange();
      markerRange.selectNode(marker);
      caretRect = markerRange.getBoundingClientRect();
      marker.remove();
      // Restore selection
      sel.removeAllRanges();
      const restoreRange = document.createRange();
      try {
        restoreRange.setStart(range.startContainer, range.startOffset);
        restoreRange.collapse(true);
        sel.addRange(restoreRange);
      } catch {
        el.focus();
      }
    }

    if (!caretRect || caretRect.top === 0) return null;

    return {
      top: caretRect.top,
      left: caretRect.right,
      maxWidth: Math.max(200, window.innerWidth - caretRect.right - 20),
    };
  }

  // ── rAF-based repositioning ──

  function acStartReposition() {
    acStopReposition();
    function loop() {
      if (!acGhostEl || !acActiveField) return;
      acRepositionGhost();
      acRafId = requestAnimationFrame(loop);
    }
    acRafId = requestAnimationFrame(loop);
  }

  function acStopReposition() {
    if (acRafId) {
      cancelAnimationFrame(acRafId);
      acRafId = null;
    }
  }

  function acRepositionGhost() {
    if (!acGhostEl || !acActiveField) return;
    const pos = acGetCaretPosition(acActiveField);
    if (!pos) { acDismiss(); return; }
    acGhostEl.style.top = `${pos.top}px`;
    acGhostEl.style.left = `${pos.left}px`;
    if (pos.maxWidth) acGhostEl.style.maxWidth = `${pos.maxWidth}px`;
  }

  // ── Accept full completion ──

  function acAcceptFull() {
    if (!acCompletionText || !acActiveField) return;
    let completion = acCompletionText;
    // Always ensure a trailing space so the cursor isn't jammed against
    // the inserted text — matches Grammarly / Gmail Smart Compose behaviour.
    if (completion.length > 0 && !completion.endsWith(' ') && !completion.endsWith('\n')) {
      completion += ' ';
    }
    const el = acActiveField;
    acDismiss();
    acInsertText(el, completion);
  }

  // ── Accept one word ──

  function acAcceptWord() {
    if (!acCompletionText || !acActiveField) return;

    // Extract first word (including trailing whitespace)
    const match = acCompletionText.match(/^\s*\S+\s?/);
    if (!match) { acAcceptFull(); return; }

    const word = match[0];
    const remaining = acCompletionText.slice(word.length);
    const el = acActiveField;

    // Insert the word
    acInsertText(el, word);

    if (remaining.trim().length === 0) {
      // No more text — fully dismiss
      acDismiss();
    } else {
      // Update ghost with remaining text
      acCompletionText = remaining;
      if (acGhostEl) {
        const textSpan = acGhostEl.querySelector('.qac-text');
        if (textSpan) textSpan.textContent = remaining;
        // Reposition after insertion
        requestAnimationFrame(() => acRepositionGhost());
      }
      if (acSrLive) {
        acSrLive.textContent = `Remaining suggestion: ${remaining.substring(0, 80)}`;
      }
    }
  }

  // ── Text insertion ──

  function acInsertText(el, text) {
    if (el.nodeName === 'INPUT' || el.nodeName === 'TEXTAREA') {
      const pos = el.selectionStart;
      el.focus();
      el.setRangeText(text, pos, pos, 'end');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      el.focus({ preventScroll: true });
      requestAnimationFrame(() => {
        const inserted = document.execCommand('insertText', false, text);
        if (!inserted) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.collapse(false);
            const textNode = document.createTextNode(text);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
  }

  // ── Dismiss helpers ──

  function acDismissGhost() {
    if (acGhostEl) {
      acGhostEl.remove();
      acGhostEl = null;
    }
    acCompletionText = '';
    acStopReposition();
    if (acSrLive) acSrLive.textContent = '';
  }

  function acDismiss() {
    acDismissGhost();
    acHideLoading();
    acActiveField = null;
    acLastRequestedText = '';
    acUnwatchField();
    clearTimeout(acDebounceTimer);
    // Cancel in-flight request
    chrome.runtime.sendMessage({ type: 'ABORT_GEMINI_COMPLETE' });
  }

} // end guard
