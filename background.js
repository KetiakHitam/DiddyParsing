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
        // Force Supabase to return the generated UUIDs so we can cache them!
        "Prefer": "return=representation" 
    };

    // Query all tabs in the current window
    const tabs = await chrome.tabs.query({ currentWindow: true });
  
    const harvested = [];
  
    for (const tab of tabs) {
      if (tab.pinned || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
        continue;
      }
  
      let cleanTitle = tab.title;
      let type = 'website';
  
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
        tabId: tab.id, // Keep the Edge tabId locally
        payload: {
            type: type,
            cleantitle: cleanTitle,
            url: tab.url,
            device: 'pc' // Explicitly tag this as a PC tab for Phase 3
        }
      });
    }
  
    if (harvested.length === 0) return;

    // Fetch existing URLs from Supabase
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

    const newItems = harvested.filter(item => !existingUrls.has(item.payload.url));
    const payloads = newItems.map(item => item.payload);

    // Post to Supabase REST API
    if (payloads.length > 0) {
        console.log(`Uploading ${payloads.length} new tabs to Supabase...`);
        try {
            const postRes = await fetch(SUPABASE_URL, {
                method: "POST",
                headers: HEADERS,
                body: JSON.stringify(payloads)
            });
            
            if (postRes.ok) {
                console.log("Upload successful!");
                const insertedData = await postRes.json();
                
                // Map the newly returned Supabase UUIDs to the physical Edge tabIds
                const newMap = {};
                insertedData.forEach((row) => {
                    const originalTab = newItems.find(h => h.payload.url === row.url);
                    if (originalTab) {
                        newMap[originalTab.tabId.toString()] = row.id;
                    }
                });
                
                // Securely save the mapping purely into local Edge memory
                const currentMapRes = await chrome.storage.local.get(['linger_uuid_map']);
                const currentMap = currentMapRes.linger_uuid_map || {};
                await chrome.storage.local.set({ 
                    linger_uuid_map: { ...currentMap, ...newMap } 
                });

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
  
    // Open the Live Cloud Dashboard
    const targetUrl = "https://ketiakhitam.github.io/DiddyParsing/web/index.html";
    const dashTabs = await chrome.tabs.query({ url: targetUrl });
    if (dashTabs.length > 0) {
        chrome.tabs.update(dashTabs[0].id, { active: true });
    } else {
        chrome.tabs.create({ url: targetUrl });
    }
});

// SURGICAL DELETION: Instantly delete the tab from Supabase when closed physically
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    const res = await chrome.storage.local.get(['linger_uuid_map']);
    const map = res.linger_uuid_map || {};
    const uuid = map[tabId.toString()];
    
    if (uuid) {
        console.log(`Tab closed! Issuing surgical DELETE for UUID: ${uuid}`);
        
        let SUPABASE_URL, SUPABASE_ANON_KEY;
        try {
            const configRes = await fetch(chrome.runtime.getURL('config.json'));
            const config = await configRes.json();
            SUPABASE_URL = config.SUPABASE_URL + "/rest/v1/linger_tabs";
            SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;
        } catch(e) { return; }
        
        await fetch(`${SUPABASE_URL}?id=eq.${uuid}`, {
            method: "DELETE",
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        // Remove edge case bloat locally
        delete map[tabId.toString()];
        await chrome.storage.local.set({ linger_uuid_map: map });
    }
});
