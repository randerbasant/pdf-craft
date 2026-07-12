import * as pdfjsLib from 'pdfjs-dist';
import QRCode from 'qrcode';
import type { Annotation, PdfDocument, PdfPage } from '../types';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

/**
 * Generate a QR code as a PNG data URL.
 * `size` is the pixel resolution of the generated image (kept high so the code
 * stays crisp regardless of how small it is placed on the page).
 */
export async function generateQrDataUrl(
  data: string,
  darkColor: string,
  size = 512
): Promise<string> {
  return QRCode.toDataURL(data || ' ', {
    margin: 1,
    width: size,
    color: { dark: darkColor, light: '#00000000' }, // transparent background
    errorCorrectionLevel: 'M',
  });
}

/**
 * Convert a PNG/JPEG data URL into raw bytes for pdf-lib embedding.
 */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Maps canvas viewport coordinates to original PDF points.
 */
export function canvasToPdfCoords(
  x: number,
  y: number,
  w: number,
  h: number,
  wView: number,
  hView: number,
  wPdf: number,
  hPdf: number,
  rotation: number
): { x: number; y: number; width: number; height: number } {
  // Normalize rotation to 0, 90, 180, 270
  const r = (rotation % 360 + 360) % 360;

  if (r === 90) {
    // Canvas: W_view = H_pdf, H_view = W_pdf
    const scaleX = hPdf / wView;
    const scaleY = wPdf / hView;
    return {
      x: (hView - y - h) * scaleY,
      y: x * scaleX,
      width: h * scaleY,
      height: w * scaleX,
    };
  } else if (r === 180) {
    // Canvas: W_view = W_pdf, H_view = H_pdf
    const scaleX = wPdf / wView;
    const scaleY = hPdf / hView;
    return {
      x: (wView - x - w) * scaleX,
      y: y * scaleY,
      width: w * scaleX,
      height: h * scaleY,
    };
  } else if (r === 270) {
    // Canvas: W_view = H_pdf, H_view = W_pdf
    const scaleX = hPdf / wView;
    const scaleY = wPdf / hView;
    return {
      x: y * scaleY,
      y: (wView - x - w) * scaleX,
      width: h * scaleY,
      height: w * scaleX,
    };
  } else {
    // 0 degrees
    const scaleX = wPdf / wView;
    const scaleY = hPdf / hView;
    return {
      x: x * scaleX,
      y: (hView - y - h) * scaleY,
      width: w * scaleX,
      height: h * scaleY,
    };
  }
}

/**
 * Maps original PDF points to canvas viewport coordinates.
 */
export function pdfToCanvasCoords(
  x: number,
  y: number,
  w: number,
  h: number,
  wView: number,
  hView: number,
  wPdf: number,
  hPdf: number,
  rotation: number
): { x: number; y: number; width: number; height: number } {
  const r = (rotation % 360 + 360) % 360;

  if (r === 90) {
    const scaleX = wView / hPdf;
    const scaleY = hView / wPdf;
    return {
      x: y * scaleX,
      y: hView - (x + w) * scaleY,
      width: h * scaleX,
      height: w * scaleY,
    };
  } else if (r === 180) {
    const scaleX = wView / wPdf;
    const scaleY = hView / hPdf;
    return {
      x: wView - (x + w) * scaleX,
      y: y * scaleY,
      width: w * scaleX,
      height: h * scaleY,
    };
  } else if (r === 270) {
    const scaleX = wView / hPdf;
    const scaleY = hView / wPdf;
    return {
      x: wView - (y + h) * scaleX,
      y: x * scaleY,
      width: h * scaleX,
      height: w * scaleY,
    };
  } else {
    // 0 degrees
    const scaleX = wView / wPdf;
    const scaleY = hView / hPdf;
    return {
      x: x * scaleX,
      y: hView - (y + h) * scaleY,
      width: w * scaleX,
      height: h * scaleY,
    };
  }
}

/**
 * Load PDF file and return information about it
 */
export async function loadPdfInfo(file: File): Promise<{ filename: string; fileBytes: Uint8Array; pagesCount: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);
  
  const loadingTask = pdfjsLib.getDocument({ data: fileBytes.slice() });
  const pdfDoc = await loadingTask.promise;
  
  return {
    filename: file.name,
    fileBytes,
    pagesCount: pdfDoc.numPages,
  };
}

/**
 * Helper to convert hex color string to rgb object
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Helper to resolve standard font styles in pdf-lib
 */
