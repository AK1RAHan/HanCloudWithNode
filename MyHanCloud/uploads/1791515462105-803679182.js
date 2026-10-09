// ==== MyCloud Drive - Script Utama ====
// Fitur: tambah file lewat file manager, unduh, bagikan lewat URL,
//        hapus (ke Sampah = riwayat), pulihkan, hapus permanen, favorit (berbintang).

const STORAGE_KEY = 'mycloud_items_v2';
const SHARED_KEY = 'mycloud_shared_v2';
const GB = 1024 * 1024 * 1024;

// Icon & label badge berdasarkan ekstensi file
const EXT_MAP = {
  pdf:  { icon: 'bi-file-earmark-pdf-fill',   color: 'text-danger',    label: 'PDF' },
  doc:  { icon: 'bi-file-earmark-word-fill',  color: 'text-primary',   label: 'Word' },
  docx: { icon: 'bi-file-earmark-word-fill',  color: 'text-primary',   label: 'Word' },
  xls:  { icon: 'bi-file-earmark-excel-fill', color: 'text-success',   label: 'Excel' },
  xlsx: { icon: 'bi-file-earmark-excel-fill', color: 'text-success',   label: 'Excel' },
  csv:  { icon: 'bi-file-earmark-excel-fill', color: 'text-success',   label: 'Excel' },
  png:  { icon: 'bi-file-earmark-image-fill', color: 'text-success',   label: 'Image' },
  jpg:  { icon: 'bi-file-earmark-image-fill', color: 'text-success',   label: 'Image' },
  jpeg: { icon: 'bi-file-earmark-image-fill', color: 'text-success',   label: 'Image' },
  gif:  { icon: 'bi-file-earmark-image-fill', color: 'text-success',   label: 'Image' },
  svg:  { icon: 'bi-file-earmark-image-fill', color: 'text-success',   label: 'Image' },
  zip:  { icon: 'bi-file-earmark-zip-fill',   color: 'text-warning',   label: 'Zip' },
  rar:  { icon: 'bi-file-earmark-zip-fill',   color: 'text-warning',   label: 'Zip' },
  '7z': { icon: 'bi-file-earmark-zip-fill',   color: 'text-warning',   label: 'Zip' },
  mp4:  { icon: 'bi-file-earmark-play-fill',  color: 'text-info',      label: 'Video' },
  mkv:  { icon: 'bi-file-earmark-play-fill',  color: 'text-info',      label: 'Video' },
  avi:  { icon: 'bi-file-earmark-play-fill',  color: 'text-info',      label: 'Video' },
  mp3:  { icon: 'bi-file-earmark-music-fill', color: 'text-danger',    label: 'Audio' },
  wav:  { icon: 'bi-file-earmark-music-fill', color: 'text-danger',    label: 'Audio' },
  flac: { icon: 'bi-file-earmark-music-fill', color: 'text-danger',    label: 'Audio' },
  js:   { icon: 'bi-file-earmark-code-fill',  color: 'text-secondary', label: 'JS' },
  html: { icon: 'bi-file-earmark-code-fill',  color: 'text-secondary', label: 'HTML' },
  css:  { icon: 'bi-file-earmark-code-fill',  color: 'text-secondary', label: 'CSS' },
  json: { icon: 'bi-file-earmark-code-fill',  color: 'text-secondary', label: 'JSON' },
  txt:  { icon: 'bi-file-earmark-text-fill',  color: 'text-dark',      label: 'Text' },
  md:   { icon: 'bi-file-earmark-text-fill',  color: 'text-dark',      label: 'Text' },
  ppt:  { icon: 'bi-file-earmark-ppt-fill',   color: 'text-warning',   label: 'PPT' },
  pptx: { icon: 'bi-file-earmark-ppt-fill',   color: 'text-warning',   label: 'PPT' }
};
const DEFAULT_EXT = { icon: 'bi-file-earmark-fill', color: 'text-secondary', label: 'File' };

// ==== Util ====

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / (1024 ** i);
  return `${val >= 100 ? val.toFixed(0) : val.toFixed(1)} ${units[i]}`;
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function extInfo(name) {
  const ext = (String(name).split('.').pop() || '').toLowerCase();
  return EXT_MAP[ext] || DEFAULT_EXT;
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ==== State & penyimpanan ====

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch (e) { /* localStorage tidak tersedia */ }
  return [];
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch (e) {
    return false; // penyimpanan penuh / tidak tersedia
  }
}

