# ✨ Quill AI — AI Writing Assistant for Edge

> Highlight text. Right-click. Get three polished rewrites instantly.

Quill AI is a personal Microsoft Edge browser extension that sends any selected text to Google's Gemini AI and returns three improved suggestions. Pick the one you like and it replaces your original text — right where it was on the page.

**Current version:** 1.2.0 — see [CHANGELOG.md](CHANGELOG.md) for what's new.

---

## Features

- **Works everywhere** — email, forms, Google Docs, LinkedIn, Teams, social media, articles
- **Inline autocomplete** — Gmail Smart Compose-style ghost text completions as you type. Tab to accept, Ctrl+Right for word-by-word, Esc to dismiss
- **Shadow DOM isolation** — the panel's CSS never clashes with page styles, and vice versa
- **Three distinct styles** per request (e.g., Professional, Concise, Enhanced)
- **One-click replacement** — the improved text drops in exactly where the original was
- **Keyboard shortcut** — `Ctrl+Shift+Q` to trigger without right-clicking
- **Dark mode** — System, Light, or Dark theme for the panel and settings page
- **Custom prompts** — override the AI's system instruction and add per-style descriptions
- **Read-only pages** — shows a Copy button when the text can't be replaced
- **Usage statistics** — local-only stats (never sent anywhere) displayed on the settings page
- **Private by design** — your API key never leaves your browser
- **No accounts, no subscriptions** — just your own Gemini API key
- **No build step** — plain HTML, CSS, and JavaScript

---

## What It Looks Like

### Right-click menu
```
┌────────────────────────────────┐
│  Cut                           │
│  Copy                          │
│  Paste                         │
│  Search Google for "..."       │
│ ────────────────────────────── │
│  ✨  Improve with AI...        │
└────────────────────────────────┘
```

### Suggestion panel (appears above your selection)
```
┌──────────────────────────────────────────────────┐
│  ✦ Quill AI                                  ×  │
│                                                  │
│  Generating suggestions…                         │
│  ┌────────────────────────────────────────────┐  │
│  │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  │
│  │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  │
│  │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
                      ↓ after ~1–2s
┌──────────────────────────────────────────────────┐
│  ✦ Quill AI                                  ×  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ PROFESSIONAL                  [Apply]  ⎘  │  │
│  │ The cat sat on the mat, appearing entirely │  │
│  │ indifferent to her surroundings.           │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ CONCISE                       [Apply]  ⎘  │  │
│  │ The cat sat on the mat, unbothered.        │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ ENHANCED                      [Apply]  ⎘  │  │
│  │ The cat lounged on the mat, utterly        │  │
│  │ unconcerned with the world around her.     │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Click a suggestion to replace your selected text│
└──────────────────────────────────────────────────┘
```

---

## Setup Guide (5 minutes)

### Step 1 — Get a Free Gemini API Key

1. Go to **https://aistudio.google.com/app/apikey**
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key — it starts with `AIza...`

> The free tier gives you ~1,500 requests per day, which is more than enough for personal use.

---

### Step 2 — Load the Extension in Edge

1. Open Edge and navigate to: **`edge://extensions/`**
2. Toggle on **"Developer mode"** (top-right corner)
3. Click **"Load unpacked"**
4. Browse to and select the **`auto_complete_browser_ext`** folder
5. Quill AI will appear in your extensions list and toolbar

> You do **not** need to publish to the Edge Add-ons store. This installs directly from the folder.

---

### Step 3 — Enter Your API Key

1. Click the **Quill AI icon** in your Edge toolbar
   — OR — right-click it and choose **"Options"**
2. Paste your Gemini API key into the field
3. Click **"Test Connection"** — you should see **✓ Connected**
4. Click **"Save Settings"**

You're ready to go.

---

## How to Use

### Text Improvement (right-click or keyboard shortcut)

1. **Highlight** any text on a webpage
2. **Right-click** the selection and click **"✨ Improve with AI..."** — or press **Ctrl+Shift+Q**
3. A panel appears — wait ~1–2 seconds for Gemini to respond
4. **Click a suggestion card** — the original text is replaced instantly
5. If you see **[Copy]** instead of **[Apply]**, the text is read-only — click to copy
6. Press **Escape** or click outside the panel to dismiss without changes

### Inline Autocomplete (as-you-type ghost text)