async function resolvePdfFont(
  pdfDoc: PDFDocument,
  fontFamily: string,
  isBold?: boolean,
  isItalic?: boolean
) {
  const family = fontFamily.toLowerCase();
  
  if (family.includes('times')) {
    if (isBold && isItalic) return await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
    if (isBold) return await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    if (isItalic) return await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    return await pdfDoc.embedFont(StandardFonts.TimesRoman);
  } else if (family.includes('courier')) {
    if (isBold && isItalic) return await pdfDoc.embedFont(StandardFonts.CourierBoldOblique);
    if (isBold) return await pdfDoc.embedFont(StandardFonts.CourierBold);
    if (isItalic) return await pdfDoc.embedFont(StandardFonts.CourierOblique);
    return await pdfDoc.embedFont(StandardFonts.Courier);
  } else {
    // Helvetica default
    if (isBold && isItalic) return await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
    if (isBold) return await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    if (isItalic) return await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    return await pdfDoc.embedFont(StandardFonts.Helvetica);
  }
}

/**
 * Exports modified PDF based on active page order, rotations, and annotations
 */
export async function exportModifiedPdf(
  documents: PdfDocument[],
  pages: PdfPage[],
  annotations: Record<string, Annotation[]>
): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();
  
  // Cache source document objects to avoid reloading multiple times
  const loadedDocs: Record<string, PDFDocument> = {};
  for (const doc of documents) {
    loadedDocs[doc.id] = await PDFDocument.load(doc.fileBytes);
  }

  for (const page of pages) {
    const srcDoc = loadedDocs[page.docId];
    if (!srcDoc) continue;

    // Copy page into new document
    const [copiedPage] = await mergedPdf.copyPages(srcDoc, [page.originalPageNumber - 1]);
    const addedPage = mergedPdf.addPage(copiedPage);

    // Set rotation
    addedPage.setRotation(degrees(page.rotation));

    // Draw annotations
    const pageAnns = annotations[page.id] || [];
    for (const ann of pageAnns) {
      if (ann.type === 'text' && ann.text.trim()) {
        const font = await resolvePdfFont(mergedPdf, ann.fontFamily, ann.isBold, ann.isItalic);
        const { r, g, b } = hexToRgb(ann.fontColor);
        const opacity = ann.opacity ?? 1;
        const align = ann.align ?? 'left';
        const lineHeightPts = ann.fontSize * (ann.lineHeight ?? 1.2);

        // Text does not wrap on-screen (only explicit newlines), so we split on
        // \n and lay out each line ourselves. This lets us honor alignment,
        // underline and highlight, none of which pdf-lib's drawText handles.
        const lines = ann.text.split('\n');
        const lineWidths = lines.map((line) => font.widthOfTextAtSize(line, ann.fontSize));
        const blockWidth = Math.max(ann.width, ...lineWidths);

        // ann.y is the bottom edge of the box; ann.height its full height.
        // The first line's baseline sits fontSize below the box top.
        const firstBaselineY = Math.max(0, ann.y + ann.height - ann.fontSize);

        // Highlight background behind the whole text block.
        if (ann.highlightColor) {
          const h = hexToRgb(ann.highlightColor);
          addedPage.drawRectangle({
            x: ann.x,
            y: Math.max(0, ann.y),
            width: blockWidth,
            height: ann.height,
            color: rgb(h.r, h.g, h.b),
            opacity,
          });
        }

        lines.forEach((line, i) => {
          if (!line.trim()) return;
          const lineWidth = lineWidths[i];
          const xOffset =
            align === 'center'
              ? (blockWidth - lineWidth) / 2
              : align === 'right'
              ? blockWidth - lineWidth
              : 0;
          const lineX = ann.x + xOffset;
          const baselineY = firstBaselineY - i * lineHeightPts;

          addedPage.drawText(line, {
            x: lineX,
            y: baselineY,
            size: ann.fontSize,
            font: font,
            color: rgb(r, g, b),
            opacity,
          });

          // pdf-lib has no underline support, so draw it as a line at the baseline.
          if (ann.isUnderline) {
            const underlineY = baselineY - ann.fontSize * 0.12;
            addedPage.drawLine({
              start: { x: lineX, y: underlineY },
              end: { x: lineX + lineWidth, y: underlineY },
              thickness: Math.max(0.5, ann.fontSize * 0.06),
              color: rgb(r, g, b),
              opacity,
            });
          }
        });
      } else if (ann.type === 'qr' && ann.data.trim()) {
        // Render the QR to a PNG and embed it as an image.
        const dataUrl = await generateQrDataUrl(ann.data, ann.darkColor);
        const pngImage = await mergedPdf.embedPng(dataUrlToBytes(dataUrl));
        addedPage.drawImage(pngImage, {
          x: ann.x,
          y: Math.max(0, ann.y),
          width: ann.width,
          height: ann.height,
          opacity: ann.opacity ?? 1,
        });
      }
    }
  }

  return await mergedPdf.save();
}
