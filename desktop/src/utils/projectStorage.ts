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

/**
 * Save template image data to IndexedDB
 */
export async function saveTemplateToDb(template: TemplateInfo): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    if (!template.url) {
      store.delete('template');
    } else {
      store.put(template, 'template');
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
 * Load template image data from IndexedDB
 */
export async function loadTemplateFromDb(): Promise<TemplateInfo | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get('template');
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
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