function loadShared() {
  try {
    const raw = localStorage.getItem(SHARED_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch (e) { /* abaikan */ }
  return [];
}

function saveShared() {
  try {
    localStorage.setItem(SHARED_KEY, JSON.stringify(sharedIds));
  } catch (e) { /* abaikan */ }
}

let items = load();          // metadata + konten file (dataUrl)
let sharedIds = loadShared(); // id file yang pernah dibagikan lewat URL
let currentView = 'drive';
const sessionFiles = new Map(); // id -> objectURL (berlaku sampai halaman ditutup)

function revokeSessionFile(id) {
  const url = sessionFiles.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    sessionFiles.delete(id);
  }
}

// ==== Template kartu ====

function starBtnHTML(item) {
  return `<button class="btn btn-sm btn-icon" data-action="star" data-id="${item.id}" title="Berbintang" aria-label="Berbintang">
    <i class="bi ${item.starred ? 'bi-star-fill text-warning' : 'bi-star'}"></i>
  </button>`;
}

function downloadBtnHTML(item) {
  return `<button class="btn btn-sm btn-icon" data-action="download" data-id="${item.id}" title="Unduh" aria-label="Unduh">
    <i class="bi bi-download"></i>
  </button>`;
}

function shareBtnHTML(item) {
  return `<button class="btn btn-sm btn-icon" data-action="share" data-id="${item.id}" title="Bagikan lewat URL" aria-label="Bagikan">
    <i class="bi bi-share-fill"></i>
  </button>`;
}

function dotsBtnHTML(item) {
  return `<button class="btn btn-sm btn-icon" data-action="menu" data-id="${item.id}" title="Lainnya" aria-label="Lainnya">
    <i class="bi bi-three-dots-vertical text-muted"></i>
  </button>`;
}

function fileCardHTML(item, opts = {}) {
  const info = extInfo(item.name);
  const meta = opts.meta || `<small class="text-muted">${formatBytes(item.size)}</small>`;
  const quick = opts.quick || 'full';

  let actions = '';
  if (quick === 'full') {
    actions = `${starBtnHTML(item)}${downloadBtnHTML(item)}${shareBtnHTML(item)}${dotsBtnHTML(item)}`;
  } else {
    actions = dotsBtnHTML(item);
  }

  return `
  <div class="card file-card flex-shrink-0 shadow-sm border">
    <div class="card-img-top bg-light d-flex align-items-center justify-content-center p-4">
      <i class="bi ${info.icon} ${info.color} display-4"></i>
    </div>
    <div class="card-body">
      <div class="d-flex align-items-start justify-content-between gap-1">
        <h6 class="card-title text-truncate mb-1 flex-grow-1" title="${esc(item.name)}">${esc(item.name)}</h6>
        <div class="d-flex align-items-center">${actions}</div>
      </div>
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <span class="badge bg-light text-dark border">${info.label}</span>
        ${meta}
      </div>
    </div>
  </div>`;
}

function emptyState(icon, title, text) {
  return `
  <div class="empty-state">
    <i class="bi ${icon} display-1"></i>
    <h6 class="mt-3 mb-1">${title}</h6>
    <small>${text}</small>
  </div>`;
}

// ==== Render tampilan ====

function renderDrive(live) {
  const files = live.filter((i) => i.type === 'file').sort((a, b) => b.addedAt - a.addedAt);

  return `
  <div class="mb-4">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h5 class="fw-bold mb-0">Semua File</h5>
      <small class="text-primary fw-semibold"><i class="bi bi-arrow-right"></i> Scroll ke kanan</small>
    </div>
    <div class="horizontal-scroll-container d-flex gap-3 pb-3">
      ${files.length
        ? files.map((f) => fileCardHTML(f)).join('')
        : emptyState('bi-file-earmark', 'Belum ada file', 'Klik tombol Baru untuk menambahkan file lewat file manager')}
    </div>
  </div>`;
}

function gridViewHTML(title, subtitle, list, metaFn, emptyIcon, emptyTitle, emptyText) {
  return `
  <div class="mb-4">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <h5 class="fw-bold mb-0">${title}</h5>
        ${subtitle ? `<small class="text-muted">${subtitle}</small>` : ''}
      </div>
    </div>
    <div class="grid-view">
      ${list.length
        ? list.map((it) => fileCardHTML(it, { meta: metaFn ? metaFn(it) : '' })).join('')
        : emptyState(emptyIcon, emptyTitle, emptyText)}
    </div>
  </div>`;
}

function renderTrash(trashList) {
  return `
  <div class="mb-4">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <h5 class="fw-bold mb-0">Sampah</h5>
        <small class="text-muted">Riwayat file yang dihapus &bull; bisa dipulihkan</small>
      </div>
      ${trashList.length
        ? `<button class="btn btn-outline-danger btn-sm rounded-pill" data-action="empty-trash"><i class="bi bi-trash me-1"></i> Kosongkan Sampah</button>`
        : ''}
    </div>
    <div class="grid-view">
      ${trashList.length
        ? trashList.map((it) => fileCardHTML(it, {
            quick: 'trash',
            meta: `<small class="text-muted">Dihapus: ${formatDate(it.deletedAt || it.addedAt)}</small>`
          })).join('')
        : emptyState('bi-trash', 'Sampah kosong', 'File yang kamu hapus akan tersimpan di riwayat ini')}
    </div>
  </div>`;
}

function render() {
  const root = document.getElementById('view-root');
  const live = items.filter((i) => !i.deleted);
  const trashList = items.filter((i) => i.deleted).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));

  let html = '';
  if (currentView === 'drive') {
    html = renderDrive(live);
  } else if (currentView === 'recent') {
    const list = [...live].sort((a, b) => b.addedAt - a.addedAt);
    html = gridViewHTML('Terbaru', 'File yang baru saja kamu tambahkan', list,
      (it) => `<small class="text-muted">${formatBytes(it.size)} &bull; ${formatDate(it.addedAt)}</small>`,
      'bi-clock-history', 'Belum ada aktivitas', 'File yang kamu tambahkan akan muncul di sini');
  } else if (currentView === 'starred') {
    const list = live.filter((i) => i.starred).sort((a, b) => b.addedAt - a.addedAt);
    html = gridViewHTML('Berbintang', 'File favoritmu', list,
      (it) => `<small class="text-muted">${formatBytes(it.size)}</small>`,
      'bi-star', 'Belum ada favorit', 'Klik ikon bintang pada file untuk menambahkannya ke sini');
  } else if (currentView === 'trash') {
    html = renderTrash(trashList);
  } else if (currentView === 'shared') {
    const list = sharedIds
      .map((sid) => live.find((i) => i.id === sid))
      .filter(Boolean)
      .sort((a, b) => b.addedAt - a.addedAt);
    html = gridViewHTML('Dibagikan', 'File yang kamu bagikan lewat URL', list,
      (it) => `<small class="text-muted">${formatBytes(it.size)}</small>`,
      'bi-people', 'Belum ada file yang dibagikan', 'Klik ikon bagikan pada file untuk membuat link URL');
  }

  root.innerHTML = html;
  renderStorage(live);
}

