chrome.action.onClicked.addListener(async () => {
    let SUPABASE_URL, SUPABASE_ANON_KEY;
    try {
        const res = await fetch(chrome.runtime.getURL('config.json'));
        const config = await res.json();
        SUPABASE_URL = config.SUPABASE_URL + "/rest/v1/linger_tabs";
        SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;
    } catch(e) {
        console.error("Missing config.json! Harvest aborted.");
        return;
    }
    
    const HEADERS = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    };

    // Query all tabs in the current window
    const tabs = await chrome.tabs.query({ currentWindow: true });
  
    const harvested = [];
  
    for (const tab of tabs) {
      // Filter out internal browser pages and pinned tabs
      if (tab.pinned || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
        continue;
      }
  
      let cleanTitle = tab.title;
      let type = 'website';
  
      // Parse search queries
      try {
          const urlObj = new URL(tab.url);
          if (urlObj.hostname.includes('google.') || urlObj.hostname.includes('bing.')) {
              if (urlObj.pathname === '/search' && urlObj.searchParams.has('q')) {
                  const query = urlObj.searchParams.get('q');
                  if (query) {
                      cleanTitle = query;
                      type = 'search';
                  }
              }
          }
      } catch (e) {}
  
      harvested.push({
        type: type,
        cleantitle: cleanTitle,
        url: tab.url
      });
    }
  
    if (harvested.length === 0) return;

    // Fetch existing URLs from Supabase to prevent massive duplicates if clicked multiple times
    let existingUrls = new Set();
    try {
        const getRes = await fetch(`${SUPABASE_URL}?select=url`, {
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        if (getRes.ok) {
            const data = await getRes.json();
            data.forEach(item => existingUrls.add(item.url));
        }
    } catch(e) {
        console.error("Failed to fetch existing tabs", e);
    }

    const newItems = harvested.filter(item => !existingUrls.has(item.url));

    // Post to Supabase REST API
    if (newItems.length > 0) {
        console.log(`Uploading ${newItems.length} new tabs to Supabase...`);
        try {
            const postRes = await fetch(SUPABASE_URL, {
                method: "POST",
                headers: HEADERS,
                body: JSON.stringify(newItems)
            });
            if (postRes.ok) {
                console.log("Upload successful!");
            } else {
                const err = await postRes.text();
                console.error("Supabase POST error:", err);
            }
        } catch(e) {
            console.error("Network error during harvest:", e);
        }
    } else {
        console.log("No new unique tabs to harvest.");
    }
  
    // Open the new Centralized Web Dashboard (Live Cloud Version)
    const targetUrl = "https://ketiakhitam.github.io/DiddyParsing/web/index.html";
    const dashTabs = await chrome.tabs.query({ url: targetUrl });
    if (dashTabs.length > 0) {
        chrome.tabs.update(dashTabs[0].id, { active: true });
    } else {
        chrome.tabs.create({ url: targetUrl });
    }
});

// Remove item from Supabase automatically when the physical tab is closed
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    // Finding the exact URL tied to this tabId is difficult since the tab is already removed, 
    // unless we maintain a local map. For simplicity in Phase 2, we leave DB items intact upon local closure,
    // or rely on explicit deletion via the Centralized Web App interface.
});
