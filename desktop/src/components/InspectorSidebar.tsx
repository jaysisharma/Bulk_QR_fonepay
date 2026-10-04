import React from 'react';
import {
  Sliders,
  AlignCenter,
  FileImage,
  FileText,
  Upload,
  RefreshCw,
  Crop,
  Layers,
  Palette,
  CheckCircle2,
  Move,
  Printer,
  Trash2,
  RotateCcw,
  CreditCard,
} from 'lucide-react';
import {
  type BgType,
  type PageBgType,
  type UploadedQrInfo,
  type PresetItem,
  CARD_SIZE_PRESETS,
} from '../types';
import { PresetManager } from './PresetManager';

interface InspectorSidebarProps {
  cardWidth: number;
  cardHeight: number;
  onCardSizeChange: (w: number, h: number) => void;
  onOpenExportModal: () => void;
  pageBg: PageBgType;
  onPageBgChange: (val: PageBgType) => void;
  showTemplateImage: boolean;
  onToggleShowTemplateImage: () => void;
  hasTemplate: boolean;
  onClearTemplate?: () => void;
  onDirectPrint: () => void;
  customQr: UploadedQrInfo | null;
  isProcessingQr: boolean;
  onOpenQrPicker: () => void;
  onResetToSampleQr: () => void;
  presets: PresetItem[];
  onSavePreset: (name: string) => void;
  onApplyPreset: (preset: PresetItem) => void;
  onDeletePreset: (id: string) => void;
  onResetToDefault: () => void;
  autoTrimMargins: boolean;
  onToggleAutoTrim: () => void;
  innerPaddingPx: number;
  onInnerPaddingChange: (val: number) => void;
  bgType: BgType;
  onBgTypeChange: (bg: BgType) => void;
  qrColor: string;
  onQrColorChange: (color: string) => void;
  whiteThreshold: number;
  onWhiteThresholdChange: (val: number) => void;
  invertOnBlack: boolean;
  onInvertOnBlackChange: (val: boolean) => void;
  qrWidth: number;
  qrHeight: number;
  onMakeSquare: () => void;
  onWidthChange: (val: number) => void;
  onHeightChange: (val: number) => void;
  qrX: number;
  qrY: number;
  onXChange: (val: number) => void;
  onYChange: (val: number) => void;
  onCenter: () => void;
  onQuickAlign: (x: number, y: number) => void;
}

