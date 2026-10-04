import React from 'react';
import {
  ScanQrCode,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Printer,
  CreditCard,
  Grid3x3,
  FolderTree,
} from 'lucide-react';
import {
  type AppMode,
} from '../types';

interface HeaderBarProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onDirectPrint?: () => void;
  onOpenExportModal?: () => void;
  bulkCount?: number;
  onOpenBulkExportModal?: () => void;
  onOpenFolderSplitter?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  mode,
  onModeChange,
  zoom,
  onZoomChange,
  onDirectPrint,
  onOpenExportModal,
  bulkCount = 0,
  onOpenBulkExportModal,
  onOpenFolderSplitter,
}) => {
  return (
    <header className="h-14 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md px-5 flex items-center justify-between shrink-0 z-20">
      {/* Left: Branding & Mode Switcher */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <ScanQrCode className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-slate-100">
            QR Studio
          </span>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => onModeChange('single')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              mode === 'single'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Single Card</span>
          </button>
          <button
            onClick={() => onModeChange('bulk')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              mode === 'bulk'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Grid3x3 className="w-3.5 h-3.5" />
            <span>132 Bulk Sheet</span>
            {bulkCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/30 text-[10px]">
                {bulkCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Right: Minimal, focused controls */}
      <div className="flex items-center gap-3">
        {/* Folder Splitter Tool */}
        {onOpenFolderSplitter && (
          <button
            onClick={onOpenFolderSplitter}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-500/30 hover:border-indigo-500/50 text-indigo-300 hover:text-indigo-100 text-xs font-medium transition cursor-pointer shadow-sm"
            title="Split large folder with 500-1000+ files into 132 files per folder (A, B, C...)"
          >
            <FolderTree className="w-3.5 h-3.5 text-indigo-400" />
            <span>Split Folder</span>
          </button>
        )}

        {/* Zoom Controls */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-slate-400">
          <button
            onClick={() => {
              const step = mode === 'bulk' ? 0.02 : 0.1;
              const minZ = mode === 'bulk' ? 0.04 : 0.4;
              onZoomChange(Math.max(minZ, Number((zoom - step).toFixed(2))));
            }}
            title="Zoom Out"
            className="p-1 hover:text-slate-200 hover:bg-slate-800 rounded transition cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="px-2 font-mono text-xs text-slate-300 min-w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => {
              const step = mode === 'bulk' ? 0.02 : 0.1;
              const maxZ = mode === 'bulk' ? 0.8 : 2.0;
              onZoomChange(Math.min(maxZ, Number((zoom + step).toFixed(2))));
            }}
            title="Zoom In"
            className="p-1 hover:text-slate-200 hover:bg-slate-800 rounded transition cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-slate-800 mx-0.5" />
          <button
            onClick={() => onZoomChange(mode === 'bulk' ? 0.12 : 1)}
            title={mode === 'bulk' ? 'Fit Sheet View (~12%)' : 'Reset 100%'}
            className="p-1 hover:text-slate-200 hover:bg-slate-800 rounded transition cursor-pointer text-xs"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        {mode === 'single' ? (
          <>
            {onDirectPrint && (
              <button
                onClick={onDirectPrint}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                title="Print Card (Cmd+P / Ctrl+P)"
              >
                <Printer className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onOpenExportModal}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-semibold transition cursor-pointer shadow-md shadow-emerald-600/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
          </>
        ) : (
          <>
            {onDirectPrint && (
              <button
                onClick={onDirectPrint}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                title="Print Sheet (Cmd+P / Ctrl+P)"
              >
                <Printer className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onOpenBulkExportModal}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-semibold transition cursor-pointer shadow-md shadow-emerald-600/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Sheet</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};
