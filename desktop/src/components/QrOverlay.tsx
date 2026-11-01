import type { BgType } from '../types';

interface QrOverlayProps {
  qrX: number;
  qrY: number;
  qrWidth: number;
  qrHeight: number;
  bgType: BgType;
  qrColor: string;
  activeQrImageUrl: string | null;
  innerPaddingPx: number;
  onStartDrag: (
    e: React.MouseEvent,
    mode: 'move' | 'resize-se' | 'resize-e' | 'resize-s'
  ) => void;
}

export const QrOverlay: React.FC<QrOverlayProps> = ({
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
  return (
    <div
      className={`absolute group cursor-move z-20 flex flex-col items-center justify-center outline outline-2 outline-indigo-500/90 print:outline-none shadow-2xl print:shadow-none ${bgType === 'white'
        ? 'bg-white'
        : bgType === 'black'
          ? 'bg-black'
          : 'bg-transparent'
        }`}
      style={{
        left: `${qrX}in`,
        top: `${qrY}in`,
        width: `${qrWidth}in`,
        height: `${qrHeight}in`,
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => onStartDrag(e, 'move')}
    >
      {/* Content Container with user-defined inner padding */}
      {activeQrImageUrl ? (
        <div
          className="w-full h-full flex items-center justify-center overflow-hidden"
          style={{ padding: `${innerPaddingPx}px` }}
        >
          <img
            src={activeQrImageUrl}
            alt="Uploaded QR Code"
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
      ) : (
        /* SVG Sample QR Code (Stretches exactly with width and height independently) */
        <div
          className="w-full h-full flex items-center justify-center overflow-hidden"
          style={{ padding: `${innerPaddingPx}px` }}
        >
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none transition-colors block"
            style={{ width: '100%', height: '100%' }}
            fill={qrColor}
          >
            {/* Standard QR Corners & Data Pattern */}
            <rect x="5" y="5" width="28" height="28" rx="2" fill="none" stroke={qrColor} strokeWidth="6" />
            <rect x="13" y="13" width="12" height="12" fill={qrColor} />

            <rect x="67" y="5" width="28" height="28" rx="2" fill="none" stroke={qrColor} strokeWidth="6" />
            <rect x="75" y="13" width="12" height="12" fill={qrColor} />

            <rect x="5" y="67" width="28" height="28" rx="2" fill="none" stroke={qrColor} strokeWidth="6" />
            <rect x="13" y="75" width="12" height="12" fill={qrColor} />

            {/* Matrix Mock Pattern */}
            <rect x="42" y="10" width="7" height="7" />
            <rect x="52" y="10" width="7" height="7" />
            <rect x="42" y="24" width="7" height="7" />
            <rect x="10" y="42" width="7" height="7" />
            <rect x="24" y="42" width="7" height="7" />
            <rect x="42" y="42" width="16" height="16" rx="1" />
            <rect x="68" y="42" width="7" height="7" />
            <rect x="80" y="42" width="7" height="7" />
            <rect x="42" y="68" width="7" height="7" />
            <rect x="55" y="68" width="7" height="7" />
            <rect x="68" y="68" width="8" height="8" />
            <rect x="80" y="80" width="8" height="8" />
            <rect x="68" y="80" width="7" height="7" />
          </svg>
        </div>
      )}

      {/* Floating Dimension Tag on overlay */}
      <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/95 text-indigo-300 border border-slate-700/80 text-[10px] font-mono px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-30 print:hidden print-hide">
        {qrWidth}&quot; × {qrHeight}&quot; ({bgType})
      </div>

      {/* Resize Handle (Bottom-Right) */}
      <div
        className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-indigo-500 hover:bg-indigo-400 border border-white rounded-full cursor-se-resize shadow-md z-30 print:hidden print-hide"
        onMouseDown={(e) => onStartDrag(e, 'resize-se')}
        title="Drag to resize"
      />

      {/* Resize Handle (Right edge - Width) */}
      <div
        className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-4 bg-indigo-500/80 hover:bg-indigo-400 rounded-sm cursor-e-resize z-30 print:hidden print-hide"
        onMouseDown={(e) => onStartDrag(e, 'resize-e')}
        title="Drag width"
      />

      {/* Resize Handle (Bottom edge - Height) */}
      <div
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-indigo-500/80 hover:bg-indigo-400 rounded-sm cursor-s-resize z-30 print:hidden print-hide"
        onMouseDown={(e) => onStartDrag(e, 'resize-s')}
        title="Drag height"
      />
    </div>
  );
};
