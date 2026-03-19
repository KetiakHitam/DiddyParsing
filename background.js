chrome.action.onClicked.addListener(async () => {
    // Query all tabs in the current window
    const tabs = await chrome.tabs.query({ currentWindow: true });
  
    const harvested = [];
    const now = Date.now();
  
    for (const tab of tabs) {
      // Filter out internal browser pages and pinned tabs
      if (tab.pinned || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
        continue;
      }
  
      let cleanTitle = tab.title;
      let type = 'website';
  
      // Parse search queries to extract the typed text
      try {
          const urlObj = new URL(tab.url);
          // Handle Google and Bing searches
          if (urlObj.hostname.includes('google.') || urlObj.hostname.includes('bing.')) {
              if (urlObj.pathname === '/search' && urlObj.searchParams.has('q')) {
                  const query = urlObj.searchParams.get('q');
                  if (query) {
                      cleanTitle = query; // The extracted search term
                      type = 'search';
                  }
              }
          }
      } catch (e) {
          // If URL parsing fails, default back to the raw page title
      }
  
      harvested.push({
        id: "linger_" + Math.random().toString(36).substr(2, 9),
        type: type,
        cleanTitle: cleanTitle,
        url: tab.url,
        tabId: tab.id, // Store ID to focus tab later
        timestamp: now
      });
    }
  
    // Retrieve the existing backlog to avoid overwriting or duplicating URLs
    const data = await chrome.storage.local.get(['linger_list']);
    const existing = data.linger_list || [];
  
    const existingUrls = new Set(existing.map(item => item.url));
    const newItems = harvested.filter(item => !existingUrls.has(item.url));
    const combined = [...existing, ...newItems]; // Append new items
  
    await chrome.storage.local.set({ linger_list: combined });
  
    // Open or focus the Dashboard
    const targetUrl = chrome.runtime.getURL("dashboard/index.html");
    const dashTabs = await chrome.tabs.query({ url: targetUrl });
    if (dashTabs.length > 0) {
        chrome.tabs.update(dashTabs[0].id, { active: true });
    } else {
        chrome.tabs.create({ url: targetUrl });
    }
  });
  
