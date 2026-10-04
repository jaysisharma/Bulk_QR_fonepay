import React from 'react';
import {
  Grid3x3,
  FileImage,
  FileText,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Scissors,
  Hash,
  Loader2,
  Sparkles,
  Copy,
  FolderTree,
} from 'lucide-react';
import {
  SHEET_TOTAL_SLOTS,
  SHEET_WIDTH_INCH,
  SHEET_HEIGHT_INCH,
  type BulkQrItem,
  type BulkSheetConfig,
  type SavedLayoutState,
  type UploadedQrInfo,
} from '../types';

interface BulkManagerSidebarProps {
  bulkQrs: BulkQrItem[];
  customQr?: UploadedQrInfo | null;
  layout: SavedLayoutState;
  config: BulkSheetConfig;
  isProcessing: boolean;
  processingProgress: { message: string; percent: number } | null;
  onOpenMultiFilePicker: () => void;
  onOpenMultiPagePdfPicker: () => void;
  onUseSingleCardQr?: () => void;
  onLoadSample132?: () => void;
  onClearBulkQrs: () => void;
  onRemoveQrItem: (id: string) => void;
  onUpdateConfig: (newConfig: Partial<BulkSheetConfig>) => void;
  onOpenBulkExportModal?: () => void;
  onDirectPrint?: () => void;
  onOpenFolderSplitter?: () => void;
}

