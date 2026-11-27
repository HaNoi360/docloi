// Lưu video và các đoạn đang ghi vào IndexedDB để không mất khi tắt/đóng app giữa chừng.
const DB_NAME = 'teleprompter-db', DB_VERSION = 1;
let dbPromise = null;

function open() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error('IndexedDB không khả dụng'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('chunks', { keyPath: 'key' });
      db.createObjectStore('videos', { keyPath: 'id' });
      db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
const done = tx => new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error); });
const get = (store, key) => open().then(db => new Promise((resolve, reject) => { const r = db.transaction(store).objectStore(store).get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }));
const all = store => open().then(db => new Promise((resolve, reject) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }));

export const Storage = {
  persist() { return navigator.storage?.persist?.().catch(() => false) ?? Promise.resolve(false); },

  // Bắt đầu một phiên ghi: xoá đoạn cũ, ghi thông tin phiên.
  async beginSession(meta) {
    try {
      const db = await open(); const tx = db.transaction(['chunks', 'meta'], 'readwrite');
      tx.objectStore('chunks').clear(); tx.objectStore('meta').put(meta, 'session'); await done(tx);
    } catch (e) { console.warn('beginSession', e); }
  },
  addChunk(key, blob) {
    open().then(db => { const tx = db.transaction('chunks', 'readwrite'); tx.objectStore('chunks').put({ key, blob }); return done(tx); })
      .catch(e => console.warn('addChunk', e));
  },
  // Ghi video hoàn chỉnh và dọn các đoạn tạm.
  async saveVideo(v) {
    try {
      const db = await open(); const tx = db.transaction(['videos', 'chunks', 'meta'], 'readwrite');
      tx.objectStore('videos').put({ id: 'last', blob: v.blob, filename: v.filename, type: v.type, size: v.size, audioBitsPerSecond: v.audioBitsPerSecond || 0, savedAt: Date.now(), recovered: false });
      tx.objectStore('chunks').clear(); tx.objectStore('meta').delete('session'); await done(tx); return true;
    } catch (e) { console.warn('saveVideo', e); return false; }
  },
  async deleteVideo() {
    try { const db = await open(); const tx = db.transaction('videos', 'readwrite'); tx.objectStore('videos').delete('last'); await done(tx); } catch (e) { console.warn('deleteVideo', e); }
  },
  // Gọi khi mở app: nếu có phiên ghi dang dở thì ghép các đoạn thành video; trả về video gần nhất (hoặc null).
  async loadLatest() {
    try {
      const session = await get('meta', 'session');
      const chunks = (await all('chunks')).sort((a, b) => a.key - b.key);
      if (session && chunks.length) {
        const type = session.mime || chunks[0].blob.type || 'video/webm';
        const blob = new Blob(chunks.map(c => c.blob), { type });
        const ext = type.includes('mp4') ? 'mp4' : 'webm';
        const rec = { id: 'last', blob, filename: `teleprompter-khoi-phuc-${new Date(session.startedAt || Date.now()).toISOString().replace(/[:.]/g, '-')}.${ext}`, type, size: blob.size, audioBitsPerSecond: 0, savedAt: Date.now(), recovered: true };
        const db = await open(); const tx = db.transaction(['videos', 'chunks', 'meta'], 'readwrite');
        tx.objectStore('videos').put(rec); tx.objectStore('chunks').clear(); tx.objectStore('meta').delete('session'); await done(tx);
        return rec;
      }
      return (await get('videos', 'last')) || null;
    } catch (e) { console.warn('loadLatest', e); return null; }
  }
};