function renderStorage(live) {
  const used = live.reduce((sum, i) => sum + (i.size || 0), 0);
  const total = 15 * GB;
  const pct = Math.min(100, (used / total) * 100);
  const bar = document.getElementById('storage-bar');
  const text = document.getElementById('storage-text');
  if (bar) bar.style.width = pct.toFixed(1) + '%';
  if (text) text.textContent = `${formatBytes(used)} dari ${formatBytes(total)} digunakan`;
}

// ==== Aksi ====

function toggleStar(id) {
  const it = items.find((i) => i.id === id);
  if (!it) return;
  it.starred = !it.starred;
  save();
  render();
  toast(it.starred ? `"${it.name}" ditambahkan ke Berbintang` : `"${it.name}" dihapus dari Berbintang`);
}

function softDelete(id) {
  const it = items.find((i) => i.id === id);
  if (!it) return;
  it.deleted = true;
  it.deletedAt = Date.now();
  save();
  render();
  toast(`"${it.name}" dipindahkan ke Sampah`);
}

function restoreItem(id) {
  const it = items.find((i) => i.id === id);
  if (!it) return;
  it.deleted = false;
  delete it.deletedAt;
  save();
  render();
  toast(`"${it.name}" dipulihkan`);
}

function deleteForever(id) {
  const it = items.find((i) => i.id === id);
  if (!it) return;
  if (!confirm(`Hapus permanen "${it.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
  items = items.filter((i) => i.id !== id);
  revokeSessionFile(id);
  save();
  render();
  toast(`"${it.name}" dihapus permanen`);
}

function emptyTrash() {
  const trashList = items.filter((i) => i.deleted);
  if (!trashList.length) return;
  if (!confirm(`Kosongkan Sampah? ${trashList.length} file akan dihapus permanen.`)) return;
  trashList.forEach((it) => revokeSessionFile(it.id));
  items = items.filter((i) => !i.deleted);
  save();
  render();
  toast('Sampah dikosongkan');
}

function downloadItem(id) {
  const it = items.find((i) => i.id === id);
  if (!it) return;

  const url = sessionFiles.get(id) || it.dataUrl || null;
  if (!url) {
    toast('Konten file tidak tersedia (file terlalu besar untuk disimpan). Silakan unggah ulang.');
    return;
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = it.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function shareItem(id) {
  const it = items.find((i) => i.id === id);
  if (!it) return;

  const url = `${location.href.split('#')[0]}#file=${it.id}`;
  const notify = () => toast('Link file disalin — kirim URL ini untuk berbagi');

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).then(notify).catch(() => fallbackCopy(url, notify));
  } else {
    fallbackCopy(url, notify);
  }

  if (!sharedIds.includes(it.id)) {
    sharedIds.push(it.id);
    saveShared();
  }
}

