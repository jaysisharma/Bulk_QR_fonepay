// Default Card Dimensions (in inches)
export const DEFAULT_CARD_WIDTH_INCH = 4.2035;
export const DEFAULT_CARD_HEIGHT_INCH = 6.7035;
export const TARGET_WIDTH_INCH = DEFAULT_CARD_WIDTH_INCH;
export const TARGET_HEIGHT_INCH = DEFAULT_CARD_HEIGHT_INCH;

// Default Bulk Sheet Constants (11 cols × 12 rows = 132 QRs)
export const SHEET_COLS = 11;
export const SHEET_ROWS = 12;
export const SHEET_TOTAL_SLOTS = 132;
export const SHEET_CELL_WIDTH_INCH = DEFAULT_CARD_WIDTH_INCH; // 4.2035"
export const SHEET_CELL_HEIGHT_INCH = DEFAULT_CARD_HEIGHT_INCH; // 6.7035"
export const SHEET_WIDTH_INCH = Number((SHEET_COLS * SHEET_CELL_WIDTH_INCH).toFixed(4)); // 46.2385"
export const SHEET_HEIGHT_INCH = Number((SHEET_ROWS * SHEET_CELL_HEIGHT_INCH).toFixed(4)); // 80.4420"

export interface PaperPreset {
  id: string;
  name: string;
  widthInch: number;
  heightInch: number;
}

export const CARD_SIZE_PRESETS: PaperPreset[] = [
  { id: 'default', name: 'Default Card (4.20" × 6.70")', widthInch: 4.2035, heightInch: 6.7035 },
  { id: 'cr80', name: 'ID Card / CR80 (2.125" × 3.375")', widthInch: 2.125, heightInch: 3.375 },
  { id: 'business', name: 'Business Card (2.0" × 3.5")', widthInch: 2.0, heightInch: 3.5 },
  { id: 'a6', name: 'A6 Card (4.13" × 5.83")', widthInch: 4.13, heightInch: 5.83 },
  { id: 'a7', name: 'A7 Card (2.91" × 4.13")', widthInch: 2.91, heightInch: 4.13 },
  { id: 'photo', name: 'Postcard / Photo (4.0" × 6.0")', widthInch: 4.0, heightInch: 6.0 },
  { id: 'square', name: 'Square Card (4.0" × 4.0")', widthInch: 4.0, heightInch: 4.0 },
];

export const SHEET_SIZE_PRESETS: PaperPreset[] = [
  { id: 'plotter', name: 'Wide Plotter (46.2" × 80.4")', widthInch: 46.2385, heightInch: 80.442 },
  { id: 'a4', name: 'A4 Sheet (8.27" × 11.69")', widthInch: 8.27, heightInch: 11.69 },
  { id: 'a3', name: 'A3 Sheet (11.69" × 16.54")', widthInch: 11.69, heightInch: 16.54 },
  { id: 'letter', name: 'US Letter (8.5" × 11.0")', widthInch: 8.5, heightInch: 11.0 },
  { id: 'legal', name: 'US Legal (8.5" × 14.0")', widthInch: 8.5, heightInch: 14.0 },
  { id: 'arch_d', name: 'Arch D (24.0" × 36.0")', widthInch: 24.0, heightInch: 36.0 },
  { id: 'arch_e', name: 'Arch E (36.0" × 48.0")', widthInch: 36.0, heightInch: 48.0 },
];

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
  sheetWidthInch?: number;
  sheetHeightInch?: number;
  sheetCols?: number;
  sheetRows?: number;
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
  cardWidth?: number;
  cardHeight?: number;
  updatedAt?: string;
}

export interface PresetItem extends SavedLayoutState {
  id: string;
  name: string;
}
