import { Upload, Maximize2, Sparkles, Printer } from 'lucide-react';
import { TARGET_WIDTH_INCH, TARGET_HEIGHT_INCH, type BgType, type PageBgType } from '../types';
import { QrOverlay } from './QrOverlay';

interface CanvasStageProps {
  zoom: number;
  templateUrl: string | null;
  isDraggingFile: boolean;
  templateStageRef: React.RefObject<HTMLDivElement | null>;
  onOpenTemplatePicker: () => void;
  // Page background & print props
  pageBg: PageBgType;
  pageBgColor?: string;
  showTemplateImage?: boolean;
  // QR overlay props
  qrX: number;
  qrY: number;
  qrWidth: number;
  qrHeight: number;
  bgType: BgType;
  qrColor: string;
  activeQrImageUrl: string | null;
  cardWidth?: number;
  cardHeight?: number;
  onStartDrag: (
    e: React.MouseEvent,
    mode: 'move' | 'resize-se' | 'resize-e' | 'resize-s'
  ) => void;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  zoom,
  templateUrl,
  isDraggingFile,
  templateStageRef,
  onOpenTemplatePicker,
  pageBg = 'white',
  pageBgColor = '#ffffff',
  showTemplateImage = true,
  cardWidth = TARGET_WIDTH_INCH,
  cardHeight = TARGET_HEIGHT_INCH,
  qrX,
  qrY,
  qrWidth,
  qrHeight,
  bgType,
  qrColor,
  activeQrImageUrl,
  innerPaddingPx,
  onStartDrag,
}) => {
  const isWhitePage = pageBg === 'white';

  return (
    <main className="flex-1 relative overflow-auto p-8 flex items-center justify-center bg-[radial-gradient(#1e2230_1px,transparent_1px)] [background-size:20px_20px]">
      <div
        id="printable-card-wrapper"
        className="flex items-center justify-center shrink-0"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
      >
        {/* The 4.2035" x 6.7035" Template Container */}
        <div
          ref={templateStageRef}
          id="printable-card"
          className={`relative rounded-xl overflow-hidden select-none transition-all shadow-2xl ${
            isWhitePage
              ? 'bg-white ring-1 ring-slate-300 shadow-xl shadow-black/20'
              : pageBg === 'dark'
              ? 'bg-[#0f172a] ring-1 ring-slate-700/60 shadow-indigo-950/40'
              : 'bg-transparent ring-2 ring-slate-700 ring-dashed'
          } ${!templateUrl ? 'cursor-pointer' : ''}`}
          style={{
            width: `${cardWidth}in`,
            height: `${cardHeight}in`,
            minWidth: `${cardWidth}in`,
            minHeight: `${cardHeight}in`,
            maxWidth: `${cardWidth}in`,
            maxHeight: `${cardHeight}in`,
            backgroundColor:
              isWhitePage
                ? '#ffffff'
                : pageBg === 'dark'
                ? '#0f172a'
                : pageBg === 'custom'
                ? pageBgColor || '#ffffff'
                : 'transparent',
            boxSizing: 'border-box',
          }}
          onClick={() => {
            if (!templateUrl) onOpenTemplatePicker();
          }}
        >
          {/* Dimensions & Print-Ready badge */}
          <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[10px] font-mono text-slate-300 shadow-sm pointer-events-none print:hidden print-hide">
            <Maximize2 className="w-3 h-3 text-indigo-400" />
            <span>{cardWidth}&quot; × {cardHeight}&quot;</span>
            {isWhitePage && (
              <span className="ml-1 pl-1 border-l border-slate-700 text-emerald-400 font-sans flex items-center gap-1">
                <Printer className="w-2.5 h-2.5" />
                White Print Page
              </span>
            )}
          </div>

          {templateUrl && showTemplateImage ? (
            /* Background Template Image - fills exact card space without letterboxing */
            <img
              src={templateUrl}
              alt="Template"
              className="absolute inset-0 w-full h-full object-fill pointer-events-none block select-none"
              draggable={false}
            />
          ) : !templateUrl ? (
            /* Empty Upload Prompt / Clean White Card Indicator */
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-3 pointer-events-none print:hidden print-hide ${
                isWhitePage ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
                  isWhitePage
                    ? 'bg-slate-100 border border-slate-200 text-slate-400'
                    : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
                }`}
              >
                <Upload className="w-5 h-5 opacity-70" />
              </div>
              <div className="space-y-1">
                <h3
                  className={`text-xs font-semibold ${
                    isWhitePage ? 'text-slate-700' : 'text-slate-200'
                  }`}
                >
                  {isWhitePage ? 'White Page (Print Ready)' : 'Upload Card Template'}
                </h3>
                <p className="text-[11px] opacity-75 max-w-[200px] leading-relaxed">
                  {isWhitePage
                    ? 'Clean white background ready for printing. Click anywhere to add a template image.'
                    : 'Click or drag your background template (Image or PDF)'}
                </p>
              </div>
            </div>
          ) : null}

          {/* QR Code Overlay Element */}
          <QrOverlay
            qrX={qrX}
            qrY={qrY}
            qrWidth={qrWidth}
            qrHeight={qrHeight}
            bgType={bgType}
            qrColor={qrColor}
            activeQrImageUrl={activeQrImageUrl}
            innerPaddingPx={innerPaddingPx}
            onStartDrag={onStartDrag}
          />
        </div>
      </div>

      {/* Drag Overlay Hint */}
      {isDraggingFile && (
        <div className="absolute inset-0 bg-indigo-950/50 backdrop-blur-xs flex items-center justify-center pointer-events-none z-30">
          <div className="px-6 py-4 rounded-2xl bg-slate-900 border border-indigo-500/50 text-indigo-300 flex items-center gap-3 shadow-2xl text-sm font-medium">
            <Sparkles className="w-5 h-5 text-indigo-400 animate-spin" />
            <span>Drop image or PDF to load template</span>
          </div>
        </div>
      )}
    </main>
  );
};