1. Enable **Inline Autocomplete** in the settings page (off by default)
2. Start typing in any text field — after a brief pause, a gray completion appears
3. **Tab** — accept the full suggestion
4. **Ctrl+Right** (or **Cmd+Right** on Mac) — accept one word at a time
5. **Escape** — dismiss the suggestion
6. Just keep typing — the suggestion dismisses automatically and a new one appears after a pause

---

## Tips & Tricks

| Situation | What happens |
|---|---|
| Text is in a form / email / text box | [Apply] replaces the text directly |
| Text is on an article or read-only page | [Copy] copies the improvement to clipboard |
| You don't like any suggestion | Click Cancel or press Escape — nothing changes |
| Gemini is slow | The panel shows a shimmer skeleton while loading |
| You want different styles | Go to Settings → Suggestion Styles |
| You want the latest model | Go to Settings → switch to Gemini 3 Flash Preview |
| Autocomplete feels slow | Settings → Trigger Delay → Fast (300ms) |
| Ghost text appears too early | Settings → increase Minimum Characters |
| You prefer no keyboard hints | Settings → uncheck "Show keyboard hints" |
| You want a custom AI persona | Settings → Custom Instructions → System Instruction |

---

## Settings Page

Access via: Edge toolbar → Quill AI icon → Options

```
┌──────────────────────────────────────────────────────┐
│  ✦ Quill AI                                         │
│  AI-powered text improvements on any webpage         │
├──────────────────────────────────────────────────────┤
│                                                      │
│  API Configuration                                   │
│  Gemini API Key                                      │
│  [AIza●●●●●●●●●●●●●●●●] [Show]                     │
│  [Test Connection]  ✓ Connected                      │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  AI Model                                            │
│  (●) Gemini 2.5 Flash Lite — Fastest · Recommended  │
│  ( ) Gemini 2.5 Flash — Fast and capable             │
│  ( ) Gemini 3 Flash Preview — Latest preview         │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Suggestion Styles (choose exactly 3)                │
│  [✓] Professional    [✓] Concise                    │
│  [✓] Enhanced        [ ] Creative                   │
│  [ ] Formal          [ ] Casual                     │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Custom Instructions                                 │
│  System Instruction: [                          ]    │
│  Style Descriptions: (per selected style)            │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Appearance                                          │
│  (●) System   ( ) Light   ( ) Dark                   │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Inline Autocomplete                                 │
│  [✓] Enable inline autocomplete                     │
│  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐ │
│  │ Trigger Delay: (●) Fast  ( ) Normal  ( ) Relaxed│ │
│  │ Minimum characters: [10]                        │ │
│  │ [✓] Show keyboard hints                        │ │
│  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘ │
│                                                      │
├──────────────────────────────────────────────────────┤
│  [ Save Settings ]   ✓ Saved                        │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Usage Statistics (local only)                       │
│  Total Improvements: 42                              │
│  Characters Improved: 12.3K                          │
│  [Reset Stats]                                       │
│                                                      │
├──────────────────────────────────────────────────────┤
│  Quill AI v1.2  ·  Personal use only                │
└──────────────────────────────────────────────────────┘
```

---

## Limitations

- Requires an active internet connection for every request
- Uses your personal Gemini API free-tier quota
- Some protected pages (banking, Edge system pages) block extensions — this is normal
- Text selections over 8,000 characters are rejected — select shorter passages for best results

---

## Project Structure

```
auto_complete_browser_ext/
├── manifest.json              Extension configuration (MV3)
├── _locales/
│   └── en/messages.json       i18n strings (English)
├── background/
│   └── service-worker.js      Context menu, Gemini API, autocomplete backend
├── content/
│   └── content.js             Shadow DOM panel + autocomplete ghost text
├── options/
│   ├── options.html           Settings page
│   ├── options.js             Settings logic
│   └── options.css            Settings styles
├── icons/
│   └── icon-*.png             Extension icons (16/32/48/128)
├── .gitignore
├── CHANGELOG.md               Version history
├── README.md                  This file
└── DEVELOPMENT.md             Developer guide
```

---

## Privacy

- Your API key is stored only in your browser's local storage (`chrome.storage.local`)
- Selected text is sent directly from your browser to Google's Gemini API — not through any intermediary server
- No analytics, no telemetry, no external servers other than Gemini

---

*Quill AI — Personal hobby project. Not affiliated with Google or Microsoft.*
