import React, { useState } from 'react';
import {
  X,
  FolderTree,
  Folder,
  FolderCheck,
  Copy,
  Move,
  Check,
  Loader2,
  ExternalLink,
  AlertCircle,
  Hash,
  Layers,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

interface FolderSplitterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBatchSelectedForSheet?: (files: File[]) => void;
}

interface ScanData {
  source_path: string;
  total_files: number;
  sample_files: string[];
  extensions: Record<string, number>;
}

interface BatchInfo {
  folder_name: string;
  folder_path: string;
  file_count: usizeNumber;
  start_index: number;
  end_index: number;
  sample_files: string[];
}

type usizeNumber = number;

interface SplitResult {
  total_processed: number;
  total_folders: number;
  destination_root: string;
  batches: BatchInfo[];
  errors: string[];
}

export const FolderSplitterModal: React.FC<FolderSplitterModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [sourcePath, setSourcePath] = useState<string>('');
  const [destPath, setDestPath] = useState<string>('');
  const [customDest, setCustomDest] = useState<boolean>(false);
  const [batchSize, setBatchSize] = useState<number>(132);
  const [namingScheme, setNamingScheme] = useState<
    'batch_letter' | 'letter_only' | 'batch_letter_range' | 'numbered'
  >('batch_letter');
  const [actionMode, setActionMode] = useState<'copy' | 'move'>('move');

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanData, setScanData] = useState<ScanData | null>(null);

  const [isSplitting, setIsSplitting] = useState<boolean>(false);
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isTauri =
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

  // Pick source folder
  const handlePickSourceFolder = async () => {
    setErrorMsg(null);
    setSplitResult(null);
    try {
      if (isTauri) {
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Select Folder Containing Files to Split',
        });
        if (selected && typeof selected === 'string') {
          setSourcePath(selected);
          await triggerScan(selected);
        }
      } else {
        // Web directory picker fallback
        if ('showDirectoryPicker' in window) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const dirHandle = await (window as any).showDirectoryPicker();
          setSourcePath(dirHandle.name || 'Selected Folder');
          // Scan in browser
          let count = 0;
          const exts: Record<string, number> = {};
          const samples: string[] = [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for await (const entry of (dirHandle as any).values()) {
            if (entry.kind === 'file' && !entry.name.startsWith('.')) {
              count++;
              const ext = entry.name.split('.').pop()?.toLowerCase() || 'none';
              exts[ext] = (exts[ext] || 0) + 1;
              if (samples.length < 20) samples.push(entry.name);
            }
          }
          setScanData({
            source_path: dirHandle.name,
            total_files: count,
            sample_files: samples,
            extensions: exts,
          });
        } else {
          setErrorMsg('Directory selection is only supported in the Desktop app or Chromium browsers.');
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Folder pick error:', err);
        setErrorMsg('Failed to select folder.');
      }
    }
  };

  const triggerScan = async (path: string) => {
    setIsScanning(true);
    setErrorMsg(null);
    try {
      const res = await invoke<ScanData>('scan_folder', { folderPath: path });
      setScanData(res);
    } catch (err) {
      console.error('Scan error:', err);
      setErrorMsg(typeof err === 'string' ? err : 'Failed to scan folder.');
      setScanData(null);
    } finally {
      setIsScanning(false);
    }
  };

  // Pick custom destination folder
  const handlePickDestFolder = async () => {
    try {
      if (isTauri) {
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Select Destination Folder for Batches',
        });
        if (selected && typeof selected === 'string') {
          setDestPath(selected);
        }
      }
    } catch (err) {
      console.error('Dest pick error:', err);
    }
  };

  // Execute splitting
  const handleStartSplit = async () => {
    if (!sourcePath || !scanData || scanData.total_files === 0) return;
    setIsSplitting(true);
    setErrorMsg(null);

    try {
      if (isTauri) {
        const result = await invoke<SplitResult>('split_folder', {
          params: {
            source_folder: sourcePath,
            destination_folder: customDest && destPath ? destPath : null,
            batch_size: batchSize,
            naming_scheme: namingScheme,
            action: actionMode,
            extension_filter: null,
          },
        });
        setSplitResult(result);
      } else {
        setErrorMsg('Splitting directly on disk is supported when running in the Desktop App.');
      }
    } catch (err) {
      console.error('Split error:', err);
      setErrorMsg(typeof err === 'string' ? err : 'Failed to split folder.');
    } finally {
      setIsSplitting(false);
    }
  };

  const handleOpenFolder = async (folderToOpen: string) => {
    if (isTauri) {
      try {
        await invoke('open_folder_in_os', { folderPath: folderToOpen });
      } catch (err) {
        console.error('Failed to open folder:', err);
      }
    }
  };

  const totalFiles = scanData?.total_files || 0;
  const calculatedBatches = totalFiles > 0 ? Math.ceil(totalFiles / batchSize) : 0;

  // Generate preview of folder labels
  const getPreviewBatchNames = () => {
    const previews = [];
    const count = Math.min(calculatedBatches, 6);
    for (let i = 0; i < count; i++) {
      let letter = '';
      let temp = i;
      while (true) {
        const rem = temp % 26;
        letter = String.fromCharCode(65 + rem) + letter;
        if (temp < 26) break;
        temp = Math.floor(temp / 26) - 1;
      }

      const start = i * batchSize + 1;
      const end = Math.min(totalFiles, (i + 1) * batchSize);
      const fileCount = end - start + 1;

      let name = '';
      if (namingScheme === 'letter_only') {
        name = letter;
      } else if (namingScheme === 'batch_letter_range') {
        name = `Folder_${letter} (${start}-${end})`;
      } else if (namingScheme === 'numbered') {
        name = `Batch_${String(i + 1).padStart(calculatedBatches >= 100 ? 3 : 2, '0')}`;
      } else {
        name = `Batch_${letter}`;
      }

      previews.push({ name, start, end, fileCount });
    }
    return previews;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in font-sans">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FolderTree className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>Folder Splitter</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                  132 Files / Folder
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Split 500, 600, 1000+ files into organized batch folders (A, B, C, D...)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* If Split is completed successfully */}
          {splitResult ? (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 mx-auto flex items-center justify-center text-emerald-400">
                  <Check className="w-5 h-5 stroke-[2.5]" />
                </div>
                <h3 className="text-sm font-bold text-emerald-200">
                  Successfully Split {splitResult.total_processed} Files!
                </h3>
                <p className="text-[11px] text-emerald-300/80">
                  Organized into {splitResult.total_folders} batch folders with up to{' '}
                  {batchSize} files each.
                </p>
              </div>

              {/* Batches Breakdown */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                  <span>Created Batch Folders:</span>
                  <button
                    onClick={() => handleOpenFolder(splitResult.destination_root)}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-normal cursor-pointer hover:underline text-[11px]"
                  >
                    <span>Open in Finder / Explorer</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 bg-slate-950/50 rounded-lg border border-slate-800">
                  {splitResult.batches.map((batch) => (
                    <div
                      key={batch.folder_name}
                      onClick={() => handleOpenFolder(batch.folder_path)}
                      className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 cursor-pointer transition flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Folder className="w-4 h-4 text-indigo-400 shrink-0 group-hover:text-indigo-300" />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-200 truncate text-[11px]">
                            {batch.folder_name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Files #{batch.start_index} - #{batch.end_index}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                        {batch.file_count} files
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setSplitResult(null);
                    setScanData(null);
                    setSourcePath('');
                  }}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                >
                  Split Another Folder
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenFolder(splitResult.destination_root)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <FolderCheck className="w-3.5 h-3.5" />
                    <span>View Output Folder</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Configure & Split View */
            <div className="space-y-4">
              {/* Step 1: Select Source Folder */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold">
                    1
                  </span>
                  <span>Select Source Folder</span>
                </label>

                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 truncate font-mono text-[11px]">
                    {sourcePath || (
                      <span className="text-slate-500 font-sans">
                        No folder selected yet...
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handlePickSourceFolder}
                    disabled={isScanning || isSplitting}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-medium text-xs transition cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {isScanning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Folder className="w-3.5 h-3.5" />
                    )}
                    <span>Browse Folder</span>
                  </button>
                </div>

                {/* Scan Info Display */}
                {scanData && (
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">
                          {scanData.total_files}
                        </span>
                        <span className="text-slate-400 text-xs">files found</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-indigo-400 font-medium text-[11px]">
                          {calculatedBatches} Folders needed ({batchSize}/folder)
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {Object.entries(scanData.extensions).map(([ext, count]) => (
                          <span
                            key={ext}
                            className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-mono"
                          >
                            .{ext}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Settings (Batch size & Naming) */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Batch Size */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Files per Folder</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={batchSize}
                      onChange={(e) =>
                        setBatchSize(Math.max(1, parseInt(e.target.value) || 1))
                      }
                      className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-mono focus:border-indigo-500 focus:outline-none"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setBatchSize(132)}
                        className={`px-2 py-1 rounded text-[10px] font-semibold transition cursor-pointer ${
                          batchSize === 132
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        132 (Sheet)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBatchSize(100)}
                        className={`px-2 py-1 rounded text-[10px] font-semibold transition cursor-pointer ${
                          batchSize === 100
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        100
                      </button>
                    </div>
                  </div>
                </div>

                {/* Operation Mode */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Operation Mode</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setActionMode('move')}
                      className={`flex items-center justify-center gap-1 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                        actionMode === 'move'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Move className="w-3 h-3" />
                      <span>Move (Auto-clean)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionMode('copy')}
                      className={`flex items-center justify-center gap-1 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                        actionMode === 'copy'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy (Keep duplicates)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Naming Style */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Folder Naming Style</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNamingScheme('batch_letter')}
                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                      namingScheme === 'batch_letter'
                        ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-semibold text-[11px]">Batch_A, Batch_B...</div>
                    <div className="text-[10px] text-slate-500">Standard batch naming</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNamingScheme('letter_only')}
                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                      namingScheme === 'letter_only'
                        ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-semibold text-[11px]">A, B, C, D...</div>
                    <div className="text-[10px] text-slate-500">Minimal letter folders</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNamingScheme('batch_letter_range')}
                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                      namingScheme === 'batch_letter_range'
                        ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-semibold text-[11px]">Folder_A (1-132)...</div>
                    <div className="text-[10px] text-slate-500">Includes exact file range</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNamingScheme('numbered')}
                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                      namingScheme === 'numbered'
                        ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-semibold text-[11px]">Batch_01, Batch_02...</div>
                    <div className="text-[10px] text-slate-500">Numbered folders</div>
                  </button>
                </div>
              </div>

              {/* Destination Folder Option */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Output Location:
                  </label>
                  <button
                    type="button"
                    onClick={() => setCustomDest(!customDest)}
                    className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
                  >
                    {customDest ? 'Use default (inside source)' : 'Choose custom destination'}
                  </button>
                </div>

                {customDest ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 truncate font-mono text-[11px]">
                      {destPath || 'No destination selected'}
                    </div>
                    <button
                      type="button"
                      onClick={handlePickDestFolder}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
                    >
                      Browse
                    </button>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                    Will create folder: <span className="font-mono text-slate-300">Batches_{batchSize}/</span> inside your source folder.
                  </div>
                )}
              </div>

              {/* Preview of Batches */}
              {scanData && totalFiles > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                    <span>Preview ({calculatedBatches} Folders):</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Max {batchSize} per folder
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 p-2 bg-slate-950/60 rounded-lg border border-slate-800/80 max-h-36 overflow-y-auto">
                    {getPreviewBatchNames().map((batch) => (
                      <div
                        key={batch.name}
                        className="p-1.5 rounded bg-slate-900 border border-slate-800 text-[10px] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Folder className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="font-semibold text-slate-200 truncate">
                            {batch.name}
                          </span>
                        </div>
                        <span className="font-mono text-slate-400 shrink-0">
                          {batch.fileCount} files
                        </span>
                      </div>
                    ))}
                    {calculatedBatches > 6 && (
                      <div className="col-span-2 text-center text-[10px] text-slate-500 py-0.5">
                        + {calculatedBatches - 6} more batch folders
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Footer Action */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer text-xs"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleStartSplit}
                  disabled={!scanData || totalFiles === 0 || isSplitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-40 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
                >
                  {isSplitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Splitting Files...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        Split {totalFiles > 0 ? `${totalFiles} Files` : 'Folder'} into {calculatedBatches} Folders
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