export const BulkManagerSidebar: React.FC<BulkManagerSidebarProps> = ({
  bulkQrs,
  customQr,
  config,
  isProcessing,
  processingProgress,
  onOpenMultiFilePicker,
  onOpenMultiPagePdfPicker,
  onUseSingleCardQr,
  onLoadSample132,
  onClearBulkQrs,
  onRemoveQrItem,
  onUpdateConfig,
  onOpenFolderSplitter,
}) => {
  const effectiveTotalQrs = bulkQrs.length > 0 ? bulkQrs.length : (customQr ? 1 : 0);
  const totalSheets = Math.max(1, Math.ceil(Math.max(1, bulkQrs.length) / SHEET_TOTAL_SLOTS));
  const activeSheet = config.activeSheetIndex;

  return (
    <aside className="w-[310px] min-w-[310px] max-w-[310px] shrink-0 border-l border-slate-800/80 bg-slate-950/70 backdrop-blur-md flex flex-col h-full z-20 overflow-y-auto font-sans text-xs">
      {/* Sidebar Header */}
      <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Grid3x3 className="w-3.5 h-3.5 text-indigo-400" />
          <h2 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Sheet Layout</h2>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          11×12 Grid
        </span>
      </div>

      <div className="p-3.5 space-y-4 flex-1 flex flex-col min-h-0">
        {/* Compact Sheet Summary */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white">{effectiveTotalQrs}</span>
            <span className="text-[11px] text-slate-400">/ 132 slots</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/50">
              {totalSheets} {totalSheets === 1 ? 'Sheet' : 'Sheets'}
            </span>
            <span>•</span>
            <span>{SHEET_WIDTH_INCH}&quot;×{SHEET_HEIGHT_INCH}&quot;</span>
          </div>
        </div>

        {/* Multi-Sheet Pager */}
        {totalSheets > 1 && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] text-slate-300 font-medium">
              Sheet {activeSheet + 1} of {totalSheets}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onUpdateConfig({ activeSheetIndex: Math.max(0, activeSheet - 1) })}
                disabled={activeSheet === 0}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition cursor-pointer"
                title="Previous Sheet"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onUpdateConfig({ activeSheetIndex: Math.min(totalSheets - 1, activeSheet + 1) })}
                disabled={activeSheet === totalSheets - 1}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition cursor-pointer"
                title="Next Sheet"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Section 1: Add QR Codes */}
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Add QR Codes
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenMultiFilePicker}
              disabled={isProcessing}
              className="flex items-center justify-center gap-2 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/40 text-slate-200 transition cursor-pointer disabled:opacity-50 text-[11px] font-medium"
            >
              <FileImage className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Select Files</span>
            </button>
            <button
              type="button"
              onClick={onOpenMultiPagePdfPicker}
              disabled={isProcessing}
              className="flex items-center justify-center gap-2 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/40 text-slate-200 transition cursor-pointer disabled:opacity-50 text-[11px] font-medium"
            >
              <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Multi-Page PDF</span>
            </button>
          </div>

          {/* Folder Splitter Tool Trigger */}
          {onOpenFolderSplitter && (
            <button
              type="button"
              onClick={onOpenFolderSplitter}
              className="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-500/30 hover:border-indigo-500/60 text-indigo-300 hover:text-indigo-100 transition cursor-pointer text-[11px] font-medium shadow-sm"
              title="Split 500, 600, 1000+ files into 132 files per folder (A, B, C...)"
            >
              <FolderTree className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Split Folder into 132s (A, B, C...)</span>
            </button>
          )}

          {(customQr || onLoadSample132) && (
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              {customQr && onUseSingleCardQr && (
                <button
                  type="button"
                  onClick={onUseSingleCardQr}
                  className="flex items-center justify-center gap-1.5 p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[10px] font-medium transition cursor-pointer"
                  title="Fill slots using QR from Single Card designer"
                >
                  <Copy className="w-3 h-3 text-indigo-400" />
                  <span>Use Single QR</span>
                </button>
              )}
              {onLoadSample132 && (
                <button
                  type="button"
                  onClick={onLoadSample132}
                  className={`flex items-center justify-center gap-1.5 p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-300 hover:text-amber-200 text-[10px] font-medium transition cursor-pointer ${
                    !customQr ? 'col-span-2' : ''
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Load 132 Samples</span>
                </button>
              )}
            </div>
          )}

          {/* Processing Progress Bar */}
          {isProcessing && processingProgress && (
            <div className="p-2 rounded-lg bg-indigo-950/40 border border-indigo-500/30 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-indigo-300">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                  <span className="truncate max-w-[190px]">{processingProgress.message}</span>
                </span>
                <span className="font-mono text-[10px] text-indigo-400">
                  {processingProgress.percent}%
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                <div
                  className="bg-indigo-500 h-full transition-all duration-150"
                  style={{ width: `${processingProgress.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Sheet Options */}
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Sheet Options
          </div>
          <div className="space-y-1.5">
            {/* Cut Guides */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2">
                <Scissors className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] text-slate-200">Cut Guides</span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateConfig({ showCutGuides: !config.showCutGuides })}
                className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${
                  config.showCutGuides ? 'bg-indigo-600' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white transition-transform absolute top-0.5 ${
                    config.showCutGuides ? 'left-4.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Slot Numbers */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] text-slate-200">Slot Numbers</span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateConfig({ showSlotNumbers: !config.showSlotNumbers })}
                className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${
                  config.showSlotNumbers ? 'bg-indigo-600' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white transition-transform absolute top-0.5 ${
                    config.showSlotNumbers ? 'left-4.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Underfilled Slots */}
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="text-[10px] text-slate-400">If under 132 QRs:</div>
              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-0.5 rounded-md border border-slate-800/80">
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ fillStrategy: 'blank' })}
                  className={`py-1 text-[11px] rounded transition cursor-pointer font-medium ${
                    config.fillStrategy === 'blank'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Leave Blank
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ fillStrategy: 'repeat' })}
                  className={`py-1 text-[11px] rounded transition cursor-pointer font-medium ${
                    config.fillStrategy === 'repeat'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Repeat QRs
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Queue List */}
        <div className="space-y-2 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Queue ({bulkQrs.length})
            </span>
            {bulkQrs.length > 0 && (
              <button
                type="button"
                onClick={onClearBulkQrs}
                className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline transition cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {bulkQrs.length === 0 ? (
            <div className="p-4 rounded-lg bg-slate-900/40 border border-dashed border-slate-800 text-center text-[11px] text-slate-500">
              No QR codes loaded yet.
            </div>
          ) : (
            <div className="flex-1 max-h-56 overflow-y-auto space-y-1 pr-1 rounded-lg bg-slate-900/30 p-1 border border-slate-800/60">
              {bulkQrs.slice(0, 150).map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-1.5 rounded bg-slate-950/80 border border-slate-800/80 text-[11px] group hover:border-slate-700"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[10px] font-mono text-slate-500 w-5 shrink-0 text-right">
                      #{idx + 1}
                    </span>
                    <img
                      src={item.trimmedUrl || item.rawUrl}
                      alt={item.name}
                      className="w-5 h-5 rounded bg-white object-contain shrink-0"
                    />
                    <span className="text-slate-300 truncate" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveQrItem(item.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer opacity-0 group-hover:opacity-100"
                    title="Remove QR"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {bulkQrs.length > 150 && (
                <div className="text-center text-[10px] text-slate-500 py-1 font-mono">
                  + {bulkQrs.length - 150} more QRs
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
