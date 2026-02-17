// AllTab popup.js v2

let groups = [];
let sortMode = 'newest';
let query = '';
let undoStack = null;
let undoTimer = null;

const DOT_COLORS = ['blue','green','amber','violet','teal'];

// ── Bootstrap ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await load();
  render();
  bindUI();
});

async function load() {
  const d = await chrome.storage.local.get('tabGroups');
  groups = (d.tabGroups || []).map((g, i) => ({
    color: DOT_COLORS[i % DOT_COLORS.length],
    collapsed: false,
    ...g
  }));
}

async function persist() {
  await chrome.storage.local.set({ tabGroups: groups });
  updateStats();
}

// ── UI bindings ───────────────────────────────────
function bindUI() {
  document.getElementById('btnAll').addEventListener('click', saveAll);
  document.getElementById('btnWin').addEventListener('click', saveWindow);
  document.getElementById('btnOpts').addEventListener('click', () => chrome.runtime.openOptionsPage());

  // Search
  const srch = document.getElementById('srch');
  const clr = document.getElementById('srchClr');
  srch.addEventListener('input', e => {
    query = e.target.value.toLowerCase();
    clr.classList.toggle('vis', query.length > 0);
    render();
  });
  clr.addEventListener('click', () => {
    srch.value = ''; query = '';
    clr.classList.remove('vis');
    render();
    srch.focus();
  });

  // Sort
  const trig = document.getElementById('sortTrig');
  const menu = document.getElementById('sortMenu');
  trig.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
  document.addEventListener('click', () => menu.classList.remove('open'));
  menu.querySelectorAll('.smopt').forEach(opt => {
    opt.addEventListener('click', () => {
      sortMode = opt.dataset.sort;
      menu.querySelectorAll('.smopt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      const labels = { newest:'Newest', oldest:'Oldest', most:'Most', least:'Fewest' };
      document.getElementById('sortLbl').textContent = labels[sortMode];
      menu.classList.remove('open');
      render();
    });
  });

  // Undo
  document.getElementById('undoBtn').addEventListener('click', doUndo);
}

// ── Save ──────────────────────────────────────────
async function saveAll() {
  const btn = document.getElementById('btnAll');
  btn.classList.add('loading');
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    const tabs = [];
    for (const w of windows)
      for (const t of w.tabs)
        if (valid(t)) tabs.push(tabObj(t));

    if (!tabs.length) { toast('No saveable tabs', 'err'); return; }
    pushGroup(tabs);
    await persist();
    render();

    for (const w of windows) {
      const ids = w.tabs.filter(valid).map(t => t.id);
      if (ids.length) await chrome.tabs.remove(ids).catch(() => {});
    }
    toast(`✓ Saved ${tabs.length} tabs`, 'ok');
  } catch(e) { toast(e.message, 'err'); }
  finally { btn.classList.remove('loading'); }
}

async function saveWindow() {
  const btn = document.getElementById('btnWin');
  btn.disabled = true;
  try {
    const w = await chrome.windows.getCurrent({ populate: true });
    const tabs = w.tabs.filter(valid).map(tabObj);
    if (!tabs.length) { toast('No saveable tabs', 'err'); return; }
    pushGroup(tabs);
    await persist();
    render();
    const ids = w.tabs.filter(valid).map(t => t.id);
    if (ids.length) await chrome.tabs.remove(ids).catch(() => {});
    toast(`✓ Saved ${tabs.length} tabs`, 'ok');
  } catch(e) { toast(e.message, 'err'); }
  finally { btn.disabled = false; }
}

function valid(t) {
  return t.url && !['chrome://','chrome-extension://','about:','edge://'].some(p => t.url.startsWith(p)) && t.url !== '';
}

function tabObj(t) {
  return { url: t.url, title: t.title || t.url, favIconUrl: t.favIconUrl || '' };
}

function pushGroup(tabs) {
  const now = new Date();
  const g = {
    id: Date.now(),
    name: `${now.toLocaleDateString('en-US',{month:'short',day:'numeric'})} · ${now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}`,
    tabs,
    createdAt: Date.now(),
    pinned: false,
    collapsed: false,
    color: DOT_COLORS[groups.length % DOT_COLORS.length]
  };
  groups.unshift(g);
}

