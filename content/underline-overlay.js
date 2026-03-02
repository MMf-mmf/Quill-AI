// Quill AI — Underline Overlay
// Renders Grammarly-style color-coded wavy underlines under flagged text.

(function () {
  'use strict';

  const Q = () => window.__quillShared;

  // ─── Wavy underline SVG patterns (data URIs) ─────────────────────────────

  function wavySvg(color) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='6' height='3' viewBox='0 0 6 3'>` +
      `<path d='M0 2.5 Q1.5 0 3 2.5 Q4.5 5 6 2.5' fill='none' stroke='${color}' stroke-width='1.2'/>` +
      `</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  // ─── CSS ──────────────────────────────────────────────────────────────────

  const OVERLAY_CSS = `
:host {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 0 !important;
  height: 0 !important;
  overflow: visible !important;
  z-index: 2147483644 !important;
  pointer-events: none !important;
  border: none !important;
  margin: 0 !important;
  padding: 0 !important;
  background: none !important;
}

.qo-underline {
  position: fixed;
  height: 3px;
  pointer-events: auto;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease;
  background-repeat: repeat-x;
  background-position: bottom left;
  background-size: 6px 3px;
}

.qo-underline.qo-visible {
  opacity: 0.75;
}

.qo-underline:hover {
  opacity: 1;
}
`;

  // ─── State ────────────────────────────────────────────────────────────────

  let shadowHost = null;
  let shadowRoot = null;
  let underlineEls = [];  // { el, issue }
  let rafId = null;
  let currentField = null;
  let currentIssues = [];
  let isRendering = false;
  let clickLock = false;   // Prevents rAF rebuild from destroying elements mid-click
  let clickLockTimer = null;

  // Cache SVG data URIs to avoid re-encoding
  const svgCache = {};

  function getCachedSvg(color) {
    if (!svgCache[color]) svgCache[color] = wavySvg(color);
    return svgCache[color];
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  function init() {
    window.addEventListener('quill-analysis-ready', onAnalysisReady);
    window.addEventListener('quill-analysis-clear', clearOverlay);

    Q()?.onSiteToggle((enabled) => {
      if (!enabled) clearOverlay();
    });
  }

  function onAnalysisReady(e) {
    if (isRendering) return; // Prevent re-entrant rendering
    const data = e.detail;
    if (!data || !data.issues) { clearOverlay(); return; }

    currentField = data.field;
    currentIssues = data.issues;
    render();
    startReposition();
  }

  // ─── Create / Destroy ─────────────────────────────────────────────────────

  function ensureHost() {
    if (shadowHost && document.documentElement.contains(shadowHost)) return;

    const q = Q();
    const created = q.createShadowHost('quill-overlay-host', OVERLAY_CSS,
      'position:fixed!important;z-index:2147483644!important;top:0!important;left:0!important;width:0!important;height:0!important;overflow:visible!important;pointer-events:none!important;');
    shadowHost = created.host;
    shadowRoot = created.shadow;
    q.registerShadowHost(shadowHost);
  }

  function clearOverlay() {
    stopReposition();
    underlineEls = [];
    currentIssues = [];
    currentField = null;
    if (shadowRoot) {
      const style = shadowRoot.querySelector('style');
      shadowRoot.innerHTML = '';
      if (style) shadowRoot.appendChild(style);
    }
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  function render(skipAnimation) {
    isRendering = true;
    ensureHost();
    const q = Q();
    if (!q) { isRendering = false; return; }

    // Clear previous underlines (keep style)
    const style = shadowRoot.querySelector('style');
    shadowRoot.innerHTML = '';
    if (style) shadowRoot.appendChild(style);
    underlineEls = [];

    const colors = q.CATEGORY_COLORS;
    const dark = q.isDarkMode();

    for (const issue of currentIssues) {
      const cat = colors[issue.type] || colors.correctness;
      const color = dark ? cat.darkColor : cat.color;

      for (const rect of issue.rects) {
        const el = document.createElement('div');
        el.className = 'qo-underline';
        el.style.top = `${rect.top + rect.height - 1}px`;
        el.style.left = `${rect.left}px`;
        el.style.width = `${rect.width}px`;
        el.style.backgroundImage = getCachedSvg(color);
        el.dataset.issueId = issue.id;
        el.title = `${cat.label}: ${issue.explanation || ''}`;

        el.addEventListener('mousedown', () => {
          clickLock = true;
          clearTimeout(clickLockTimer);
          // Safety release: if click never fires (e.g., user drags away), unlock after 1s
          clickLockTimer = setTimeout(() => { clickLock = false; }, 1000);
        });

        el.addEventListener('click', (e) => {
          clickLock = false;
          clearTimeout(clickLockTimer);
          e.stopPropagation();
          window.dispatchEvent(new CustomEvent('quill-underline-click', {
            detail: {
              issue,
              rect: {
                top: parseFloat(el.style.top),
                left: parseFloat(el.style.left),
                width: parseFloat(el.style.width),
                height: 3,
                bottom: parseFloat(el.style.top) + 3,
              },
            },
          }));
        });

        shadowRoot.appendChild(el);

        // Fade in after a frame (skip animation on reposition to avoid flicker)
        if (skipAnimation) {
          el.classList.add('qo-visible');
        } else {
          requestAnimationFrame(() => el.classList.add('qo-visible'));
        }

        underlineEls.push({ el, issue });
      }
    }

    isRendering = false;
  }

  // ─── Position Tracking ────────────────────────────────────────────────────
  // Instead of re-dispatching events, we directly recalculate positions
  // using the analysis engine's position resolution methods.

  let lastFieldKey = '';

  function startReposition() {
    stopReposition();
    function loop() {
      if (!currentField || underlineEls.length === 0) return;
      updatePositions();
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
  }

  function stopReposition() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastFieldKey = '';
  }

  function updatePositions() {
    if (!currentField || !currentField.isConnected) {
      clearOverlay();
      return;
    }

    // Don't rebuild elements while user is mid-click on an underline
    if (clickLock) return;

    const rect = currentField.getBoundingClientRect();
    const scrollTop = currentField.scrollTop || 0;
    const scrollLeft = currentField.scrollLeft || 0;
    const key = `${rect.top},${rect.left},${rect.width},${rect.height},${scrollTop},${scrollLeft}`;

    if (key === lastFieldKey) return; // No change — skip
    lastFieldKey = key;

    // Field rect changed (scroll, resize, etc.) — re-resolve positions
    const engine = window.__quillAnalysisEngine;
    if (!engine || !engine.resolveIssuePositions) return;

    const text = engine.getFieldText(currentField);
    if (!text || currentIssues.length === 0) return;

    // Strip rects and re-resolve with fresh coordinates
    const rawIssues = currentIssues.map((i) => ({
      type: i.type,
      original: i.original,
      replacement: i.replacement,
      explanation: i.explanation,
    }));

    const freshIssues = engine.resolveIssuePositions(currentField, text, rawIssues);
    currentIssues = freshIssues;

    // Re-render with updated positions (skip animation to avoid flicker)
    render(true);
  }

  // ─── Expose ───────────────────────────────────────────────────────────────

  window.__quillOverlay = {
    clearOverlay,
    rerender() {
      if (currentIssues.length > 0 && currentField) render();
    },
  };

  // ─── Init ─────────────────────────────────────────────────────────────────

  if (Q()) {
    init();
  } else {
    const check = setInterval(() => {
      if (Q()) { clearInterval(check); init(); }
    }, 50);
  }

})();
