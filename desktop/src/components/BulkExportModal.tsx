import React, { useState, useRef } from 'react';
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
  Folder,
  FolderCheck,
  ExternalLink,
  Plus,
  Minus,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import {
  SHEET_COLS,
  SHEET_ROWS,
  DEFAULT_CUT_LINE_THICKNESS_PT,
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
import { triggerBlobDownload } from '../utils/exportUtils';

interface BulkExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  layout: SavedLayoutState;
  template: TemplateInfo;
  bulkQrs: BulkQrItem[];
  customQr?: UploadedQrInfo | null;
  config: BulkSheetConfig;
}

const DEST_FOLDER_KEY = 'bulk_export_dest_folder';
const FILE_COUNTER_KEY = 'bulk_export_file_counter';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1] || '';
        resolve(base64);
      } else {
        reject(new Error('Failed to convert blob to base64.'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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
  const [filename, setFilename] = useState<string>('bulk-qr-sheet');
  const [exportAllSheets, setExportAllSheets] = useState<boolean>(true);
  const [showCutGuides, setShowCutGuides] = useState<boolean>(config.showCutGuides);
  const [cutLineThicknessPt, setCutLineThicknessPt] = useState<number>(
    config.cutLineThicknessPt ?? DEFAULT_CUT_LINE_THICKNESS_PT
  );
  const [showSlotNumbers, setShowSlotNumbers] = useState<boolean>(config.showSlotNumbers);
  const [pdfDpi, setPdfDpi] = useState<number>(300);
  const pngDpi = 100;
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Destination folder & auto increment counter
  const [destFolder, setDestFolder] = useState<string>(() => {
    return localStorage.getItem(DEST_FOLDER_KEY) || '';
  });
  const [autoIncrement, setAutoIncrement] = useState<boolean>(true);
  const [fileCounter, setFileCounter] = useState<number>(() => {
    const saved = localStorage.getItem(FILE_COUNTER_KEY);
    return saved ? parseInt(saved, 10) || 1 : 1;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webDirHandleRef = useRef<any>(null);

  const isTauri =
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

  const cols = config.sheetCols ?? SHEET_COLS;
  const rows = config.sheetRows ?? SHEET_ROWS;
  const totalSlots = cols * rows;
  const cardW = layout.cardWidth ?? 4.2035;
  const cardH = layout.cardHeight ?? 6.7035;
  const sheetW = config.sheetWidthInch ?? Number((cols * cardW).toFixed(4));
  const sheetH = config.sheetHeightInch ?? Number((rows * cardH).toFixed(4));

  const totalSheets = Math.max(1, Math.ceil(bulkQrs.length / totalSlots));

  const baseName = filename.trim() || 'bulk-qr-sheet';
  const paddedCounter = String(Math.max(1, fileCounter)).padStart(3, '0');
  const previewFilename = autoIncrement
    ? `${baseName}_${paddedCounter}.${format}`
    : `${baseName}.${format}`;

  const handlePickDestFolder = async () => {
    try {
      if (isTauri) {
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Select Destination Folder for Bulk Exports',
          defaultPath: destFolder || undefined,
        });
        if (selected && typeof selected === 'string') {
          setDestFolder(selected);
          localStorage.setItem(DEST_FOLDER_KEY, selected);
        }
      } else if ('showDirectoryPicker' in window) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handle = await (window as any).showDirectoryPicker();
        webDirHandleRef.current = handle;
        const name = handle.name || 'Selected Folder';
        setDestFolder(name);
        localStorage.setItem(DEST_FOLDER_KEY, name);
      } else {
        alert('Directory selection is supported in Desktop App or Chromium browsers (Chrome, Edge).');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Failed to select destination folder:', err);
      }
    }
  };

  const handleClearDestFolder = () => {
    setDestFolder('');
    webDirHandleRef.current = null;
    localStorage.removeItem(DEST_FOLDER_KEY);
  };

  const handleOpenDestFolder = async () => {
    if (!destFolder) return;
    try {
      if (isTauri) {
        await invoke('open_folder_in_os', { folderPath: destFolder });
      }
    } catch (err) {
      console.error('Failed to open destination folder:', err);
    }
  };

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
        cutLineThicknessPt,
        showSlotNumbers,
        fillStrategy: config.fillStrategy,
        activeSheetIndex: config.activeSheetIndex,
        exportAllSheets,
        dpi: pdfDpi,
        sheetWidthInch: sheetW,
        sheetHeightInch: sheetH,
        sheetCols: cols,
        sheetRows: rows,
        cardWidthInch: cardW,
        cardHeightInch: cardH,
        onProgress: (msg, percent) => {
          setProgressMsg(msg);
          setProgressPercent(percent);
        },
      };

      const finalFilename = previewFilename;

      if (destFolder.trim()) {
        // Generate Blob without triggering default browser download popup
        const blob =
          format === 'pdf'
            ? await exportBulkSheetAsPdf(exportOptions, undefined)
            : await exportBulkSheetAsPng(exportOptions, undefined, pngDpi);

        if (isTauri) {
          setProgressMsg('Writing file to destination folder...');
          const base64 = await blobToBase64(blob);
          await invoke<string>('save_binary_file', {
            destinationFolder: destFolder.trim(),
            fileName: finalFilename,
            base64Data: base64,
          });
        } else if (webDirHandleRef.current) {
          setProgressMsg('Saving file via File System API...');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fileHandle = await webDirHandleRef.current.getFileHandle(finalFilename, {
            create: true,
          });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
        } else {
          // Fallback to browser download if folder path was typed manually in browser
          triggerBlobDownload(blob, finalFilename);
        }
      } else {
        // Standard download prompt / save
        if (format === 'pdf') {
          await exportBulkSheetAsPdf(exportOptions, finalFilename);
        } else {
          await exportBulkSheetAsPng(exportOptions, finalFilename, pngDpi);
        }
      }

      setSuccessMsg(
        destFolder.trim()
          ? `Saved ${finalFilename} to destination folder!`
          : `Successfully saved ${finalFilename}!`
      );

      // Increment file counter if enabled
      if (autoIncrement) {
        const nextNum = fileCounter + 1;
        setFileCounter(nextNum);
        localStorage.setItem(FILE_COUNTER_KEY, String(nextNum));
      }

      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      console.error('Bulk sheet export failed:', err);
      alert('Failed to export bulk sheet. Please check permissions or try standard download.');
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

  if (!isOpen) return null;

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
                Save & Export Bulk QR Sheet
              </h2>
              <p className="text-[11px] text-slate-400">
                {sheetW}&quot; × {sheetH}&quot; ({cols} Cols × {rows} Rows = {totalSlots} Cards)
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
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
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
                    Exact {sheetW}&quot; × {sheetH}&quot;
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
                  All {totalSheets} Sheets ({totalSheets * totalSlots} slots)
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
                  Sheet {config.activeSheetIndex + 1} Only ({totalSlots} QRs)
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

          {/* Cut Line Thickness */}
          {showCutGuides && (
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 uppercase tracking-wider">Cut Line Thickness</span>
                <span className="font-mono text-indigo-400">{cutLineThicknessPt.toFixed(2)}pt</span>
              </div>
              <input
                type="range"
                min={0.25}
                max={6}
                step={0.25}
                value={cutLineThicknessPt}
                onChange={(e) => setCutLineThicknessPt(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
              />
            </div>
          )}

          {/* Destination Folder Section */}
          <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-indigo-400" />
                <span>Destination Folder</span>
              </label>
              {destFolder && isTauri && (
                <button
                  type="button"
                  onClick={handleOpenDestFolder}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition cursor-pointer"
                  title="Open folder in Finder / Explorer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open Folder</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus-within:border-indigo-500 overflow-hidden">
                <input
                  type="text"
                  value={destFolder}
                  onChange={(e) => {
                    setDestFolder(e.target.value);
                    localStorage.setItem(DEST_FOLDER_KEY, e.target.value);
                  }}
                  placeholder="Default (Browser Downloads folder)"
                  className="bg-transparent flex-1 outline-none text-xs text-slate-200 placeholder:text-slate-500"
                />
                {destFolder && (
                  <button
                    type="button"
                    onClick={handleClearDestFolder}
                    className="p-0.5 rounded text-slate-400 hover:text-rose-400 transition ml-1 cursor-pointer"
                    title="Clear destination folder"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handlePickDestFolder}
                className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                <FolderCheck className="w-3.5 h-3.5" />
                <span>Browse...</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              {destFolder
                ? 'Exported files will be written directly into this folder.'
                : 'Leave empty to download to standard Downloads directory.'}
            </p>
          </div>

          {/* Filename & Auto Increment Section */}
          <div className="space-y-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                File Name & Numbering
              </label>
              <label className="flex items-center gap-1.5 text-xs text-indigo-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoIncrement}
                  onChange={(e) => setAutoIncrement(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="text-[11px] font-medium">Auto-Increment #</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2 flex items-center bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs focus-within:border-indigo-500">
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="bulk-qr-sheet"
                  className="bg-transparent flex-1 text-slate-200 outline-none"
                />
              </div>

              {autoIncrement ? (
                <div className="flex items-center justify-between bg-slate-900 border border-slate-700/80 rounded-lg p-1">
                  <span className="text-[10px] text-slate-500 pl-1 font-mono">#</span>
                  <input
                    type="number"
                    min={1}
                    value={fileCounter}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                      setFileCounter(val);
                      localStorage.setItem(FILE_COUNTER_KEY, String(val));
                    }}
                    className="w-12 bg-transparent text-center font-mono text-xs text-indigo-300 outline-none"
                  />
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.max(1, fileCounter - 1);
                        setFileCounter(val);
                        localStorage.setItem(FILE_COUNTER_KEY, String(val));
                      }}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                      title="Decrease number"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const val = fileCounter + 1;
                        setFileCounter(val);
                        localStorage.setItem(FILE_COUNTER_KEY, String(val));
                      }}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                      title="Increase number"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center text-[11px] text-slate-500 font-mono bg-slate-900/50 rounded-lg border border-slate-800/80">
                  .{format}
                </div>
              )}
            </div>

            {/* Live Filename Preview */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-[11px]">
              <span className="text-slate-400">Saving as:</span>
              <span className="font-mono text-emerald-400 font-medium truncate max-w-[280px]">
                {previewFilename}
              </span>
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
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2 truncate">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">{successMsg}</span>
              </div>
              {destFolder && isTauri && (
                <button
                  type="button"
                  onClick={handleOpenDestFolder}
                  className="px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 text-[11px] font-medium flex items-center gap-1 transition shrink-0 cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open Folder</span>
                </button>
              )}
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
                <span>Save {format.toUpperCase()} ({sheetW}&quot; × {sheetH}&quot;)</span>
              </>
            )}
          </button>

          <button
            onClick={handlePrint}
            disabled={isExporting}
            title={`Direct Print ${sheetW}in × ${sheetH}in Sheet`}
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
