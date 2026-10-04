import { jsPDF } from 'jspdf';
import {
  SHEET_COLS,
  SHEET_ROWS,
  SHEET_CELL_WIDTH_INCH,
  SHEET_CELL_HEIGHT_INCH,
  type BulkQrItem,
  type SavedLayoutState,
  type TemplateInfo,
  type UploadedQrInfo,
} from '../types';
import { renderCompositeCanvas, triggerBlobDownload } from './exportUtils';

export interface BulkExportOptions {
  layout: SavedLayoutState;
  template: TemplateInfo;
  bulkQrs: BulkQrItem[];
  showCutGuides: boolean;
  showSlotNumbers: boolean;
  fillStrategy: 'blank' | 'repeat';
  activeSheetIndex?: number;
  exportAllSheets?: boolean;
  customQr?: UploadedQrInfo | null;
  dpi?: number;
  onProgress?: (msg: string, percent: number) => void;
  sheetWidthInch?: number;
  sheetHeightInch?: number;
  sheetCols?: number;
  sheetRows?: number;
  cardWidthInch?: number;
  cardHeightInch?: number;
}

/**
 * Returns the effective active QR image URL for a bulk QR item given the layout settings
 */
export function getActiveQrUrlForBulkItem(
  item: BulkQrItem | null | undefined,
  layout: SavedLayoutState
): string | null {
  if (!item) return null;
  if (layout.bgType === 'transparent') {
    return item.transparentUrl;
  }
  if (layout.bgType === 'black' && layout.invertOnBlack) {
    return item.invertedUrl;
  }
  return layout.autoTrimMargins ? item.trimmedUrl : item.rawUrl;
}

/**
 * Resolves which BulkQrItem goes into a given slot index
 */
export function getQrItemForSlot(
  slotIndex: number,
  bulkQrs: BulkQrItem[],
  fillStrategy: 'blank' | 'repeat',
  customQr?: UploadedQrInfo | null
): BulkQrItem | null {
  if (bulkQrs.length > 0) {
    if (slotIndex < bulkQrs.length) {
      return bulkQrs[slotIndex];
    }
    if (fillStrategy === 'repeat') {
      return bulkQrs[slotIndex % bulkQrs.length];
    }
    return null;
  }
  if (customQr) {
    return {
      id: 'custom_single_qr',
      name: customQr.name,
      rawUrl: customQr.rawOriginalUrl,
      trimmedUrl: customQr.trimmedOriginalUrl,
      transparentUrl: customQr.transparentUrl,
      invertedUrl: customQr.invertedUrl,
    };
  }
  return null;
}

/**
 * Export the 46.2" × 80.4444" Bulk Sheet as a Print-Ready PDF
 * Uses cell-by-cell rendering to avoid huge single-canvas memory overhead.
 */
