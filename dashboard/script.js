document.addEventListener('DOMContentLoaded', async () => {
    const listContainer = document.getElementById('list-container');
    const copyTextBtn = document.getElementById('copy-text-btn');
    const copyAllBtn = document.getElementById('copy-all-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');
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
            div.className = 'item' + (item.working ? ' working' : '');
            div.tabIndex = 0;
            
            const content = document.createElement('div');
            content.className = 'item-content';
            
            const title = document.createElement('span');
            title.className = 'item-title';
            
            // Subtle icon prefix based on tab type
            const typeIndicator = item.type === 'search' ? '🔍 ' : '🌐 ';
            title.textContent = typeIndicator + item.cleanTitle;

            content.appendChild(title);

            // Show "WORKING ON" label below title when flagged
            if (item.working) {
                const label = document.createElement('span');
                label.className = 'working-label';
                label.textContent = 'working on';
                content.appendChild(label);
            }

            const url = document.createElement('span');
            url.className = 'item-url';
            url.textContent = item.url;
            content.appendChild(url);

            // Action buttons container
            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.alignItems = 'center';

            // Working On toggle button
            const workBtn = document.createElement('button');
            workBtn.className = 'working-btn';
            workBtn.textContent = item.working ? 'Unflag' : 'Flag';
            workBtn.title = item.working ? 'Remove working status' : 'Mark as currently working on';

            workBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                item.working = !item.working;
                await chrome.storage.local.set({ linger_list: items });
                filterList();
            });

            // Delete button
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '✕';
            delBtn.title = 'Remove from backlog';

            actions.appendChild(workBtn);
            actions.appendChild(delBtn);

            div.appendChild(content);
            div.appendChild(actions);

            // Navigate Logic: Smart Tab Focus
            const navigate = async () => {
                try {
                    const tab = await chrome.tabs.get(item.tabId);
                    if (tab && tab.windowId) {
                        await chrome.tabs.update(tab.id, { active: true });
                        await chrome.windows.update(tab.windowId, { focused: true });
                        return;
                    }
                } catch(e) {
                    // Tab was closed, open a fresh one
                }
                chrome.tabs.create({ url: item.url });
            };

            content.addEventListener('click', navigate);
            div.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') navigate();
            });

            // Delete item from storage, close tab physically, and re-render
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                try {
                    await chrome.tabs.remove(item.tabId);
                } catch(err) {
                    // Physical tab was already closed, ignore
                }

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

    // Live sync: Listen for tab removals emitted by background.js
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.linger_list) {
            items = changes.linger_list.newValue || [];
            filterList();
        }
    });

    // Load initial data from Chrome Storage Map
    const data = await chrome.storage.local.get(['linger_list']);
    items = data.linger_list || [];
    filterList();

    // Clear All: Wipe the entire backlog from local storage
    clearAllBtn.addEventListener('click', async () => {
        if (items.length === 0) return;
        
        const confirmed = confirm(`This will remove all ${items.length} tabs from your backlog. Physical browser tabs will NOT be closed. Continue?`);
        if (!confirmed) return;

        items = [];
        await chrome.storage.local.set({ linger_list: items });
        filterList();
    });

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
