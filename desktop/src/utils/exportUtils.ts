import { jsPDF } from 'jspdf';
import { TARGET_WIDTH_INCH, TARGET_HEIGHT_INCH, type BgType, type PageBgType } from '../types';

export interface ExportCardOptions {
  dpi?: number;
  templateUrl: string | null;
  activeQrImageUrl: string | null;
  qrX: number;
  qrY: number;
  qrWidth: number;
  qrHeight: number;
  bgType: BgType;
  qrColor: string;
  innerPaddingPx: number;
  pageBg?: PageBgType;
  pageBgColor?: string;
  showTemplateImage?: boolean;
  allowFallbackQr?: boolean;
  cardWidth?: number;
  cardHeight?: number;
}

/**
 * Loads an image from a Data URL or URL into an HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Failed to load image for export: ${err}`));
    img.src = src;
  });
}

/**
 * Returns an SVG string of the fallback sample QR code
 */
function getSampleQrSvgString(fillColor: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" fill="${fillColor}">
    <rect x="5" y="5" width="28" height="28" rx="2" fill="none" stroke="${fillColor}" stroke-width="6" />
    <rect x="13" y="13" width="12" height="12" fill="${fillColor}" />
    <rect x="67" y="5" width="28" height="28" rx="2" fill="none" stroke="${fillColor}" stroke-width="6" />
    <rect x="75" y="13" width="12" height="12" fill="${fillColor}" />
    <rect x="5" y="67" width="28" height="28" rx="2" fill="none" stroke="${fillColor}" stroke-width="6" />
    <rect x="13" y="75" width="12" height="12" fill="${fillColor}" />
    <rect x="42" y="10" width="7" height="7" />
    <rect x="52" y="10" width="7" height="7" />
    <rect x="42" y="24" width="7" height="7" />
    <rect x="10" y="42" width="7" height="7" />
    <rect x="24" y="42" width="7" height="7" />
    <rect x="42" y="42" width="16" height="16" rx="1" />
    <rect x="68" y="42" width="7" height="7" />
    <rect x="80" y="42" width="7" height="7" />
    <rect x="42" y="68" width="7" height="7" />
    <rect x="55" y="68" width="7" height="7" />
    <rect x="68" y="68" width="8" height="8" />
    <rect x="80" y="80" width="8" height="8" />
    <rect x="68" y="80" width="7" height="7" />
  </svg>`;
}

/**
 * Triggers a client-side file download for a Blob
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Composite the entire card (template + QR overlay) onto a high-resolution offscreen canvas
 */
export async function renderCompositeCanvas(options: ExportCardOptions): Promise<HTMLCanvasElement> {
  const dpi = options.dpi || 600;
  const cardWidth = options.cardWidth || TARGET_WIDTH_INCH;
  const cardHeight = options.cardHeight || TARGET_HEIGHT_INCH;
  const canvasWidth = Math.round(cardWidth * dpi);
  const canvasHeight = Math.round(cardHeight * dpi);

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not obtain 2D canvas context for rendering.');
  }

  // Enable high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Draw Page Background (Default pure white for printing)
  const pageBg = options.pageBg || 'white';
  const effectivePageColor =
    pageBg === 'white'
      ? '#ffffff'
      : pageBg === 'dark'
      ? '#0f172a'
      : pageBg === 'custom'
      ? options.pageBgColor || '#ffffff'
      : 'transparent';

  if (effectivePageColor !== 'transparent') {
    ctx.fillStyle = effectivePageColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // 2. Draw Template Background (if present and not hidden)
  const shouldDrawTemplate = options.templateUrl && options.showTemplateImage !== false;
  if (shouldDrawTemplate && options.templateUrl) {
    const templateImg = await loadImage(options.templateUrl);
    // Draw template to fill exact dimensions
    ctx.drawImage(templateImg, 0, 0, canvasWidth, canvasHeight);
  }

  // 2. Compute QR Pixel Coordinates (based on physical inches)
  const pxPerInch = canvasWidth / cardWidth;
  const qrX_px = options.qrX * pxPerInch;
  const qrY_px = options.qrY * pxPerInch;
  const qrW_px = options.qrWidth * pxPerInch;
  const qrH_px = options.qrHeight * pxPerInch;

  // 3. Draw QR Overlay only if active QR exists or fallback is explicitly requested
  const hasQr = !!options.activeQrImageUrl;
  const shouldRenderFallback = !hasQr && options.allowFallbackQr === true;

  if (hasQr || shouldRenderFallback) {
    if (options.bgType === 'white') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(qrX_px, qrY_px, qrW_px, qrH_px);
    } else if (options.bgType === 'black') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(qrX_px, qrY_px, qrW_px, qrH_px);
    }

    const scaleRatio = dpi / 96;
    const scaledPadding = options.innerPaddingPx * scaleRatio;
    const drawX = qrX_px + scaledPadding;
    const drawY = qrY_px + scaledPadding;
    const drawW = Math.max(1, qrW_px - (scaledPadding * 2));
    const drawH = Math.max(1, qrH_px - (scaledPadding * 2));

    if (options.activeQrImageUrl) {
      const qrImg = await loadImage(options.activeQrImageUrl);
      drawImageContained(ctx, qrImg, drawX, drawY, drawW, drawH);
    } else if (shouldRenderFallback) {
      const effectiveFill = options.bgType === 'black' ? '#ffffff' : options.qrColor;
      const svgStr = getSampleQrSvgString(effectiveFill);
      const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
      const qrImg = await loadImage(svgUrl);
      drawImageContained(ctx, qrImg, drawX, drawY, drawW, drawH);
    }
  }

  return canvas;
}

/**
 * Draws an image into a bounding box, preserving its natural aspect ratio (contained & centered)
 */
function drawImageContained(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
): void {
  const imgW = img.naturalWidth || img.width || 1;
  const imgH = img.naturalHeight || img.height || 1;
  const imgAspect = imgW / imgH;
  const boxAspect = boxW / boxH;

  let fitW = boxW;
  let fitH = boxH;
  let fitX = boxX;
  let fitY = boxY;

  if (imgAspect > boxAspect) {
    fitW = boxW;
    fitH = boxW / imgAspect;
    fitX = boxX;
    fitY = boxY + (boxH - fitH) / 2;
  } else {
    fitH = boxH;
    fitW = boxH * imgAspect;
    fitX = boxX + (boxW - fitW) / 2;
    fitY = boxY;
  }

  ctx.drawImage(img, fitX, fitY, fitW, fitH);
}

/**
 * Export the composite card as a high-resolution PNG
 */
export async function exportCardAsPng(
  options: ExportCardOptions,
  filename = 'qr-card-template.png'
): Promise<void> {
  const canvas = await renderCompositeCanvas(options);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create PNG blob.'));
        return;
      }
      triggerBlobDownload(blob, filename);
      resolve();
    }, 'image/png');
  });
}

/**
 * Export the composite card as a print-ready PDF matching 4.2035" × 6.7035"
 */
export async function exportCardAsPdf(
  options: ExportCardOptions,
  filename = 'qr-card-template.pdf'
): Promise<void> {
  // Render at 600 DPI for ultra-crisp print quality
  const exportDpi = Math.max(300, options.dpi || 600);
  const cardWidth = options.cardWidth || TARGET_WIDTH_INCH;
  const cardHeight = options.cardHeight || TARGET_HEIGHT_INCH;

  const canvas = await renderCompositeCanvas({ ...options, dpi: exportDpi });
  const imgDataUrl = canvas.toDataURL('image/png');

  const pdf = new jsPDF({
    orientation: cardWidth > cardHeight ? 'landscape' : 'portrait',
    unit: 'in',
    format: [cardWidth, cardHeight],
  });

  pdf.addImage(imgDataUrl, 'PNG', 0, 0, cardWidth, cardHeight);
  pdf.save(filename);
}

/**
 * Copy the composite card image directly to clipboard
 */
export async function copyCardToClipboard(options: ExportCardOptions): Promise<boolean> {
  try {
    const canvas = await renderCompositeCanvas({ ...options, dpi: 300 });
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          resolve(false);
          return;
        }
        try {
          if (navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob }),
            ]);
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (e) {
          console.error('Clipboard copy error:', e);
          resolve(false);
        }
      }, 'image/png');
    });
  } catch (err) {
    console.error('Failed copying to clipboard:', err);
    return false;
  }
}