export const InspectorSidebar: React.FC<InspectorSidebarProps> = ({
  cardWidth,
  cardHeight,
  onCardSizeChange,
  pageBg,
  onPageBgChange,
  showTemplateImage,
  onToggleShowTemplateImage,
  hasTemplate,
  onClearTemplate,
  customQr,
  isProcessingQr,
  onOpenQrPicker,
  onResetToSampleQr,
  presets,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  onResetToDefault,
  autoTrimMargins,
  onToggleAutoTrim,
  innerPaddingPx,
  onInnerPaddingChange,
  bgType,
  onBgTypeChange,
  qrColor,
  onQrColorChange,
  whiteThreshold,
  onWhiteThresholdChange,
  invertOnBlack,
  onInvertOnBlackChange,
  qrWidth,
  qrHeight,
  onMakeSquare,
  onWidthChange,
  onHeightChange,
  qrX,
  qrY,
  onXChange,
  onYChange,
  onCenter,
  onQuickAlign,
}) => {
  return (
    <aside className="w-[310px] min-w-[310px] max-w-[310px] shrink-0 border-l border-slate-800/80 bg-slate-950/70 backdrop-blur-md flex flex-col h-full z-20 overflow-y-auto font-sans text-xs">
      {/* Sidebar Header */}
      <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-indigo-400" />
          <h2 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Properties</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onCenter}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 hover:text-white transition cursor-pointer"
            title="Center QR within card"
          >
            <AlignCenter className="w-3 h-3" />
            <span>Center</span>
          </button>
          <button
            onClick={onResetToDefault}
            className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            title="Reset position & size to defaults"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="p-3.5 space-y-4">
        {/* Section 0: Card Size Dimensions */}
        <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/90">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
              <span>Card Dimensions</span>
            </span>
            <span className="text-[10px] font-mono text-indigo-400">
              {cardWidth}&quot; × {cardHeight}&quot;
            </span>
          </div>

          {/* Quick Preset Selector */}
          <select
            value={
              CARD_SIZE_PRESETS.find(
                (p) => Math.abs(p.widthInch - cardWidth) < 0.01 && Math.abs(p.heightInch - cardHeight) < 0.01
              )?.id || 'custom'
            }
            onChange={(e) => {
              const preset = CARD_SIZE_PRESETS.find((p) => p.id === e.target.value);
              if (preset) {
                onCardSizeChange(preset.widthInch, preset.heightInch);
              }
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            {CARD_SIZE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="custom">Custom Dimensions...</option>
          </select>

          {/* Width & Height Number Inputs */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-1.5 focus-within:border-indigo-500">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-0.5">
                <span>CARD WIDTH</span>
                <span className="text-slate-500">in</span>
              </div>
              <input
                type="number"
                min={0.5}
                max={24}
                step={0.01}
                value={cardWidth}
                onChange={(e) => onCardSizeChange(parseFloat(e.target.value) || 0.5, cardHeight)}
                className="w-full bg-transparent text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-1.5 focus-within:border-indigo-500">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-0.5">
                <span>CARD HEIGHT</span>
                <span className="text-slate-500">in</span>
              </div>
              <input
                type="number"
                min={0.5}
                max={24}
                step={0.01}
                value={cardHeight}
                onChange={(e) => onCardSizeChange(cardWidth, parseFloat(e.target.value) || 0.5)}
                className="w-full bg-transparent text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 1: Transform (Dimensions & Position) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Move className="w-3 h-3 text-indigo-400" />
              <span>QR Placement</span>
            </span>
            <button
              onClick={onMakeSquare}
              className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
              title="Lock 1:1 Square aspect ratio"
            >
              Snap 1:1
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* X */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-1.5 focus-within:border-indigo-500">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-0.5">
                <span>X POS</span>
                <span className="text-slate-500">in</span>
              </div>
              <input
                type="number"
                min={0}
                max={Math.max(0, Number((cardWidth - qrWidth).toFixed(4)))}
                step={0.01}
                value={qrX}
                onChange={(e) => onXChange(Number(parseFloat(e.target.value) || 0))}
                className="w-full bg-transparent text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>

            {/* Y */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-1.5 focus-within:border-indigo-500">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-0.5">
                <span>Y POS</span>
                <span className="text-slate-500">in</span>
              </div>
              <input
                type="number"
                min={0}
                max={Math.max(0, Number((cardHeight - qrHeight).toFixed(4)))}
                step={0.01}
                value={qrY}
                onChange={(e) => onYChange(Number(parseFloat(e.target.value) || 0))}
                className="w-full bg-transparent text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>

            {/* Width */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-1.5 focus-within:border-indigo-500">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-0.5">
                <span>WIDTH</span>
                <span className="text-slate-500">in</span>
              </div>
              <input
                type="number"
                min={0.3}
                max={cardWidth}
                step={0.05}
                value={qrWidth}
                onChange={(e) => onWidthChange(Number(parseFloat(e.target.value) || 0.3))}
                className="w-full bg-transparent text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>

            {/* Height */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-1.5 focus-within:border-indigo-500">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-0.5">
                <span>HEIGHT</span>
                <span className="text-slate-500">in</span>
              </div>
              <input
                type="number"
                min={0.3}
                max={cardHeight}
                step={0.05}
                value={qrHeight}
                onChange={(e) => onHeightChange(Number(parseFloat(e.target.value) || 0.3))}
                className="w-full bg-transparent text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          {/* Quick Align Row */}
          <div className="grid grid-cols-3 gap-1 pt-0.5 text-[11px]">
            <button
              onClick={() => onQuickAlign(Number(((cardWidth - qrWidth) / 2).toFixed(4)), 0.35)}
              className="py-1 px-1.5 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 text-slate-300 text-center transition cursor-pointer"
            >
              Top Center
            </button>
            <button
              onClick={onCenter}
              className="py-1 px-1.5 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 text-slate-300 text-center transition cursor-pointer"
            >
              Center
            </button>
            <button
              onClick={() =>
                onQuickAlign(
                  Number(((cardWidth - qrWidth) / 2).toFixed(4)),
                  Number((cardHeight - qrHeight - 0.45).toFixed(4))
                )
              }
              className="py-1 px-1.5 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 text-slate-300 text-center transition cursor-pointer"
            >
              Bottom Center
            </button>
          </div>
        </div>

        <div className="h-px bg-slate-800/80" />

        {/* Section 2: QR Appearance & Color */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Palette className="w-3 h-3 text-indigo-400" />
            <span>QR Appearance</span>
          </span>

          {/* QR Background Segmented Control */}
          <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-900 border border-slate-800 rounded-lg">
            {(['white', 'black', 'transparent'] as BgType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onBgTypeChange(type)}
                className={`py-1.5 rounded text-[11px] font-medium capitalize transition cursor-pointer ${
                  bgType === type
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Transparent Mode Knockout Slider */}
          {bgType === 'transparent' && customQr && (
            <div className="bg-slate-900/50 p-2.5 rounded-lg border border-indigo-500/25 space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-300">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>White Knockout</span>
                </span>
                <span className="font-mono text-slate-400">{whiteThreshold}</span>
              </div>
              <input
                type="range"
                min={180}
                max={255}
                step={1}
                value={whiteThreshold}
                onChange={(e) => onWhiteThresholdChange(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
              />
            </div>
          )}

          {/* Transparent Mode Sample Contrast */}
          {bgType === 'transparent' && !customQr && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-800 text-[11px]">
              <span className="text-slate-400">Contrast Color:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onQrColorChange('#000000')}
                  className={`w-5 h-5 rounded-full bg-black border ${
                    qrColor === '#000000' ? 'ring-2 ring-indigo-500 border-white' : 'border-slate-700'
                  }`}
                  title="Dark QR"
                />
                <button
                  onClick={() => onQrColorChange('#ffffff')}
                  className={`w-5 h-5 rounded-full bg-white border ${
                    qrColor === '#ffffff' ? 'ring-2 ring-indigo-500 border-indigo-400' : 'border-slate-300'
                  }`}
                  title="Light QR"
                />
              </div>
            </div>
          )}

          {/* Black Mode Invert Toggle */}
          {bgType === 'black' && customQr && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-800 text-[11px]">
              <span className="text-slate-300">Invert to White QR</span>
              <button
                type="button"
                onClick={() => onInvertOnBlackChange(!invertOnBlack)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                  invertOnBlack ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {invertOnBlack ? 'ON' : 'OFF'}
              </button>
            </div>
          )}

          {/* Auto Trim Margins Toggle */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-800">
            <span className="text-[11px] text-slate-300 flex items-center gap-1.5">
              <Crop className="w-3 h-3 text-indigo-400" />
              <span>Trim Quiet Zone</span>
            </span>
            <button
              type="button"
              onClick={onToggleAutoTrim}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                autoTrimMargins
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {autoTrimMargins ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Inner Padding */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3" />
                <span>Inner Padding</span>
              </span>
              <span className="font-mono text-indigo-400">{innerPaddingPx}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={24}
              step={1}
              value={innerPaddingPx}
              onChange={(e) => onInnerPaddingChange(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
            />
          </div>
        </div>

        <div className="h-px bg-slate-800/80" />

        {/* Section 3: QR File Source */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <FileImage className="w-3 h-3 text-indigo-400" />
              <span>QR File</span>
            </span>
            {customQr && (
              <button
                onClick={onResetToSampleQr}
                className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition cursor-pointer"
                title="Revert to sample QR"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>Sample</span>
              </button>
            )}
          </div>

          {customQr ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2 min-w-0 mr-2">
                {customQr.type === 'pdf' ? (
                  <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <FileImage className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-200 truncate font-medium">{customQr.name}</p>
                  <p className="text-[9px] text-slate-500 font-mono">
                    {customQr.type.toUpperCase()}{customQr.pageCount ? ` • ${customQr.pageCount}p` : ''}
                  </p>
                </div>
              </div>

              <button
                onClick={onOpenQrPicker}
                disabled={isProcessingQr}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition cursor-pointer shrink-0"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenQrPicker}
              disabled={isProcessingQr}
              className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-dashed border-slate-700 hover:border-indigo-500/50 text-slate-300 hover:text-white transition cursor-pointer flex items-center justify-center gap-1.5 text-[11px]"
            >
              {isProcessingQr ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              ) : (
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
              )}
              <span>{isProcessingQr ? 'Reading File...' : 'Upload Custom QR (PDF / Image)'}</span>
            </button>
          )}
        </div>

        <div className="h-px bg-slate-800/80" />

        {/* Section 4: Card & Template Controls */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Printer className="w-3 h-3 text-emerald-400" />
            <span>Card Background</span>
          </span>

          <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-900 border border-slate-800 rounded-lg">
            {(['white', 'dark', 'transparent'] as PageBgType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onPageBgChange(type)}
                className={`py-1.5 rounded text-[11px] font-medium capitalize transition cursor-pointer ${
                  pageBg === type
                    ? 'bg-slate-800 text-white shadow-xs font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {hasTemplate && (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={onToggleShowTemplateImage}
                className={`px-2.5 py-1 rounded text-[11px] font-mono border transition cursor-pointer ${
                  showTemplateImage
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                {showTemplateImage ? 'Template: Visible' : 'Template: Hidden'}
              </button>

              {onClearTemplate && (
                <button
                  type="button"
                  onClick={onClearTemplate}
                  title="Remove template"
                  className="p-1 rounded bg-slate-900 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 border border-slate-800 transition cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="h-px bg-slate-800/80" />

        {/* Section 5: Presets (Collapsible) */}
        <PresetManager
          presets={presets}
          onSavePreset={onSavePreset}
          onApplyPreset={onApplyPreset}
          onDeletePreset={onDeletePreset}
          onResetToDefault={onResetToDefault}
          currentDims={{ width: qrWidth, height: qrHeight, x: qrX, y: qrY }}
        />
      </div>
    </aside>
  );
};
