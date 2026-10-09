// ==== HanCloud Drive - Script Utama Frontend ====

const STORAGE_KEY = 'hancloud_items_v1';
const SHARED_KEY = 'hancloud_shared_v1';
const GB = 1024 * 1024 * 1024;

// Pemetaan Ekstensi File ke Ikon & Label
const EXT_MAP = {
  pdf:  { icon: 'bi-file-earmark-pdf-fill',   color: 'text-danger',    label: 'PDF' },
  doc:  { icon: 'bi-file-earmark-word-fill',  color: 'text-primary',   label: 'Word' },
  docx: { icon: 'bi-file-earmark-word-fill',  color: 'text-primary',   label: 'Word' },
  xls:  { icon: 'bi-file-earmark-excel-fill', color: 'text-success',   label: 'Excel' },
  xlsx: { icon: 'bi-file-earmark-excel-fill', color: 'text-success',   label: 'Excel' },
  png:  { icon: 'bi-file-earmark-image-fill', color: 'text-success',   label: 'Image' },
  jpg:  { icon: 'bi-file-earmark-image-fill', color: 'text-success',   label: 'Image' },
  jpeg: { icon: 'bi-file-earmark-image-fill', color: 'text-success',   label: 'Image' },
  mp4:  { icon: 'bi-file-earmark-play-fill',  color: 'text-info',      label: 'Video' },
  mp3:  { icon: 'bi-file-earmark-music-fill', color: 'text-danger',    label: 'Audio' },
  zip:  { icon: 'bi-file-earmark-zip-fill',   color: 'text-warning',   label: 'Zip' },
  rar:  { icon: 'bi-file-earmark-zip-fill',   color: 'text-warning',   label: 'Zip' },
  js:   { icon: 'bi-file-earmark-code-fill',  color: 'text-secondary', label: 'JS' },
  html: { icon: 'bi-file-earmark-code-fill',  color: 'text-secondary', label: 'HTML' },
  txt:  { icon: 'bi-file-earmark-text-fill',  color: 'text-dark',      label: 'Text' },
  ppt:  { icon: 'bi-file-earmark-ppt-fill',   color: 'text-warning',   label: 'PPT' },
  pptx: { icon: 'bi-file-earmark-ppt-fill',   color: 'text-warning',   label: 'PPT' }
};
const DEFAULT_EXT = { icon: 'bi-file-earmark-fill', color: 'text-secondary', label: 'File' };

// Utility Functions
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
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

// State Management
let items = loadStorage(STORAGE_KEY, []);
let sharedIds = loadStorage(SHARED_KEY, []);
let currentView = 'drive';
const sessionFiles = new Map();

function loadStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

function saveShared() {
  try {
    localStorage.setItem(SHARED_KEY, JSON.stringify(sharedIds));
  } catch {}
}