function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    done();
  } catch (e) {
    toast('Gagal menyalin link');
  }
  ta.remove();
}

// ==== Modal aksi item ====

function openItemModal(id) {
  const it = items.find((i) => i.id === id);
  if (!it) return;

  document.getElementById('item-modal-title').textContent = it.name;
  const body = document.getElementById('item-modal-body');

  if (it.deleted) {
    body.innerHTML = `
      <button class="btn btn-light w-100 mb-2 d-flex align-items-center justify-content-start" data-action="restore" data-id="${it.id}">
        <i class="bi bi-arrow-counterclockwise me-2"></i> Pulihkan
      </button>
      <button class="btn btn-light w-100 d-flex align-items-center justify-content-start text-danger" data-action="delete-forever" data-id="${it.id}">
        <i class="bi bi-trash me-2"></i> Hapus Permanen
      </button>`;
    return;
  }

  let rows = `
    <button class="btn btn-light w-100 mb-2 d-flex align-items-center justify-content-start" data-action="star" data-id="${it.id}">
      <i class="bi ${it.starred ? 'bi-star-fill text-warning' : 'bi-star'} me-2"></i>
      ${it.starred ? 'Hapus dari Berbintang' : 'Tambahkan ke Berbintang'}
    </button>`;

  if (it.type === 'file') {
    rows += `
    <button class="btn btn-light w-100 mb-2 d-flex align-items-center justify-content-start" data-action="download" data-id="${it.id}">
      <i class="bi bi-download me-2"></i> Unduh
    </button>`;
  }

  rows += `
    <button class="btn btn-light w-100 mb-2 d-flex align-items-center justify-content-start" data-action="share" data-id="${it.id}">
      <i class="bi bi-share-fill me-2"></i> Bagikan Lewat URL
    </button>
    <hr class="dropdown-divider my-2">
    <button class="btn btn-light w-100 d-flex align-items-center justify-content-start text-danger" data-action="delete" data-id="${it.id}">
      <i class="bi bi-trash me-2"></i> Hapus
    </button>`;

  body.innerHTML = rows;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('item-modal')).show();
}

function hideItemModal() {
  const inst = bootstrap.Modal.getInstance(document.getElementById('item-modal'));
  if (inst) inst.hide();
}

// ==== Notifikasi toast ====

