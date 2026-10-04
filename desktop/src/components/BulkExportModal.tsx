import React, { useState } from 'react';
import {
  X,
  Download,
  FileText,
  FileImage,
  Printer,
  Loader2,
  Check,
  Scissors,
  Hash,
} from 'lucide-react';
import {
  SHEET_COLS,
  SHEET_ROWS,
  SHEET_TOTAL_SLOTS,
  SHEET_WIDTH_INCH,
  SHEET_HEIGHT_INCH,
  type BulkQrItem,
  type SavedLayoutState,
  type TemplateInfo,
  type BulkSheetConfig,
  type UploadedQrInfo,
} from '../types';
import {
  exportBulkSheetAsPdf,
  exportBulkSheetAsPng,
  type BulkExportOptions,
} from '../utils/bulkExportUtils';

interface BulkExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  layout: SavedLayoutState;
  template: TemplateInfo;
  bulkQrs: BulkQrItem[];
  customQr?: UploadedQrInfo | null;
  config: BulkSheetConfig;
}

export const BulkExportModal: React.FC<BulkExportModalProps> = ({
  isOpen,
  onClose,
  layout,
  template,
  bulkQrs,
  customQr,
  config,
}) => {
  const [format, setFormat] = useState<'pdf' | 'png'>('pdf');
  const [filename, setFilename] = useState<string>('bulk-132-qr-sheet');
  const [exportAllSheets, setExportAllSheets] = useState<boolean>(true);
  const [showCutGuides, setShowCutGuides] = useState<boolean>(config.showCutGuides);
  const [showSlotNumbers, setShowSlotNumbers] = useState<boolean>(config.showSlotNumbers);
  const [pdfDpi, setPdfDpi] = useState<number>(300);
  const pngDpi = 100;
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalSheets = Math.max(1, Math.ceil(bulkQrs.length / SHEET_TOTAL_SLOTS));

  const handleExport = async () => {
    setIsExporting(true);
    setSuccessMsg(null);
    setProgressPercent(0);
    setProgressMsg('Preparing bulk sheet...');

    try {
      const exportOptions: BulkExportOptions = {
        layout,
        template,
        bulkQrs,
        customQr,
        showCutGuides,
        showSlotNumbers,
        fillStrategy: config.fillStrategy,
        activeSheetIndex: config.activeSheetIndex,
        exportAllSheets,
        dpi: pdfDpi,
        onProgress: (msg, percent) => {
          setProgressMsg(msg);
          setProgressPercent(percent);
        },
      };

      const fullFilename = `${filename.trim() || 'bulk-132-qr-sheet'}.${format}`;

      if (format === 'pdf') {
        await exportBulkSheetAsPdf(exportOptions, fullFilename);
      } else {
        await exportBulkSheetAsPng(exportOptions, fullFilename, pngDpi);
      }

      setSuccessMsg(`Successfully saved ${fullFilename}!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Bulk sheet export failed:', err);
      alert('Failed to export bulk sheet. Please try with fewer items or PDF format.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    onClose();
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-slate-100">
                Save & Export 132-QR Sheet
              </h2>
              <p className="text-[11px] text-slate-400">
                {SHEET_WIDTH_INCH}&quot; × {SHEET_HEIGHT_INCH}&quot; ({SHEET_COLS} Cols × {SHEET_ROWS} Rows = 132 Cards)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Format Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition cursor-pointer ${
                  format === 'pdf'
                    ? 'bg-indigo-600/15 border-indigo-500/60 text-white shadow-sm'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    format === 'pdf' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-medium">Print PDF (Recommended)</div>
                  <div className="text-[10px] text-slate-400">
                    Exact {SHEET_WIDTH_INCH}&quot; × {SHEET_HEIGHT_INCH}&quot;
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('png')}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition cursor-pointer ${
                  format === 'png'
                    ? 'bg-indigo-600/15 border-indigo-500/60 text-white shadow-sm'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    format === 'png' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <FileImage className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-medium">Raster PNG Poster</div>
                  <div className="text-[10px] text-slate-400">Full sheet bitmap</div>
                </div>
              </button>
            </div>
          </div>

          {/* Sheet Scope */}
          {totalSheets > 1 && format === 'pdf' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Sheets to Export ({bulkQrs.length} QRs total)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExportAllSheets(true)}
                  className={`p-2.5 rounded-xl border text-center text-xs transition cursor-pointer ${
                    exportAllSheets
                      ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  All {totalSheets} Sheets ({totalSheets * 132} slots)
                </button>
                <button
                  type="button"
                  onClick={() => setExportAllSheets(false)}
                  className={`p-2.5 rounded-xl border text-center text-xs transition cursor-pointer ${
                    !exportAllSheets
                      ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Sheet {config.activeSheetIndex + 1} Only (132 QRs)
                </button>
              </div>
            </div>
          )}

          {/* PDF Resolution Selector */}
          {format === 'pdf' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 uppercase tracking-wider">
                  PDF Print Quality / Resolution
                </span>
                <span className="font-mono text-indigo-400 text-[11px]">
                  {pdfDpi} DPI
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 200, label: '200 DPI', sub: 'Compact (~8 MB)' },
                  { value: 300, label: '300 DPI', sub: 'Standard (~15 MB)' },
                  { value: 450, label: '450 DPI', sub: 'High Res (~35 MB)' },
                  { value: 600, label: '600 DPI', sub: 'Ultra Sharp' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setPdfDpi(item.value)}
                    className={`p-2 rounded-lg border text-center transition cursor-pointer ${
                      pdfDpi === item.value
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-sm'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-medium">{item.label}</div>
                    <div className="text-[9px] text-slate-500">{item.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Options: Cut Guides & Slot Numbers */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowCutGuides((prev) => !prev)}
              className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition cursor-pointer ${
                showCutGuides
                  ? 'bg-indigo-600/15 border-indigo-500/50 text-indigo-200 font-medium'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5" />
                <span>Cut Guides</span>
              </span>
              <span className="text-[10px] font-mono">{showCutGuides ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSlotNumbers((prev) => !prev)}
              className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition cursor-pointer ${
                showSlotNumbers
                  ? 'bg-indigo-600/15 border-indigo-500/50 text-indigo-200 font-medium'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" />
                <span>Slot #s</span>
              </span>
              <span className="text-[10px] font-mono">{showSlotNumbers ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Filename Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              File Name
            </label>
            <div className="flex items-center bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs focus-within:border-indigo-500">
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="bulk-132-qr-sheet"
                className="bg-transparent flex-1 text-slate-200 outline-none"
              />
              <span className="text-slate-500 font-mono text-[11px]">.{format}</span>
            </div>
          </div>

          {/* Progress / Status Indicator */}
          {isExporting && (
            <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-500/30 space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs text-indigo-300">
                <span className="flex items-center gap-2 font-medium">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>{progressMsg}</span>
                </span>
                <span className="font-mono text-indigo-400">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-500 h-full transition-all duration-150"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center gap-2.5">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer shadow-lg shadow-emerald-600/20"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Exporting Sheet...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download {format.toUpperCase()} (46.2&quot; × 80.4&quot;)</span>
              </>
            )}
          </button>

          <button
            onClick={handlePrint}
            disabled={isExporting}
            title="Direct Print 46.2in × 80.4444in Sheet"
            className="flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 border border-slate-700 text-xs font-medium transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Sheet</span>
          </button>
        </div>
      </div>
    </div>
  );
};