// Template Kartu dengan atribut data-id
function fileCardHTML(item, opts = {}) {
  const info = extInfo(item.name);
  const meta = opts.meta || `<small class="text-muted">${formatBytes(item.size)}</small>`;
  const isTrash = opts.isTrash || false;

  return `
  <div class="card file-card flex-shrink-0 shadow-sm border" data-id="${item.id}">
    <div class="card-img-top bg-light d-flex align-items-center justify-content-center p-4">
      <i class="bi ${info.icon} ${info.color} display-4"></i>
    </div>
    <div class="card-body">
      <div class="d-flex align-items-start justify-content-between gap-1">
        <h6 class="card-title text-truncate mb-1 flex-grow-1" title="${esc(item.name)}">${esc(item.name)}</h6>
        <div class="d-flex align-items-center">
          ${!isTrash ? `<button class="btn btn-sm btn-icon" data-action="star" data-id="${item.id}" title="Berbintang"><i class="bi ${item.starred ? 'bi-star-fill text-warning' : 'bi-star'}"></i></button>` : ''}
          ${!isTrash ? `<button class="btn btn-sm btn-icon" data-action="download" data-id="${item.id}" title="Unduh"><i class="bi bi-download"></i></button>` : ''}
          ${!isTrash ? `<button class="btn btn-sm btn-icon" data-action="share" data-id="${item.id}" title="Bagikan"><i class="bi bi-share-fill"></i></button>` : ''}
          <button class="btn btn-sm btn-icon" data-action="menu" data-id="${item.id}" title="Menu"><i class="bi bi-three-dots-vertical text-muted"></i></button>
        </div>
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

// Render View Utama
function render() {
  const root = document.getElementById('view-root');
  const live = items.filter((i) => !i.deleted);
  const trashList = items.filter((i) => i.deleted).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));

  let html = '';
  if (currentView === 'drive') {
    const files = live.sort((a, b) => b.addedAt - a.addedAt);
    html = `
      <div class="mb-4">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h5 class="fw-bold mb-0">Semua File</h5>
          <small class="text-primary fw-semibold"><i class="bi bi-arrow-right"></i> Scroll ke kanan</small>
        </div>
        <div class="horizontal-scroll-container d-flex gap-3 pb-3">
          ${files.length ? files.map((f) => fileCardHTML(f)).join('') : emptyState('bi-file-earmark', 'Belum ada file', 'Klik tombol Baru untuk mengunggah file.')}
        </div>
      </div>`;
  } else if (currentView === 'recent') {
    const list = [...live].sort((a, b) => b.addedAt - a.addedAt);
    html = renderGridView('Terbaru', 'File yang baru ditambahkan', list, (it) => `<small class="text-muted">${formatBytes(it.size)}</small>`, 'bi-clock-history', 'Belum ada file terbaru', 'File baru akan muncul di sini');
  } else if (currentView === 'starred') {
    const list = live.filter((i) => i.starred);
    html = renderGridView('Berbintang', 'File favorit Anda', list, (it) => `<small class="text-muted">${formatBytes(it.size)}</small>`, 'bi-star', 'Belum ada file berbintang', 'Tandai file dengan ikon bintang untuk melihatnya di sini');
  } else if (currentView === 'shared') {
    const list = sharedIds.map((id) => live.find((i) => i.id === id)).filter(Boolean);
    html = renderGridView('Dibagikan', 'File yang memiliki tautan berbagi', list, (it) => `<small class="text-muted">${formatBytes(it.size)}</small>`, 'bi-people', 'Belum ada file dibagikan', 'Gunakan tombol bagikan pada file untuk membuat link');
  } else if (currentView === 'trash') {
    html = `
      <div class="mb-4">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h5 class="fw-bold mb-0">Sampah</h5>
          ${trashList.length ? `<button class="btn btn-outline-danger btn-sm rounded-pill" data-action="empty-trash"><i class="bi bi-trash me-1"></i> Kosongkan Sampah</button>` : ''}
        </div>
        <div class="grid-view">
          ${trashList.length ? trashList.map((it) => fileCardHTML(it, { isTrash: true, meta: `<small class="text-muted">Dihapus: ${formatDate(it.deletedAt)}</small>` })).join('') : emptyState('bi-trash', 'Sampah kosong', 'File yang dihapus akan tampil di sini')}
        </div>
      </div>`;
  }

  root.innerHTML = html;
  updateStorage(live);
}

function renderGridView(title, subtitle, list, metaFn, icon, emptyTitle, emptyText) {
  return `
    <div class="mb-4">
      <div class="mb-3">
        <h5 class="fw-bold mb-0">${title}</h5>
        <small class="text-muted">${subtitle}</small>
      </div>
      <div class="grid-view">
        ${list.length ? list.map((it) => fileCardHTML(it, { meta: metaFn(it) })).join('') : emptyState(icon, emptyTitle, emptyText)}
      </div>
    </div>`;
}

function updateStorage(live) {
  const used = live.reduce((sum, i) => sum + (i.size || 0), 0);
  const total = 15 * GB;
  const pct = Math.min(100, (used / total) * 100);
  document.getElementById('storage-bar').style.width = pct.toFixed(1) + '%';
  document.getElementById('storage-text').textContent = `${formatBytes(used)} dari 15 GB digunakan`;
}

// Aksi Manajemen File
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;
  const item = items.find((i) => i.id === id);

  if (!item) return;

  if (action === 'star') {
    item.starred = !item.starred;
    saveStorage();
    render();
    toast(item.starred ? 'Ditambahkan ke Berbintang' : 'Dihapus dari Berbintang');
  } else if (action === 'download') {
    const url = sessionFiles.get(id) || item.dataUrl;
    if (!url) return toast('File tidak tersedia di sesi ini.');
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name;
    a.click();
    a.remove();
  } else if (action === 'share') {
    const link = `${location.href.split('#')[0]}#file=${item.id}`;
    navigator.clipboard.writeText(link).then(() => toast('Tautan disalin ke clipboard!'));
    if (!sharedIds.includes(item.id)) {
      sharedIds.push(item.id);
      saveShared();
    }
  } else if (action === 'menu') {
    openModal(item);
  } else if (action === 'delete') {
    item.deleted = true;
    item.deletedAt = Date.now();
    saveStorage();
    render();
    hideModal();
    toast('Dipindahkan ke Sampah');
  } else if (action === 'restore') {
    item.deleted = false;
    delete item.deletedAt;
    saveStorage();
    render();
    hideModal();
    toast('File dipulihkan');
  } else if (action === 'delete-forever') {
    if (!confirm('Hapus permanen file ini?')) return;
    items = items.filter((i) => i.id !== id);
    saveStorage();
    render();
    hideModal();
    toast('File dihapus permanen');
  } else if (action === 'empty-trash') {
    if (!confirm('Kosongkan semua sampah?')) return;
    items = items.filter((i) => !i.deleted);
    saveStorage();
    render();
    toast('Sampah dikosongkan');
  }
});

