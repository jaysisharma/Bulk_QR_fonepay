import React, { useState } from 'react';
import {
  X,
  Download,
  FileImage,
  FileText,
  Copy,
  Check,
  Loader2,
  FolderArchive,
  Printer,
} from 'lucide-react';
import { TARGET_WIDTH_INCH, TARGET_HEIGHT_INCH, type PageBgType } from '../types';
import {
  exportCardAsPng,
  exportCardAsPdf,
  copyCardToClipboard,
  type ExportCardOptions,
} from '../utils/exportUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: ExportCardOptions;
  onExportProjectBundle: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  options,
  onExportProjectBundle,
}) => {
  const [format, setFormat] = useState<'png' | 'pdf'>('pdf');
  const [dpi, setDpi] = useState<number>(600);
  const [filename, setFilename] = useState<string>('qr-card-design');
  const [exportPageBg, setExportPageBg] = useState<PageBgType>(options.pageBg || 'white');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const cardWidth = options.cardWidth ?? TARGET_WIDTH_INCH;
  const cardHeight = options.cardHeight ?? TARGET_HEIGHT_INCH;
  const widthPx = Math.round(cardWidth * dpi);
  const heightPx = Math.round(cardHeight * dpi);

  const effectiveOptions: ExportCardOptions = {
    ...options,
    pageBg: exportPageBg,
    dpi,
  };

  const handleDownload = async () => {
    setIsExporting(true);
    setSuccessMessage(null);
    try {
      const fullFilename = `${filename.trim() || 'qr-card-design'}.${format}`;
      if (format === 'png') {
        await exportCardAsPng(effectiveOptions, fullFilename);
      } else {
        await exportCardAsPdf(effectiveOptions, fullFilename);
      }
      setSuccessMessage(`Saved as ${fullFilename}!`);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to save export. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyClipboard = async () => {
    setIsExporting(true);
    setSuccessMessage(null);
    try {
      const ok = await copyCardToClipboard(effectiveOptions);
      if (ok) {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
        setSuccessMessage('High-resolution card copied to clipboard!');
        setTimeout(() => setSuccessMessage(null), 3500);
      } else {
        alert('Could not copy to clipboard in this environment.');
      }
    } catch (err) {
      console.error('Clipboard copy failed:', err);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-slate-100">Save & Export Card</h2>
              <p className="text-[11px] text-slate-400">
                {cardWidth}&quot; × {cardHeight}&quot; Card Template
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
                onClick={() => setFormat('png')}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition cursor-pointer ${
                  format === 'png'
                    ? 'bg-indigo-600/15 border-indigo-500/60 text-white shadow-sm'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
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
                  <div className="text-xs font-medium">PNG Image</div>
                  <div className="text-[10px] text-slate-400">Raster graphic ({widthPx} × {heightPx} px)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition cursor-pointer ${
                  format === 'pdf'
                    ? 'bg-indigo-600/15 border-indigo-500/60 text-white shadow-sm'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
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
                  <div className="text-xs font-medium">Print PDF</div>
                  <div className="text-[10px] text-slate-400">
                    Exact {cardWidth}&quot; × {cardHeight}&quot;
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* DPI Resolution selector for PDF & PNG */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 uppercase tracking-wider">
                Print Resolution / Quality
              </span>
              <span className="font-mono text-indigo-400 text-[11px]">
                {widthPx} × {heightPx} px ({dpi} DPI)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 300, label: '300 DPI', sub: 'Standard' },
                { value: 450, label: '450 DPI', sub: 'High Res' },
                { value: 600, label: '600 DPI', sub: 'Ultra Sharp' },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setDpi(item.value)}
                  className={`p-2 rounded-lg border text-center transition cursor-pointer ${
                    dpi === item.value
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

          {/* Page Background Choice for Print/Export */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                <span>Page Background (Print)</span>
              </label>
              <span className="text-[10px] text-emerald-400 font-mono">
                {exportPageBg === 'white' ? 'Pure White #ffffff' : exportPageBg}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setExportPageBg('white')}
                className={`p-2 rounded-lg border text-center transition cursor-pointer flex flex-col items-center ${
                  exportPageBg === 'white'
                    ? 'bg-emerald-500/15 border-emerald-500 text-white font-medium shadow-sm'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-white border border-slate-300 shadow-xs mb-1" />
                <div className="text-xs">White Page</div>
                <div className="text-[9px] text-emerald-400">Best for Print</div>
              </button>

              <button
                type="button"
                onClick={() => setExportPageBg('dark')}
                className={`p-2 rounded-lg border text-center transition cursor-pointer flex flex-col items-center ${
                  exportPageBg === 'dark'
                    ? 'bg-indigo-500/15 border-indigo-500 text-white font-medium shadow-sm'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-[#0f172a] border border-slate-600 shadow-xs mb-1" />
                <div className="text-xs">Dark Card</div>
                <div className="text-[9px] text-slate-500">Digital Card</div>
              </button>

              <button
                type="button"
                onClick={() => setExportPageBg('transparent')}
                className={`p-2 rounded-lg border text-center transition cursor-pointer flex flex-col items-center ${
                  exportPageBg === 'transparent'
                    ? 'bg-indigo-500/15 border-indigo-500 text-white font-medium shadow-sm'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-transparent border border-dashed border-slate-400 shadow-xs mb-1" />
                <div className="text-xs">Transparent</div>
                <div className="text-[9px] text-slate-500">No Fill</div>
              </button>
            </div>
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
                placeholder="qr-card-design"
                className="bg-transparent flex-1 text-slate-200 outline-none"
              />
              <span className="text-slate-500 font-mono text-[11px]">.{format}</span>
            </div>
          </div>

          {/* Success banner */}
          {successMessage && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            {/* Download Button */}
            <button
              onClick={handleDownload}
              disabled={isExporting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 text-white font-medium text-xs transition cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating {format.toUpperCase()}...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download {format.toUpperCase()}</span>
                </>
              )}
            </button>

            {/* Copy Image Button */}
            <button
              onClick={handleCopyClipboard}
              disabled={isExporting}
              title="Copy card image to clipboard"
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition cursor-pointer"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Direct Print Button */}
            <button
              onClick={handlePrint}
              disabled={isExporting}
              title="Print directly to physical printer (Cmd+P / Ctrl+P)"
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/40 text-xs font-medium transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div>

          {/* Project Backup / Save bundle */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Need to edit later?</span>
            <button
              type="button"
              onClick={() => {
                onExportProjectBundle();
                setSuccessMessage('Project backup (.qrproj) saved!');
                setTimeout(() => setSuccessMessage(null), 3500);
              }}
              className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 hover:underline cursor-pointer"
            >
              <FolderArchive className="w-3 h-3" />
              Save Project (.qrproj)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
