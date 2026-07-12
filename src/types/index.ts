interface BaseAnnotation {
  id: string;
  x: number; // in PDF points (relative to original page size)
  y: number; // in PDF points (relative to original page size)
  width: number; // in PDF points
  height: number; // in PDF points
  opacity?: number; // 0..1
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number; // in PDF points
  fontColor: string; // Hex color
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number; // Multiplier, e.g. 1.2
  highlightColor?: string; // Hex color for background highlight; undefined = none
}

export interface QrAnnotation extends BaseAnnotation {
  type: 'qr';
  data: string; // The content encoded in the QR code (URL or text)
  darkColor: string; // Hex color of the QR modules
}

export type Annotation = TextAnnotation | QrAnnotation;

export interface PdfDocument {
  id: string;
  filename: string;
  fileBytes: Uint8Array; // Original file bytes for export/rendering
  pagesCount: number;
}

export interface PdfPage {
  id: string; // Unique page ID (e.g. 'docId-pageIndex')
  docId: string; // Reference to parent document
  originalPageNumber: number; // 1-based page number in source doc
  rotation: number; // 0, 90, 180, 270 degrees
}

export interface EditorState {
  documents: PdfDocument[];
  pages: PdfPage[]; // Reordered/merged page list representing the active document
  annotations: Record<string, Annotation[]>; // Keyed by unique page ID
  activePageId: string | null; // Currently selected page ID
  selectedAnnotationId: string | null; // Selected text box ID
  zoom: number; // Scale factor, e.g. 1.0
  activeTool: 'select' | 'text' | 'qr';
  undoStack: HistoryState[];
  redoStack: HistoryState[];
}

export interface HistoryState {
  pages: PdfPage[];
  annotations: Record<string, Annotation[]>;
}
