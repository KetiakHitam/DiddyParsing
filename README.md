# Linger

Linger is a lightweight browser extension and web dashboard for syncing open tabs between your PC and iPhone. It uses no heavy frameworks—just vanilla HTML/JS and a Supabase backend—to keep the tool as fast and simple as possible.

## Features

- **PC Sync:** The Chromium (Edge/Chrome) extension saves your open tabs to a Supabase database. When you close a tab on your PC, it automatically deletes it from the database so your list stays clean.
- **URL Tracking:** If you navigate to a new page within a synced tab, the extension updates the database link in real time.
- **iPhone Sync (via Shortcuts):** Instead of paying for an Apple Developer account to build a Safari extension, Linger uses a custom iOS Shortcut to automatically push your Safari tabs directly to the database.
- **Simple Dashboard:** A minimalistic, paginated web interface hosted on GitHub Pages to view and search your combined tab backlog.

## Setup Instructions

### 1. Database (Supabase)
Create a new Supabase project and run this SQL to create the table and prevent duplicate entries:
```sql
CREATE TABLE linger_tabs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT,
    cleantitle TEXT,
    url TEXT,
    device TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE linger_tabs DISABLE ROW LEVEL SECURITY;
ALTER TABLE linger_tabs ADD CONSTRAINT unique_url_device UNIQUE (url, device);
```

### 2. PC Extension
1. Clone this repository.
2. Create a `config.json` file in the root directory (make sure it's in your `.gitignore`):
```json
{
  "SUPABASE_URL": "https://your-project.supabase.co",
  "SUPABASE_ANON_KEY": "your-anon-key-here"
}
```
3. Go to `edge://extensions` or `chrome://extensions`.
4. Turn on **Developer Mode**, click **Load Unpacked**, and select this folder.

### 3. iPhone Shortcut
Since there's no native app, use the Apple Shortcuts app to scrape and upload tabs:
1. Create a new shortcut.
2. Add the **Find Safari Tabs** action.
3. Add a **Repeat with Each** action (Item in Safari Tabs).
4. Inside the loop, add **Get Contents of URL**:
   - URL: `https://your-project.supabase.co/rest/v1/linger_tabs`
   - Method: `POST`
   - Headers: 
     - `apikey`: your-anon-key
     - `Authorization`: Bearer your-anon-key
     - `Prefer`: `return=minimal, resolution=ignore-duplicates`
   - JSON Body: Map the repeat item's Name to `cleantitle` and URL to `url`. Set `device` to `mobile`.

### 4. Web Dashboard
Deploy the repository to GitHub Pages. Open your live URL, and the site will prompt you for your Supabase credentials once, storing them locally in your browser.

## Known Limitations

- **One-Way iPhone Sync:** The iOS Shortcut can only send tabs to the database. Closing a tab on your iPhone won't delete it from the dashboard; you have to delete iPhone tabs manually via the web UI.
- **Security:** Row Level Security (RLS) is disabled by default for simplicity, relying on the anonymity of your API keys. If your physical devices are compromised or someone gets your key, they can read or delete your tabs.