// ── Render ────────────────────────────────────────
function render() {
  const list = document.getElementById('list');
  list.innerHTML = '';

  const filtered = getFiltered();

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = `
      <div class="empty-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7a2 2 0 012-2h14a2 2 0 012 2v1H3V7zM3 10h18v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8z"/></svg></div>
      <h3>${query ? 'No results found' : 'No tabs saved yet'}</h3>
      <p>${query ? 'Try a different search term.' : 'Hit "Save All Tabs" to snapshot your browser and free up memory.'}</p>
    `;
    list.appendChild(empty);
    updateStats();
    return;
  }

  const pinned = filtered.filter(g => g.pinned);
  const regular = filtered.filter(g => !g.pinned);

  if (pinned.length) {
    list.appendChild(makeLabel('📌 Pinned'));
    pinned.forEach(g => list.appendChild(makeCard(g)));
  }

  if (regular.length) {
    if (pinned.length) list.appendChild(makeLabel('Recent'));
    regular.forEach(g => list.appendChild(makeCard(g)));
  }

  updateStats();
}

function getFiltered() {
  let list = [...groups];

  if (query) {
    list = list.map(g => {
      const nameMatch = g.name.toLowerCase().includes(query);
      const matchedTabs = g.tabs.filter(t =>
        t.title.toLowerCase().includes(query) || t.url.toLowerCase().includes(query)
      );
      if (nameMatch || matchedTabs.length) return { ...g, tabs: nameMatch ? g.tabs : matchedTabs };
      return null;
    }).filter(Boolean);
  }

  const sorted = [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (sortMode === 'newest') return b.createdAt - a.createdAt;
    if (sortMode === 'oldest') return a.createdAt - b.createdAt;
    if (sortMode === 'most')   return b.tabs.length - a.tabs.length;
    if (sortMode === 'least')  return a.tabs.length - b.tabs.length;
    return 0;
  });

  return sorted;
}

function makeLabel(txt) {
  const d = document.createElement('div');
  d.className = 'section-lbl';
  d.innerHTML = `<span>${txt}</span>`;
  return d;
}

