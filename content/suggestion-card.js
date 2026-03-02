// Quill AI — Suggestion Card
// Floating card that appears when clicking an underlined issue.
// Shows the issue details and allows accepting or dismissing the fix.

(function () {
  'use strict';

  const Q = () => window.__quillShared;

  // ─── CSS ──────────────────────────────────────────────────────────────────

  const CARD_CSS = `
@keyframes qc-slide-in {
  from { opacity: 0; transform: translateY(-6px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes qc-toast-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

:host {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 0 !important;
  height: 0 !important;
  overflow: visible !important;
  z-index: 2147483647 !important;
  pointer-events: none !important;
  border: none !important;
  margin: 0 !important;
  padding: 0 !important;
  background: none !important;
}

.qc-card {
  position: fixed;
  width: 340px;
  max-height: 240px;
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04);
  padding: 16px;
  pointer-events: auto;
  animation: qc-slide-in 0.18s ease-out both;
  font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  overflow-y: auto;
  box-sizing: border-box;
}

.qc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.qc-category {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.qc-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.qc-close {
  all: unset;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  cursor: pointer;
  color: #9CA3AF;
  font-size: 16px;
  line-height: 1;
  transition: background 0.12s, color 0.12s;
}
.qc-close:hover {
  background: #F3F4F6;
  color: #374151;
}

.qc-diff {
  margin-bottom: 12px;
  font-size: 14px;
  line-height: 1.6;
  color: #111827;
}

.qc-original {
  text-decoration: line-through;
  color: #EF4444;
  background: rgba(239,68,68,0.06);
  padding: 1px 3px;
  border-radius: 3px;
}

.qc-arrow {
  color: #9CA3AF;
  margin: 0 6px;
  font-size: 12px;
}

.qc-replacement {
  font-weight: 600;
  color: #10B981;
  background: rgba(16,185,129,0.06);
  padding: 1px 3px;
  border-radius: 3px;
}

.qc-explanation {
  font-size: 12px;
  line-height: 1.5;
  color: #6B7280;
  margin-bottom: 14px;
}

.qc-actions {
  display: flex;
  gap: 8px;
}

.qc-btn {
  all: unset;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, box-shadow 0.12s;
  box-sizing: border-box;
}

.qc-btn-accept {
  background: #7C3AED;
  color: #FFFFFF;
}
.qc-btn-accept:hover {
  background: #6D28D9;
}
.qc-btn-accept:active {
  background: #5B21B6;
}

.qc-btn-dismiss {
  background: transparent;
  color: #6B7280;
  border: 1px solid #E5E7EB;
}
.qc-btn-dismiss:hover {
  background: #F9FAFB;
  color: #374151;
}

.qc-toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 16px;
  background: #111827;
  color: #F9FAFB;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  font-family: "Segoe UI", system-ui, sans-serif;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  pointer-events: none;
  animation: qc-toast-in 0.2s ease-out both;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.qc-toast-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  background: #10B981;
  border-radius: 50%;
  color: #FFFFFF;
  font-size: 10px;
  flex-shrink: 0;
}

/* Dark mode */
:host(.qp-dark) .qc-card {
  background: #1F2937;
  border-color: #374151;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06);
}
:host(.qp-dark) .qc-diff {
  color: #F9FAFB;
}
:host(.qp-dark) .qc-original {
  color: #F87171;
  background: rgba(248,113,113,0.1);
}
:host(.qp-dark) .qc-replacement {
  color: #34D399;
  background: rgba(52,211,153,0.1);
}
:host(.qp-dark) .qc-explanation {
  color: #9CA3AF;
}
:host(.qp-dark) .qc-close:hover {
  background: #374151;
  color: #D1D5DB;
}
:host(.qp-dark) .qc-btn-dismiss {
  border-color: #4B5563;
  color: #9CA3AF;
}
:host(.qp-dark) .qc-btn-dismiss:hover {
  background: #374151;
  color: #D1D5DB;
}
:host(.qp-dark) .qc-toast {
  background: #F9FAFB;
  color: #1F2937;
}
`;

  // ─── State ────────────────────────────────────────────────────────────────

  let shadowHost = null;
  let shadowRoot = null;
  let cardEl = null;
  let currentIssue = null;

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  function init() {
    window.addEventListener('quill-underline-click', onUnderlineClick);
    window.addEventListener('quill-analysis-clear', close);
    document.addEventListener('keydown', onKeydown, true);
    document.addEventListener('mousedown', onOutsideClick, true);
  }

  function onUnderlineClick(e) {
    const data = e.detail;
    if (!data || !data.issue) return;

    currentIssue = data.issue;
    show(data.issue, data.rect);
  }

  // ─── Show / Close ─────────────────────────────────────────────────────────

  function show(issue, anchorRect) {
    close(); // Close any existing card

    const q = Q();
    if (!q) return;

    const created = q.createShadowHost('quill-card-host', CARD_CSS,
      'position:fixed!important;z-index:2147483647!important;top:0!important;left:0!important;width:0!important;height:0!important;overflow:visible!important;pointer-events:none!important;');
    shadowHost = created.host;
    shadowRoot = created.shadow;
    q.registerShadowHost(shadowHost);

    const colors = q.CATEGORY_COLORS;
    const cat = colors[issue.type] || colors.correctness;
    const color = q.isDarkMode() ? cat.darkColor : cat.color;

    // Build card
    cardEl = document.createElement('div');
    cardEl.className = 'qc-card';
    cardEl.setAttribute('role', 'dialog');
    cardEl.setAttribute('aria-label', `${cat.label} suggestion`);

    // Header
    const header = document.createElement('div');
    header.className = 'qc-header';

    const category = document.createElement('div');
    category.className = 'qc-category';
    category.style.color = color;

    const dot = document.createElement('span');
    dot.className = 'qc-dot';
    dot.style.background = color;
    category.appendChild(dot);

    const catLabel = document.createElement('span');
    catLabel.textContent = cat.label;
    category.appendChild(catLabel);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'qc-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });

    header.appendChild(category);
    header.appendChild(closeBtn);

    // Diff line
    const diff = document.createElement('div');
    diff.className = 'qc-diff';

    const original = document.createElement('span');
    original.className = 'qc-original';
    original.textContent = issue.original;

    const arrow = document.createElement('span');
    arrow.className = 'qc-arrow';
    arrow.textContent = '→';

    const replacement = document.createElement('span');
    replacement.className = 'qc-replacement';
    replacement.textContent = issue.replacement;

    diff.appendChild(original);
    diff.appendChild(arrow);
    diff.appendChild(replacement);

    // Explanation
    const explanation = document.createElement('div');
    explanation.className = 'qc-explanation';
    explanation.textContent = issue.explanation || '';

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'qc-actions';

    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'qc-btn qc-btn-accept';
    acceptBtn.textContent = 'Accept';
    acceptBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onAccept(issue);
    });

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'qc-btn qc-btn-dismiss';
    dismissBtn.textContent = 'Dismiss';
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onDismiss(issue);
    });

    actions.appendChild(acceptBtn);
    actions.appendChild(dismissBtn);

    // Assemble
    cardEl.appendChild(header);
    cardEl.appendChild(diff);
    if (issue.explanation) cardEl.appendChild(explanation);
    cardEl.appendChild(actions);

    shadowRoot.appendChild(cardEl);

    // Position card below the underline
    positionCard(anchorRect);

    // Don't auto-focus the accept button — it triggers focusout on the text field
    // which causes the analysis engine to clear. Keyboard users can use Enter to accept.
  }

  function close() {
    if (shadowHost) {
      shadowHost.remove();
      shadowHost = null;
      shadowRoot = null;
      cardEl = null;
    }
    currentIssue = null;
  }

  // ─── Positioning ──────────────────────────────────────────────────────────

  function positionCard(anchorRect) {
    if (!cardEl || !anchorRect) return;

    const CARD_WIDTH = 340;
    const GAP = 8;
    const MARGIN = 12;

    // Try below the underline first
    let top = anchorRect.bottom + GAP;
    let left = anchorRect.left;

    // If too close to bottom, show above
    if (top + 200 > window.innerHeight) {
      top = anchorRect.top - GAP - 200;
      if (top < MARGIN) top = MARGIN;
    }

    // Horizontal clamping
    const maxLeft = window.innerWidth - CARD_WIDTH - MARGIN;
    left = Math.min(left, Math.max(MARGIN, maxLeft));

    cardEl.style.top = `${Math.round(top)}px`;
    cardEl.style.left = `${Math.round(left)}px`;
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  async function onAccept(issue) {
    const engine = window.__quillAnalysisEngine;
    if (!engine) { close(); return; }

    const ok = await engine.acceptIssue(issue.id);
    if (ok) {
      showToast('Fixed!');
    } else {
      // Fallback: copy replacement to clipboard
      try {
        await navigator.clipboard.writeText(issue.replacement);
        showToast('Copied — paste with Ctrl+V');
      } catch {
        showToast('Could not apply fix');
      }
    }
    close();
  }

  function onDismiss(issue) {
    const engine = window.__quillAnalysisEngine;
    if (engine) engine.dismissIssue(issue.id);
    close();
  }

  function showToast(message) {
    const q = Q();
    if (!q) return;

    // Create a temporary shadow host for the toast
    const created = q.createShadowHost('quill-toast-host', CARD_CSS,
      'position:fixed!important;z-index:2147483647!important;top:0!important;left:0!important;width:0!important;height:0!important;overflow:visible!important;pointer-events:none!important;');
    q.registerShadowHost(created.host);

    const toast = document.createElement('div');
    toast.className = 'qc-toast';

    const check = document.createElement('span');
    check.className = 'qc-toast-check';
    check.textContent = '✓';

    toast.appendChild(check);
    toast.appendChild(document.createTextNode(message));
    created.shadow.appendChild(toast);

    setTimeout(() => {
      created.host.remove();
    }, 2000);
  }

  // ─── Keyboard / Outside Click ─────────────────────────────────────────────

  function onKeydown(e) {
    if (!cardEl) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Enter' && currentIssue) {
      e.preventDefault();
      e.stopPropagation();
      onAccept(currentIssue);
    }
  }

  function onOutsideClick(e) {
    if (!shadowHost) return;
    const path = e.composedPath();
    if (!path.includes(shadowHost)) {
      close();
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  if (Q()) {
    init();
  } else {
    const check = setInterval(() => {
      if (Q()) { clearInterval(check); init(); }
    }, 50);
  }

})();
