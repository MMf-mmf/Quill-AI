# Quill AI — Developer Reference

This document is for building, debugging, and extending the Quill AI Edge extension.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Architecture Overview](#architecture-overview)
4. [File-by-File Reference](#file-by-file-reference)
5. [Development Workflow](#development-workflow)
6. [Debugging Guide](#debugging-guide)
7. [Gemini API Reference](#gemini-api-reference)
8. [UI Design System](#ui-design-system)
9. [Text Replacement Logic](#text-replacement-logic)
10. [Common Issues & Fixes](#common-issues--fixes)
11. [Extending the Extension](#extending-the-extension)
12. [Icons](#icons)
13. [Future Roadmap](#future-roadmap)
14. [Verification Checklist](#verification-checklist)

---

## Prerequisites

- **Microsoft Edge** (any recent version — Chromium-based). Also works on Chrome, Brave, Opera.
- A **Gemini API key** from https://aistudio.google.com/app/apikey
- A text editor (VS Code recommended)
- No Node.js, no npm, no build tools required — this is plain HTML/CSS/JS

---

## Project Structure

```
auto_complete_browser_ext/
├── manifest.json                   Extension config (Manifest V3)
│
├── _locales/
│   └── en/
│       └── messages.json           i18n strings (English)
│
├── background/
│   └── service-worker.js           Context menu, Gemini API, autocomplete backend
│
├── content/
│   └── content.js                  Shadow DOM panel + autocomplete ghost text
│
├── options/
│   ├── options.html                Settings page HTML
│   ├── options.js                  Reads/writes chrome.storage.local
│   └── options.css                 Settings page styles
│
├── icons/
│   ├── icon-16.png                 Toolbar favicon size
│   ├── icon-32.png
│   ├── icon-48.png                 Extensions list size
│   └── icon-128.png                Store / install dialog size
│
├── .gitignore
├── CHANGELOG.md                    Version history
├── README.md                       User-facing setup guide
└── DEVELOPMENT.md                  This file
```

---

## Architecture Overview

Quill AI uses the standard **Manifest V3** extension architecture with three layers:

```
┌─────────────────────────────────────────────────────────────────┐
│  WEBPAGE (any site the user visits)                             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  content/content.js  (Content Script)                   │   │
│  │  • Captures selection + input context at contextmenu    │   │
│  │  • Injects Shadow DOM panel on <html> element           │   │
│  │  • Shadow DOM isolation — no CSS bleed in or out        │   │
│  │  • Renders loading → suggestions → apply                │   │
│  │  • Performs text replacement (5-attempt async chain)     │   │
│  │  • Inline autocomplete: Shadow DOM ghost text overlay   │   │
│  └───────────────────┬─────────────────────────────────────┘   │
└──────────────────────│─────────────────────────────────────────┘
                       │  chrome.runtime.sendMessage / onMessage
┌──────────────────────│─────────────────────────────────────────┐
│  EXTENSION BACKGROUND                                           │
│                                                                 │
│  ┌───────────────────┴─────────────────────────────────────┐   │
│  │  background/service-worker.js  (Service Worker)         │   │
│  │  • Registers the "Improve with AI" context menu item    │   │
│  │  • On click: sends IMPROVE_TEXT to the active tab       │   │
│  │  • On CALL_GEMINI message: reads API key from storage   │   │
│  │  • Validates input length (max 8,000 chars)             │   │
│  │  • POSTs to Gemini API, parses 3 suggestions            │   │
│  │  • Sends SUGGESTIONS (or ERROR) back to the tab         │   │
│  │  • Handles GEMINI_COMPLETE for inline autocomplete      │   │
│  │  • Caches completions, supports AbortController         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                       │  fetch()
┌──────────────────────▼─────────────────────────────────────────┐
│  GOOGLE GEMINI API                                              │
│  https://generativelanguage.googleapis.com/v1beta/models/...   │
└─────────────────────────────────────────────────────────────────┘
```

### Message Types

| Message type | Direction | Payload |
|---|---|---|
| `IMPROVE_TEXT` | Service Worker → Content Script | `{ text }` |
| `CALL_GEMINI` | Content Script → Service Worker | `{ text }` |
| `SUGGESTIONS` | Service Worker → Content Script | `{ suggestions: [{label, text}] }` |
| `ERROR` | Service Worker → Content Script | `{ code, message }` |
| `GEMINI_COMPLETE` | Content Script → Service Worker | `{ textBeforeCursor }` |
| `ABORT_GEMINI_COMPLETE` | Content Script → Service Worker | *(none)* |
| `TRACK_APPLY` | Content Script → Service Worker | `{ label, charCount }` |

### Shared Constants

`GEMINI_BASE_URL` and `DEFAULT_MODEL` are defined in both `service-worker.js` and `options.js`. In Manifest V3 without a build step, there is no module system that both the service worker and the options page can share. This duplication is intentional. If you change these values, update both files.

---

## File-by-File Reference

### `manifest.json`

The extension configuration. Manifest V3 is required by modern Chromium-based browsers.

```json
{
  "manifest_version": 3,
  "name": "__MSG_extName__",
  "version": "1.2.0",
  "description": "__MSG_extDescription__",
  "default_locale": "en",

  "permissions": [
    "contextMenus",
    "storage",
    "activeTab",
    "scripting"
  ],

  "host_permissions": [
    "https://generativelanguage.googleapis.com/*"
  ],

  "background": {
    "service_worker": "background/service-worker.js"
  },

  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/content.js"],
    "run_at": "document_idle",
    "all_frames": true,
    "match_origin_as_fallback": true
  }],

  "options_page": "options/options.html",

  "action": {
    "default_title": "Quill AI Settings",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },

  "commands": {
    "trigger-quill": {
      "suggested_key": {
        "default": "Ctrl+Shift+Q",
        "mac": "Command+Shift+Q"
      },
      "description": "Improve selected text with Quill AI"
    }
  },

  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

Key differences from v1.0:
- No `css` array in `content_scripts` — all panel CSS is inlined in `content.js` for Shadow DOM injection
- `all_frames: true` — the content script runs in iframes as well as the main frame
- `match_origin_as_fallback: true` — allows matching in cross-origin iframes
- `__MSG_extName__` / `__MSG_extDescription__` — i18n message references
- `default_locale: "en"` — required for i18n
- `commands` block — `Ctrl+Shift+Q` keyboard shortcut

---

### `background/service-worker.js`

**Responsibilities:**
- Register the context menu item once on install
- On context menu click: forward selected text to content script
- Handle `Ctrl+Shift+Q` keyboard shortcut via `chrome.commands`
- Receive `CALL_GEMINI` messages from content script
- Validate input length (reject selections > 8,000 chars)
- Read API key + model from `chrome.storage.local`
- Build the Gemini API request with prompt engineering
- POST to Gemini, parse the JSON response, extract 3 suggestions
- Send `SUGGESTIONS` or `ERROR` back to the originating tab
- Handle `GEMINI_COMPLETE` for inline autocomplete (with caching, backoff, AbortController)
- Handle `ABORT_GEMINI_COMPLETE` to cancel in-flight autocomplete requests
- Track usage analytics via `TRACK_APPLY` messages

**Key constants:**
```javascript
const GEMINI_BASE_URL  = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL    = 'gemini-2.5-flash-lite';
const CONTEXT_MENU_ID  = 'quill-improve';
const DEBUG            = false;       // Set to true for verbose API logging
const MAX_INPUT_LENGTH = 8000;        // ~2,000 words
```

**Prompt template:**
```
System instruction:
  "You are an expert writing assistant. Given a snippet of text, return
  exactly 3 improved versions as a JSON object with a 'suggestions' array.
  Each item in the array must have a 'label' (style name) and 'text' (the
  improved version). Fix spelling, grammar, and clarity. Preserve meaning.
  Do not explain. Respond only with valid JSON."

User message:
  "Improve this text using these 3 styles: {style1}, {style2}, {style3}.
  Text: \"{selectedText}\""
```

**Parsing strategy (3 attempts x 3 normalizations):**

Attempts (tried in order):
1. Direct `JSON.parse()` on the full response text
2. Strip markdown code fences (`` ```json … ``` ``) then parse
3. Find the first `{` or `[` and last matching `}` or `]`, parse that substring

Each parsed result is normalized through:
- **Format A:** `{"suggestions": [{label, text}, ...]}` — standard
- **Format B:** `[{label, text}, ...]` — direct array
- **Format C:** `{"Professional": "...", "Concise": "...", ...}` — flat key-value map

**Thinking model support (Gemini 2.5+, Gemini 3):**

These models return multiple `parts` in the response. Parts with `thought: true` contain internal reasoning and are filtered out. Only non-thought parts are concatenated:

```javascript
const parts = data.candidates[0].content.parts;
const raw = parts.filter(p => p.text && !p.thought).map(p => p.text).join('');
```

**Inline autocomplete backend (`handleGeminiComplete`):**

The service worker also handles autocomplete completion requests from the content script. Key features:

- **AbortController** — a module-level `acAbortController` cancels in-flight requests when a new request arrives or the user dismisses the ghost text
- **Response caching** — `acCache` (Map, max 50 entries, 5-minute TTL) stores completions keyed by the last 500 chars of text-before-cursor. Avoids redundant API calls.
- **Exponential backoff** — on 429 or 500+ errors, backs off with delay: 1s → 2s → 4s → 8s max. Resets on success. Returns `{ type: 'ERROR', code: 'BACKOFF' }` during backoff.
- **Prompt tuning** — `maxOutputTokens: 128` (short completions), `temperature: 0.3` (deterministic), instructions to match the user's language/writing style and never repeat existing text.

---

### `content/content.js`

**Responsibilities:**

1. **Capture selection** on `IMPROVE_TEXT` message:
   - `window.getSelection()` for contenteditable and read-only text
   - `capturedInputContext` (snapped at right-click time via `contextmenu` event) for `<input>` / `<textarea>` where `getSelection()` is always empty
   - Deep active element traversal via `getDeepActiveElement()` — walks into Shadow Roots to find the truly focused element (Teams, Outlook web components)

2. **Send to background:**
   - `chrome.runtime.sendMessage({ type: 'CALL_GEMINI', text })` with callback
   - Show loading panel immediately (don't wait)

3. **Panel lifecycle (Shadow DOM):**
   - Create a `<div>` shadow host, attach an open Shadow Root
   - Inject `PANEL_CSS` constant as a `<style>` element inside the shadow root
   - Build the panel DOM inside the shadow root
   - Attach to `document.documentElement` (`<html>`), not `<body>` — escapes body-level CSS stacking contexts (fixes Jira, Confluence)
   - States: `loading` → `results` → `success` / `error`

4. **Panel positioning (position: fixed):**
   ```
   // Viewport-relative — no scroll offsets needed
   left = selectionRect.left, clamped to [PANEL_MARGIN, viewportWidth - PANEL_WIDTH - PANEL_MARGIN]
   top  = anchorY - panelHeight - 8px  (above the selection)
   top  = Math.max(PANEL_MARGIN, top)
   ```

5. **Text replacement** (see dedicated section below)

6. **SPA navigation state invalidation:**
   - Listens to `popstate` and `hashchange`
   - Monkey-patches `history.pushState` / `replaceState`
   - Clears stored Range, EditInfo, and position rect on navigation

7. **Cleanup:**
   - ESC key → remove panel
   - Click outside panel → remove panel (uses `composedPath()` for Shadow DOM)
   - Successful apply → show success toast for 2s → remove panel

8. **Inline autocomplete** (lines 972–1701):
   - Watches all editable fields (`<input>`, `<textarea>`, `contenteditable`) for typing activity
   - After a configurable debounce (default 300ms), sends partial text to the service worker via `GEMINI_COMPLETE`
   - Renders ghost text completion inside a **dedicated Shadow DOM container** (`#quill-ac-host`) — fully isolated from page CSS
   - Supports `Tab` to accept full completion, `Ctrl+Right` / `Cmd+Right` for word-by-word acceptance, `Esc` to dismiss
   - Shows a 3-dot animated loading indicator while the API request is in flight
   - Displays a keyboard hint badge ("Tab") next to the ghost text (configurable)
   - Tracks IME composition state to avoid triggering during CJK input
   - Uses `requestAnimationFrame` loop for smooth 60fps ghost text repositioning on scroll/resize
   - MutationObserver watches for the active field being removed from DOM (SPA navigation)
   - Deduplicates requests (skips if text-before-cursor matches last request)
   - ARIA attributes on shadow host for screen reader accessibility

### Panel CSS (inlined in `content.js`)

Because the panel lives inside a Shadow Root, external stylesheets loaded via the manifest's `content_scripts.css` array do not apply. All panel styles are defined in the `PANEL_CSS` constant at the top of `content.js` and injected as a `<style>` element inside the shadow root.

All rules use `:host` (for the shadow host element) and bare `.qp-*` class selectors (scoped automatically by the shadow boundary). The `!important` flags on `:host` properties are intentional — they prevent aggressive page styles from overriding the panel's positioning.

### Autocomplete CSS (inlined in `content.js`)

The inline autocomplete ghost text also lives inside its own Shadow Root (separate from the panel's). All autocomplete styles are defined in the `AUTOCOMPLETE_CSS` constant and injected into the `#quill-ac-host` shadow root.

Key style classes:
- `.qac-ghost` — fixed-position container for ghost text, `pointer-events: none`, font/size matched to the active field
- `.qac-text` — the completion text itself, semi-transparent gray (`#9CA3AF`), fades in via `qac-fade-in` animation (150ms)
- `.qac-hint` — keyboard hint badge ("Tab"), purple pill (`rgba(124,58,237,0.08)`), font-size 10px
- `.qac-loading` — 3-dot animated pulse indicator using `qac-dot-pulse` keyframes with staggered delays
- `.qac-sr-only` — screen-reader-only live region for ARIA announcements
- Dark mode variants via `:host(.qp-dark)` selector

---

### `options/options.html`

A standard full-page options page (not a popup). Uses semantic HTML with ARIA labels and linked inputs. Calls `options.js` for all logic.

**Sections:**
1. API Configuration — password input for API key, Show/Hide toggle, Test Connection button, status badge
2. AI Model — radio buttons for `gemini-2.5-flash-lite` (default), `gemini-2.5-flash`, `gemini-3-flash-preview`
3. Suggestion Styles — checkboxes in a 2-column grid: Professional, Concise, Enhanced, Creative, Formal, Casual
4. Custom Instructions — textarea for custom system prompt, optional per-style description inputs
5. Appearance — radio buttons for System / Light / Dark theme
6. Inline Autocomplete — master toggle + sub-settings panel:
   - **Trigger Delay** — radio group: Fast (300ms), Normal (600ms), Relaxed (1000ms)
   - **Minimum characters** — number input (range 5–50, default 10)
   - **Show keyboard hints** — toggle checkbox
7. Usage Statistics — local-only stats grid with reset button

---

### `options/options.js`

**Storage keys in `chrome.storage.local`:**

| Key | Type | Default |
|---|---|---|
| `apiKey` | string | `""` |
| `model` | string | `"gemini-2.5-flash-lite"` |
| `styles` | string[] | `["Professional", "Concise", "Enhanced"]` |
| `theme` | string | `"auto"` |
| `customPrompt` | string | `""` |
| `styleDescriptions` | object | `{}` |
| `autocompleteEnabled` | boolean | `false` |
| `autocompleteDelay` | number | `300` |
| `autocompleteMinChars` | number | `10` |
| `autocompleteHints` | boolean | `true` |
| `analytics` | object | `{ totalImprovements, totalChars, styleUsage, modelUsage }` |

**On load:**
- Read all keys from storage
- Populate form fields
- Apply saved theme
- Build style description inputs for selected styles
- Show/hide autocomplete sub-settings based on toggle state
- Apply i18n to all `[data-i18n]` elements

**On "Test Connection":**
- Make a minimal Gemini API call: prompt = `"Reply with the single word OK"`
- Show ✓ green badge or ✗ red badge with error message

**On "Save Settings":**
- Validate exactly 3 styles are checked
- Write all settings to `chrome.storage.local`
- Show a brief "Saved ✓" confirmation

---

## Development Workflow

### Loading the Extension

```
1. Open Edge → navigate to: edge://extensions/
2. Enable "Developer mode" toggle (top-right)
3. Click "Load unpacked"
4. Select the auto_complete_browser_ext/ folder
5. The extension appears in your list
```

### Reloading After a Code Change

After editing any file:
```
edge://extensions/ → Find "Quill AI" → Click the ↻ refresh icon
```

Then refresh any test page you have open (F5).

> **Note:** You do NOT need to reload for options page changes — just close and reopen the options tab.

---

## Debugging Guide

### Background Service Worker (API calls, context menu)

```
edge://extensions/ → "Quill AI" card → Click "Inspect views: service worker"
```

This opens a DevTools window for the service worker. Set `DEBUG = true` at the top of `service-worker.js` to enable verbose API response logging.

### Content Script (panel UI, text replacement)

```
Open any webpage → F12 → Console tab
Filter by source: content.js
```

All `console.warn()` calls in `content.js` appear in the page's DevTools console. These are prefixed with `[Quill AI]` for easy filtering.

### Options Page

```
Right-click anywhere on the options page → "Inspect"
```

### Useful DevTools snippets for content script testing

```javascript
// Check if content script loaded
window.__quillAILoaded

// Manually trigger a panel (for testing UI without right-clicking)
window.__quillAIDebug({ text: "hello world", rect: { top: 300, left: 200, width: 200, height: 20 } })

// Check stored settings
chrome.storage.local.get(null, console.log)
```

---

## Gemini API Reference

### Endpoint

```
POST https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}
```

### Request Body

```json
{
  "system_instruction": {
    "parts": [{ "text": "You are an expert writing assistant..." }]
  },
  "contents": [{
    "role": "user",
    "parts": [{ "text": "Improve this text using styles: Professional, Concise, Enhanced. Text: \"your selected text here\"" }]
  }],
  "generationConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 4096,
    "responseMimeType": "application/json"
  }
}
```

### Response Structure

```json
{
  "candidates": [{
    "content": {
      "parts": [
        { "thought": true, "text": "internal reasoning..." },
        { "text": "{\"suggestions\":[...]}" }
      ]
    }
  }]
}
```

**Thinking models (Gemini 2.5+, Gemini 3)** may return multiple parts. Filter for non-thought parts:

```javascript
const parts = data.candidates[0].content.parts;
const raw = parts.filter(p => p.text && !p.thought).map(p => p.text).join('');
const suggestions = parseGeminiSuggestions(raw);
```

### Free Tier Limits (as of early 2026)

| Model | RPM | RPD | Notes |
|---|---|---|---|
| gemini-2.5-flash | 10 | 500 | Recommended default |
| gemini-3-flash-preview | 5 | 200 | Latest preview, limits may change |
| gemini-2.0-flash | 15 | 1,500 | Stable, highest free limits |

### Error Codes to Handle

| HTTP Status | Meaning | User Message |
|---|---|---|
| 400 | Bad request / malformed prompt | "Request error — please try again" |
| 401 | Invalid API key | "Invalid API key — check Settings" |
| 403 | API key not enabled for Gemini | "API key not authorized — check AI Studio" |
| 429 | Rate limit hit | "Too many requests — try again in a moment" |
| 500 | Gemini server error | "Gemini is unavailable — try again shortly" |

---

## UI Design System

### Color Tokens

```css
:root {
  --quill-purple:        #7C3AED;
  --quill-purple-dark:   #5B21B6;
  --quill-purple-light:  #EDE9FE;
  --quill-bg:            #FFFFFF;
  --quill-border:        #E5E7EB;
  --quill-card-border:   #F3F4F6;
  --quill-text:          #111827;
  --quill-text-muted:    #6B7280;
  --quill-success:       #10B981;
  --quill-error:         #EF4444;
  --quill-warning:       #F59E0B;
}
```

### Spacing & Shape

```
Panel width:       440px
Panel max-height:  80vh (scrollable if needed)
Panel padding:     20px
Card padding:      14px 16px
Border radius:     Panel 16px, Cards 10px, Buttons 6px
Gap between cards: 10px
```

### Typography Scale

```
Panel header:      15px / weight 600
Card label badge:  10px / weight 700 / UPPERCASE / letter-spacing 0.07em
Card body text:    13px / weight 400 / line-height 1.6
Button text:       12px / weight 600
Caption/footer:    11px / weight 400 / color: --quill-text-muted
```

### Shadow

```css
/* Panel drop shadow */
box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08);

/* Card hover shadow */
box-shadow: 0 2px 8px rgba(124, 58, 237, 0.10);
```

---

## Text Replacement Logic

The replacement strategy depends on the target element type, detected by `getEditableContext()` which walks up the DOM — crossing Shadow DOM boundaries via `getRootNode()` — looking for `contentEditable === 'true'` or `<input>`/`<textarea>` nodes.

Key detail: the function checks `node.contentEditable === 'true'` (the property on THIS element) rather than `node.isContentEditable` (which is inherited by all children). This ensures we find the root editable element, not a nested `<span>` or `<p>`.

### Case 1: `<input>` or `<textarea>` (synchronous)

```javascript
element.focus();
element.setRangeText(newText, start, end, 'end');
element.dispatchEvent(new Event('input',  { bubbles: true }));
element.dispatchEvent(new Event('change', { bubbles: true }));
```

The selection range (`start`, `end`) is captured at right-click time via the `contextmenu` event listener, before the context menu steals focus and the selection is lost.

### Case 2: `contenteditable` (async, 5-attempt chain)

Each step is separated by `requestAnimationFrame` delays to let framework handlers (React effects, Vue watchers, Angular zones) settle before proceeding.

**Attempt 0: EditContext API** — Chrome 121+ editors (new Teams, VS Code web). When an element has an associated `editContext`, `execCommand` and DOM Range manipulation are completely ignored. We call `editContext.updateText()` and dispatch a `TextUpdateEvent`.

**Attempt 1: `execCommand('insertText')`** — Generates a *trusted* `beforeinput` event (`isTrusted: true`), which frameworks like Lexical and ProseMirror process correctly. Kept as the primary approach despite deprecation for exactly this reason.

**Attempt 1.5: CKEditor paste simulation** — Teams web uses CKEditor 5, which filters out synthetic InputEvents. We dispatch a synthetic `ClipboardEvent('paste')` with a `DataTransfer` containing the new text. CKEditor's internal `ClipboardObserver` picks this up.

**Attempt 2: Synthetic `InputEvent`** — Dispatches `beforeinput` + `input` events with `inputType: 'insertText'`. Works for Slate.js, ProseMirror, and TipTap. Note: `isTrusted` will be `false`, so editors that guard against untrusted input will ignore this.

**Attempt 3: Direct Range API** — `storedRange.deleteContents()` + `storedRange.insertNode(textNode)`. Last resort for plain contenteditable divs with no framework.

If all attempts fail, falls back to clipboard copy with a toast message: "Copied — paste with Ctrl+V".

### Case 3: Read-only text

Shows [Copy] instead of [Apply]. Clicking copies to clipboard via `navigator.clipboard.writeText()`.

---

## Common Issues & Fixes

| Issue | Likely Cause | Fix |
|---|---|---|
| Extension doesn't load | Syntax error in any JS/JSON file | Check DevTools → Extensions page for error |
| Context menu item missing | Service worker crashed on startup | Inspect service worker → fix the error → reload extension |
| Panel doesn't appear | Content script error | Open page DevTools → Console → look for error in content.js |
| Panel appears off-screen | Position clamping missing | Check viewport clamp in `positionPanel()` |
| "Failed to fetch" in service worker | Missing host_permissions | Add `https://generativelanguage.googleapis.com/*` to manifest |
| Text not replaced in Gmail | Gmail uses contenteditable | Should work via Attempt 1 (execCommand); check console for warnings |
| Panel CSS looks wrong | Shadow DOM style not injected | Check PANEL_CSS constant in content.js matches expected styles |
| API key not persisting | Storage write not awaited | Use `await chrome.storage.local.set(...)` |
| Gemini returns non-JSON | Model generated markdown/text | The 3-attempt parser handles code fences and mixed prose |
| Apply doesn't work in Teams | CKEditor/EditContext path failed | Check console for `[Quill AI]` warnings; try the ⎘ clipboard icon |
| Stale selection after SPA navigation | Stored Range points to unmounted DOM | SPA handlers should clear state; verify history patch is active |
| Extension works in main frame but not iframe | `all_frames` not set | Ensure `"all_frames": true` in manifest content_scripts |
| Suggestion cards have wrong font | Page CSS bleeding into panel | Panel uses Shadow DOM — should be isolated. Check host styles. |

---

## Extending the Extension

### Adding a New Suggestion Style

1. Open `options/options.html` — add a new checkbox in the `.checkbox-grid`:
   ```html
   <label class="checkbox-label">
     <input type="checkbox" name="style" value="Humorous">
     <span class="checkbox-info">
       <strong>Humorous</strong>
       <span class="checkbox-desc">Light-hearted and witty</span>
     </span>
   </label>
   ```
2. `options.js` automatically picks it up from the checkbox values
3. The prompt in `service-worker.js` will include the new style name in the next request

### Adding Keyboard Shortcut to Trigger

1. Add to `manifest.json`:
   ```json
   "commands": {
     "trigger-quill": {
       "suggested_key": { "default": "Ctrl+Shift+Q" },
       "description": "Improve selected text with Quill AI"
     }
   }
   ```
2. In `background/service-worker.js`, listen to `chrome.commands.onCommand`

### Supporting Multiple Languages

The Gemini model already handles most languages natively. The panel UI uses `chrome.i18n` with `_locales/en/messages.json` for all user-facing strings. To add a new locale:

1. Create `_locales/{locale}/messages.json` (e.g., `_locales/es/messages.json`)
2. Copy all keys from `_locales/en/messages.json`
3. Translate each `"message"` value
4. Chrome will automatically use the browser's locale preference

---

## Icons

The extension needs icons at 4 sizes: 16×16, 32×32, 48×48, 128×128 pixels.

**Design concept:** A purple quill pen on a white circle, with a subtle sparkle

**Free tools:**
- **Figma** (https://figma.com) — free, browser-based, export PNG at any size
- **Inkscape** — free, desktop SVG editor

**Icon generation steps:**
1. Design at 512×512 in Figma or Inkscape
2. Export as PNG
3. Resize to 128, 48, 32, 16 using the export presets
4. Place in `icons/` folder

---

## Future Roadmap

Potential enhancements (not committed to any timeline):

- **Chrome Web Store / Edge Add-ons** — publish for one-click install
- **Streaming responses** — show suggestions as they arrive instead of waiting for the full response (Gemini streaming API)
- **Multi-language locales** — currently only `_locales/en/` exists; community translations could be added

### Already Implemented (v1.2)

The following items from the original roadmap have been completed:

- ~~Inline autocomplete~~ — Shadow DOM ghost text, Tab/Ctrl+Right/Esc, IME handling, caching, backoff, loading indicator, word-by-word acceptance
- ~~Keyboard shortcut~~ — `Ctrl+Shift+Q` / `Cmd+Shift+Q` via `chrome.commands`
- ~~Dark mode~~ — System / Light / Dark theme for panel and options page
- ~~i18n~~ — `chrome.i18n` with `_locales/en/messages.json`
- ~~Custom prompts~~ — custom system instruction + per-style descriptions in settings
- ~~Local usage analytics~~ — total improvements, chars improved, style/model breakdowns on options page

---

## Verification Checklist

Run through this after each development phase:

### Core Suggestion Panel
- [ ] `edge://extensions/` shows no errors for Quill AI
- [ ] Context menu item "✨ Improve with AI..." appears when text is selected
- [ ] `Ctrl+Shift+Q` triggers improvement on selected text
- [ ] Loading skeleton panel appears immediately after triggering
- [ ] 3 suggestion cards appear within ~2 seconds
- [ ] Card labels match the selected styles (Professional / Concise / Enhanced by default)
- [ ] Clicking a suggestion card in a text input replaces the text
- [ ] Clicking a suggestion card in Gmail compose replaces the text
- [ ] Selecting text in an article shows [Copy] instead of [Apply]
- [ ] ⎘ clipboard fallback button copies text on click
- [ ] Pressing Escape closes the panel with no changes
- [ ] Clicking outside the panel closes it with no changes
- [ ] Success toast appears after applying, then auto-dismisses
- [ ] Selecting 8,000+ characters shows a friendly error
- [ ] Panel does not visually break on pages with aggressive CSS (Jira, Confluence)
- [ ] Panel works inside iframes (e.g., embedded editors)

### Inline Autocomplete
- [ ] Type in a `<textarea>` on any page — ghost text appears after debounce pause
- [ ] Type in an `<input type="text">` — ghost text appears correctly positioned
- [ ] Type in Gmail compose (contenteditable) — ghost text appears at cursor
- [ ] Press **Tab** — ghost text is fully inserted into the field
- [ ] Press **Ctrl+Right** (or **Cmd+Right** on Mac) — one word is accepted
- [ ] Press **Escape** — ghost text is dismissed
- [ ] Continue typing — ghost text dismissed, new suggestion after pause
- [ ] During CJK/IME input — no ghost text appears until composition ends
- [ ] Open DevTools — ghost elements are inside `#quill-ac-host` Shadow DOM
- [ ] 3-dot loading indicator appears while API request is in flight
- [ ] Keyboard hint badge ("Tab") appears next to ghost text
- [ ] Rapid typing — no visual flickering, stale suggestions don't appear
- [ ] API rate limit hit — autocomplete silently pauses (no user-facing errors)
- [ ] SPA navigation — ghost dismissed, no stale references
- [ ] Disable autocomplete in settings — ghost text stops entirely
- [ ] Change trigger delay in settings — debounce timing updates
- [ ] Test on a page with aggressive CSS — ghost text styled correctly (Shadow DOM isolation)

### Options Page
- [ ] Options page loads without errors, footer shows v1.2
- [ ] Entering an invalid API key shows ✗ Failed
- [ ] Entering a valid API key shows ✓ Connected
- [ ] Theme switching works live (System / Light / Dark)
- [ ] Autocomplete toggle shows/hides sub-settings panel
- [ ] Autocomplete delay, min chars, and hints toggle save correctly
- [ ] Custom prompt and style descriptions save and persist
- [ ] Usage statistics display and reset button works
- [ ] Preferences survive a browser restart (check storage persistence)

---

*Quill AI — Developer Reference v1.2*
