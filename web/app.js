document.addEventListener('DOMContentLoaded', async () => {
    let SUPABASE_URL = localStorage.getItem('linger_url');
    let SUPABASE_ANON_KEY = localStorage.getItem('linger_key');

    if (!SUPABASE_URL) {
        try {
            const res = await fetch('../config.json');
            if (res.ok) {
                const config = await res.json();
                SUPABASE_URL = config.SUPABASE_URL;
                SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;
            }
        } catch(e) {}
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        SUPABASE_URL = prompt("First-time Setup:\nEnter your Supabase API URL:");
        SUPABASE_ANON_KEY = prompt("Enter your Supabase Anon Public Key:");
        if (SUPABASE_URL) localStorage.setItem('linger_url', SUPABASE_URL);
        if (SUPABASE_ANON_KEY) localStorage.setItem('linger_key', SUPABASE_ANON_KEY);
    }

    if (!SUPABASE_URL) {
        document.getElementById('list-container').innerHTML = '<div style="color:#ff4a4a; text-align:center; padding: 40px; font-size: 13px;">API Keys missing. Refresh to try again.</div>';
        return;
    }

    const TABLE_URL = `${SUPABASE_URL}/rest/v1/linger_tabs`;
    const HEADERS = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json"
    };
    const listContainer = document.getElementById('list-container');
    const copyTextBtn = document.getElementById('copy-text-btn');
    const copyAllBtn = document.getElementById('copy-all-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const searchInput = document.getElementById('search-input');

    const itemCountSpan = document.getElementById('item-count');
    const togglePcBtn = document.getElementById('toggle-pc');
    const toggleMobileBtn = document.getElementById('toggle-mobile');
    let activeDevice = 'pc';

    let items = [];
    let filteredItems = [];
    let selectedIndex = 0;
    let VISIBLE_LIMIT = 50;

    const render = () => {
        listContainer.innerHTML = '';
        if (itemCountSpan) itemCountSpan.textContent = `${filteredItems.length} items`;

        if (filteredItems.length === 0) {
            listContainer.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding: 40px; font-size: 13px;">No matching tabs found.</div>';
            return;
        }

        const itemsToRender = filteredItems.slice(0, VISIBLE_LIMIT);

        itemsToRender.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'item' + (index === selectedIndex ? ' selected' : '') + (item.working ? ' working' : '');
            
            const content = document.createElement('div');
            content.className = 'item-content';
            
            const icon = document.createElement('span');
            icon.className = 'item-icon';
            icon.textContent = item.type === 'search' ? '🔍' : '🌐';
            
            const title = document.createElement('span');
            title.className = 'item-title';
            title.textContent = item.cleantitle || item.title; 

            content.appendChild(icon);
            content.appendChild(title);

            // Show "WORKING ON" label when flagged
            if (item.working) {
                const label = document.createElement('span');
                label.className = 'working-label';
                label.textContent = 'working on';
                content.appendChild(label);
            }

            const urlEl = document.createElement('span');
            urlEl.className = 'item-url';
            try {
                urlEl.textContent = new URL(item.url).hostname.replace('www.', '');
            } catch {
                urlEl.textContent = item.url;
            }
            content.appendChild(urlEl);

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
                e.preventDefault();
                e.stopPropagation();
                const newState = !item.working;
                
                // Optimistic UI update
                item.working = newState;
                render();

                // Persist to Supabase
                await fetch(`${TABLE_URL}?id=eq.${item.id}`, {
                    method: "PATCH",
                    headers: { ...HEADERS, "Prefer": "return=minimal" },
                    body: JSON.stringify({ working: newState })
                });
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '✕';
            delBtn.title = 'Permanently delete from database';

            actions.appendChild(workBtn);
            actions.appendChild(delBtn);
            
            div.appendChild(content);
            div.appendChild(actions);

            const delAction = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Optimistic UI update
                items = items.filter(i => i.id !== item.id);
                filterList();
                
                // Execute deletion in Supabase
                await fetch(`${TABLE_URL}?id=eq.${item.id}`, {
                    method: "DELETE",
                    headers: HEADERS
                });
            };

            div.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    delAction(e);
                } else {
                    window.open(item.url, '_blank');
                }
            });

            delBtn.addEventListener('click', delAction);

            div.addEventListener('mousemove', () => {
                if (selectedIndex !== index) {
                    selectedIndex = index;
                    updateSelection();
                }
            });

            listContainer.appendChild(div);
        });

        if (filteredItems.length > VISIBLE_LIMIT) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.className = 'load-more-btn';
            loadMoreBtn.textContent = `Load More (${filteredItems.length - VISIBLE_LIMIT} remaining)`;
            loadMoreBtn.style.cssText = 'width:100%; padding:15px; margin-top:5px; background:var(--bg-secondary); border:1px solid #333; color:var(--text-primary); border-radius:6px; cursor:pointer; font-weight:500; transition: background 0.2s ease;';
            loadMoreBtn.onmouseover = () => loadMoreBtn.style.background = '#333';
            loadMoreBtn.onmouseout = () => loadMoreBtn.style.background = 'var(--bg-secondary)';
            loadMoreBtn.addEventListener('click', () => {
                VISIBLE_LIMIT += 50;
                render();
            });
            listContainer.appendChild(loadMoreBtn);
        }
        
        const selectedEl = listContainer.children[selectedIndex];
        if (selectedEl) {
            if (selectedEl.scrollIntoViewIfNeeded) {
                selectedEl.scrollIntoViewIfNeeded(false);
            } else {
                selectedEl.scrollIntoView({ block: 'nearest' });
            }
        }
    };

    const updateSelection = () => {
        Array.from(listContainer.children).forEach((child, idx) => {
            if (idx === selectedIndex) {
                child.classList.add('selected');
            } else {
                child.classList.remove('selected');
            }
        });
    };

    const switchTab = (device) => {
        activeDevice = device;
        if (device === 'pc') {
            togglePcBtn.style.background = 'var(--accent)';
            togglePcBtn.style.color = 'var(--text-primary)';
            togglePcBtn.style.border = 'none';
            toggleMobileBtn.style.background = 'transparent';
            toggleMobileBtn.style.color = 'var(--text-secondary)';
            toggleMobileBtn.style.border = '1px solid #333';
        } else {
            toggleMobileBtn.style.background = 'var(--accent)';
            toggleMobileBtn.style.color = 'var(--text-primary)';
            toggleMobileBtn.style.border = 'none';
            togglePcBtn.style.background = 'transparent';
            togglePcBtn.style.color = 'var(--text-secondary)';
            togglePcBtn.style.border = '1px solid #333';
        }
        filterList();
    };

    togglePcBtn.addEventListener('click', () => switchTab('pc'));
    toggleMobileBtn.addEventListener('click', () => switchTab('mobile'));

    const filterList = () => {
        VISIBLE_LIMIT = 50;
        const pcCount = items.filter(i => i.device === 'pc' || !i.device).length;
        const mobileCount = items.filter(i => i.device === 'mobile').length;
        togglePcBtn.textContent = `PC Tabs (${pcCount})`;
        toggleMobileBtn.textContent = `iPhone Tabs (${mobileCount})`;

        const query = searchInput.value.toLowerCase();
        filteredItems = items.filter(i => {
            const matchesDevice = (i.device === activeDevice) || (!i.device && activeDevice === 'pc');
            const t = (i.cleantitle || i.title || '').toLowerCase();
            const u = (i.url || '').toLowerCase();
            return matchesDevice && (t.includes(query) || u.includes(query));
        });
        if (selectedIndex >= filteredItems.length) {
            selectedIndex = Math.max(0, filteredItems.length - 1);
        }
        render();
    };

    searchInput.addEventListener('input', filterList);

    // Clear All: Delete all tabs for the currently viewed device from Supabase
    clearAllBtn.addEventListener('click', async () => {
        const count = filteredItems.length;
        if (count === 0) return;

        const deviceLabel = activeDevice === 'pc' ? 'PC' : 'iPhone';
        const confirmed = confirm(`This will permanently delete all ${count} ${deviceLabel} tabs from the database. This cannot be undone. Continue?`);
        if (!confirmed) return;

        // Fire the mass DELETE to Supabase filtered by device
        const deviceFilter = activeDevice === 'pc' ? 'pc' : 'mobile';
        await fetch(`${TABLE_URL}?device=eq.${deviceFilter}`, {
            method: "DELETE",
            headers: HEADERS
        });

        // Optimistic UI update: remove all items matching the active device
        items = items.filter(i => {
            if (activeDevice === 'pc') return i.device === 'mobile';
            return i.device === 'pc' || !i.device;
        });
        filterList();
    });

    // Initial fetch from Supabase
    listContainer.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding: 40px; font-size: 13px;">Fetching from Supabase Cloud...</div>';
    
    const fetchTabs = async () => {
        try {
            const res = await fetch(`${TABLE_URL}?order=created_at.desc`, { headers: HEADERS });
            if (res.ok) {
                items = await res.json();
                filterList();
            } else {
                const text = await res.text();
                listContainer.innerHTML = `<div style="color:#ff4a4a; text-align:center; padding: 40px; font-size: 13px;">Supabase Error:<br>${text}</div>`;
            }
        } catch(e) {
            listContainer.innerHTML = `<div style="color:#ff4a4a; text-align:center; padding: 40px; font-size: 13px;">Database connection failed: ${e.message}</div>`;
        }
    };
    
    await fetchTabs();

    // Naive polling for live sync
    setInterval(fetchTabs, 5000); 

    // Export Logic
    const handleCopy = (btn, textMapper) => {
        if (filteredItems.length === 0) return;
        const text = filteredItems.map(textMapper).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            const temp = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = temp, 2000);
        });
    };

    copyTextBtn.addEventListener('click', () => handleCopy(copyTextBtn, i => `- [ ] ${i.cleantitle || i.title}`));
    copyAllBtn.addEventListener('click', () => handleCopy(copyAllBtn, i => `- [ ] ${i.cleantitle || i.title} (${i.url})`));
    
    document.addEventListener('keydown', (e) => {
        if (filteredItems.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % filteredItems.length;
            render();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + filteredItems.length) % filteredItems.length;
            render();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const selectedItem = filteredItems[selectedIndex];
            if (selectedItem) {
                window.open(selectedItem.url, '_blank');
            }
        }
    });
});