// Modal Handler
const modalInstance = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('item-modal'));

function openModal(item) {
  document.getElementById('item-modal-title').textContent = item.name;
  const body = document.getElementById('item-modal-body');

  if (item.deleted) {
    body.innerHTML = `
      <button class="btn btn-light w-100 mb-2 text-start" data-action="restore" data-id="${item.id}"><i class="bi bi-arrow-counterclockwise me-2"></i> Pulihkan</button>
      <button class="btn btn-light w-100 text-danger text-start" data-action="delete-forever" data-id="${item.id}"><i class="bi bi-trash me-2"></i> Hapus Permanen</button>`;
  } else {
    body.innerHTML = `
      <button class="btn btn-light w-100 mb-2 text-start" data-action="star" data-id="${item.id}"><i class="bi bi-star me-2"></i> Ubah Status Bintang</button>
      <button class="btn btn-light w-100 mb-2 text-start" data-action="download" data-id="${item.id}"><i class="bi bi-download me-2"></i> Unduh</button>
      <button class="btn btn-light w-100 mb-2 text-start" data-action="share" data-id="${item.id}"><i class="bi bi-share me-2"></i> Bagikan Tautan</button>
      <hr>
      <button class="btn btn-light w-100 text-danger text-start" data-action="delete" data-id="${item.id}"><i class="bi bi-trash me-2"></i> Hapus</button>`;
  }
  modalInstance().show();
}

function hideModal() {
  modalInstance().hide();
}

// Toast Notifikasi
function toast(msg) {
  const host = document.getElementById('toast-host');
  const el = document.createElement('div');
  el.className = 'toast align-items-center text-bg-dark border-0 shadow';
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(msg)}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  host.appendChild(el);
  const t = new bootstrap.Toast(el, { delay: 2500 });
  t.show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

// Event Upload File via Tombol Baru
const fileInput = document.getElementById('file-input');
document.getElementById('btn-new').addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const files = Array.from(fileInput.files);
  if (!files.length) return;

  const now = Date.now();
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    let dataUrl = null;
    try {
      dataUrl = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(f);
      });
    } catch {}

    const newItem = {
      id: uid(),
      name: f.name,
      size: f.size || 0,
      starred: false,
      deleted: false,
      addedAt: now + i,
      dataUrl: dataUrl && f.size < 2 * 1024 * 1024 ? dataUrl : null
    };

    sessionFiles.set(newItem.id, URL.createObjectURL(f));
    items.unshift(newItem);
  }

  saveStorage();
  render();
  toast(`${files.length} file berhasil ditambahkan!`);
  fileInput.value = '';
});

// Navigasi Sidebar View
document.querySelectorAll('.nav-link[data-view]').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    currentView = link.dataset.view;
    document.querySelectorAll('.nav-link').forEach((l) => {
      l.classList.toggle('active', l.dataset.view === currentView);
      l.classList.toggle('text-dark', l.dataset.view !== currentView);
    });
    render();
  });
});

// Horizontal scroll dengan mouse wheel
document.addEventListener('wheel', (e) => {
  const container = e.target.closest('.horizontal-scroll-container');
  if (!container) return;
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    e.preventDefault();
    container.scrollLeft += e.deltaY;
  }
}, { passive: false });

// Inisialisasi awal
render();