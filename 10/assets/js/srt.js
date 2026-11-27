// Đọc file phụ đề .srt thành danh sách cue {start, end, text} (đơn vị: giây).
const TIME_RE = /(\d+):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/;
const toSeconds = (h, m, s, ms) => Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, '0')) / 1000;

export function parseSrt(raw) {
  const text = String(raw || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  if (!text) return [];
  const cues = [];
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split('\n');
    const idx = lines.findIndex(line => TIME_RE.test(line));
    if (idx < 0) continue;
    const m = lines[idx].match(TIME_RE);
    const start = toSeconds(m[1], m[2], m[3], m[4]);
    const end = toSeconds(m[5], m[6], m[7], m[8]);
    const body = lines.slice(idx + 1).join('\n')
      .replace(/<[^>]+>/g, '')        // thẻ <i>, <b>, <font>
      .replace(/\{\\[^}]*\}/g, '')    // thẻ kiểu ASS {\an8}
      .trim();
    if (!body) continue;
    cues.push({ start, end: Math.max(end, start + 0.1), text: body });
  }
  return cues.sort((a, b) => a.start - b.start);
}
