// IndexedDB proxy for exam script PDFs (FR-17 / FR-18).
// In production, the binary would live in Cloudflare R2.
// The Postgres `id` from `student_scripts` is used as the IndexedDB key so that
// metadata and blob can always be correlated.

const DB_NAME    = 'sohojcoaching-script-proxy';
const DB_VERSION = 1;
const STORE_NAME = 'student_script_files';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror  = () => reject(request.error);
  });
}

function runTransaction(mode, runner) {
  return openDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);

      tx.oncomplete = () => { db.close(); };
      tx.onerror    = () => { reject(tx.error); };

      runner(store, resolve, reject);
    });
  });
}

/**
 * Persist a PDF blob in IndexedDB.
 * @param {string} id       - UUID from student_scripts Postgres row
 * @param {Blob}   blob     - The raw PDF file blob
 * @param {string} examName - Human-readable label used as filename on download
 */
export function saveScriptBlob(id, blob, examName) {
  return runTransaction('readwrite', (store, resolve, reject) => {
    const request = store.put({ id, blob, examName, savedAt: Date.now() });
    request.onsuccess = () => resolve(true);
    request.onerror   = () => reject(request.error);
  });
}

/**
 * Retrieve a stored script entry (contains { id, blob, examName, savedAt }).
 * Returns null when the key is not found.
 */
export function getScriptBlob(id) {
  return runTransaction('readonly', (store, resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror   = () => reject(request.error);
  });
}

/**
 * Remove a script blob from IndexedDB (called after Postgres DELETE to keep stores in sync).
 */
export function deleteScriptBlob(id) {
  return runTransaction('readwrite', (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror   = () => reject(request.error);
  });
}
