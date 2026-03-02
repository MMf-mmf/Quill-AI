# Contributing to Quill AI

First off, thank you for considering contributing to Quill AI! It's people like you that make Quill AI such a great tool. 

Quill AI is currently a **Work in Progress (WIP)**. We are actively looking for **core contributors / co-contributors** to help us make the extension better, cleaner, and more user-friendly.

## Where We Need Help

We'd love your help in the following areas:

### 1. Bug Fixes
Browser extensions deal with the chaos of the open web. There are edge cases in editable contexts, SPAs, and Shadow DOM conflicts across different websites (like Teams, Outlook, Gmail, Jira). Help us identify, document, and fix these issues so Quill AI works perfectly everywhere.

### 2. Code Cleanliness & Refactoring
As the project grows, keeping the code clean, modular, and easy to read is paramount. Since we use no build steps (pure HTML/CSS/JS), any refactoring that improves architecture, efficiency, or maintainability without adding complex build tools is highly welcome.

### 3. UI/UX Improvements
We want Quill AI to feel native, sleek, and intuitive. Whether it's the right-click menu, the suggestion panel, inline autocomplete, or the options page, we are looking for developers and designers to help elevate the user experience.

---

## How to Get Started

### 1. Set Up Your Environment
The project requires no build tools (no Node.js, no npm). It is plain HTML, CSS, and JS.
- Clone the repository.
- Read through the [`DEVELOPMENT.md`](DEVELOPMENT.md) for a deep dive into the architecture.
- Load the unpacked extension in Microsoft Edge or Chrome via `edge://extensions` or `chrome://extensions`.

### 2. Find an Issue
Look for issues labeled `bug`, `help wanted`, `good first issue`, or `ui/ux`. If you have a new idea or found a bug, please create a new issue first to discuss it before opening a Pull Request.

### 3. Make Your Changes
- Create a new branch: `git checkout -b feature/your-feature-name` or `bugfix/issue-description`
- Write clear, concise, and documented code.
- Follow the existing code style (plain JavaScript, native browser APIs).
- Test your changes locally across different sites (editable divs, input fields, read-only text).

### 4. Submit a Pull Request
- Push your branch to your fork.
- Open a Pull Request against our `main` branch.
- Fill out the PR template completely so we understand what you changed and why.
- We will review your PR, provide feedback, and merge it!

## Code of Conduct
Please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms. Let's build a welcoming and inclusive community.

Thank you for contributing!
