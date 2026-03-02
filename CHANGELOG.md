# Changelog

All notable changes to Quill AI are documented here.

---

## [1.3.0]

### Added
- **Grammarly-style floating icon** — a circular "✦" icon appears in the bottom-right corner of focused text fields. States: idle (gray), analyzing (spinning purple), clean (green check), issues (red badge with count). Click to trigger writing analysis.
- **Real-time writing analysis engine** — sends text to Gemini for grammar, clarity, engagement, and delivery analysis. Returns structured issues with exact text positions. Two modes: manual (click to check) and auto (debounced on typing). Mode is user-configurable, defaulting to manual.
- **Inline underlines** — Grammarly-style color-coded wavy underlines rendered as SVG overlays:
  - Red (#EF4444): correctness (spelling, grammar, punctuation)
  - Blue (#3B82F6): clarity (wordy, passive voice, unclear)
  - Green (#10B981): engagement (vocabulary, repetition)
  - Purple (#8B5CF6): delivery (tone, formality)
  - Positioned using Range API (contenteditable) or mirror-element technique (textarea)
  - Click any underline to open the suggestion card
- **Suggestion cards** — floating cards that appear when clicking an underlined issue. Shows category badge, original→replacement diff, explanation, and Accept/Dismiss buttons. Keyboard accessible (Enter to accept, Esc to close).
- **Extension popup** — clicking the extension icon now opens a compact dashboard with issue counts by category, word count, "Check Writing" button, per-site enable/disable toggle, and analysis mode selector.
- **Per-site controls** — toggle Quill AI on/off for specific websites. Stored as a hostname blocklist in `chrome.storage.local`.
- **Analysis caching** — LRU cache (30 entries, 3-min TTL) for analysis results, keyed by text hash. Avoids redundant API calls.
- **Shared utilities module** (`content/shared.js`) — extracted common functions (deep active element traversal, field detection, dark mode, text replacement chain, Shadow DOM creation) into a shared module loaded first by all content scripts.

### Changed
- `manifest.json` version bumped to 1.3.0.
- Extension action now shows a popup instead of directly opening the options page.
- Content scripts now load as an ordered array: `shared.js` → `floating-icon.js` → `analysis-engine.js` → `underline-overlay.js` → `suggestion-card.js` → `content.js`.

---

## [1.2.0]

### Added
- **Keyboard shortcut** — `Ctrl+Shift+Q` (or `Cmd+Shift+Q` on Mac) triggers text improvement without right-clicking. Uses `chrome.commands` API.
- **Dark mode** — options page and suggestion panel both support dark theme. Choose System (auto-detects OS preference), Light, or Dark in the new Appearance section.
- **Custom prompts** — override the default system instruction sent to Gemini. Optionally add per-style descriptions to further guide the AI.
- **Local usage analytics** — track total improvements, characters improved, and per-style/model breakdowns. Stats are stored locally and displayed on the options page. Reset anytime.
- **Streaming responses** — suggestions now appear progressively as they stream in from Gemini, instead of waiting for the full response. Falls back to non-streaming if the stream fails.
- **i18n support** — all user-facing strings extracted to `_locales/en/messages.json` using `chrome.i18n`. Ready for community translations.
- **Inline autocomplete (full rebuild)** — Gmail Smart Compose / GitHub Copilot-quality ghost text completions as you type:
  - Dedicated Shadow DOM container (`#quill-ac-host`) for full CSS isolation from page styles
  - **Tab** to accept full completion, **Ctrl+Right / Cmd+Right** for word-by-word acceptance, **Esc** to dismiss
  - 3-dot animated loading indicator at cursor while API request is in flight
  - Keyboard hint badge ("Tab") displayed next to ghost text (toggle in settings)
  - IME composition handling — no ghost text during CJK input
  - `requestAnimationFrame`-based repositioning for smooth 60fps ghost text tracking on scroll/resize
  - MutationObserver detects active field removal (SPA navigation) and cleans up
  - Request deduplication — skips re-requesting identical text
  - ARIA attributes (`role="status"`, `aria-live="polite"`) for screen reader accessibility
  - Service worker backend: AbortController for stale request cancellation, response caching (50 entries, 5-min TTL), exponential backoff (1s→8s) on rate limits
  - Configurable trigger delay (300ms / 600ms / 1000ms), minimum characters, and keyboard hints toggle in settings
  - Opt-in via settings toggle (disabled by default)

### Changed
- Panel CSS refactored from hardcoded hex colors to CSS custom properties (`:host` scoped), enabling dark mode theming.
- Version bumped to 1.2.0.
- Options page expanded with new sections: Custom Instructions, Appearance, Inline Autocomplete, Usage Statistics.
- `manifest.json` now uses `__MSG_extName__`/`__MSG_extDescription__` for i18n and includes `default_locale: "en"` and `commands` block.

---

## [1.1.0]

### Added
- **Shadow DOM panel** — the suggestion panel now renders inside a Shadow Root attached to `<html>`, providing complete CSS isolation from host pages. Styles no longer bleed in or out.
- **Thinking model support** — Gemini 2.5+ and Gemini 3 models return `thought:true` parts for internal reasoning. The response parser now filters these and concatenates only output parts.
- **Enhanced JSON parsing** — three parsing strategies (direct, code-fence stripping, first-JSON-token extraction) with three normalization formats (object with `suggestions` array, direct array, flat key-value map).
- **EditContext API support** — for editors using Chrome's EditContext API (new Teams, VS Code web), text replacement goes through `editContext.updateText()`.
- **CKEditor paste simulation** — for CKEditor 5 (Teams web), dispatches a synthetic `ClipboardEvent('paste')` when `execCommand` fails.
- **Deep active element traversal** — `getDeepActiveElement()` walks into Shadow Roots to find the truly focused element, fixing input capture on web-component-based apps.
- **Input/textarea context capture** — captures `selectionStart`/`selectionEnd` at right-click time so replacement works even after focus shifts to the context menu.
- **SPA navigation handling** — listens to `popstate`, `hashchange`, and monkey-patches `history.pushState`/`replaceState` to invalidate stale DOM references.
- **Async contenteditable replacement** — uses `requestAnimationFrame` delays between focus, selection restore, and text insertion to let React/framework handlers settle.
- **Copy-to-clipboard fallback button** — each suggestion card in editable mode shows a small clipboard icon (⎘) as a manual fallback.
- **Input length validation** — selections over 8,000 characters are rejected with a friendly error message.
- **Debug logging flag** — verbose API response logging gated behind `DEBUG = false`.
- **Gemini 2.5 Flash** as new default model.
- **Gemini 3 Flash Preview** added as a model option in settings.
- Settings page redesigned with card-based layout, radio model selector, and checkbox style grid.

### Changed
- Panel positioning uses `position: fixed` (viewport-relative) instead of `position: absolute` (document-relative), eliminating scroll-offset bugs.
- Panel attaches to `<html>` instead of `<body>` to escape body-level CSS stacking contexts (fixes Jira, Confluence).
- Editable context detection uses `node.contentEditable === 'true'` (own property) instead of `node.isContentEditable` (inherited), preventing focus on non-focusable child nodes.
- Editable context traversal crosses Shadow DOM boundaries via `getRootNode()`.
- `all_frames: true` and `match_origin_as_fallback: true` added to manifest for iframe support.
- `maxOutputTokens` increased from 1,024 to 4,096.
- Error messages in catch handler sanitized (no longer exposes stack traces).

### Removed
- `content/content.css` — all panel CSS is now inlined in `content.js` for Shadow DOM injection.

### Fixed
- Panel no longer mispositions on scrolled pages (was adding `scrollY` to already-viewport-relative coordinates).
- Text replacement in Gmail, Outlook, and other contenteditable editors now works reliably via the multi-attempt async chain.

---

## [1.0.0]

### Added
- Initial release.
- Context menu "Improve with AI..." on text selection.
- Gemini API integration with configurable API key.
- Floating suggestion panel with 3 style cards.
- One-click text replacement for editable fields.
- Copy-to-clipboard for read-only pages.
- Options page with API key management, model selection, and style preferences.
