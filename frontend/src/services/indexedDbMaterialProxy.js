const DB_NAME = 'sohojcoaching-material-proxy';
const DB_VERSION = 1;
const STORE_NAME = 'study_material_files';

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
    request.onerror = () => reject(request.error);
  });
}

function runTransaction(mode, runner) {
  return openDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);

      tx.oncomplete = () => {
        db.close();
      };

      tx.onerror = () => {
        reject(tx.error);
      };

      runner(store, resolve, reject);
    });
  });
}

export function saveMaterialBlob(id, blob, fileName, fileType) {
  return runTransaction('readwrite', (store, resolve, reject) => {
    const request = store.put({
      id,
      blob,
      fileName,
      fileType,
      savedAt: Date.now()
    });

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

export function getMaterialBlob(id) {
  return runTransaction('readonly', (store, resolve, reject) => {
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export function deleteMaterialBlob(id) {
  return runTransaction('readwrite', (store, resolve, reject) => {
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}
