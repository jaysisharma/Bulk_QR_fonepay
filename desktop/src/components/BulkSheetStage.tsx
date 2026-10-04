import React from 'react';
import {
  SHEET_COLS,
  SHEET_ROWS,
  SHEET_TOTAL_SLOTS,
  SHEET_WIDTH_INCH,
  SHEET_HEIGHT_INCH,
  SHEET_CELL_WIDTH_INCH,
  SHEET_CELL_HEIGHT_INCH,
  type BulkQrItem,
  type SavedLayoutState,
  type TemplateInfo,
  type BulkSheetConfig,
  type UploadedQrInfo,
} from '../types';
import { getQrItemForSlot, getActiveQrUrlForBulkItem } from '../utils/bulkExportUtils';
import { Maximize2, Sparkles, FileImage, FileText } from 'lucide-react';

interface BulkSheetStageProps {
  zoom: number;
  layout: SavedLayoutState;
  template: TemplateInfo;
  bulkQrs: BulkQrItem[];
  customQr?: UploadedQrInfo | null;
  config: BulkSheetConfig;
  onOpenBulkPicker: () => void;
  onOpenMultiPagePdfPicker?: () => void;
  onLoadSample132?: () => void;
  onSelectSlot?: (globalIndex: number) => void;
}

export const BulkSheetStage: React.FC<BulkSheetStageProps> = ({
  zoom,
  layout,
  template,
  bulkQrs,
  customQr,
  config,
  onOpenBulkPicker,
  onOpenMultiPagePdfPicker,
  onLoadSample132,
  onSelectSlot,
}) => {
  const isWhitePage = layout.pageBg === 'white';
  const effectiveBgColor =
    isWhitePage
      ? '#ffffff'
      : layout.pageBg === 'dark'
      ? '#0f172a'
      : layout.pageBg === 'custom'
      ? layout.pageBgColor || '#ffffff'
      : 'transparent';

  const cols = config.sheetCols || SHEET_COLS;
  const rows = config.sheetRows || SHEET_ROWS;
  const totalSlotsPerSheet = cols * rows;

  const cardW = layout.cardWidth || SHEET_CELL_WIDTH_INCH;
  const cardH = layout.cardHeight || SHEET_CELL_HEIGHT_INCH;

  const sheetW = config.sheetWidthInch || Number((cols * cardW).toFixed(4));
  const sheetH = config.sheetHeightInch || Number((rows * cardH).toFixed(4));

  const cellW = Number((sheetW / cols).toFixed(4));
  const cellH = Number((sheetH / rows).toFixed(4));

  const totalSheets = Math.max(1, Math.ceil(bulkQrs.length / totalSlotsPerSheet));
  const activeSheet = config.activeSheetIndex;

  return (
    <main className="flex-1 relative overflow-auto p-8 flex items-center justify-center bg-[radial-gradient(#1e2230_1px,transparent_1px)] [background-size:20px_20px]">
      <div
        id="printable-card-wrapper"
        className="flex items-center justify-center shrink-0"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
      >
        {/* Bulk Sheet Container */}
        <div
          id="printable-bulk-sheet"
          className="relative select-none shadow-2xl transition-all"
          style={{
            width: `${sheetW}in`,
            height: `${sheetH}in`,
            minWidth: `${sheetW}in`,
            minHeight: `${sheetH}in`,
            maxWidth: `${sheetW}in`,
            maxHeight: `${sheetH}in`,
            backgroundColor: effectiveBgColor,
            boxSizing: 'border-box',
          }}
        >
          {/* Sheet Dimension Header Badge */}
          <div className="absolute top-3 left-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/90 backdrop-blur-md border border-slate-800 text-xs font-mono text-slate-200 shadow-xl pointer-events-none print:hidden print-hide">
            <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold text-white">
              {sheetW}&quot; × {sheetH}&quot;
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-emerald-400">
              {cols} Cols × {rows} Rows ({totalSlotsPerSheet} Cards)
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-indigo-300">
              Sheet {activeSheet + 1} of {totalSheets}
            </span>
            {bulkQrs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px]">
                {bulkQrs.length} QRs Loaded
              </span>
            )}
            {bulkQrs.length === 0 && customQr && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                Showing Single Card QR (Repeated)
              </span>
            )}
          </div>

          {/* Quick Action Bar for Bulk Mode (Non-blocking) */}
          <div className="absolute top-3 right-3 z-30 flex items-center gap-2 print:hidden print-hide">
            <button
              type="button"
              onClick={onOpenBulkPicker}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              <FileImage className="w-3.5 h-3.5" />
              <span>Select QR Images</span>
            </button>

            {onOpenMultiPagePdfPicker && (
              <button
                type="button"
                onClick={onOpenMultiPagePdfPicker}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-rose-400" />
                <span>Multi-Page PDF</span>
              </button>
            )}

            {onLoadSample132 && (
              <button
                type="button"
                onClick={onLoadSample132}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-medium transition cursor-pointer"
                title="Populate sample QR codes to test grid layout immediately"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Load Sample QRs</span>
              </button>
            )}
          </div>

          {/* Dynamic Columns × Rows Grid */}
          <div
            className={`w-full h-full grid ${
              config.showCutGuides ? 'border-t-2 border-l-2 border-dashed border-slate-500/85' : ''
            }`}
            style={{
              gridTemplateColumns: `repeat(${cols}, ${cellW}in)`,
              gridTemplateRows: `repeat(${rows}, ${cellH}in)`,
            }}
          >
            {Array.from({ length: totalSlotsPerSheet }).map((_, slotIndex) => {
              const globalSlotIndex = activeSheet * totalSlotsPerSheet + slotIndex;
              const qrItem = getQrItemForSlot(globalSlotIndex, bulkQrs, config.fillStrategy, customQr);
              const activeQrUrl = getActiveQrUrlForBulkItem(qrItem, layout);
              const col = slotIndex % cols;
              const row = Math.floor(slotIndex / cols);

              return (
                <div
                  key={slotIndex}
                  onClick={() => onSelectSlot && onSelectSlot(globalSlotIndex)}
                  className="relative overflow-hidden box-border group cursor-pointer transition-colors"
                  style={{
                    width: `${cellW}in`,
                    height: `${cellH}in`,
                    backgroundColor: effectiveBgColor,
                  }}
                  title={`Slot #${globalSlotIndex + 1} (Col ${col + 1}, Row ${row + 1})${qrItem ? `: ${qrItem.name}` : ''}`}
                >
                  {/* Background Template Image - shown on all card cells if configured */}
                  {template.url && layout.showTemplateImage !== false && (
                    <img
                      src={template.url}
                      alt="Template"
                      className="absolute inset-0 w-full h-full object-fill pointer-events-none block select-none"
                      draggable={false}
                    />
                  )}

                  {/* QR Code Overlay (rendered when an active QR is placed in this slot) */}
                  {activeQrUrl && (
                    <div
                      className={`absolute flex flex-col items-center justify-center ${
                        layout.bgType === 'white'
                          ? 'bg-white'
                          : layout.bgType === 'black'
                          ? 'bg-black'
                          : 'bg-transparent'
                      }`}
                      style={{
                        left: `${layout.qrX}in`,
                        top: `${layout.qrY}in`,
                        width: `${layout.qrWidth}in`,
                        height: `${layout.qrHeight}in`,
                        boxSizing: 'border-box',
                      }}
                    >
                      <div
                        className="w-full h-full flex items-center justify-center overflow-hidden"
                        style={{ padding: `${layout.innerPaddingPx}px` }}
                      >
                        <img
                          src={activeQrUrl}
                          alt={`QR #${globalSlotIndex + 1}`}
                          className="pointer-events-none block select-none"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            width: 'auto',
                            height: 'auto',
                            objectFit: 'contain',
                          }}
                          draggable={false}
                        />
                      </div>
                    </div>
                  )}

                  {/* High-visibility Cut Guide Overlay on top of card content */}
                  {config.showCutGuides && (
                    <div
                      className="absolute inset-0 pointer-events-none z-15 border-r-2 border-b-2 border-dashed border-slate-500/85 print:border-black"
                    />
                  )}

                  {/* Slot Number Badge */}
                  {config.showSlotNumbers && (
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[9px] font-mono text-slate-300 pointer-events-none z-10 print:hidden print-hide">
                      #{globalSlotIndex + 1}
                    </div>
                  )}

                  {/* Cell Hover Highlight */}
                  <div className="absolute inset-0 border-2 border-transparent group-hover:border-indigo-500/80 pointer-events-none transition-colors z-20 print:hidden print-hide" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
};
