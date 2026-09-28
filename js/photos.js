// Фото еженедельных проверок — только на телефоне (IndexedDB), на сервер не отправляются.
const DB = 'mimika-photos', STORE = 'photos';
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export const putPhoto = (key, blob) => tx('readwrite', (s) => s.put(blob, key)).catch(() => null);
export const getPhoto = (key) => tx('readonly', (s) => s.get(key)).catch(() => null);
export const clearPhotos = () => tx('readwrite', (s) => s.clear()).catch(() => null);

// Квадратный кадр лица из видео (без зеркалирования; зеркалим при показе).
export function captureFace(video, pts, size = 320) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  const side = Math.max(x1 - x0, y1 - y0) * 1.3;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d').drawImage(video, cx - side / 2, cy - side / 2, side, side, 0, 0, size, size);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', 0.82));
}