function makeCard(group) {
  const card = document.createElement('div');
  card.className = 'gcard' + (group.pinned ? ' pinned' : '');
  card.dataset.id = group.id;

  const dateStr = new Date(group.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});

  card.innerHTML = `
    <div class="gh">
      <span class="gh-chev ${!group.collapsed ? 'open' : ''}">
        <svg viewBox="0 0 12 12" fill="none"><path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      <span class="gh-dot ${group.color || 'blue'}"></span>
      <div class="gh-info">
        <span class="gh-name">${esc(group.name)}</span>
        <input class="gh-name-input" type="text" value="${esc(group.name)}">
        <div class="gh-sub">${dateStr}</div>
      </div>
      <div class="gh-meta">
        <span class="pin-star">📌</span>
        <span class="gh-badge">${group.tabs.length}</span>
      </div>
      <div class="gh-btns">
        <button class="ib pin-btn ${group.pinned ? 'pin-on' : ''}" title="${group.pinned ? 'Unpin' : 'Pin'}">
          <svg viewBox="0 0 16 16" fill="${group.pinned ? 'currentColor' : 'none'}"><path d="M9.5 1.5a4 4 0 010 5.657L8.12 8.536l.293.293a1 1 0 010 1.414l-.707.707a1 1 0 01-1.414 0L4.05 8.707a1 1 0 010-1.414l.707-.707a1 1 0 011.414 0l.293.293L7.88 5.464a4 4 0 015.656 0zM4 12L1.5 14.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        </button>
        <button class="ib del" title="Delete group">
          <svg viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 4V2.5A.5.5 0 015.5 2h5a.5.5 0 01.5.5V4M6 7v5M10 7v5M3.5 4l1 9a1 1 0 001 1h5a1 1 0 001-1l1-9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>
    <div class="gb ${!group.collapsed ? 'open' : ''}">
      <div class="gq">
        <button class="qb g rst-all">
          <svg viewBox="0 0 12 12" fill="none"><path d="M2 6a4 4 0 108 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M10 6V3.5L7.5 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Restore All
        </button>
        <button class="qb copy-urls">
          <svg viewBox="0 0 12 12" fill="none"><rect x="1" y="3" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M3 3V2a1 1 0 011-1h6a1 1 0 011 1v7a1 1 0 01-1 1H9" stroke="currentColor" stroke-width="1.2"/></svg>
          Copy URLs
        </button>
        <button class="qb r ml del-grp">
          <svg viewBox="0 0 12 12" fill="none"><path d="M2 3h8M4 3V2h4v1M3 3l.75 7h4.5L9 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          Delete
        </button>
      </div>
      ${group.tabs.map((t, i) => tabRow(t, group.id, i)).join('')}
    </div>
  `;

  // header click → toggle
  card.querySelector('.gh').addEventListener('click', e => {
    if (e.target.closest('button') || e.target.classList.contains('gh-name-input') || e.target.tagName === 'INPUT') return;
    const g = groups.find(x => x.id === group.id);
    if (g) { g.collapsed = !g.collapsed; persist(); render(); }
  });

  // double-click name → rename
  card.querySelector('.gh-name').addEventListener('dblclick', e => {
    e.stopPropagation();
    const nameEl = card.querySelector('.gh-name');
    const inp = card.querySelector('.gh-name-input');
    nameEl.classList.add('on'); inp.classList.add('on');
    inp.focus(); inp.select();
  });
  card.querySelector('.gh-name-input').addEventListener('blur', e => {
    const val = e.target.value.trim();
    if (val) {
      const g = groups.find(x => x.id === group.id);
      if (g) { g.name = val; persist(); render(); }
    } else {
      e.target.classList.remove('on');
      card.querySelector('.gh-name').classList.remove('on');
    }
  });
  card.querySelector('.gh-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') e.target.blur();
    if (e.key === 'Escape') { e.target.value = group.name; e.target.blur(); }
  });

  // Pin
  card.querySelector('.pin-btn').addEventListener('click', e => {
    e.stopPropagation();
    const g = groups.find(x => x.id === group.id);
    if (g) { g.pinned = !g.pinned; persist(); render(); toast(g.pinned ? '📌 Pinned' : 'Unpinned'); }
  });

  // Delete (header)
  card.querySelector('.gh .del').addEventListener('click', e => { e.stopPropagation(); deleteGroup(group.id); });

  // Quick actions
  card.querySelector('.rst-all').addEventListener('click', () => restoreAll(group.id));
  card.querySelector('.copy-urls').addEventListener('click', () => copyUrls(group.id));
  card.querySelector('.del-grp').addEventListener('click', () => deleteGroup(group.id));

  // Tab restore
  card.querySelectorAll('.tname').forEach(el => {
    el.addEventListener('click', () => restoreOne(+el.dataset.gid, +el.dataset.idx));
  });

  // Tab delete
  card.querySelectorAll('.tdel').forEach(el => {
    el.addEventListener('click', () => deleteTab(+el.dataset.gid, +el.dataset.idx));
  });

  // Drag reorder
  setupDrag(card);

  return card;
}

