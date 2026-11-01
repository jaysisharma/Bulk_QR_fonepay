import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  TARGET_WIDTH_INCH,
  TARGET_HEIGHT_INCH,
  DEFAULT_CUT_LINE_THICKNESS_PT,
  CARD_OPTIONS,
  SHEET_COLS,
  SHEET_ROWS,
  type BgType,
  type PageBgType,
  type AppMode,
  type BulkQrItem,
  type BulkSheetConfig,
  type CardOptionId,
  type CardOptionSize,
  type UploadedQrInfo,
  type TemplateInfo,
  type SavedLayoutState,
  type PresetItem,
} from './types';
import {
  renderPdfPageToDataUrl,
  renderAllPdfPagesToDataUrls,
  readImageToDataUrl,
  trimImageWhitespace,
  createTransparentVersion,
  createInvertedVersion,
} from './utils/imageUtils';
import { HeaderBar } from './components/HeaderBar';
import { CanvasStage } from './components/CanvasStage';
import { InspectorSidebar } from './components/InspectorSidebar';
import { ExportModal } from './components/ExportModal';
import { BulkSheetStage } from './components/BulkSheetStage';
import { BulkManagerSidebar } from './components/BulkManagerSidebar';
import { BulkExportModal } from './components/BulkExportModal';
import { FolderSplitterModal } from './components/FolderSplitterModal';
import {
  saveTemplateToDb,
  loadTemplateFromDb,
  saveCustomQrToDb,
  loadCustomQrFromDb,
  exportProjectBundle,
  type ProjectBundle,
} from './utils/projectStorage';

const STORAGE_KEY = 'qr_template_studio_saved_state';
const PRESETS_KEY = 'qr_template_studio_saved_presets';
const SHEET_GRIDS_KEY = 'qr_template_studio_sheet_grids';
const ACTIVE_CARD_OPTION_KEY = 'qr_template_studio_active_card_option';
const CARD_OPTION_SIZES_KEY = 'qr_template_studio_card_option_sizes';

function getInitialState(): SavedLayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        qrX: typeof parsed.qrX === 'number' ? parsed.qrX : Number(((TARGET_WIDTH_INCH - 1.5) / 2).toFixed(4)),
        qrY: typeof parsed.qrY === 'number' ? parsed.qrY : Number(((TARGET_HEIGHT_INCH - 1.5) / 2).toFixed(4)),
        qrWidth: typeof parsed.qrWidth === 'number' ? parsed.qrWidth : 1.5,
        qrHeight: typeof parsed.qrHeight === 'number' ? parsed.qrHeight : 1.5,
        cardWidth: typeof parsed.cardWidth === 'number' ? parsed.cardWidth : TARGET_WIDTH_INCH,
        cardHeight: typeof parsed.cardHeight === 'number' ? parsed.cardHeight : TARGET_HEIGHT_INCH,
        bgType: parsed.bgType || 'white',
        qrColor: parsed.qrColor || '#000000',
        invertOnBlack: parsed.invertOnBlack ?? true,
        whiteThreshold: typeof parsed.whiteThreshold === 'number' ? parsed.whiteThreshold : 235,
        innerPaddingPx: typeof parsed.innerPaddingPx === 'number' ? parsed.innerPaddingPx : 0,
        autoTrimMargins: parsed.autoTrimMargins ?? true,
        pageBg: parsed.pageBg || 'white',
        pageBgColor: parsed.pageBgColor || '#ffffff',
        showTemplateImage: parsed.showTemplateImage ?? true,
        templateLayer: parsed.templateLayer || 'back',
      };
    }
  } catch (e) {
    console.error('Failed to load saved state from localStorage:', e);
  }
  return {
    qrX: Number(((TARGET_WIDTH_INCH - 1.5) / 2).toFixed(4)),
    qrY: Number(((TARGET_HEIGHT_INCH - 1.5) / 2).toFixed(4)),
    qrWidth: 1.5,
    qrHeight: 1.5,
    cardWidth: TARGET_WIDTH_INCH,
    cardHeight: TARGET_HEIGHT_INCH,
    bgType: 'white',
    qrColor: '#000000',
    invertOnBlack: true,
    whiteThreshold: 235,
    innerPaddingPx: 0,
    autoTrimMargins: true,
    pageBg: 'white',
    pageBgColor: '#ffffff',
    showTemplateImage: true,
    templateLayer: 'back',
  };
}

function getInitialPresets(): PresetItem[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load presets from localStorage:', e);
  }
  return [];
}

// Each card option keeps its own bulk sheet grid (cols × rows and sheet dimensions)
type SheetGrid = Required<Pick<BulkSheetConfig, 'sheetCols' | 'sheetRows' | 'sheetWidthInch' | 'sheetHeightInch'>>;

function getInitialActiveCardOption(): CardOptionId {
  const saved = localStorage.getItem(ACTIVE_CARD_OPTION_KEY);
  return CARD_OPTIONS.some((o) => o.id === saved) ? (saved as CardOptionId) : 'option1';
}

function getInitialCardOptionSizes(): Record<CardOptionId, CardOptionSize> {
  const sizes = Object.fromEntries(CARD_OPTIONS.map((o) => [o.id, o.defaultSize])) as Record<
    CardOptionId,
    CardOptionSize
  >;
  try {
    const raw = localStorage.getItem(CARD_OPTION_SIZES_KEY);
    if (raw) return { ...sizes, ...JSON.parse(raw) };
    // First run: Option 1 adopts the card size the user already had
    const saved = getInitialState();
    sizes.option1 = {
      cardWidth: saved.cardWidth ?? TARGET_WIDTH_INCH,
      cardHeight: saved.cardHeight ?? TARGET_HEIGHT_INCH,
    };
  } catch (e) {
    console.error('Failed to load card option sizes from localStorage:', e);
  }
  return sizes;
}