function toast(msg) {
  const host = document.getElementById('toast-host');
  if (!host || typeof bootstrap === 'undefined') return;

  const el = document.createElement('div');
  el.className = 'toast align-items-center text-bg-primary border-0';
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');
  el.setAttribute('aria-atomic', 'true');
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${esc(msg)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Tutup"></button>
    </div>`;
  host.appendChild(el);

  const t = bootstrap.Toast.getOrCreateInstance(el, { delay: 2500 });
  t.show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

// ==== Event wiring ====

function setView(view) {
  currentView = view;
  document.querySelectorAll('.nav-link[data-view]').forEach((l) => {
    const on = l.dataset.view === view;
    l.classList.toggle('active', on);
    l.classList.toggle('text-dark', !on);
  });
  render();
}

document.querySelectorAll('.nav-link[data-view]').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    setView(link.dataset.view);
  });
});

// Tombol Baru -> buka file manager
const fileInput = document.getElementById('file-input');
document.getElementById('btn-new').addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const files = Array.from(fileInput.files || []);
  if (!files.length) return;

  const now = Date.now();
  let downsized = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];

    let dataUrl = null;
    try {
      dataUrl = await readAsDataURL(f);
    } catch (e) {
      dataUrl = null;
    }

    const item = {
      id: uid() + i,
      type: 'file',
      name: f.name,
      size: f.size || 0,
      starred: false,
      deleted: false,
      addedAt: now + i
    };
    if (dataUrl) {
      item.dataUrl = dataUrl;
      if (f.type) item.mimeType = f.type;
    }
    sessionFiles.set(item.id, URL.createObjectURL(f));

    items.unshift(item);
    if (!save()) {
      // Penyimpanan penuh: simpan sebagai metadata saja (tanpa konten permanen)
      delete item.dataUrl;
      delete item.mimeType;
      if (save()) downsized++;
    }
  }

  render();
  const names = files.length === 1 ? `"${files[0].name}"` : `${files.length} file`;
  toast(downsized ? `${names} ditambahkan (${downsized} terlalu besar untuk disimpan permanen)` : `${names} ditambahkan`);
  fileInput.value = '';
});

// Delegasi klik untuk semua aksi pada kartu & modal
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;

  const action = el.dataset.action;
  const id = el.dataset.id;

  if (action === 'menu') {
    e.preventDefault();
    openItemModal(id);
  } else if (action === 'star') {
    e.preventDefault();
    toggleStar(id);
  } else if (action === 'download') {
    e.preventDefault();
    downloadItem(id);
  } else if (action === 'share') {
    e.preventDefault();
    shareItem(id);
  } else if (action === 'delete') {
    e.preventDefault();
    softDelete(id);
    hideItemModal();
  } else if (action === 'restore') {
    e.preventDefault();
    restoreItem(id);
    hideItemModal();
  } else if (action === 'delete-forever') {
    e.preventDefault();
    deleteForever(id);
    hideItemModal();
  } else if (action === 'empty-trash') {
    e.preventDefault();
    emptyTrash();
  }
});

// Scroll horizontal pakai wheel mouse (delegasi, agar tetap jalan setelah re-render)
document.addEventListener('wheel', (evt) => {
  const container = evt.target.closest ? evt.target.closest('.horizontal-scroll-container') : null;
  if (!container) return;
  if (Math.abs(evt.deltaY) > Math.abs(evt.deltaX)) {
    evt.preventDefault();
    container.scrollLeft += evt.deltaY;
  }
}, { passive: false });

// Buka file dari link berbagi: index.html#file=<id>
function handleHash() {
  const m = location.hash.match(/#file=([A-Za-z0-9]+)/);
  if (!m) return;

  const it = items.find((i) => i.id === m[1]);
  if (!it) {
    toast('File dari link tidak ditemukan');
    return;
  }

  if (it.deleted) {
    setView('trash');
    toast(`"${it.name}" ada di Sampah`);
    return;
  }

  setView('drive');
  toast(`File dari link: "${it.name}"`);
  requestAnimationFrame(() => {
    const card = document.querySelector(`.card[data-id="${it.id}"]`);
    if (card) {
      card.classList.add('card-highlight');
      card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  });
}

// Render awal + tangani link berbagi
render();
handleHash();
