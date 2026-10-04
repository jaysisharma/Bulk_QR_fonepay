export const TARGET_WIDTH_INCH = 4.2035;
export const TARGET_HEIGHT_INCH = 6.7035;

// 132 QR Bulk Sheet Constants (11 cols × 12 rows = 132 QRs)
export const SHEET_COLS = 11;
export const SHEET_ROWS = 12;
export const SHEET_TOTAL_SLOTS = 132;
export const SHEET_CELL_WIDTH_INCH = TARGET_WIDTH_INCH; // 4.2035"
export const SHEET_CELL_HEIGHT_INCH = TARGET_HEIGHT_INCH; // 6.7035"
export const SHEET_WIDTH_INCH = Number((SHEET_COLS * SHEET_CELL_WIDTH_INCH).toFixed(4)); // 46.2385"
export const SHEET_HEIGHT_INCH = Number((SHEET_ROWS * SHEET_CELL_HEIGHT_INCH).toFixed(4)); // 80.4420"

export type AppMode = 'single' | 'bulk';
export type BgType = 'white' | 'black' | 'transparent';
export type PageBgType = 'white' | 'dark' | 'transparent' | 'custom';

export interface BulkQrItem {
  id: string;
  name: string;
  rawUrl: string;
  trimmedUrl: string;
  transparentUrl: string;
  invertedUrl: string;
}

export interface BulkSheetConfig {
  showCutGuides: boolean;
  showSlotNumbers: boolean;
  fillStrategy: 'blank' | 'repeat';
  activeSheetIndex: number;
}

export interface UploadedQrInfo {
  rawOriginalUrl: string;
  trimmedOriginalUrl: string;
  transparentUrl: string;
  invertedUrl: string;
  name: string;
  type: 'image' | 'pdf';
  pageCount?: number;
  currentPage?: number;
  width?: number;
  height?: number;
  trimmedBounds?: { x: number; y: number; width: number; height: number };
}

export interface TemplateInfo {
  url: string | null;
  name: string | null;
  width?: number;
  height?: number;
  size?: string;
}

export interface QrOverlayCoords {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SavedLayoutState {
  qrX: number;
  qrY: number;
  qrWidth: number;
  qrHeight: number;
  bgType: BgType;
  qrColor: string;
  invertOnBlack: boolean;
  whiteThreshold: number;
  innerPaddingPx: number;
  autoTrimMargins: boolean;
  pageBg?: PageBgType;
  pageBgColor?: string;
  showTemplateImage?: boolean;
  updatedAt?: string;
}

export interface PresetItem extends SavedLayoutState {
  id: string;
  name: string;
}
