<p align="center">
  <img src="icons/logo.jpg" width="200" alt="Linger Logo">
</p>

<h1 align="center">Linger</h1>

<p align="center">
  <strong>A zero-footprint, cross-platform tab synchronization system that harvests and manages open tabs across PC and iOS without relying on heavy web frameworks.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-7c3aed?style=flat-square" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Backend-Supabase-3ecf8e?style=flat-square" alt="Supabase">
  <img src="https://img.shields.io/badge/Frontend-Vanilla_JS-f7df1e?style=flat-square" alt="Vanilla JS">
  <img src="https://img.shields.io/badge/Platform-PC_&_iOS-000000?style=flat-square" alt="Multi-platform">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License">
</p>

---

## Overview

Linger is a brutalist approach to cross-platform browser tab synchronization. Instead of relying on bloated Node modules, React DOM trees, or paid Apple Developer accounts for Safari extensions, Linger uses raw HTML/JS, PostgreSQL, and an iOS Shortcut to achieve instant, bidirectional tab syncing.

It acts as an active backlog for your mental state—allowing you to flag tabs you are actively working on and cleanly separating tabs harvested from your desktop environment versus your mobile environment.

---

## Features

### Surgical Two-Way Sync (PC)

- **Local UUID Mapping:** Maps physical Edge/Chrome `tabId`s to Supabase UUIDs entirely in local `chrome.storage`.
- **Instant Deletion:** Closing a physical browser tab triggers the `chrome.tabs.onRemoved` listener, immediately firing a surgical REST `DELETE` to the cloud so your backlog stays perfectly clean.
- **URL Mutation Tracking:** Intercepts `chrome.tabs.onUpdated` to track live navigations within an existing tab, pushing `PATCH` requests to Supabase to prevent "orphaned" records if a URL changes.

### Bypassing the Apple Tax (iOS Sync)

- Circumvents the need for a native iOS app or paid Safari Extension by utilizing a custom Apple Shortcut.
- Harvests Safari tabs locally on your iPhone and fires bulk `POST` payloads directly to the Supabase REST API endpoint.

### ADHD Productivity Workflow

- **"Working On" State:** Toggle a persistent purple flag on any item to mark it as an active task. The state is patched directly to the database so your focus flags sync instantly between your phone and laptop.
- **Mass Clearance:** Device-aware "Clear All" functionality allows you to wipe all PC tabs or all iPhone tabs from the cloud with one click, without destroying your physical browser windows.

### Virtualized Dashboard UI

- **Zero-Dependency Frontend:** Hosted purely on GitHub Pages using vanilla HTML5, CSS3, and JavaScript. No build steps, no package managers.
- **DOM Pagination:** Renders tabs in 50-item chunks. Dynamically handles "Load More" states to prevent the browser from locking up when parsing massive historical backlogs.
- **Keyboard Navigable:** Full `ArrowUp`, `ArrowDown`, and `Enter` support for power-user speed.

### Cloud-Level Deduplication

- Prevents database bloating by enforcing a `UNIQUE(url, device)` constraint natively at the PostgreSQL database layer.
- Locally suppresses duplicate batches when multiple identical tabs are open before the payload even leaves the browser.

---

## Architecture

```text
DiddyParsing/
|-- manifest.json              # Chrome Extension manifest (V3)
|-- background.js              # Service worker: harvesting, mutation tracking, REST syncing
|-- config.json                # API Keys (Gitignored locally)
|-- icons/
|   |-- logo.jpg               # Project Logo
|-- dashboard/                 
|   |-- index.html             # UI layout for local extension (unused, pointing to web)
|   |-- style.css              # Dark purple minimalist design system
|   |-- script.js              # Logic for local popup
|-- web/
|   |-- index.html             # Primary Cloud Dashboard (Hosted on GitHub Pages)
|   |-- app.js                 # Primary Dashboard Logic (Supabase REST, Virtualization, Flags)
```

### Data Flow

```text
[PC Browser Tabs]                        [iPhone Safari Tabs]
       |                                          |
       v                                          v
[background.js via Chrome APIs]          [Apple Shortcuts Native App]
       |                                          |
       |----> [Supabase PostgreSQL Database] <----|
                         |
                         v
     [Vanilla JS Dashboard (GitHub Pages)]
```

---

## Installation

### Prerequisites

- Google Chrome or Microsoft Edge
- A free Supabase account
- Apple Shortcuts app (for iOS sync)

### Steps

#### 1. Database (Supabase)
Create a free Supabase project and execute this SQL to build the architecture:
```sql
CREATE TABLE linger_tabs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT,
    cleantitle TEXT,
    url TEXT,
    device TEXT,
    working BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE linger_tabs DISABLE ROW LEVEL SECURITY;
ALTER TABLE linger_tabs ADD CONSTRAINT unique_url_device UNIQUE (url, device);
```

#### 2. PC Extension (Edge/Chrome)
1. Clone this repository.
2. Create a `config.json` file in the root directory (ensure it stays gitignored):
```json
{
  "SUPABASE_URL": "https://your-project.supabase.co",
  "SUPABASE_ANON_KEY": "your-anon-key-here"
}
```
3. Navigate to `edge://extensions` or `chrome://extensions`.
4. Enable **Developer Mode**, click **Load Unpacked**, and select the `DiddyParsing` directory.

#### 3. iPhone Shortcut
Since there is no native app, use Apple Shortcuts to harvest and upload:
1. Add the **Find Safari Tabs** action.
2. Add a **Repeat with Each** action (Item in Safari Tabs).
3. Inside the loop, add **Get Contents of URL**:
   - URL: `https://your-project.supabase.co/rest/v1/linger_tabs`
   - Method: `POST`
   - Headers: 
     - `apikey`: your-anon-key
     - `Authorization`: Bearer your-anon-key
     - `Prefer`: `return=minimal, resolution=ignore-duplicates`
   - JSON Body: Map the repeat item's Name to `cleantitle` and URL to `url`. Set `device` to `mobile`.

#### 4. Cloud Dashboard
Deploy the repository to GitHub Pages. Navigate to `your-repo.github.io/web/index.html`. It will prompt you for your Supabase credentials once, securely storing them locally in your browser's `localStorage`.

---

## Known Limitations

- **One-Way iOS Sync:** Because iOS completely sandboxes Safari from third-party scripting without a paid developer account, the iOS Shortcut acts as a one-way vacuum. Closing a tab on your phone will not delete it from the Supabase backlog; you must manually clear iPhone tabs via the web UI.
- **Security Posture:** For extreme deployment speed, PostgreSQL Row Level Security (RLS) is disabled. Security relies purely on keeping your database URL and Anon Key out of public repositories.
