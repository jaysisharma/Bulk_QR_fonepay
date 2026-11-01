import React, { useEffect, useRef, useState } from 'react';
import {
  SHEET_COLS,
  SHEET_ROWS,
  SHEET_CELL_WIDTH_INCH,
  SHEET_CELL_HEIGHT_INCH,
  DEFAULT_CUT_LINE_THICKNESS_PT,
  BULK_MIN_ZOOM,
  BULK_MAX_ZOOM,
  type BulkQrItem,
  type SavedLayoutState,
  type TemplateInfo,
  type BulkSheetConfig,
  type UploadedQrInfo,
} from '../types';
import { getQrItemForSlot, getActiveQrUrlForBulkItem, slotHasCard } from '../utils/bulkExportUtils';
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
  /** View offset in screen px (applied before the zoom) */
  pan?: { x: number; y: number };
  /** Mouse wheel zoom / drag-to-pan report the new view here */
  onViewChange?: (zoom: number, pan: { x: number; y: number }) => void;
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
  pan = { x: 0, y: 0 },
  onViewChange,
}) => {
  const viewportRef = useRef<HTMLElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  // Latest view for the native wheel listener (registered once)
  const viewRef = useRef({ zoom, pan, onViewChange });
  viewRef.current = { zoom, pan, onViewChange };

  // Mouse wheel zooms toward the cursor. Native listener so preventDefault works (React wheel is passive).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      const { zoom: z, pan: p, onViewChange: report } = viewRef.current;
      if (!report) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      const nextZoom = Math.min(BULK_MAX_ZOOM, Math.max(BULK_MIN_ZOOM, z * factor));
      if (nextZoom === z) return;
      // Sheet is centred in the viewport and scaled from its centre, so keep the point under the cursor fixed
      const rect = el.getBoundingClientRect();
      const ox = e.clientX - (rect.left + rect.width / 2 + p.x);
      const oy = e.clientY - (rect.top + rect.height / 2 + p.y);
      const k = 1 - nextZoom / z;
      report(Number(nextZoom.toFixed(4)), { x: p.x + ox * k, y: p.y + oy * k });
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Drag anywhere on the sheet/background to pan 
  const handlePanStart = (e: React.MouseEvent) => {
    if (!onViewChange || e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPan = pan;
    setIsPanning(true);
    const handleMove = (ev: MouseEvent) => {
      const { zoom: z, onViewChange: report } = viewRef.current;
      report?.(z, { x: startPan.x + ev.clientX - startX, y: startPan.y + ev.clientY - startY });
    };
    const handleUp = () => {
      setIsPanning(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

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
  const cutLinePt = config.cutLineThicknessPt ?? DEFAULT_CUT_LINE_THICKNESS_PT;
  const totalSlotsPerSheet = cols * rows;

  const cardW = layout.cardWidth || SHEET_CELL_WIDTH_INCH;
  const cardH = layout.cardHeight || SHEET_CELL_HEIGHT_INCH;

  const sheetW = config.sheetWidthInch || Number((cols * cardW).toFixed(4));
  const sheetH = config.sheetHeightInch || Number((rows * cardH).toFixed(4));

  const cellW = Number((sheetW / cols).toFixed(4));
  const cellH = Number((sheetH / rows).toFixed(4));
  // Slots can differ from the card size (sheet presets); scale the QR with the template so it stays in place
  const scaleX = cellW / cardW;
  const scaleY = cellH / cardH;

  const totalSheets = Math.max(1, Math.ceil(bulkQrs.length / totalSlotsPerSheet));
  const activeSheet = config.activeSheetIndex;

  return (
    <main
      ref={viewportRef}
      onMouseDown={handlePanStart}
      className={`flex-1 relative overflow-hidden p-8 flex items-center justify-center bg-[radial-gradient(#1e2230_1px,transparent_1px)] [background-size:20px_20px] ${
        isPanning ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      title="Scroll to zoom • drag to move the view"
    >
      <div
        id="printable-card-wrapper"
        className="flex items-center justify-center shrink-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
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
            {template.url && layout.templateLayer === 'front' && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                Template in FRONT (may cover QRs)
              </span>
            )}
          </div>

          {/* Quick Action Bar for Bulk Mode (Non-blocking) */}
          <div
            className="absolute top-3 right-3 z-30 flex items-center gap-2 print:hidden print-hide"
            onMouseDown={(e) => e.stopPropagation()}
          >
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
              config.showCutGuides ? 'border-dashed border-slate-500/85' : ''
            }`}
            style={{
              borderWidth: config.showCutGuides ? `${cutLinePt}pt 0 0 ${cutLinePt}pt` : undefined,
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
                  className="relative overflow-hidden box-border group transition-colors"
                  style={{
                    width: `${cellW}in`,
                    height: `${cellH}in`,
                    backgroundColor: effectiveBgColor,
                  }}
                  title={`Slot #${globalSlotIndex + 1} (Col ${col + 1}, Row ${row + 1})${qrItem ? `: ${qrItem.name}` : ''}`}
                >
                  {/* Background Template Image - shown on all card cells if configured */}
                  {template.url && layout.showTemplateImage !== false && slotHasCard(qrItem, bulkQrs, customQr) && (
                    <img
                      src={template.url}
                      alt="Template"
                      className="absolute inset-0 w-full h-full object-fill pointer-events-none block select-none"
                      style={{ zIndex: layout.templateLayer === 'front' ? 2 : 0 }}
                      draggable={false}
                    />
                  )}

                  {/* QR Code Overlay (view only; position/size is edited in the Single Card designer) */}
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
                        left: `${layout.qrX * scaleX}in`,
                        top: `${layout.qrY * scaleY}in`,
                        width: `${layout.qrWidth * scaleX}in`,
                        height: `${layout.qrHeight * scaleY}in`,
                        boxSizing: 'border-box',
                        zIndex: 1,
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
                      className="absolute inset-0 pointer-events-none z-15 border-dashed border-slate-500/85 print:border-black"
                      style={{ borderWidth: `0 ${cutLinePt}pt ${cutLinePt}pt 0` }}
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
