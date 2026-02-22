<div align="center">

# AllTab (Chrome Extension)

Save up to **95% memory** by converting all your open tabs into a clean, organized list — then restore them anytime.

<p>
  <img alt="Manifest" src="https://img.shields.io/badge/Manifest-v3-blue?style=for-the-badge" />
  <img alt="Built with" src="https://img.shields.io/badge/Built%20with-HTML%20%2B%20JavaScript-black?style=for-the-badge" />
  <a href="https://github.com/akshitsutharr/AllTab/issues"><img alt="Issues" src="https://img.shields.io/github/issues/akshitsutharr/AllTab?style=for-the-badge"></a>
  <a href="https://github.com/akshitsutharr/AllTab/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/akshitsutharr/AllTab?style=for-the-badge"></a>
</p>

</div>

---

## Table of Contents

- [What is AllTab?](#what-is-alltab)
- [Key Features](#key-features)
- [How It Works (Concept)](#how-it-works-concept)
- [Screenshots / Demo](#screenshots--demo)
- [Install (Developer Mode)](#install-developer-mode)
- [How to Use](#how-to-use)
  - [Save](#save)
  - [Restore](#restore)
  - [Search + Sort](#search--sort)
  - [Undo](#undo)
- [Settings (Options Page)](#settings-options-page)
- [Data & Privacy](#data--privacy)
- [Export / Backup](#export--backup)
- [Technical Details](#technical-details)
  - [Manifest & Permissions](#manifest--permissions)
  - [Storage Schema](#storage-schema)
  - [Project Files](#project-files)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

---

## What is AllTab?

**AllTab** is a **Chrome Extension (Manifest V3)** that helps you quickly reduce browser memory usage by:

1. Capturing your current open tabs into **saved tab groups**
2. Optionally closing those tabs to free memory
3. Letting you restore all (or individual) saved tabs later

The extension UI lives in the **toolbar popup** and an **Options / Settings page**.

---

## Key Features

### Save tabs fast
- **Save All Tabs** across **all windows**
- **Save Current Window** only
- Automatically creates a saved **group** containing URLs, titles, and favicons

### Restore anytime
- Restore a full group (re-open all saved tabs)
- Restore a single tab from a group

### Productivity UI
- Search saved tabs/groups
- Sort groups (e.g., Newest/Oldest/Most/Fewest — as implemented in popup UI)
- Undo support for destructive actions (implemented via an undo bar in the popup)

### Local-first storage
- Saved groups are stored using **`chrome.storage.local`**
- No server required, no account needed

---

## How It Works (Concept)

At a high level, AllTab does this:

1. Reads open tabs using Chrome APIs (`tabs`, `windows`)
2. Filters out non-saveable URLs like internal pages (`chrome://`, `chrome-extension://`, etc.)
3. Converts each tab into a small object: `url`, `title`, `favIconUrl`
4. Saves them into a `tabGroups` array in `chrome.storage.local`
5. If enabled, closes the original tabs after saving (to free memory)
6. Restores by re-creating tabs with `chrome.tabs.create(...)`

---

## Screenshots / Demo
-- Pending

## Install (Developer Mode)

1. Clone the repository:
   ```bash
   git clone https://github.com/akshitsutharr/AllTab.git
   cd AllTab
   ```

2. Open Chrome and go to:
   - `chrome://extensions`

3. Enable **Developer mode** (top-right)

4. Click **Load unpacked**

5. Select the project folder (the folder containing `manifest.json`)

You should now see **AllTab** in your extensions list, and its icon in the toolbar.

---

## How to Use

### Save

Inside the popup:

- **Save All Tabs**  
  Captures tabs from **all windows** and stores them as a group.

- **Save Current Window**  
  Captures tabs from the **current window only**.

If the preference **“Close tabs after saving”** is enabled, AllTab will close the captured tabs after saving.

### Restore

- Restore a full group: AllTab reopens every URL in that group.
- Restore one tab: AllTab reopens that URL and removes it from the saved group.

### Search + Sort

The popup provides:
- A search input to filter saved items
- A sort menu that updates the group list view (labels like Newest/Oldest/Most/Fewest)

### Undo

Certain actions (like deleting) can be undone using the popup’s **Undo bar**.

---

## Settings (Options Page)

Open settings from the popup via **Settings** (it calls `chrome.runtime.openOptionsPage()`).

Available preferences (from `options.html`):
- **Close tabs after saving**  
  Automatically closes tabs once they are captured.
- **Include pinned tabs**  
  Saves pinned tabs alongside regular ones.
- **Restore tabs in background**  
  Opens restored tabs without switching focus.
- **Auto-collapse new groups**  
  Starts new groups in a collapsed state.

---

## Data & Privacy

AllTab is designed to be **local-first**:

- Your saved data is stored in your browser via **`chrome.storage.local`**
- The extension does **not** upload or sync your data to any server by default

> Note: `chrome.storage.local` is stored on your local profile. Clearing browser data / reinstalling Chrome may remove extension storage unless you export it.

---

## Export / Backup

From the Options page:
- **Export saved tabs** downloads all groups as JSON named like:
  `alltab-YYYY-MM-DD.json`
- **Clear all saved tab groups** deletes all stored groups (with confirmation)

This makes it easy to:
- Create backups
- Move data between profiles/devices (manual import could be added as a roadmap item)

---

## Technical Details

### Manifest & Permissions

AllTab uses **Manifest V3**.

Permissions (from `manifest.json`):
- `tabs` — read and create/remove tabs
- `windows` — access tabs across windows (e.g., save all windows)
- `storage` — persist tab groups and preferences locally

Extension pages:
- Popup UI: `popup.html`
- Service worker: `background.js`
- Options page: `options.html`

### Storage Schema

AllTab stores data in `chrome.storage.local` keys:

- `tabGroups`: array of groups
  - each group contains tabs (`{ url, title, favIconUrl }`) plus group metadata
- `prefs`: preferences object (close tabs, include pinned, restore background, auto-collapse)

(Exact group shape may evolve; the popup code maps saved groups and adds UI-only fields like color/collapsed.)

### Project Files

Typical important files in this repo:

- `manifest.json` — MV3 definition
- `background.js` — extension lifecycle + message listener
- `popup.html` — popup UI + styling
- `popup.js` — main logic (save/restore/search/sort/undo/persist)
- `options.html` — settings UI + export/clear + prefs persistence
- `icons/` — toolbar + store icons

---

## Troubleshooting

**1) “No saveable tabs”**
- Some tabs cannot be saved (Chrome internal pages). AllTab filters URLs like:
  - `chrome://...`
  - `chrome-extension://...`
  - `edge://...`
  - `about:...`

**2) Tabs didn’t close after saving**
- Check Settings → **Close tabs after saving**

**3) Data missing after reinstall**
- `chrome.storage.local` can be cleared when extension data is removed.
- Use **Export** regularly if you rely on saved groups.

---

## Roadmap

Ideas you can add next:
- [ ] Import JSON backup (paired with export)
- [ ] Named groups (custom titles)
- [ ] Auto-save sessions on browser close
- [ ] Sync via Chrome Sync (optional) using `chrome.storage.sync`
- [ ] Keyboard shortcuts (commands)
- [ ] Duplicate tab detection
- [ ] Auto-clean invalid/dead URLs

---

## Contributing

Contributions are welcome.

1. Fork this repo
2. Create a branch:
   ```bash
   git checkout -b feature/my-change
   ```
3. Make changes and test by reloading the extension in `chrome://extensions`
4. Commit + push
5. Open a Pull Request

---

By Akshit Suthar
