// Quill AI — Analysis Engine
// Sends text to Gemini for writing analysis, resolves issue positions.

(function () {
  'use strict';

  const Q = () => window.__quillShared;

  // ─── State ────────────────────────────────────────────────────────────────

  let currentField = null;
  let currentIssues = [];   // Resolved issues with position data
  let debounceTimer = null;
  let analysisRequestId = 0;
  let isAnalyzing = false;

  // Mirror element cache: WeakMap<HTMLElement, HTMLDivElement>
  const mirrorCache = new WeakMap();

  // Styles to copy for mirror elements
  const MIRROR_STYLES = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
    'wordSpacing', 'lineHeight', 'textTransform', 'paddingTop', 'paddingRight',
    'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth',
    'borderBottomWidth', 'borderLeftWidth', 'boxSizing', 'width', 'whiteSpace',
    'wordWrap', 'overflowWrap', 'tabSize', 'textIndent',
  ];

  // ─── Public API ───────────────────────────────────────────────────────────

  function triggerAnalysis(field) {
    if (!field || isAnalyzing) return;
    currentField = field;
    runAnalysis(field);
  }

  function clearAnalysis() {
    currentIssues = [];
    currentField = null;
    isAnalyzing = false;
    clearTimeout(debounceTimer);
    window.dispatchEvent(new CustomEvent('quill-analysis-clear'));
  }

  // ─── Auto Mode Listener ───────────────────────────────────────────────────

  function setupAutoMode() {
    document.addEventListener('input', onAutoInput, true);
  }

  function teardownAutoMode() {
    document.removeEventListener('input', onAutoInput, true);
    clearTimeout(debounceTimer);
  }

  function onAutoInput(e) {
    const q = Q();
    if (!q || q.analysisMode !== 'auto' || !q.isSiteEnabled()) return;

    let el = e.target;
    if (!q.isEditableField(el)) {
      el = q.getDeepActiveElement();
      if (!q.isEditableField(el)) return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentField = el;
      runAnalysis(el);
    }, q.analysisDelay || 2000);
  }

  // ─── Core Analysis ────────────────────────────────────────────────────────

  async function runAnalysis(field) {
    const q = Q();
    if (!q || !field) return;

    const text = getFieldText(field);
    if (!text || text.trim().length < 10) {
      clearAnalysis();
      return;
    }

    isAnalyzing = true;
    const thisId = ++analysisRequestId;

    // Notify UI of analysis start
    window.dispatchEvent(new CustomEvent('quill-analysis-start'));

    // Send to service worker
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'ANALYZE_TEXT',
          text: text.substring(0, 8000), // Respect MAX_INPUT_LENGTH
        }, (resp) => {
          if (chrome.runtime.lastError) {
            resolve({ type: 'ERROR', message: chrome.runtime.lastError.message });
          } else {
            resolve(resp);
          }
        });
      });

      // Stale check
      if (thisId !== analysisRequestId) return;
      isAnalyzing = false;

      if (response?.type === 'ANALYSIS' && Array.isArray(response.issues)) {
        // Filter by enabled categories
        const q = Q();
        const enabledCats = q?.analysisCategories || ['correctness', 'clarity', 'engagement', 'delivery'];
        const filtered = response.issues.filter((issue) => enabledCats.includes(issue.type));
        const resolved = resolveIssuePositions(field, text, filtered);
        currentIssues = resolved;

        // Store globally for other components
        window.__quillAnalysis = {
          field,
          issues: resolved,
          text,
        };

        window.dispatchEvent(new CustomEvent('quill-analysis-ready', {
          detail: { field, issues: resolved, text },
        }));
      } else if (response?.type === 'ERROR') {
        isAnalyzing = false;
        window.dispatchEvent(new CustomEvent('quill-analysis-clear'));
      }
    } catch (err) {
      console.warn('[Quill AI] Analysis request failed:', err);
      isAnalyzing = false;
      window.dispatchEvent(new CustomEvent('quill-analysis-clear'));
    }
  }

  // ─── Get Field Text ───────────────────────────────────────────────────────

  function getFieldText(el) {
    if (el.nodeName === 'INPUT' || el.nodeName === 'TEXTAREA') {
      return el.value || '';
    }
    // contenteditable
    return el.innerText || el.textContent || '';
  }

  // ─── Issue Position Resolution ────────────────────────────────────────────

  function resolveIssuePositions(field, text, issues) {
    const resolved = [];
    const usedRanges = []; // Track used positions to avoid overlapping highlights

    for (const issue of issues) {
      if (!issue.original || !issue.replacement || !issue.type) continue;

      // Find the original text in the field
      const startIdx = findNextOccurrence(text, issue.original, usedRanges);
      if (startIdx === -1) continue; // Can't find the text — skip this issue

      const endIdx = startIdx + issue.original.length;
      usedRanges.push({ start: startIdx, end: endIdx });

      // Get screen coordinates
      let rects;
      if (field.nodeName === 'INPUT' || field.nodeName === 'TEXTAREA') {
        rects = getRectsForTextarea(field, startIdx, endIdx);
      } else {
        rects = getRectsForContentEditable(field, issue.original, startIdx);
      }

      if (!rects || rects.length === 0) continue;

      resolved.push({
        ...issue,
        charStart: startIdx,
        charEnd: endIdx,
        rects,
        id: `qi-${Date.now()}-${resolved.length}`,
      });
    }

    return resolved;
  }

  function findNextOccurrence(text, substring, usedRanges) {
    let searchFrom = 0;
    while (true) {
      const idx = text.indexOf(substring, searchFrom);
      if (idx === -1) return -1;

      // Check if this position overlaps with an already-used range
      const end = idx + substring.length;
      const overlaps = usedRanges.some(
        (r) => idx < r.end && end > r.start
      );

      if (!overlaps) return idx;
      searchFrom = idx + 1;
    }
  }

  // ─── Textarea Rect Calculation (Mirror Element) ───────────────────────────

  function getRectsForTextarea(el, startIdx, endIdx) {
    const computed = getComputedStyle(el);
    const fieldRect = el.getBoundingClientRect();

    // Get or create mirror (cached but only attached to DOM during measurement)
    let mirror = mirrorCache.get(el);
    if (!mirror) {
      mirror = document.createElement('div');
      mirror.setAttribute('aria-hidden', 'true');
      mirror.style.cssText = 'position:absolute;visibility:hidden;top:-9999px;left:-9999px;overflow:hidden;';
      mirrorCache.set(el, mirror);
    }

    // Attach temporarily for measurement
    document.body.appendChild(mirror);
    try {
      // Sync mirror styles
      for (const prop of MIRROR_STYLES) {
        mirror.style[prop] = computed[prop];
      }
      // Force same width for wrapping
      mirror.style.width = `${el.clientWidth}px`;

      // Build mirror content with markers
      const text = el.value;
      const before = text.substring(0, startIdx);
      const target = text.substring(startIdx, endIdx);
      const after = text.substring(endIdx);

      // Use textContent to avoid HTML injection
      mirror.textContent = '';

      const beforeNode = document.createTextNode(before);
      const mark = document.createElement('mark');
      mark.style.cssText = 'background:transparent;color:inherit;font:inherit;';
      mark.textContent = target;
      const afterNode = document.createTextNode(after);

      mirror.appendChild(beforeNode);
      mirror.appendChild(mark);
      mirror.appendChild(afterNode);

      // Measure
      const mirrorRect = mirror.getBoundingClientRect();
      const markRect = mark.getBoundingClientRect();

      // Convert to field-relative coordinates, accounting for scroll
      const scrollTop = el.scrollTop || 0;
      const scrollLeft = el.scrollLeft || 0;

      const borderTop = parseFloat(computed.borderTopWidth) || 0;
      const borderLeft = parseFloat(computed.borderLeftWidth) || 0;

      const top = fieldRect.top + borderTop + (markRect.top - mirrorRect.top) - scrollTop;
      const left = fieldRect.left + borderLeft + (markRect.left - mirrorRect.left) - scrollLeft;
      const width = markRect.width;
      const height = markRect.height;

      // Check if within visible area of textarea
      const visibleTop = fieldRect.top + borderTop;
      const visibleBottom = fieldRect.bottom - (parseFloat(computed.borderBottomWidth) || 0);
      const visibleLeft = fieldRect.left + borderLeft;
      const visibleRight = fieldRect.right - (parseFloat(computed.borderRightWidth) || 0);

      if (top + height < visibleTop || top > visibleBottom ||
          left + width < visibleLeft || left > visibleRight) {
        return []; // Not visible
      }

      return [{
        top: Math.max(top, visibleTop),
        left: Math.max(left, visibleLeft),
        width: Math.min(width, visibleRight - Math.max(left, visibleLeft)),
        height: Math.min(height, visibleBottom - Math.max(top, visibleTop)),
        bottom: Math.max(top, visibleTop) + Math.min(height, visibleBottom - Math.max(top, visibleTop)),
      }];
    } finally {
      mirror.remove();
    }
  }

  // ─── ContentEditable Rect Calculation (Range API) ─────────────────────────

  function getRectsForContentEditable(el, originalText, charOffset) {
    // Walk text nodes to find the exact position
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    let charCount = 0;
    let startNode = null;
    let startOffset = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const nodeLen = node.textContent.length;

      if (charCount + nodeLen > charOffset) {
        startNode = node;
        startOffset = charOffset - charCount;
        break;
      }
      charCount += nodeLen;
    }

    if (!startNode) return [];

    // Find end position
    const endCharOffset = charOffset + originalText.length;
    let endNode = startNode;
    let endOffset = startOffset + originalText.length;

    if (endOffset > startNode.textContent.length) {
      // Text spans multiple nodes
      const walker2 = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      let count2 = 0;
      while (walker2.nextNode()) {
        const node = walker2.currentNode;
        const nodeLen = node.textContent.length;
        if (count2 + nodeLen >= endCharOffset) {
          endNode = node;
          endOffset = endCharOffset - count2;
          break;
        }
        count2 += nodeLen;
      }
    }

    try {
      const range = document.createRange();
      range.setStart(startNode, Math.min(startOffset, startNode.textContent.length));
      range.setEnd(endNode, Math.min(endOffset, endNode.textContent.length));

      const clientRects = range.getClientRects();
      const rects = [];

      for (let i = 0; i < clientRects.length; i++) {
        const r = clientRects[i];
        if (r.width > 0 && r.height > 0) {
          rects.push({
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
            bottom: r.bottom,
          });
        }
      }

      return rects;
    } catch {
      return [];
    }
  }

  // ─── Handle Issue Acceptance / Dismissal ──────────────────────────────────

  function acceptIssue(issueId) {
    const q = Q();
    if (!q || !currentField) return Promise.resolve(false);

    const issue = currentIssues.find((i) => i.id === issueId);
    if (!issue) return Promise.resolve(false);

    const field = currentField;

    if (field.nodeName === 'INPUT' || field.nodeName === 'TEXTAREA') {
      const ok = q.replaceInInput(field, issue.replacement, issue.charStart, issue.charEnd);
      if (ok) {
        removeIssueAndRefresh(issueId, field);
      }
      return Promise.resolve(ok);
    } else {
      // Contenteditable: create a range for the issue
      const rng = createRangeForIssue(field, issue);
      if (!rng) return Promise.resolve(false);

      return q.replaceInContentEditable(field, rng, issue.replacement).then((ok) => {
        if (ok) {
          removeIssueAndRefresh(issueId, field);
        }
        return ok;
      });
    }
  }

  function dismissIssue(issueId) {
    currentIssues = currentIssues.filter((i) => i.id !== issueId);
    window.__quillAnalysis = {
      field: currentField,
      issues: currentIssues,
      text: getFieldText(currentField),
    };
    window.dispatchEvent(new CustomEvent('quill-analysis-ready', {
      detail: { field: currentField, issues: currentIssues },
    }));
  }

  function removeIssueAndRefresh(issueId, field) {
    // Remove the accepted issue
    currentIssues = currentIssues.filter((i) => i.id !== issueId);

    // Re-resolve positions since text has changed
    const newText = getFieldText(field);
    const rawIssues = currentIssues.map((i) => ({
      type: i.type,
      original: i.original,
      replacement: i.replacement,
      explanation: i.explanation,
    }));

    const resolved = resolveIssuePositions(field, newText, rawIssues);
    currentIssues = resolved;

    window.__quillAnalysis = { field, issues: resolved, text: newText };
    window.dispatchEvent(new CustomEvent('quill-analysis-ready', {
      detail: { field, issues: resolved, text: newText },
    }));
  }

  function createRangeForIssue(el, issue) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    let charCount = 0;
    let startNode = null;
    let startOffset = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const nodeLen = node.textContent.length;
      if (charCount + nodeLen > issue.charStart) {
        startNode = node;
        startOffset = issue.charStart - charCount;
        break;
      }
      charCount += nodeLen;
    }
    if (!startNode) return null;

    const walker2 = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    let count2 = 0;
    let endNode = null;
    let endOffset = 0;

    while (walker2.nextNode()) {
      const node = walker2.currentNode;
      const nodeLen = node.textContent.length;
      if (count2 + nodeLen >= issue.charEnd) {
        endNode = node;
        endOffset = issue.charEnd - count2;
        break;
      }
      count2 += nodeLen;
    }
    if (!endNode) return null;

    try {
      const range = document.createRange();
      range.setStart(startNode, Math.min(startOffset, startNode.textContent.length));
      range.setEnd(endNode, Math.min(endOffset, endNode.textContent.length));
      return range;
    } catch {
      return null;
    }
  }

  // ─── Event Handlers ───────────────────────────────────────────────────────

  function init() {
    // Manual trigger from floating icon or popup
    window.addEventListener('quill-trigger-analysis', (e) => {
      const field = e.detail?.field || currentField;
      if (field) triggerAnalysis(field);
    });

    // Field blur cleanup
    document.addEventListener('focusout', () => {
      setTimeout(() => {
        // Don't clear if the document lost focus (popup opened, alt-tabbed, etc.)
        if (!document.hasFocus()) return;

        const q = Q();
        if (!q) return;
        const active = q.getDeepActiveElement();
        if (active !== currentField) {
          // Don't clear if focus moved to a Quill UI element (underline, card, icon)
          const activeHost = document.activeElement;
          if (activeHost && activeHost.id && activeHost.id.startsWith('quill-')) return;

          // Don't clear immediately - user might be clicking a suggestion card
          setTimeout(() => {
            if (!document.hasFocus()) return;
            const q2 = Q();
            if (!q2) return;

            const nowHost = document.activeElement;
            if (nowHost && nowHost.id && nowHost.id.startsWith('quill-')) return;

            const nowActive = q2.getDeepActiveElement();
            if (nowActive !== currentField) {
              clearAnalysis();
            }
          }, 500);
        }
      }, 100);
    }, true);

    // Auto mode setup
    setupAutoMode();

    // Listen for settings changes
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.analysisMode) {
        if (changes.analysisMode.newValue === 'auto') setupAutoMode();
        else teardownAutoMode();
      }
    });

    // SPA navigation cleanup
    window.addEventListener('popstate', clearAnalysis);
    window.addEventListener('hashchange', clearAnalysis);

    // Message listener for popup accept/dismiss (avoids Promise serialization issues)
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'QUILL_ACCEPT_ISSUE') {
        const result = acceptIssue(msg.issueId);
        if (result && typeof result.then === 'function') {
          result.then((ok) => sendResponse({ ok }));
          return true; // Keep channel open for async response
        }
        sendResponse({ ok: false });
      } else if (msg.type === 'QUILL_DISMISS_ISSUE') {
        dismissIssue(msg.issueId);
        sendResponse({ ok: true });
      } else if (msg.type === 'QUILL_ACCEPT_ALL') {
        // Accept issues in reverse order to preserve character positions
        const ids = currentIssues.map((i) => i.id).reverse();
        let applied = 0;
        function acceptNext(idx) {
          if (idx >= ids.length) {
            sendResponse({ ok: true, applied });
            return;
          }
          const result = acceptIssue(ids[idx]);
          if (result && typeof result.then === 'function') {
            result.then((ok) => {
              if (ok) applied++;
              acceptNext(idx + 1);
            });
          } else {
            acceptNext(idx + 1);
          }
        }
        acceptNext(0);
        return true; // Keep channel open for async response
      }
    });
  }

  // ─── Expose ───────────────────────────────────────────────────────────────

  window.__quillAnalysisEngine = {
    triggerAnalysis,
    clearAnalysis,
    acceptIssue,
    dismissIssue,
    getIssues() { return currentIssues; },
    getCurrentField() { return currentField; },
    getFieldText,
    resolveIssuePositions,
  };

  // ─── Init ─────────────────────────────────────────────────────────────────

  const q = Q();
  if (q) {
    init();
  } else {
    const check = setInterval(() => {
      if (Q()) { clearInterval(check); init(); }
    }, 50);
  }

})();
