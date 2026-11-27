// Lưu cấu hình vào localStorage của trình duyệt (chỉ nằm trên thiết bị này).
const KEY = 'teleprompter.settings.v1';

export const Settings = {
  load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  },
  save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
  },
  clear() {
    try { localStorage.removeItem(KEY); } catch { /* bỏ qua */ }
  }
};

// Vị trí chữ đang cuộn (lưu riêng, ghi thường xuyên hơn cấu hình).
const PKEY = 'teleprompter.progress.v1';
export const Progress = {
  load() { try { return JSON.parse(localStorage.getItem(PKEY)) || null; } catch { return null; } },
  save(data) { try { localStorage.setItem(PKEY, JSON.stringify(data)); } catch { /* bỏ qua */ } },
  clear() { try { localStorage.removeItem(PKEY); } catch { /* bỏ qua */ } }
};
