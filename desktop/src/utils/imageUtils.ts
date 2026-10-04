import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Render first page of a PDF file to a high-DPI image data URL
 */
export async function renderPdfPageToDataUrl(
  file: File,
  scale = 1.5
): Promise<{ dataUrl: string; width: number; height: number; pageCount: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  // Auto-cap scale so large poster PDFs do not blow up memory while maintaining crisp 1000px+ QR detail
  const baseViewport = page.getViewport({ scale: 1.0 });
  const maxDim = Math.max(baseViewport.width, baseViewport.height);
  const targetScale = Math.min(scale, Math.max(1.0, 1200 / maxDim));
  const viewport = page.getViewport({ scale: targetScale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  const dataUrl = canvas.toDataURL('image/png');

  return {
    dataUrl,
    width: Math.round(viewport.width),
    height: Math.round(viewport.height),
    pageCount: pdf.numPages,
  };
}

/**
 * Render all pages of a PDF file to high-DPI image data URLs (for multi-page bulk QRs)
 */
export async function renderAllPdfPagesToDataUrls(
  file: File,
  scale = 1.5,
  onProgress?: (current: number, total: number) => void
): Promise<Array<{ pageNumber: number; dataUrl: string; width: number; height: number }>> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const results: Array<{ pageNumber: number; dataUrl: string; width: number; height: number }> = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const baseViewport = page.getViewport({ scale: 1.0 });
    const maxDim = Math.max(baseViewport.width, baseViewport.height);
    const targetScale = Math.min(scale, Math.max(1.0, 1200 / maxDim));
    const viewport = page.getViewport({ scale: targetScale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      results.push({
        pageNumber: i,
        dataUrl: canvas.toDataURL('image/png'),
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
      });
    }
    if (onProgress) onProgress(i, numPages);
  }

  return results;
}

/**
 * Read image file to Data URL
 */
export function readImageToDataUrl(
  file: File
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        resolve({
          dataUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.onerror = reject;
      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Automatically trims outer quiet zone / whitespace padding around content
 */
export function trimImageWhitespace(
  sourceDataUrl: string,
  threshold = 235
): Promise<{ trimmedUrl: string; bounds?: { x: number; y: number; width: number; height: number } }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ trimmedUrl: sourceDataUrl });
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];

          const isWhitespace = a < 25 || (r >= threshold && g >= threshold && b >= threshold);
          if (!isWhitespace) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (
        maxX < minX ||
        maxY < minY ||
        (minX === 0 && minY === 0 && maxX === canvas.width - 1 && maxY === canvas.height - 1)
      ) {
        resolve({ trimmedUrl: sourceDataUrl });
        return;
      }

      const trimW = maxX - minX + 1;
      const trimH = maxY - minY + 1;

      const trimmedCanvas = document.createElement('canvas');
      trimmedCanvas.width = trimW;
      trimmedCanvas.height = trimH;
      const tCtx = trimmedCanvas.getContext('2d');
      if (!tCtx) {
        resolve({ trimmedUrl: sourceDataUrl });
        return;
      }

      tCtx.drawImage(canvas, minX, minY, trimW, trimH, 0, 0, trimW, trimH);
      resolve({
        trimmedUrl: trimmedCanvas.toDataURL('image/png'),
        bounds: { x: minX, y: minY, width: trimW, height: trimH },
      });
    };
    img.onerror = reject;
    img.src = sourceDataUrl;
  });
}

/**
 * Converts white and near-white background pixels to transparent alpha (Chroma-key)
 */
export function createTransparentVersion(sourceDataUrl: string, threshold = 235): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(sourceDataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a === 0) continue;

        if (r >= threshold && g >= threshold && b >= threshold) {
          data[i + 3] = 0; // 100% transparent
        } else if (r >= threshold - 30 && g >= threshold - 30 && b >= threshold - 30) {
          const minChannel = Math.min(r, g, b);
          const ratio = Math.max(0, Math.min(1, (threshold - minChannel) / 30));
          data[i + 3] = Math.round(a * ratio);
        }
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = sourceDataUrl;
  });
}

/**
 * Invert image colors (for white QR on black background)
 */
export function createInvertedVersion(sourceDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(sourceDataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = sourceDataUrl;
  });
}