function getDefaultSheetGrid(cardWidth: number, cardHeight: number): SheetGrid {
  return {
    sheetCols: SHEET_COLS,
    sheetRows: SHEET_ROWS,
    sheetWidthInch: Number((SHEET_COLS * cardWidth).toFixed(4)),
    sheetHeightInch: Number((SHEET_ROWS * cardHeight).toFixed(4)),
  };
}

function getInitialSheetGrids(): Record<string, SheetGrid> {
  try {
    const raw = localStorage.getItem(SHEET_GRIDS_KEY);
    if (raw) {
      const grids = JSON.parse(raw);
      // Grids were briefly keyed by card size preset id before card options existed
      return { option1: grids.default, option2: grids.photo, ...grids };
    }
  } catch (e) {
    console.error('Failed to load sheet grids from localStorage:', e);
  }
  return {};
}

export default function App() {
  // Background Template State
  const [template, setTemplate] = useState<TemplateInfo>({
    url: null,
    name: null,
  });

  // Zoom & Viewport
  const [zoom, setZoom] = useState<number>(1);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  // Load persistent initial layout
  const [initialSaved] = useState<SavedLayoutState>(getInitialState);

  // Card options (Option 1 / Option 2): each has its own card size, template, and sheet grid
  const [activeCardOption, setActiveCardOption] = useState<CardOptionId>(getInitialActiveCardOption);
  const [cardOptionSizes, setCardOptionSizes] = useState<Record<CardOptionId, CardOptionSize>>(getInitialCardOptionSizes);

  // Card physical dimensions (in inches) of the active option - customizable
  const [cardWidth, setCardWidth] = useState<number>(cardOptionSizes[activeCardOption].cardWidth);
  const [cardHeight, setCardHeight] = useState<number>(cardOptionSizes[activeCardOption].cardHeight);

  // QR Overlay state (in physical inches) - preserved across new QR uploads
  const [qrWidth, setQrWidth] = useState<number>(initialSaved.qrWidth);
  const [qrHeight, setQrHeight] = useState<number>(initialSaved.qrHeight);
  const [qrX, setQrX] = useState<number>(initialSaved.qrX);
  const [qrY, setQrY] = useState<number>(initialSaved.qrY);
  const [bgType, setBgType] = useState<BgType>(initialSaved.bgType);
  const [qrColor, setQrColor] = useState<string>(initialSaved.qrColor);
  const [invertOnBlack, setInvertOnBlack] = useState<boolean>(initialSaved.invertOnBlack);
  const [whiteThreshold, setWhiteThreshold] = useState<number>(initialSaved.whiteThreshold);
  const [autoTrimMargins, setAutoTrimMargins] = useState<boolean>(initialSaved.autoTrimMargins);
  const [innerPaddingPx, setInnerPaddingPx] = useState<number>(initialSaved.innerPaddingPx);

  // Page background & print mode state (default white page)
  const [pageBg, setPageBg] = useState<PageBgType>(initialSaved.pageBg || 'white');
  const [pageBgColor, setPageBgColor] = useState<string>(initialSaved.pageBgColor || '#ffffff');
  const [showTemplateImage, setShowTemplateImage] = useState<boolean>(initialSaved.showTemplateImage ?? true);
  const [templateLayer, setTemplateLayer] = useState<'back' | 'front'>(initialSaved.templateLayer || 'back');

  // Presets list
  const [presets, setPresets] = useState<PresetItem[]>(getInitialPresets);

  // Custom Uploaded QR State (PDF or Image)
  const [customQr, setCustomQr] = useState<UploadedQrInfo | null>(null);
  const [isProcessingQr, setIsProcessingQr] = useState<boolean>(false);

  // App Mode: 'single' (Single Card Designer) vs 'bulk' (132 QR Sheet)
  const [mode, setMode] = useState<AppMode>('single');

  // Bulk Sheet State
  const [bulkQrs, setBulkQrs] = useState<BulkQrItem[]>([]);
  const [bulkConfig, setBulkConfig] = useState<BulkSheetConfig>({
    showCutGuides: true,
    cutLineThicknessPt: DEFAULT_CUT_LINE_THICKNESS_PT,
    showSlotNumbers: false,
    fillStrategy: 'blank',
    activeSheetIndex: 0,
  });
  const [sheetGrids, setSheetGrids] = useState<Record<string, SheetGrid>>(getInitialSheetGrids);
  const activeSheetGrid = sheetGrids[activeCardOption] ?? getDefaultSheetGrid(cardWidth, cardHeight);
  const activeSlotsPerSheet = activeSheetGrid.sheetCols * activeSheetGrid.sheetRows;
  const activeBulkConfig: BulkSheetConfig = {
    ...bulkConfig,
    ...activeSheetGrid,
    // Grid may shrink the sheet count when switching card option
    activeSheetIndex: Math.min(
      bulkConfig.activeSheetIndex,
      Math.max(0, Math.ceil(bulkQrs.length / activeSlotsPerSheet) - 1)
    ),
  };
  const [isBulkExportModalOpen, setIsBulkExportModalOpen] = useState<boolean>(false);
  const [isProcessingBulk, setIsProcessingBulk] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<{ message: string; percent: number } | null>(null);

  // Save / Export Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isFolderSplitterOpen, setIsFolderSplitterOpen] = useState<boolean>(false);

  // DOM Refs
  const templateFileInputRef = useRef<HTMLInputElement>(null);
  const qrFileInputRef = useRef<HTMLInputElement>(null);
  const templateStageRef = useRef<HTMLDivElement>(null);
  const bulkMultiFileInputRef = useRef<HTMLInputElement>(null);
  const bulkPdfInputRef = useRef<HTMLInputElement>(null);

  const handleModeChange = (newMode: AppMode) => {
    setMode(newMode);
    if (newMode === 'bulk') {
      setZoom(0.12); // Fit 46.2" x 80.4444" comfortably in viewport
    } else {
      setZoom(1.0);
    }
  };

  // Each card option has its own template: load it whenever the option changes
  useEffect(() => {
    let cancelled = false;
    loadTemplateFromDb(activeCardOption)
      .then((savedTemplate) => {
        if (cancelled) return;
        setTemplate(savedTemplate && savedTemplate.url ? savedTemplate : { url: null, name: null });
      })
      .catch((err) => console.error('Failed to restore template from DB:', err));
    return () => {
      cancelled = true;
    };
  }, [activeCardOption]);

  // Remember the active option's card size (edits, presets and resets all land here)
  useEffect(() => {
    setCardOptionSizes((prev) => {
      const current = prev[activeCardOption];
      if (current.cardWidth === cardWidth && current.cardHeight === cardHeight) return prev;
      const updated = { ...prev, [activeCardOption]: { cardWidth, cardHeight } };
      try {
        localStorage.setItem(CARD_OPTION_SIZES_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to persist card option sizes:', e);
      }
      return updated;
    });
  }, [activeCardOption, cardWidth, cardHeight]);

  // Load persisted QR image from IndexedDB on startup
  useEffect(() => {
    loadCustomQrFromDb()
      .then((savedQr) => {
        if (savedQr) {
          setCustomQr(savedQr);
        }
      })
      .catch((err) => console.error('Failed to restore custom QR from DB:', err));
  }, []);

  // Auto-persist layout changes to localStorage
  useEffect(() => {
    try {
      const stateToSave: SavedLayoutState = {
        qrX,
        qrY,
        qrWidth,
        qrHeight,
        cardWidth,
        cardHeight,
        bgType,
        qrColor,
        invertOnBlack,
        whiteThreshold,
        innerPaddingPx,
        autoTrimMargins,
        pageBg,
        pageBgColor,
        showTemplateImage,
        templateLayer,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.error('Failed to persist layout state:', e);
    }
  }, [qrX, qrY, qrWidth, qrHeight, cardWidth, cardHeight, bgType, qrColor, invertOnBlack, whiteThreshold, innerPaddingPx, autoTrimMargins, pageBg, pageBgColor, showTemplateImage, templateLayer]);

  // Drag interaction state
  const dragInteractionRef = useRef<{
    mode: 'move' | 'resize-se' | 'resize-e' | 'resize-s' | null;
    startX: number;
    startY: number;
    initX: number;
    initY: number;
    initW: number;
    initH: number;
  }>({
    mode: null,
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
    initW: 0,
    initH: 0,
  });

  const handleBgTypeChange = (newBg: BgType) => {
    setBgType(newBg);
    if (newBg === 'black') {
      setQrColor('#ffffff');
    } else if (newBg === 'white') {
      setQrColor('#000000');
    }
  };

  // Re-generate transparent version when tolerance slider changes
  const handleThresholdChange = async (newVal: number) => {
    setWhiteThreshold(newVal);
    if (customQr) {
      try {
        const sourceForProcessing = autoTrimMargins ? customQr.trimmedOriginalUrl : customQr.rawOriginalUrl;
        const newTranspUrl = await createTransparentVersion(sourceForProcessing, newVal);
        setCustomQr((prev) => (prev ? { ...prev, transparentUrl: newTranspUrl } : null));
      } catch (err) {
        console.error('Failed to update transparent threshold:', err);
      }
    }
  };

  // Toggle trimming of white PDF/image quiet zone padding
  const handleToggleAutoTrim = async () => {
    const nextVal = !autoTrimMargins;
    setAutoTrimMargins(nextVal);
    if (customQr) {
      try {
        const source = nextVal ? customQr.trimmedOriginalUrl : customQr.rawOriginalUrl;
        const transparentUrl = await createTransparentVersion(source, whiteThreshold);
        const invertedUrl = await createInvertedVersion(source);
        setCustomQr((prev) => (prev ? { ...prev, transparentUrl, invertedUrl } : null));
      } catch (err) {
        console.error('Failed to toggle auto trim:', err);
      }
    }
  };

  // Preset operations
  const handleSavePreset = (name: string) => {
    const newPreset: PresetItem = {
      id: Date.now().toString(),
      name,
      qrX,
      qrY,
      qrWidth,
      qrHeight,
      cardWidth,
      cardHeight,
      bgType,
      qrColor,
      invertOnBlack,
      whiteThreshold,
      innerPaddingPx,
      autoTrimMargins,
      pageBg,
      pageBgColor,
      showTemplateImage,
      templateLayer,
      updatedAt: new Date().toISOString(),
    };
    const updated = [newPreset, ...presets];
    setPresets(updated);
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save preset to localStorage:', e);
    }
  };

  const handleApplyPreset = (preset: PresetItem) => {
    setQrX(preset.qrX);
    setQrY(preset.qrY);
    setQrWidth(preset.qrWidth);
    setQrHeight(preset.qrHeight);
    if (typeof (preset as any).cardWidth === 'number') setCardWidth((preset as any).cardWidth);
    if (typeof (preset as any).cardHeight === 'number') setCardHeight((preset as any).cardHeight);
    setBgType(preset.bgType);
    setQrColor(preset.qrColor);
    setInvertOnBlack(preset.invertOnBlack);
    setWhiteThreshold(preset.whiteThreshold);
    setInnerPaddingPx(preset.innerPaddingPx);
    setAutoTrimMargins(preset.autoTrimMargins);
    if (preset.pageBg) setPageBg(preset.pageBg);
    if (preset.pageBgColor) setPageBgColor(preset.pageBgColor);
    if (preset.showTemplateImage !== undefined) setShowTemplateImage(preset.showTemplateImage);
    if ((preset as any).templateLayer !== undefined) setTemplateLayer((preset as any).templateLayer);
  };

  const handleDeletePreset = (id: string) => {
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to delete preset from localStorage:', e);
    }
  };

  const handleResetToDefault = () => {
    setCardWidth(TARGET_WIDTH_INCH);
    setCardHeight(TARGET_HEIGHT_INCH);
    setQrWidth(1.5);
    setQrHeight(1.5);
    setQrX(Number(((TARGET_WIDTH_INCH - 1.5) / 2).toFixed(4)));
    setQrY(Number(((TARGET_HEIGHT_INCH - 1.5) / 2).toFixed(4)));
    setInnerPaddingPx(0);
    setAutoTrimMargins(true);
    setPageBg('white');
    setShowTemplateImage(true);
    setTemplateLayer('back');
  };

  // Direct print handler (prints exact 4.2035" x 6.7035" card)
  const handleDirectPrint = () => {
    window.print();
  };

  const handleToggleShowTemplateImage = () => {
    setShowTemplateImage((prev) => !prev);
  };

  // Process Background Template File or Project Bundle (.qrproj / .json)
  const handleProcessTemplateFile = useCallback(async (file: File) => {
    // Check for project backup file (.qrproj / .json)
    if (file.name.toLowerCase().endsWith('.qrproj') || file.type === 'application/json') {
      try {
        const text = await file.text();
        const parsed: ProjectBundle = JSON.parse(text);
        // Projects import into the currently selected card option
        if (parsed.layout) {
          handleApplyPreset(parsed.layout as any);
        }
        if (parsed.template) {
          setTemplate(parsed.template);
          saveTemplateToDb(parsed.template, activeCardOption);
        }
        if (parsed.customQr !== undefined) {
          setCustomQr(parsed.customQr);
          saveCustomQrToDb(parsed.customQr);
        }
        return;
      } catch (e) {
        console.error('Failed to import project backup file:', e);
        alert('Invalid .qrproj project file.');
        return;
      }
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      alert('Please upload an image file (PNG, JPG, SVG, WebP), a PDF, or a .qrproj project file.');
      return;
    }

    const sizeFormatted =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    if (isPdf) {
      try {
        const { dataUrl, width, height } = await renderPdfPageToDataUrl(file, 2.0);
        const newTemplate: TemplateInfo = {
          url: dataUrl,
          name: file.name,
          width,
          height,
          size: sizeFormatted,
        };
        setTemplate(newTemplate);
        saveTemplateToDb(newTemplate, activeCardOption);
      } catch (err) {
        console.error('Failed to parse PDF template:', err);
        alert('Could not render PDF template.');
      }
    } else {
      try {
        const { dataUrl, width, height } = await readImageToDataUrl(file);
        const newTemplate: TemplateInfo = {
          url: dataUrl,
          name: file.name,
          width,
          height,
          size: sizeFormatted,
        };
        setTemplate(newTemplate);
        saveTemplateToDb(newTemplate, activeCardOption);
      } catch (err) {
        console.error('Failed to read image template:', err);
        alert('Could not read image template.');
      }
    }
  }, [activeCardOption]);

  // Process Uploaded QR File (PDF or Image)
  // Preserves existing qrX, qrY, qrWidth, and qrHeight so new QRs load in the exact same position
  const handleProcessQrFile = useCallback(
    async (file: File) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImg = file.type.startsWith('image/');

      if (!isPdf && !isImg) {
        alert('Please upload a valid image (PNG, JPG, SVG, WebP) or PDF file.');
        return;
      }

      setIsProcessingQr(true);
      try {
        let rawDataUrl = '';
        let pageCount = 1;
        let width = 0;
        let height = 0;

        if (isPdf) {
          const res = await renderPdfPageToDataUrl(file, 4.5);
          rawDataUrl = res.dataUrl;
          width = res.width;
          height = res.height;
          pageCount = res.pageCount;
        } else {
          const res = await readImageToDataUrl(file);
          rawDataUrl = res.dataUrl;
          width = res.width;
          height = res.height;
        }

        // Trim white margins / quiet zone padding around the QR code
        const { trimmedUrl, bounds } = await trimImageWhitespace(rawDataUrl, whiteThreshold);

        const activeSource = autoTrimMargins ? trimmedUrl : rawDataUrl;
        const transparentDataUrl = await createTransparentVersion(activeSource, whiteThreshold);
        const invertedDataUrl = await createInvertedVersion(activeSource);

        const newQr: UploadedQrInfo = {
          rawOriginalUrl: rawDataUrl,
          trimmedOriginalUrl: trimmedUrl,
          transparentUrl: transparentDataUrl,
          invertedUrl: invertedDataUrl,
          name: file.name,
          type: isPdf ? 'pdf' : 'image',
          pageCount,
          currentPage: 1,
          width,
          height,
          trimmedBounds: bounds,
        };

        setCustomQr(newQr);
        saveCustomQrToDb(newQr);
      } catch (err) {
        console.error('Error rendering uploaded QR:', err);
        alert('Failed to render uploaded QR file. Please ensure it is a valid PDF or image.');
      } finally {
        setIsProcessingQr(false);
      }
    },
    [autoTrimMargins, whiteThreshold]
  );

  const handleClearTemplate = () => {
    const emptyTemplate = { url: null, name: null };
    setTemplate(emptyTemplate);
    saveTemplateToDb(emptyTemplate, activeCardOption);
    if (templateFileInputRef.current) templateFileInputRef.current.value = '';
  };

  const handleResetToSampleQr = () => {
    setCustomQr(null);
    saveCustomQrToDb(null);
    if (qrFileInputRef.current) qrFileInputRef.current.value = '';
  };

  // Export full project state bundle (.qrproj)
  const handleExportProjectBundle = () => {
    const bundle: ProjectBundle = {
      version: 1,
      layout: {
        qrX,
        qrY,
        qrWidth,
        qrHeight,
        cardWidth,
        cardHeight,
        bgType,
        qrColor,
        invertOnBlack,
        whiteThreshold,
        innerPaddingPx,
        autoTrimMargins,
        pageBg,
        pageBgColor,
        showTemplateImage,
        templateLayer,
        updatedAt: new Date().toISOString(),
      },
      template,
      customQr,
      exportedAt: new Date().toISOString(),
    };
    const baseName = template.name ? template.name.replace(/\.[^/.]+$/, '') : 'qr-card';
    exportProjectBundle(bundle, `${baseName}-project.qrproj`);
  };

  // Bulk File Processors
  // Bulk File Processors - Progressive & Instant Placement
  const handleProcessBulkFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsProcessingBulk(true);
    setBulkProgress({ message: `Reading ${fileArray.length} QR files...`, percent: 0 });

    try {
      const pendingBatch: BulkQrItem[] = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|svg|webp|bmp|gif)$/i.test(file.name);

        if (!isPdf && !isImg) continue;

        let rawUrl = '';
        if (isPdf) {
          const res = await renderPdfPageToDataUrl(file, 4.5);
          rawUrl = res.dataUrl;
        } else {
          const res = await readImageToDataUrl(file);
          rawUrl = res.dataUrl;
        }

        let trimmedUrl = rawUrl;
        let transparentUrl = rawUrl;
        let invertedUrl = rawUrl;

        if (autoTrimMargins) {
          try {
            const trimRes = await trimImageWhitespace(rawUrl, whiteThreshold);
            trimmedUrl = trimRes.trimmedUrl;
          } catch {
            trimmedUrl = rawUrl;
          }
        }

        if (bgType === 'transparent') {
          try {
            transparentUrl = await createTransparentVersion(trimmedUrl, whiteThreshold);
          } catch {
            transparentUrl = trimmedUrl;
          }
        } else if (bgType === 'black' && invertOnBlack) {
          try {
            invertedUrl = await createInvertedVersion(trimmedUrl);
          } catch {
            invertedUrl = trimmedUrl;
          }
        }

        const item: BulkQrItem = {
          id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          rawUrl,
          trimmedUrl,
          transparentUrl,
          invertedUrl,
        };

        pendingBatch.push(item);

        // Progressively push into state so user sees images appear immediately
        if (pendingBatch.length % 5 === 0 || i === fileArray.length - 1) {
          const chunk = [...pendingBatch];
          pendingBatch.length = 0;
          setBulkQrs((prev: BulkQrItem[]) => [...prev, ...chunk]);
        }

        const percent = Math.round(((i + 1) / fileArray.length) * 100);
        setBulkProgress({
          message: `Placed ${i + 1} of ${fileArray.length} QRs in 11×12 grid...`,
          percent,
        });
      }
    } catch (err) {
      console.error('Failed processing bulk files:', err);
      alert('Error processing some files.');
    } finally {
      setIsProcessingBulk(false);
      setBulkProgress(null);
    }
  };

  const handleProcessMultiPagePdf = async (file: File) => {
    setIsProcessingBulk(true);
    setBulkProgress({ message: 'Reading multi-page PDF...', percent: 0 });

    try {
      const pages = await renderAllPdfPagesToDataUrls(file, 4.5, (cur, total) => {
        setBulkProgress({
          message: `Extracting page ${cur} of ${total}...`,
          percent: Math.round((cur / total) * 50),
        });
      });

      const pendingBatch: BulkQrItem[] = [];
      const baseName = file.name.replace(/\.[^/.]+$/, '');

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        let trimmedUrl = page.dataUrl;
        let transparentUrl = page.dataUrl;
        let invertedUrl = page.dataUrl;

        if (autoTrimMargins) {
          try {
            const trimRes = await trimImageWhitespace(page.dataUrl, whiteThreshold);
            trimmedUrl = trimRes.trimmedUrl;
          } catch {
            trimmedUrl = page.dataUrl;
          }
        }

        if (bgType === 'transparent') {
          try {
            transparentUrl = await createTransparentVersion(trimmedUrl, whiteThreshold);
          } catch {
            transparentUrl = trimmedUrl;
          }
        } else if (bgType === 'black' && invertOnBlack) {
          try {
            invertedUrl = await createInvertedVersion(trimmedUrl);
          } catch {
            invertedUrl = trimmedUrl;
          }
        }

        pendingBatch.push({
          id: `${Date.now()}_page_${page.pageNumber}_${Math.random().toString(36).slice(2, 6)}`,
          name: `${baseName} - Page ${page.pageNumber}`,
          rawUrl: page.dataUrl,
          trimmedUrl,
          transparentUrl,
          invertedUrl,
        });

        if (pendingBatch.length % 5 === 0 || i === pages.length - 1) {
          const chunk = [...pendingBatch];
          pendingBatch.length = 0;
          setBulkQrs((prev: BulkQrItem[]) => [...prev, ...chunk]);
        }

        const percent = 50 + Math.round(((i + 1) / pages.length) * 50);
        setBulkProgress({
          message: `Placed QR ${i + 1} of ${pages.length} in grid...`,
          percent,
        });
      }
    } catch (err) {
      console.error('Failed processing multi-page PDF:', err);
      alert('Failed to extract pages from PDF.');
    } finally {
      setIsProcessingBulk(false);
      setBulkProgress(null);
    }
  };

  // Helper to use the single card QR in the bulk sheet
  const handleUseSingleCardQr = () => {
    if (!customQr) return;
    const item: BulkQrItem = {
      id: `single_card_${Date.now()}`,
      name: `${customQr.name} (Single Card)`,
      rawUrl: customQr.rawOriginalUrl,
      trimmedUrl: customQr.trimmedOriginalUrl,
      transparentUrl: customQr.transparentUrl,
      invertedUrl: customQr.invertedUrl,
    };
    setBulkQrs([item]);
  };

  // Helper to load 132 sample QRs instantly (matching app.py demo capability)
  const handleLoadSample132Qrs = () => {
    const samples: BulkQrItem[] = [];
    for (let i = 1; i <= 132; i++) {
      const numStr = String(i).padStart(3, '0');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" fill="black">
        <rect width="120" height="120" fill="white"/>
        <rect x="10" y="10" width="32" height="32" fill="none" stroke="black" stroke-width="8"/>
        <rect x="20" y="20" width="12" height="12" fill="black"/>
        <rect x="78" y="10" width="32" height="32" fill="none" stroke="black" stroke-width="8"/>
        <rect x="88" y="20" width="12" height="12" fill="black"/>
        <rect x="10" y="78" width="32" height="32" fill="none" stroke="black" stroke-width="8"/>
        <rect x="20" y="88" width="12" height="12" fill="black"/>
        <rect x="50" y="15" width="10" height="10"/>
        <rect x="65" y="15" width="8" height="15"/>
        <rect x="15" y="50" width="15" height="8"/>
        <rect x="15" y="65" width="10" height="10"/>
        <rect x="40" y="40" width="40" height="40" rx="6" fill="#4f46e5"/>
        <text x="60" y="65" font-size="13" font-weight="bold" font-family="monospace" fill="white" text-anchor="middle">#${numStr}</text>
        <rect x="85" y="55" width="15" height="10"/>
        <rect x="55" y="85" width="10" height="15"/>
        <rect x="75" y="85" width="15" height="15"/>
        <rect x="95" y="85" width="10" height="10"/>
      </svg>`;
      const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
      samples.push({
        id: `sample_qr_${i}`,
        name: `Sample QR #${numStr}`,
        rawUrl: dataUrl,
        trimmedUrl: dataUrl,
        transparentUrl: dataUrl,
        invertedUrl: dataUrl,
      });
    }
    setBulkQrs(samples);
  };

  const handleClearBulkQrs = () => {
    if (confirm('Clear all uploaded bulk QR codes?')) {
      setBulkQrs([]);
    }
  };

  const handleRemoveBulkQrItem = (id: string) => {
    setBulkQrs((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateBulkConfig = (partial: Partial<BulkSheetConfig>) => {
    const { sheetCols, sheetRows, sheetWidthInch, sheetHeightInch, ...rest } = partial;
    const gridPartial = Object.fromEntries(
      Object.entries({ sheetCols, sheetRows, sheetWidthInch, sheetHeightInch }).filter(([, v]) => v !== undefined)
    ) as Partial<SheetGrid>;
    if (Object.keys(gridPartial).length > 0) {
      // Save grid edits against the currently selected card option only
      setSheetGrids((prev) => {
        const updated = { ...prev, [activeCardOption]: { ...activeSheetGrid, ...gridPartial } };
        try {
          localStorage.setItem(SHEET_GRIDS_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error('Failed to persist sheet grids:', e);
        }
        return updated;
      });
    }
    setBulkConfig((prev) => ({ ...prev, ...rest }));
  };

  const handleCardSizeChange = (newWidth: number, newHeight: number) => {
    const clampedW = Math.max(1, Number(newWidth.toFixed(4)));
    const clampedH = Math.max(1, Number(newHeight.toFixed(4)));
    setCardWidth(clampedW);
    setCardHeight(clampedH);
    if (qrX + qrWidth > clampedW) {
      setQrX(Math.max(0, Number((clampedW - qrWidth).toFixed(4))));
    }
    if (qrY + qrHeight > clampedH) {
      setQrY(Math.max(0, Number((clampedH - qrHeight).toFixed(4))));
    }
  };

  const handleCardOptionChange = (option: CardOptionId) => {
    if (option === activeCardOption) return;
    setActiveCardOption(option);
    try {
      localStorage.setItem(ACTIVE_CARD_OPTION_KEY, option);
    } catch (e) {
      console.error('Failed to persist active card option:', e);
    }
    const size = cardOptionSizes[option];
    handleCardSizeChange(size.cardWidth, size.cardHeight);
  };

  // Center QR in template
  const handleCenter = () => {
    setQrX(Number(((cardWidth - qrWidth) / 2).toFixed(4)));
    setQrY(Number(((cardHeight - qrHeight) / 2).toFixed(4)));
  };

  // Quick alignment
  const handleQuickAlign = (x: number, y: number) => {
    setQrX(x);
    setQrY(y);
  };

  // Width change handler (strictly independent - never modifies height)
  const handleWidthChange = (newW: number) => {
    const clampedW = Math.max(0.3, Math.min(cardWidth, Number(newW.toFixed(4))));
    setQrWidth(clampedW);
    if (qrX + clampedW > cardWidth) {
      setQrX(Number((cardWidth - clampedW).toFixed(4)));
    }
  };

  // Height change handler (strictly independent - never modifies width)
  const handleHeightChange = (newH: number) => {
    const clampedH = Math.max(0.3, Math.min(cardHeight, Number(newH.toFixed(4))));
    setQrHeight(clampedH);
    if (qrY + clampedH > cardHeight) {
      setQrY(Number((cardHeight - clampedH).toFixed(4)));
    }
  };

  // Direct mouse drag and resize on the canvas
  const handleStartDrag = (
    e: React.MouseEvent,
    mode: 'move' | 'resize-se' | 'resize-e' | 'resize-s'
  ) => {
    e.stopPropagation();
    e.preventDefault();

    dragInteractionRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      initX: qrX,
      initY: qrY,
      initW: qrWidth,
      initH: qrHeight,
    };

    const handlePointerMove = (moveEvt: MouseEvent) => {
      const current = dragInteractionRef.current;
      if (!current.mode || !templateStageRef.current) return;

      const rect = templateStageRef.current.getBoundingClientRect();
      const pxPerInch = rect.width / cardWidth;

      const dx = (moveEvt.clientX - current.startX) / pxPerInch;
      const dy = (moveEvt.clientY - current.startY) / pxPerInch;

      if (current.mode === 'move') {
        const nextX = Math.max(0, Math.min(cardWidth - current.initW, current.initX + dx));
        const nextY = Math.max(0, Math.min(cardHeight - current.initH, current.initY + dy));
        setQrX(Number(nextX.toFixed(4)));
        setQrY(Number(nextY.toFixed(4)));
      } else if (current.mode === 'resize-se') {
        const nextW = Math.max(0.3, Math.min(cardWidth - current.initX, current.initW + dx));
        const nextH = Math.max(0.3, Math.min(cardHeight - current.initY, current.initH + dy));
        setQrWidth(Number(nextW.toFixed(4)));
        setQrHeight(Number(nextH.toFixed(4)));
      } else if (current.mode === 'resize-e') {
        const nextW = Math.max(0.3, Math.min(cardWidth - current.initX, current.initW + dx));
        setQrWidth(Number(nextW.toFixed(4)));
      } else if (current.mode === 'resize-s') {
        const nextH = Math.max(0.3, Math.min(cardHeight - current.initY, current.initH + dy));
        setQrHeight(Number(nextH.toFixed(4)));
      }
    };

    const handlePointerUp = () => {
      dragInteractionRef.current.mode = null;
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
  };

  // Determine active QR image URL
  const activeQrImageUrl = customQr
    ? bgType === 'transparent'
      ? customQr.transparentUrl
      : bgType === 'black' && invertOnBlack
      ? customQr.invertedUrl
      : autoTrimMargins
      ? customQr.trimmedOriginalUrl
      : customQr.rawOriginalUrl
    : null;

  return (
    <div
      className="flex h-screen w-screen bg-[#090a0f] text-slate-100 select-none overflow-hidden font-sans"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingFile(false);
        if (mode === 'bulk' && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          if (e.dataTransfer.files.length === 1 && e.dataTransfer.files[0].type === 'application/pdf') {
            handleProcessMultiPagePdf(e.dataTransfer.files[0]);
          } else {
            handleProcessBulkFiles(e.dataTransfer.files);
          }
        } else {
          const file = e.dataTransfer.files?.[0];
          if (file) handleProcessTemplateFile(file);
        }
      }}
    >
      {/* Hidden File Inputs */}
      <input
        ref={templateFileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleProcessTemplateFile(file);
        }}
        className="hidden"
      />
      <input
        ref={qrFileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleProcessQrFile(file);
        }}
        className="hidden"
      />
      <input
        ref={bulkMultiFileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        onChange={(e) => {
          if (e.target.files) handleProcessBulkFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={bulkPdfInputRef}
        type="file"
        accept="application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleProcessMultiPagePdf(file);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <HeaderBar
          mode={mode}
          onModeChange={handleModeChange}
          zoom={zoom}
          onZoomChange={setZoom}
          onDirectPrint={handleDirectPrint}
          onOpenExportModal={() => setIsExportModalOpen(true)}
          bulkCount={bulkQrs.length}
          onOpenBulkExportModal={() => setIsBulkExportModalOpen(true)}
          onOpenFolderSplitter={() => setIsFolderSplitterOpen(true)}
          onUploadQr={() => qrFileInputRef.current?.click()}
          templateLayer={templateLayer}
          onToggleTemplateLayer={() => setTemplateLayer((prev) => (prev === 'back' ? 'front' : 'back'))}
        />

        {mode === 'single' ? (
          <CanvasStage
            zoom={zoom}
            templateUrl={template.url}
            isDraggingFile={isDraggingFile}
            templateStageRef={templateStageRef}
            onOpenTemplatePicker={() => templateFileInputRef.current?.click()}
            pageBg={pageBg}
            pageBgColor={pageBgColor}
            showTemplateImage={showTemplateImage}
            templateLayer={templateLayer}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            qrX={qrX}
            qrY={qrY}
            qrWidth={qrWidth}
            qrHeight={qrHeight}
            bgType={bgType}
            qrColor={qrColor}
            activeQrImageUrl={activeQrImageUrl}
            innerPaddingPx={innerPaddingPx}
            onStartDrag={handleStartDrag}
          />
        ) : (
          <BulkSheetStage
            zoom={zoom}
            layout={{
              qrX,
              qrY,
              qrWidth,
              qrHeight,
              cardWidth,
              cardHeight,
              bgType,
              qrColor,
              invertOnBlack,
              whiteThreshold,
              innerPaddingPx,
              autoTrimMargins,
              pageBg,
              pageBgColor,
              showTemplateImage,
            }}
            template={template}
            bulkQrs={bulkQrs}
            customQr={customQr}
            config={activeBulkConfig}
            onOpenBulkPicker={() => bulkMultiFileInputRef.current?.click()}
            onOpenMultiPagePdfPicker={() => bulkPdfInputRef.current?.click()}
            onLoadSample132={handleLoadSample132Qrs}
          />
        )}
      </div>

      {/* Right Fixed Sidebar */}
      {mode === 'single' ? (
        <InspectorSidebar
          onOpenExportModal={() => setIsExportModalOpen(true)}
          pageBg={pageBg}
          onPageBgChange={setPageBg}
          showTemplateImage={showTemplateImage}
          onToggleShowTemplateImage={handleToggleShowTemplateImage}
          templateLayer={templateLayer}
          onToggleTemplateLayer={() => setTemplateLayer((prev) => (prev === 'back' ? 'front' : 'back'))}
          hasTemplate={!!template.url}
          onClearTemplate={handleClearTemplate}
          onDirectPrint={handleDirectPrint}
          customQr={customQr}
          isProcessingQr={isProcessingQr}
          onOpenQrPicker={() => qrFileInputRef.current?.click()}
          onResetToSampleQr={handleResetToSampleQr}
          presets={presets}
          onSavePreset={handleSavePreset}
          onApplyPreset={handleApplyPreset}
          onDeletePreset={handleDeletePreset}
          onResetToDefault={handleResetToDefault}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          onCardSizeChange={handleCardSizeChange}
          activeCardOption={activeCardOption}
          cardOptionSizes={cardOptionSizes}
          onCardOptionChange={handleCardOptionChange}
          autoTrimMargins={autoTrimMargins}
          onToggleAutoTrim={handleToggleAutoTrim}
          innerPaddingPx={innerPaddingPx}
          onInnerPaddingChange={setInnerPaddingPx}
          bgType={bgType}
          onBgTypeChange={handleBgTypeChange}
          qrColor={qrColor}
          onQrColorChange={setQrColor}
          whiteThreshold={whiteThreshold}
          onWhiteThresholdChange={handleThresholdChange}
          invertOnBlack={invertOnBlack}
          onInvertOnBlackChange={setInvertOnBlack}
          qrWidth={qrWidth}
          qrHeight={qrHeight}
          onMakeSquare={() => {
            const squareSize = Math.min(qrWidth, qrHeight);
            setQrWidth(squareSize);
            setQrHeight(squareSize);
          }}
          onWidthChange={handleWidthChange}
          onHeightChange={handleHeightChange}
          qrX={qrX}
          qrY={qrY}
          onXChange={setQrX}
          onYChange={setQrY}
          onCenter={handleCenter}
          onQuickAlign={handleQuickAlign}
        />
      ) : (
        <BulkManagerSidebar
          bulkQrs={bulkQrs}
          customQr={customQr}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          activeCardOption={activeCardOption}
          cardOptionSizes={cardOptionSizes}
          onCardOptionChange={handleCardOptionChange}
          layout={{
            qrX,
            qrY,
            qrWidth,
            qrHeight,
            cardWidth,
            cardHeight,
            bgType,
            qrColor,
            invertOnBlack,
            whiteThreshold,
            innerPaddingPx,
            autoTrimMargins,
            pageBg,
            pageBgColor,
            showTemplateImage,
            templateLayer,
          }}
          config={activeBulkConfig}
          isProcessing={isProcessingBulk}
          processingProgress={bulkProgress}
          onOpenMultiFilePicker={() => bulkMultiFileInputRef.current?.click()}
          onOpenMultiPagePdfPicker={() => bulkPdfInputRef.current?.click()}
          onUseSingleCardQr={handleUseSingleCardQr}
          onLoadSample132={handleLoadSample132Qrs}
          onClearBulkQrs={handleClearBulkQrs}
          onRemoveQrItem={handleRemoveBulkQrItem}
          onUpdateConfig={handleUpdateBulkConfig}
          onOpenBulkExportModal={() => setIsBulkExportModalOpen(true)}
          onDirectPrint={handleDirectPrint}
          onOpenFolderSplitter={() => setIsFolderSplitterOpen(true)}
        />
      )}

      {/* Save & Export Card Dialog */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        options={{
          templateUrl: template.url,
          activeQrImageUrl,
          qrX,
          qrY,
          qrWidth,
          qrHeight,
          cardWidth,
          cardHeight,
          bgType,
          qrColor,
          innerPaddingPx,
          pageBg,
          pageBgColor,
          showTemplateImage,
          templateLayer,
        }}
        onExportProjectBundle={handleExportProjectBundle}
      />

      {/* Save & Export Bulk Sheet Dialog */}
      <BulkExportModal
        isOpen={isBulkExportModalOpen}
        onClose={() => setIsBulkExportModalOpen(false)}
        layout={{
          qrX,
          qrY,
          qrWidth,
          qrHeight,
          cardWidth,
          cardHeight,
          bgType,
          qrColor,
          invertOnBlack,
          whiteThreshold,
          innerPaddingPx,
          autoTrimMargins,
          pageBg,
          pageBgColor,
          showTemplateImage,
        }}
        template={template}
        bulkQrs={bulkQrs}
        customQr={customQr}
        config={activeBulkConfig}
      />

      {/* Split Large Folder (132 per Folder) Dialog */}
      <FolderSplitterModal
        isOpen={isFolderSplitterOpen}
        onClose={() => setIsFolderSplitterOpen(false)}
      />
    </div>
  );
}
