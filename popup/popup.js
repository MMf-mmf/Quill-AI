// Quill AI — Popup Script

(function () {
  'use strict';

  const checkBtn      = document.getElementById('check-btn');
  const siteToggle    = document.getElementById('site-toggle');
  const analysisMode  = document.getElementById('analysis-mode');
  const analysisDelay = document.getElementById('analysis-delay');
  const delaySection  = document.getElementById('delay-section');
  const settingsLink  = document.getElementById('settings-link');
  const wordCountEl   = document.getElementById('word-count');
  const issueListSection = document.getElementById('issue-list-section');
  const issueListEl   = document.getElementById('issue-list');
  const acceptAllBtn  = document.getElementById('accept-all-btn');

  // Category stat elements
  const statEls = {
    correctness: document.getElementById('stat-correctness'),
    clarity:     document.getElementById('stat-clarity'),
    engagement:  document.getElementById('stat-engagement'),
    delivery:    document.getElementById('stat-delivery'),
  };

  const CAT_LABELS = {
    correctness: 'Correctness',
    clarity: 'Clarity',
    engagement: 'Engagement',
    delivery: 'Delivery',
  };

  let activeTabId = null;
  let currentIssues = [];

  // ─── Load Settings ──────────────────────────────────────────────────────

  // Category filter checkboxes
  const catFilterCheckboxes = document.querySelectorAll('#category-filters input[data-cat]');

  chrome.storage.local.get({
    analysisMode: 'manual',
    analysisDelay: 2000,
    disabledSites: [],
    analysisCategories: ['correctness', 'clarity', 'engagement', 'delivery'],
  }, (r) => {
    analysisMode.value = r.analysisMode;
    analysisDelay.value = String(r.analysisDelay);
    delaySection.hidden = r.analysisMode !== 'auto';

    // Set category filter checkboxes
    const enabledCats = r.analysisCategories || ['correctness', 'clarity', 'engagement', 'delivery'];
    catFilterCheckboxes.forEach((cb) => {
      cb.checked = enabledCats.includes(cb.dataset.cat);
    });

    // Check if current site is disabled
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.url) return;
      try {
        const hostname = new URL(tabs[0].url).hostname;
        const disabled = (r.disabledSites || []).includes(hostname);
        siteToggle.checked = !disabled;
      } catch {
        // Non-standard URL (chrome://, etc.)
        siteToggle.checked = true;
      }
    });
  });

  // ─── Category Filter Change ──────────────────────────────────────────

  catFilterCheckboxes.forEach((cb) => {
    cb.addEventListener('change', () => {
      const enabled = Array.from(catFilterCheckboxes)
        .filter((c) => c.checked)
        .map((c) => c.dataset.cat);
      chrome.storage.local.set({ analysisCategories: enabled });
    });
  });

  // ─── Refresh Issue Counts ─────────────────────────────────────────────

  function refreshStats() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return;
      activeTabId = tabs[0].id;

      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          const analysis = window.__quillAnalysis;
          if (!analysis || !analysis.issues) {
            return { issues: [], wordCount: 0 };
          }
          const text = analysis.text || '';
          const words = text.trim().split(/\s+/).filter(Boolean).length;
          const counts = { correctness: 0, clarity: 0, engagement: 0, delivery: 0 };
          const issueList = [];
          for (const issue of analysis.issues) {
            if (counts[issue.type] !== undefined) counts[issue.type]++;
            issueList.push({
              id: issue.id,
              type: issue.type,
              original: issue.original,
              replacement: issue.replacement,
              explanation: issue.explanation || '',
            });
          }
          return { counts, wordCount: words, total: analysis.issues.length, issues: issueList };
        },
      }).then((results) => {
        const data = results?.[0]?.result;
        if (!data) return;

        // Update pills
        for (const [cat, el] of Object.entries(statEls)) {
          const count = data.counts?.[cat] || 0;
          el.querySelector('.stat-count').textContent = count;
          el.classList.toggle('has-issues', count > 0);
        }

        // Update word count
        if (data.wordCount > 0) {
          wordCountEl.textContent = `${data.wordCount} words · ${data.total || 0} suggestion${data.total !== 1 ? 's' : ''}`;
        } else {
          wordCountEl.textContent = 'No text field focused';
        }

        // Update issue list
        currentIssues = data.issues || [];
        renderIssueList();
      }).catch(() => {
        wordCountEl.textContent = 'No text field focused';
        currentIssues = [];
        renderIssueList();
      });
    });
  }

  refreshStats();

  // ─── Issue List Rendering ──────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderIssueList() {
    if (currentIssues.length === 0) {
      issueListSection.hidden = true;
      issueListEl.innerHTML = '';
      return;
    }

    issueListSection.hidden = false;
    issueListEl.innerHTML = '';

    for (const issue of currentIssues) {
      const item = document.createElement('div');
      item.className = `issue-item`;
      item.dataset.issueId = issue.id;

      const catClass = `issue-cat-${issue.type || 'correctness'}`;
      const catLabel = CAT_LABELS[issue.type] || 'Correctness';

      let html = `<div class="issue-cat-row ${catClass}">`;
      html += `<span class="issue-cat-dot"></span>`;
      html += `<span class="issue-cat-label">${escapeHtml(catLabel)}</span>`;
      html += `</div>`;

      html += `<div class="issue-diff">`;
      html += `<span class="issue-original">${escapeHtml(issue.original)}</span>`;
      html += `<span class="issue-arrow">&rarr;</span>`;
      html += `<span class="issue-replacement">${escapeHtml(issue.replacement)}</span>`;
      html += `</div>`;

      if (issue.explanation) {
        html += `<div class="issue-explanation">${escapeHtml(issue.explanation)}</div>`;
      }

      html += `<div class="issue-actions">`;
      html += `<button class="issue-accept-btn" data-id="${escapeHtml(issue.id)}">Accept</button>`;
      html += `<button class="issue-dismiss-btn" data-id="${escapeHtml(issue.id)}">Dismiss</button>`;
      html += `</div>`;

      item.innerHTML = html;
      issueListEl.appendChild(item);
    }
  }

  // ─── Accept / Dismiss Actions ──────────────────────────────────────────

  function animateRemoveItem(item, callback) {
    item.style.transition = 'opacity 0.15s, max-height 0.2s';
    item.style.opacity = '0';
    item.style.maxHeight = item.offsetHeight + 'px';
    setTimeout(() => {
      item.style.maxHeight = '0';
      item.style.padding = '0';
      item.style.margin = '0';
      item.style.border = 'none';
      item.style.overflow = 'hidden';
    }, 150);
    setTimeout(() => {
      item.remove();
      if (callback) callback();
    }, 350);
  }

  issueListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.issue-accept-btn, .issue-dismiss-btn');
    if (!btn || !activeTabId) return;

    const issueId = btn.dataset.id;
    const isAccept = btn.classList.contains('issue-accept-btn');
    const msgType = isAccept ? 'QUILL_ACCEPT_ISSUE' : 'QUILL_DISMISS_ISSUE';

    btn.disabled = true;

    chrome.tabs.sendMessage(activeTabId, { type: msgType, issueId }, (response) => {
      if (chrome.runtime.lastError) {
        btn.disabled = false;
        return;
      }
      if (response?.ok) {
        const item = btn.closest('.issue-item');
        if (item) {
          animateRemoveItem(item, refreshStats);
        }
      } else {
        btn.disabled = false;
      }
    });
  });

  // ─── Accept All ────────────────────────────────────────────────────────

  acceptAllBtn.addEventListener('click', () => {
    if (!activeTabId || currentIssues.length === 0) return;

    acceptAllBtn.disabled = true;
    acceptAllBtn.textContent = 'Applying...';

    chrome.tabs.sendMessage(activeTabId, { type: 'QUILL_ACCEPT_ALL' }, (response) => {
      acceptAllBtn.disabled = false;
      acceptAllBtn.textContent = 'Accept All';
      if (chrome.runtime.lastError) return;
      refreshStats();
    });
  });

  // ─── Check Writing Button ─────────────────────────────────────────────

  function resetCheckBtn() {
    checkBtn.disabled = false;
    checkBtn.querySelector('.popup-btn-icon').textContent = '✦';
  }

  checkBtn.addEventListener('click', () => {
    checkBtn.disabled = true;
    checkBtn.querySelector('.popup-btn-icon').textContent = '⟳';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        resetCheckBtn();
        return;
      }

      const tabId = tabs[0].id;

      chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const field = window.__quillIcon?.getCurrentField?.() ||
                        document.activeElement;
          if (field) {
            // Clear previous analysis so we can detect when new one arrives
            window.__quillAnalysis = null;
            window.dispatchEvent(new CustomEvent('quill-trigger-analysis', {
              detail: { field },
            }));
          }
        },
      }).then(() => {
        // Poll for analysis completion instead of fixed timeout
        let attempts = 0;
        const maxAttempts = 15; // 15 × 500ms = 7.5s max wait
        const pollInterval = setInterval(() => {
          attempts++;
          chrome.scripting.executeScript({
            target: { tabId },
            func: () => !!(window.__quillAnalysis && window.__quillAnalysis.issues),
          }).then((results) => {
            const done = results?.[0]?.result;
            if (done || attempts >= maxAttempts) {
              clearInterval(pollInterval);
              resetCheckBtn();
              refreshStats();
            }
          }).catch(() => {
            clearInterval(pollInterval);
            resetCheckBtn();
          });
        }, 500);
      }).catch(() => {
        resetCheckBtn();
      });
    });
  });

  // ─── Site Toggle ──────────────────────────────────────────────────────

  siteToggle.addEventListener('change', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.url) return;

      let hostname;
      try {
        hostname = new URL(tabs[0].url).hostname;
      } catch {
        return;
      }

      chrome.storage.local.get({ disabledSites: [] }, (r) => {
        let sites = r.disabledSites || [];

        if (siteToggle.checked) {
          // Enable: remove from blocklist
          sites = sites.filter((s) => s !== hostname);
        } else {
          // Disable: add to blocklist
          if (!sites.includes(hostname)) sites.push(hostname);
        }

        chrome.storage.local.set({ disabledSites: sites });
      });
    });
  });

  // ─── Analysis Mode ────────────────────────────────────────────────────

  analysisMode.addEventListener('change', () => {
    const mode = analysisMode.value;
    chrome.storage.local.set({ analysisMode: mode });
    delaySection.hidden = mode !== 'auto';
  });

  analysisDelay.addEventListener('change', () => {
    chrome.storage.local.set({ analysisDelay: parseInt(analysisDelay.value, 10) });
  });

  // ─── Settings Link ────────────────────────────────────────────────────

  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

})();
