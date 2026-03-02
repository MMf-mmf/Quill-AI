// Quill AI — Floating Icon
// Grammarly-style icon that appears in the bottom-right corner of focused text fields.

(function () {
  'use strict';

  const Q = () => window.__quillShared;

  // ─── CSS ──────────────────────────────────────────────────────────────────

  const ICON_CSS = `
@keyframes qi-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes qi-pop-in {
  from { opacity: 0; transform: scale(0.6); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes qi-fade-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}

:host {
  position: fixed !important;
  z-index: 2147483645 !important;
  width: 0 !important;
  height: 0 !important;
  overflow: visible !important;
  pointer-events: none !important;
  border: none !important;
  margin: 0 !important;
  padding: 0 !important;
  background: none !important;
}

.qi-btn {
  position: fixed;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1.5px solid #E5E7EB;
  background: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 2px 8px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04);
  transition: box-shadow 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
  animation: qi-pop-in 0.2s ease-out both;
  font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  user-select: none;
  -webkit-user-select: none;
}

.qi-btn:hover {
  box-shadow: 0 3px 12px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06);
  transform: scale(1.06);
}

.qi-btn:active {
  transform: scale(0.96);
}

/* States */
.qi-btn[data-state="idle"] {
  border-color: #D1D5DB;
}
.qi-btn[data-state="idle"] .qi-icon {
  color: #9CA3AF;
}

.qi-btn[data-state="analyzing"] {
  border-color: #7C3AED;
}
.qi-btn[data-state="analyzing"] .qi-icon {
  color: #7C3AED;
  animation: qi-spin 1s linear infinite;
}

.qi-btn[data-state="clean"] {
  border-color: #10B981;
}
.qi-btn[data-state="clean"] .qi-icon {
  color: #10B981;
}

.qi-btn[data-state="issues"] {
  border-color: #EF4444;
}
.qi-btn[data-state="issues"] .qi-icon {
  color: #7C3AED;
}

/* Badge */
.qi-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  background: #EF4444;
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  padding: 0 4px;
  box-sizing: border-box;
  pointer-events: none;
}

/* Icon symbol */
.qi-icon {
  font-size: 16px;
  line-height: 1;
  transition: color 0.15s ease;
}

/* Tooltip */
.qi-tooltip {
  position: fixed;
  padding: 5px 10px;
  background: #1F2937;
  color: #F9FAFB;
  font-size: 11px;
  font-weight: 500;
  font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  border-radius: 6px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.qi-tooltip.qi-visible {
  opacity: 1;
}

/* Dark mode */
:host(.qp-dark) .qi-btn {
  background: #374151;
  border-color: #4B5563;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06);
}
:host(.qp-dark) .qi-btn:hover {
  box-shadow: 0 3px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08);
}
:host(.qp-dark) .qi-btn[data-state="idle"] {
  border-color: #4B5563;
}
:host(.qp-dark) .qi-btn[data-state="idle"] .qi-icon {
  color: #6B7280;
}
:host(.qp-dark) .qi-tooltip {
  background: #F9FAFB;
  color: #1F2937;
}
`;

  // ─── State ────────────────────────────────────────────────────────────────

  let shadowHost = null;
  let shadowRoot = null;
  let btnEl = null;
  let badgeEl = null;
  let tooltipEl = null;
  let currentField = null;
  let rafId = null;
  let hideTimer = null;
  let currentState = 'idle'; // idle | analyzing | clean | issues
  let issueCount = 0;

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  function init() {
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);

    // Listen for analysis state changes
    window.addEventListener('quill-analysis-start', () => setState('analyzing'));
    window.addEventListener('quill-analysis-ready', onAnalysisReady);
    window.addEventListener('quill-analysis-clear', () => {
      setState('idle');
      issueCount = 0;
    });

    // Per-site toggle
    Q()?.onSiteToggle((enabled) => {
      if (!enabled) destroy();
    });
  }

  function onFocusIn(e) {
    const q = Q();
    if (!q || !q.isSiteEnabled()) return;

    let el = e.target;
    if (!q.isEditableField(el)) {
      el = q.getDeepActiveElement();
      if (!q.isEditableField(el)) return;
    }

    // Skip very tiny fields (e.g., color pickers, hidden inputs)
    const rect = el.getBoundingClientRect();
    if (rect.height < 20 || rect.width < 60) return;

    // Skip our own elements
    if (el.closest?.('#quill-ai-host, #quill-ac-host, #quill-icon-host, #quill-overlay-host, #quill-card-host')) return;
    if (el.id && el.id.startsWith('quill-')) return;

    clearTimeout(hideTimer);
    if (currentField === el && shadowHost) return; // Already showing for this field

    currentField = el;
    show();
  }

  function onFocusOut() {
    // Delay hide so the icon can be clicked
    hideTimer = setTimeout(() => {
      const q = Q();
      if (!q) return;
      const active = q.getDeepActiveElement();
      // Don't hide if focus moved to our icon
      if (active && shadowHost?.contains(active)) return;
      // Don't hide if focus is still in the same field
      if (active === currentField) return;
      hide();
    }, 200);
  }

  // ─── Create / Destroy ─────────────────────────────────────────────────────

  function show() {
    if (!shadowHost) {
      const q = Q();
      const created = q.createShadowHost('quill-icon-host', ICON_CSS,
        'position:fixed!important;z-index:2147483645!important;top:0!important;left:0!important;width:0!important;height:0!important;overflow:visible!important;pointer-events:none!important;');
      shadowHost = created.host;
      shadowRoot = created.shadow;
      q.registerShadowHost(shadowHost);

      // Button
      btnEl = document.createElement('div');
      btnEl.className = 'qi-btn';
      btnEl.setAttribute('data-state', currentState);
      btnEl.setAttribute('role', 'button');
      btnEl.setAttribute('tabindex', '0');
      btnEl.setAttribute('aria-label', 'Quill AI — Check writing');

      const icon = document.createElement('span');
      icon.className = 'qi-icon';
      icon.textContent = '✦';
      btnEl.appendChild(icon);

      // Badge (hidden by default)
      badgeEl = document.createElement('span');
      badgeEl.className = 'qi-badge';
      badgeEl.style.display = 'none';
      btnEl.appendChild(badgeEl);

      shadowRoot.appendChild(btnEl);

      // Tooltip
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'qi-tooltip';
      tooltipEl.textContent = 'Quill AI — Click to check writing';
      shadowRoot.appendChild(tooltipEl);

      // Events
      btnEl.addEventListener('click', onIconClick);
      btnEl.addEventListener('mouseenter', onIconHover);
      btnEl.addEventListener('mouseleave', onIconLeave);
      btnEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onIconClick();
        }
      });
    }

    setState(currentState);
    position();
    startReposition();
  }

  function hide() {
    stopReposition();
    if (shadowHost) {
      shadowHost.remove();
      shadowHost = null;
      shadowRoot = null;
      btnEl = null;
      badgeEl = null;
      tooltipEl = null;
    }
    currentField = null;
  }

  function destroy() {
    hide();
    currentState = 'idle';
    issueCount = 0;
  }

  // ─── Positioning ──────────────────────────────────────────────────────────

  function position() {
    if (!btnEl || !currentField) return;

    const rect = currentField.getBoundingClientRect();

    // Bottom-right corner of the field, 8px inset
    let top = rect.bottom - 32 - 8;
    let left = rect.right - 32 - 8;

    // Viewport clamp
    top = Math.max(4, Math.min(top, window.innerHeight - 36));
    left = Math.max(4, Math.min(left, window.innerWidth - 36));

    btnEl.style.top = `${Math.round(top)}px`;
    btnEl.style.left = `${Math.round(left)}px`;
  }

  let lastRect = '';

  function startReposition() {
    stopReposition();
    function loop() {
      if (!btnEl || !currentField) return;

      const rect = currentField.getBoundingClientRect();
      const key = `${rect.top},${rect.left},${rect.width},${rect.height}`;
      if (key !== lastRect) {
        lastRect = key;
        position();
      }

      // Hide if field scrolled out of view
      if (rect.bottom < 0 || rect.top > window.innerHeight ||
          rect.right < 0 || rect.left > window.innerWidth) {
        if (btnEl) btnEl.style.display = 'none';
      } else {
        if (btnEl) btnEl.style.display = 'flex';
      }

      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
  }

  function stopReposition() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastRect = '';
  }

  // ─── State Management ─────────────────────────────────────────────────────

  function setState(state) {
    currentState = state;
    if (!btnEl) return;

    btnEl.setAttribute('data-state', state);

    if (state === 'issues' && issueCount > 0) {
      badgeEl.textContent = issueCount > 99 ? '99+' : String(issueCount);
      badgeEl.style.display = '';
    } else {
      badgeEl.style.display = 'none';
    }

    // Update icon content
    const icon = btnEl.querySelector('.qi-icon');
    if (icon) {
      if (state === 'clean') {
        icon.textContent = '✓';
      } else {
        icon.textContent = '✦';
      }
    }
  }

  function onAnalysisReady(e) {
    const data = e.detail;
    if (!data) return;
    issueCount = data.issues?.length || 0;
    setState(issueCount > 0 ? 'issues' : 'clean');
  }

  // ─── Interaction ──────────────────────────────────────────────────────────

  function onIconClick() {
    if (!currentField) return;

    if (currentState === 'idle' || currentState === 'clean') {
      // Trigger analysis
      window.dispatchEvent(new CustomEvent('quill-trigger-analysis', {
        detail: { field: currentField },
      }));
    } else if (currentState === 'issues') {
      // Toggle showing/hiding underlines summary — for now just re-trigger analysis
      window.dispatchEvent(new CustomEvent('quill-trigger-analysis', {
        detail: { field: currentField },
      }));
    }
    // 'analyzing' state — do nothing, already in progress
  }

  function onIconHover() {
    if (!tooltipEl || !btnEl) return;

    const q = Q();
    const mode = q?.analysisMode || 'manual';

    if (currentState === 'issues') {
      tooltipEl.textContent = `Quill AI: ${issueCount} suggestion${issueCount !== 1 ? 's' : ''}`;
    } else if (currentState === 'clean') {
      tooltipEl.textContent = 'Quill AI: No issues found';
    } else if (currentState === 'analyzing') {
      tooltipEl.textContent = 'Quill AI: Analyzing...';
    } else {
      tooltipEl.textContent = mode === 'manual'
        ? 'Quill AI — Click to check writing'
        : 'Quill AI';
    }

    // Position tooltip above the button
    const btnRect = btnEl.getBoundingClientRect();
    tooltipEl.style.top = `${btnRect.top - 30}px`;
    tooltipEl.style.left = `${btnRect.left + btnRect.width / 2}px`;
    tooltipEl.style.transform = 'translateX(-50%)';
    tooltipEl.classList.add('qi-visible');
  }

  function onIconLeave() {
    if (tooltipEl) tooltipEl.classList.remove('qi-visible');
  }

  // ─── Expose for other modules ─────────────────────────────────────────────

  window.__quillIcon = {
    setState,
    setIssueCount(n) { issueCount = n; setState(n > 0 ? 'issues' : 'clean'); },
    getCurrentField() { return currentField; },
    isShowing() { return !!shadowHost; },
  };

  // ─── Init ─────────────────────────────────────────────────────────────────

  // Wait for shared utilities to be available
  if (Q()) {
    init();
  } else {
    const check = setInterval(() => {
      if (Q()) { clearInterval(check); init(); }
    }, 50);
  }

})();