function tabRow(tab, gid, idx) {
  const fav = tab.favIconUrl
    ? `<img class="tfav" src="${esc(tab.favIconUrl)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const ph = `<span class="tfav-ph" ${tab.favIconUrl ? 'style="display:none"' : ''}>
    <svg viewBox="0 0 10 10" fill="none"><rect x="1" y="1" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2"/></svg>
  </span>`;
  return `
    <div class="trow">
      ${fav}${ph}
      <span class="tname" data-gid="${gid}" data-idx="${idx}" title="${esc(tab.url)}">${esc(tab.title)}</span>
      <button class="tdel" data-gid="${gid}" data-idx="${idx}" title="Remove">
        <svg viewBox="0 0 10 10" fill="none"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>
  `;
}

// ── Drag & Drop reorder ───────────────────────────
let dragSrc = null;

function setupDrag(card) {
  card.setAttribute('draggable', true);

  card.addEventListener('dragstart', e => {
    dragSrc = card;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.id);
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    document.querySelectorAll('.gcard').forEach(c => c.classList.remove('drag-over'));
  });

  card.addEventListener('dragover', e => {
    e.preventDefault();
    if (dragSrc && dragSrc !== card) {
      document.querySelectorAll('.gcard').forEach(c => c.classList.remove('drag-over'));
      card.classList.add('drag-over');
    }
  });

  card.addEventListener('drop', e => {
    e.preventDefault();
    card.classList.remove('drag-over');
    if (!dragSrc || dragSrc === card) return;

    const srcId = +dragSrc.dataset.id;
    const dstId = +card.dataset.id;
    const srcIdx = groups.findIndex(g => g.id === srcId);
    const dstIdx = groups.findIndex(g => g.id === dstId);

    if (srcIdx === -1 || dstIdx === -1) return;
    const [moved] = groups.splice(srcIdx, 1);
    groups.splice(dstIdx, 0, moved);
    persist();
    render();
  });
}

// ── Actions ───────────────────────────────────────
async function restoreAll(gid) {
  const g = groups.find(x => x.id === gid);
  if (!g) return;
  for (const t of g.tabs) await chrome.tabs.create({ url: t.url, active: false });
  deleteGroup(gid, false);
  toast(`✓ Restored ${g.tabs.length} tabs`, 'ok');
}

async function restoreOne(gid, idx) {
  const g = groups.find(x => x.id === gid);
  if (!g) return;
  const tab = g.tabs[idx];
  if (!tab) return;
  await chrome.tabs.create({ url: tab.url, active: true });
  g.tabs.splice(idx, 1);
  if (!g.tabs.length) groups = groups.filter(x => x.id !== gid);
  persist(); render();
}

function deleteGroup(gid, withUndo = true) {
  const idx = groups.findIndex(g => g.id === gid);
  if (idx === -1) return;
  const [removed] = groups.splice(idx, 1);
  persist(); render();

  if (withUndo) {
    undoStack = { group: removed, idx };
    showUndo(`"${removed.name}" deleted`);
  }
}

function deleteTab(gid, idx) {
  const g = groups.find(x => x.id === gid);
  if (!g) return;
  const [removed] = g.tabs.splice(idx, 1);
  if (!g.tabs.length) groups = groups.filter(x => x.id !== gid);
  persist(); render();

  undoStack = { tab: removed, gid, idx };
  showUndo('Tab removed');
}

function doUndo() {
  if (!undoStack) return;
  if (undoStack.group) {
    groups.splice(undoStack.idx, 0, undoStack.group);
    toast('Group restored', 'ok');
  } else if (undoStack.tab) {
    const g = groups.find(x => x.id === undoStack.gid);
    if (g) g.tabs.splice(undoStack.idx, 0, undoStack.tab);
    toast('Tab restored', 'ok');
  }
  undoStack = null;
  persist(); render();
  hideUndo();
}

function copyUrls(gid) {
  const g = groups.find(x => x.id === gid);
  if (!g) return;
  navigator.clipboard.writeText(g.tabs.map(t => t.url).join('\n'))
    .then(() => toast(`✓ Copied ${g.tabs.length} URLs`, 'ok'))
    .catch(() => toast('Copy failed', 'err'));
}

// ── Stats ─────────────────────────────────────────
function updateStats() {
  const total = groups.reduce((s, g) => s + g.tabs.length, 0);
  document.getElementById('sGroups').textContent = groups.length;
  document.getElementById('sTabs').textContent = total;

  const mb = total * 45;
  const memStr = mb >= 1024 ? `~${(mb/1024).toFixed(1)} GB` : `~${mb} MB`;
  document.getElementById('memLabel').textContent = memStr;
  document.getElementById('footMem').textContent = memStr;

  // bar: cap at 200 tabs = 100%
  const pct = Math.min(100, (total / 200) * 100);
  document.getElementById('memBar').style.width = pct + '%';
}

// ── Undo banner ───────────────────────────────────
function showUndo(msg) {
  clearTimeout(undoTimer);
  document.getElementById('undoMsg').textContent = msg;
  document.getElementById('undoBar').classList.add('show');
  undoTimer = setTimeout(() => { hideUndo(); undoStack = null; }, 5000);
}
function hideUndo() {
  document.getElementById('undoBar').classList.remove('show');
  clearTimeout(undoTimer);
}

// ── Toast ──────────────────────────────────────────
let toastTimer;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2200);
}

// ── Util ───────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
