import {
  TARGET_WIDTH_INCH,
  TARGET_HEIGHT_INCH,
  type BgType,
  type UploadedQrInfo,
  type TemplateInfo,
} from '../types';

interface StatusBarProps {
  template: TemplateInfo;
  customQr: UploadedQrInfo | null;
  qrX: number;
  qrY: number;
  qrWidth: number;
  qrHeight: number;
  bgType: BgType;
  autoTrimMargins: boolean;
  cardWidth?: number;
  cardHeight?: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  template,
  customQr,
  qrX,
  qrY,
  qrWidth,
  qrHeight,
  bgType,
  autoTrimMargins,
  cardWidth = TARGET_WIDTH_INCH,
  cardHeight = TARGET_HEIGHT_INCH,
}) => {
  return (
    <footer className="h-8 border-t border-slate-800/80 bg-slate-950/80 px-5 flex items-center justify-between text-xs text-slate-400 shrink-0 font-mono">
      <div className="flex items-center gap-3">
        <span>Card: {cardWidth}&quot; × {cardHeight}&quot;</span>
        {template.name && (
          <span className="text-slate-300 max-w-36 truncate">{template.name}</span>
        )}
        {template.width && template.height && (
          <span>({template.width}×{template.height}px, {template.size})</span>
        )}
        <span>•</span>
        <span>
          QR: {qrWidth}&quot; × {qrHeight}&quot; at ({qrX}&quot;, {qrY}&quot;)
        </span>
      </div>
      <div className="flex items-center gap-2">
        {customQr ? (
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Custom QR: {customQr.name} {autoTrimMargins ? '(Edge-Trimmed)' : '(Raw)'}
          </span>
        ) : (
          <span className="text-slate-500">Sample QR (Default)</span>
        )}
        <span className="text-slate-600">|</span>
        <span className="text-slate-300">
          BG: <strong className="text-indigo-400 uppercase">{bgType}</strong>
        </span>
      </div>
    </footer>
  );
};
