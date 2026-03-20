document.addEventListener('DOMContentLoaded', async () => {
    const listContainer = document.getElementById('list-container');
    const copyTextBtn = document.getElementById('copy-text-btn');
    const copyAllBtn = document.getElementById('copy-all-btn');
    const searchInput = document.getElementById('search-input');

    let items = [];
    let filteredItems = [];

    const render = () => {
        listContainer.innerHTML = '';
        if (filteredItems.length === 0) {
            listContainer.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding: 40px;">No matching tabs found.</div>';
            return;
        }

        filteredItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'item';
            div.tabIndex = 0; // Enables keyboard navigation
            
            const content = document.createElement('div');
            content.className = 'item-content';
            
            const title = document.createElement('span');
            title.className = 'item-title';
            title.textContent = item.cleanTitle;
            
            const url = document.createElement('span');
            url.className = 'item-url';
            url.textContent = item.url;
            
            // Subtle icon prefix based on tab type
            const typeIndicator = item.type === 'search' ? '🔍 ' : '🌐 ';
            title.textContent = typeIndicator + title.textContent;

            content.appendChild(title);
            content.appendChild(url);

            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '✕';
            delBtn.title = 'Remove from backlog';
            
            div.appendChild(content);
            div.appendChild(delBtn);

            // Navigate Logic: Smart Tab Focus
            const navigate = async () => {
                try {
                    // Try to finding the existing tab
                    const tab = await chrome.tabs.get(item.tabId);
                    if (tab && tab.windowId) {
                        await chrome.tabs.update(tab.id, { active: true });
                        await chrome.windows.update(tab.windowId, { focused: true });
                        return;
                    }
                } catch(e) {
                    // Tab was closed, catch the error and open a fresh one
                }
                chrome.tabs.create({ url: item.url });
            };

            content.addEventListener('click', navigate);
            div.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') navigate();
            });

            // Delete item from storage and re-render
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Don't trigger the navigate event
                items = items.filter(i => i.id !== item.id);
                await chrome.storage.local.set({ linger_list: items });
                filterList();
            });

            listContainer.appendChild(div);
        });
    };

    const filterList = () => {
        const query = searchInput.value.toLowerCase();
        filteredItems = items.slice().reverse().filter(i => 
            i.cleanTitle.toLowerCase().includes(query) || 
            i.url.toLowerCase().includes(query)
        );
        render();
    };

    searchInput.addEventListener('input', filterList);

    // Load initial data from Chrome Storage Map
    const data = await chrome.storage.local.get(['linger_list']);
    items = data.linger_list || [];
    filterList();

    // Export Text Only (List Format)
    copyTextBtn.addEventListener('click', () => {
        if (filteredItems.length === 0) return;
        const text = filteredItems.map(i => `- [ ] ${i.cleanTitle}`).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            const originalText = copyTextBtn.textContent;
            copyTextBtn.textContent = 'Copied!';
            setTimeout(() => copyTextBtn.textContent = originalText, 2000);
        });
    });

    // Export cleanly to markdown (Text + Link)
    copyAllBtn.addEventListener('click', () => {
        if (filteredItems.length === 0) return;
        const text = filteredItems.map(i => `- [ ] ${i.cleanTitle} (${i.url})`).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            const originalText = copyAllBtn.textContent;
            copyAllBtn.textContent = 'Copied!';
            setTimeout(() => copyAllBtn.textContent = originalText, 2000);
        });
    });
});