export async function exportBulkSheetAsPdf(
  options: BulkExportOptions,
  filename = 'bulk-132-qr-sheet.pdf'
): Promise<void> {
  const {
    layout,
    template,
    bulkQrs,
    showCutGuides,
    showSlotNumbers,
    fillStrategy,
    activeSheetIndex = 0,
    exportAllSheets = false,
    customQr,
    dpi: exportDpi = 450,
    onProgress,
  } = options;

  const cols = options.sheetCols || SHEET_COLS;
  const rows = options.sheetRows || SHEET_ROWS;
  const totalSlotsPerSheet = cols * rows;

  const cardW = options.cardWidthInch || layout.cardWidth || SHEET_CELL_WIDTH_INCH;
  const cardH = options.cardHeightInch || layout.cardHeight || SHEET_CELL_HEIGHT_INCH;

  const sheetW = options.sheetWidthInch || Number((cols * cardW).toFixed(4));
  const sheetH = options.sheetHeightInch || Number((rows * cardH).toFixed(4));

  const cellW = Number((sheetW / cols).toFixed(4));
  const cellH = Number((sheetH / rows).toFixed(4));

  const totalSheets = Math.max(1, Math.ceil(bulkQrs.length / totalSlotsPerSheet));
  const sheetIndicesToExport = exportAllSheets
    ? Array.from({ length: totalSheets }, (_, i) => i)
    : [activeSheetIndex];

  const pdf = new jsPDF({
    orientation: sheetW > sheetH ? 'landscape' : 'portrait',
    unit: 'in',
    format: [sheetW, sheetH],
  });

  for (let sIdx = 0; sIdx < sheetIndicesToExport.length; sIdx++) {
    const sheetNum = sheetIndicesToExport[sIdx];
    if (sIdx > 0) {
      pdf.addPage([sheetW, sheetH]);
    }

    // Set page background fill if configured
    const effectivePageColor =
      layout.pageBg === 'white'
        ? [255, 255, 255]
        : layout.pageBg === 'dark'
        ? [15, 23, 42]
        : [255, 255, 255];

    pdf.setFillColor(effectivePageColor[0], effectivePageColor[1], effectivePageColor[2]);
    pdf.rect(0, 0, sheetW, sheetH, 'F');

    // Pre-cache unique rendered cards to optimize speed
    const renderedCardCache = new Map<string, string>();

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const slotInSheet = row * cols + col;
        const globalSlotIndex = sheetNum * totalSlotsPerSheet + slotInSheet;
        const qrItem = getQrItemForSlot(globalSlotIndex, bulkQrs, fillStrategy, customQr);
        const cellX = col * cellW;
        const cellY = row * cellH;

        const activeQrUrl = qrItem ? getActiveQrUrlForBulkItem(qrItem, layout) : null;
        const hasCardToRender = activeQrUrl || (template.url && layout.showTemplateImage !== false);

        if (hasCardToRender) {
          const cacheKey = qrItem ? qrItem.id : '__empty_template_card__';
          let cardDataUrl = renderedCardCache.get(cacheKey);

          if (!cardDataUrl) {
            const cellCanvas = await renderCompositeCanvas({
              dpi: exportDpi, // Ultra-sharp print resolution per card (450 or 600 DPI)
              templateUrl: template.url,
              activeQrImageUrl: activeQrUrl,
              qrX: layout.qrX,
              qrY: layout.qrY,
              qrWidth: layout.qrWidth,
              qrHeight: layout.qrHeight,
              bgType: layout.bgType,
              qrColor: layout.qrColor,
              innerPaddingPx: layout.innerPaddingPx,
              pageBg: layout.pageBg,
              pageBgColor: layout.pageBgColor,
              showTemplateImage: layout.showTemplateImage,
              cardWidth: cellW,
              cardHeight: cellH,
            });
            cardDataUrl = cellCanvas.toDataURL('image/jpeg', 0.90);
            // Cache if card is repeated or empty template card to avoid re-rendering
            if (fillStrategy === 'repeat' || bulkQrs.length < 20 || !activeQrUrl) {
              renderedCardCache.set(cacheKey, cardDataUrl);
            }
          }

          // Draw card image into sheet cell via native JPEG stream
          pdf.addImage(
            cardDataUrl,
            'JPEG',
            cellX,
            cellY,
            cellW,
            cellH,
            undefined,
            'FAST'
          );

          // Optional slot numbering
          if (showSlotNumbers) {
            pdf.setFontSize(8);
            pdf.setTextColor(140, 140, 140);
            pdf.text(`#${globalSlotIndex + 1}`, cellX + 0.1, cellY + 0.18);
          }
        }

        const currentCount = sIdx * totalSlotsPerSheet + slotInSheet + 1;
        const totalItems = sheetIndicesToExport.length * totalSlotsPerSheet;
        if (onProgress) {
          onProgress(
            `Rendering Card ${currentCount} of ${totalItems}...`,
            Math.round((currentCount / totalItems) * 100)
          );
        }
      }
    }

    // Draw Cutting / Guillotine Guide Lines
    if (showCutGuides) {
      // High-visibility, crisp dashed cutting lines for plotter / guillotine trimming
      pdf.setDrawColor(60, 64, 75); // Dark slate for sharp contrast on light and dark backgrounds
      pdf.setLineWidth(0.015); // ~1.1 pt, clearly visible without bleeding
      pdf.setLineDashPattern([0.1, 0.05], 0);

      // Vertical column slicing lines
      for (let c = 1; c < cols; c++) {
        const x = c * cellW;
        pdf.line(x, 0, x, sheetH);
      }
      // Horizontal row slicing lines
      for (let r = 1; r < rows; r++) {
        const y = r * cellH;
        pdf.line(0, y, sheetW, y);
      }

      // Outer sheet trim perimeter border
      pdf.rect(0, 0, sheetW, sheetH, 'S');

      // Reset dash pattern
      pdf.setLineDashPattern([], 0);
    }
    renderedCardCache.clear();
  }

  if (onProgress) onProgress('Compiling PDF file...', 98);
  pdf.save(filename);
}

