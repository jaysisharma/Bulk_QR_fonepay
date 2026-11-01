import type { TemplateInfo, UploadedQrInfo, SavedLayoutState } from '../types';

const DB_NAME = 'qr_template_studio_db';
const DB_VERSION = 1;
const STORE_NAME = 'media_cache';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Pre-per-size installs stored a single template under this key
const LEGACY_TEMPLATE_KEY = 'template';
// Older saved templates each card option adopts on first load: the single legacy
// template and the briefly-used per-size keys go to Option 1, the 4×6 one to Option 2
const TEMPLATE_MIGRATION_SOURCES: Record<string, string[]> = {
  option1: ['template:default', LEGACY_TEMPLATE_KEY],
  option2: ['template:photo'],
};

function templateKeyForCardOption(cardOptionId: string): string {
  return `template:${cardOptionId}`;
}

/**
 * Save template image data to IndexedDB for a specific card option
 */
export async function saveTemplateToDb(template: TemplateInfo, cardOptionId: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const key = templateKeyForCardOption(cardOptionId);
    if (!template.url) {
      store.delete(key);
    } else {
      store.put(template, key);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('Failed to save template to IndexedDB:', e);
  }
}

/**
 * Load template image data from IndexedDB for a specific card option.
 * On first load an option adopts (and removes) its older saved template, if any.
 */
export async function loadTemplateFromDb(cardOptionId: string): Promise<TemplateInfo | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const key = templateKeyForCardOption(cardOptionId);
    const sources = [key, ...(TEMPLATE_MIGRATION_SOURCES[cardOptionId] ?? [])];
    return new Promise((resolve) => {
      const tryNext = (index: number) => {
        if (index >= sources.length) {
          resolve(null);
          return;
        }
        const request = store.get(sources[index]);
        request.onsuccess = () => {
          if (!request.result) {
            tryNext(index + 1);
            return;
          }
          if (index > 0) {
            store.put(request.result, key);
            store.delete(sources[index]);
          }
          resolve(request.result);
        };
        request.onerror = () => resolve(null);
      };
      tryNext(0);
    });
  } catch (e) {
    console.error('Failed to load template from IndexedDB:', e);
    return null;
  }
}

/**
 * Save custom QR info to IndexedDB
 */
export async function saveCustomQrToDb(qr: UploadedQrInfo | null): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    if (!qr) {
      store.delete('custom_qr');
    } else {
      store.put(qr, 'custom_qr');
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('Failed to save custom QR to IndexedDB:', e);
  }
}

/**
 * Load custom QR info from IndexedDB
 */
export async function loadCustomQrFromDb(): Promise<UploadedQrInfo | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get('custom_qr');
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    console.error('Failed to load custom QR from IndexedDB:', e);
    return null;
  }
}

export interface ProjectBundle {
  version: number;
  layout: SavedLayoutState;
  template: TemplateInfo;
  customQr: UploadedQrInfo | null;
  exportedAt: string;
}

/**
 * Export full project file (.qrproj)
 */
export function exportProjectBundle(bundle: ProjectBundle, filename = 'card-project.qrproj'): void {
  const jsonStr = JSON.stringify(bundle, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