/**
 * Render a complete high-res canvas of the 46.2" × 80.4444" bulk sheet for PNG export
 */
export async function exportBulkSheetAsPng(
  options: BulkExportOptions,
  filename = 'bulk-132-qr-sheet.png',
  dpi = 100
): Promise<void> {
  const {
    layout,
    template,
    bulkQrs,
    showCutGuides,
    showSlotNumbers,
    fillStrategy,
    activeSheetIndex = 0,
    customQr,
    onProgress,
  } = options;

  const cols = options.sheetCols || SHEET_COLS;
  const rows = options.sheetRows || SHEET_ROWS;
  const totalSlotsPerSheet = cols * rows;

  const cardW = options.cardWidthInch || layout.cardWidth || SHEET_CELL_WIDTH_INCH;
  const cardH = options.cardHeightInch || layout.cardHeight || SHEET_CELL_HEIGHT_INCH;

  const sheetW = options.sheetWidthInch || Number((cols * cardW).toFixed(4));
  const sheetH = options.sheetHeightInch || Number((rows * cardH).toFixed(4));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sheetW * dpi);
  canvas.height = Math.round(sheetH * dpi);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D Canvas context unavailable');

  // Fill page background
  ctx.fillStyle = layout.pageBg === 'white' ? '#ffffff' : layout.pageBg === 'dark' ? '#0f172a' : '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cellWidthPx = canvas.width / cols;
  const cellHeightPx = canvas.height / rows;

  const cellWidthInch = Number((sheetW / cols).toFixed(4));
  const cellHeightInch = Number((sheetH / rows).toFixed(4));

  const renderedCardCache = new Map<string, HTMLCanvasElement>();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const slotInSheet = row * cols + col;
      const globalSlotIndex = activeSheetIndex * totalSlotsPerSheet + slotInSheet;
      const qrItem = getQrItemForSlot(globalSlotIndex, bulkQrs, fillStrategy, customQr);
      const cellX = col * cellWidthPx;
      const cellY = row * cellHeightPx;

      const activeQrUrl = qrItem ? getActiveQrUrlForBulkItem(qrItem, layout) : null;
      const hasCardToRender = activeQrUrl || (template.url && layout.showTemplateImage !== false);

      if (hasCardToRender) {
        const cacheKey = qrItem ? qrItem.id : '__empty_template_card__';
        let cellCanvas = renderedCardCache.get(cacheKey);

        if (!cellCanvas) {
          cellCanvas = await renderCompositeCanvas({
            dpi: 150,
            templateUrl: template.url,
            activeQrImageUrl: activeQrUrl,
            qrX: layout.qrX,
            qrY: layout.qrY,
            qrWidth: layout.qrWidth,
            qrHeight: layout.qrHeight,
            bgType: layout.bgType,
            qrColor: layout.qrColor,
            innerPaddingPx: layout.innerPaddingPx,
            pageBg: layout.pageBg,
            pageBgColor: layout.pageBgColor,
            showTemplateImage: layout.showTemplateImage,
            cardWidth: cellWidthInch,
            cardHeight: cellHeightInch,
          });
          renderedCardCache.set(cacheKey, cellCanvas);
        }

        ctx.drawImage(cellCanvas, cellX, cellY, cellWidthPx, cellHeightPx);

        if (showSlotNumbers) {
          ctx.fillStyle = 'rgba(100, 116, 139, 0.8)';
          ctx.font = '10px monospace';
          ctx.fillText(`#${globalSlotIndex + 1}`, cellX + 6, cellY + 14);
        }
      }

      if (onProgress) {
        onProgress(
          `Rendering slot ${slotInSheet + 1} of ${totalSlotsPerSheet}...`,
          Math.round(((slotInSheet + 1) / totalSlotsPerSheet) * 100)
        );
      }
    }
  }

  // Draw Cut Guides
  if (showCutGuides) {
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.85)';
    ctx.lineWidth = Math.max(3, Math.round(dpi / 40));
    ctx.setLineDash([Math.round(dpi / 12), Math.round(dpi / 24)]);

    for (let c = 1; c < cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellWidthPx, 0);
      ctx.lineTo(c * cellWidthPx, canvas.height);
      ctx.stroke();
    }
    for (let r = 1; r < rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellHeightPx);
      ctx.lineTo(canvas.width, r * cellHeightPx);
      ctx.stroke();
    }

    // Outer sheet border
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    ctx.setLineDash([]);
  }

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
