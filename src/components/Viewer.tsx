import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Stage,
  Layer,
  Text as KonvaText,
  Rect as KonvaRect,
  Image as KonvaImage,
  Transformer,
} from 'react-konva';
import { Upload } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { usePdfStore } from '../store/usePdfStore';
import { canvasToPdfCoords, pdfToCanvasCoords, loadPdfInfo } from '../utils/pdfHelpers';
import { generateQrDataUrl } from '../utils/pdfHelpers';
import type { PdfPage, Annotation, TextAnnotation, QrAnnotation } from '../types';

interface TextareaOverlayProps {
  ann: TextAnnotation;
  pageId: string;
  dimensions: { wView: number; hView: number; wPdf: number; hPdf: number };
  rotation: number;
  updateAnnotation: (pageId: string, annId: string, updates: Partial<Annotation>) => void;
  setEditingAnnId: (id: string | null) => void;
}

const TextareaOverlay: React.FC<TextareaOverlayProps> = ({
  ann,
  pageId,
  dimensions,
  rotation,
  updateAnnotation,
  setEditingAnnId,
}) => {
  const [editText, setEditText] = useState(ann.text);
  const textRef = useRef(editText);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    textRef.current = editText;
  }, [editText]);

  // Grow the textarea to fit its content on every keystroke so it matches the
  // no-wrap Konva text (only Shift+Enter creates a new line).
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.width = 'auto';
    el.style.height = 'auto';
    setBoxSize({ w: el.scrollWidth, h: el.scrollHeight });
  }, [editText, ann.fontSize, ann.fontFamily, ann.isBold, ann.isItalic, ann.lineHeight]);

  // Save on unmount
  useEffect(() => {
    return () => {
      updateAnnotation(pageId, ann.id, { text: textRef.current });
    };
  }, [ann.id, pageId, updateAnnotation]);

  const screenPos = pdfToCanvasCoords(
    ann.x,
    ann.y,
    ann.width,
    ann.height,
    dimensions.wView,
    dimensions.hView,
    dimensions.wPdf,
    dimensions.hPdf,
    rotation
  );

  const scale = dimensions.wView / dimensions.wPdf;

  return (
    <textarea
      ref={taRef}
      className="canvas-textarea-input"
      value={editText}
      wrap="off"
      onChange={(e) => setEditText(e.target.value)}
      onBlur={() => {
        setEditingAnnId(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          setEditingAnnId(null);
        }
        if (e.key === 'Escape') {
          setEditingAnnId(null);
        }
      }}
      autoFocus
      style={{
        left: `${screenPos.x}px`,
        top: `${screenPos.y}px`,
        width: `${boxSize.w + 2}px`,
        height: `${boxSize.h}px`,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        resize: 'none',
        fontFamily: ann.fontFamily,
        fontSize: `${ann.fontSize * scale}px`,
        color: ann.fontColor,
        fontWeight: ann.isBold ? 'bold' : 'normal',
        fontStyle: ann.isItalic ? 'italic' : 'normal',
        textDecoration: ann.isUnderline ? 'underline' : 'none',
        textAlign: ann.align ?? 'left',
        opacity: ann.opacity ?? 1,
        background: ann.highlightColor || 'transparent',
        lineHeight: ann.lineHeight ?? 1.2,
      }}
    />
  );
};

interface SinglePageViewProps {
  page: PdfPage;
  index: number;
}

const SinglePageView: React.FC<SinglePageViewProps> = ({ page, index }) => {
  const {
    documents,
    activePageId,
    activeTool,
    selectedAnnotationId,
    zoom,
    setActivePageId,
    addAnnotation,
    updateAnnotation,
    selectAnnotation,
  } = usePdfStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [dimensions, setDimensions] = useState({ wView: 0, hView: 0, wPdf: 1, hPdf: 1 });
  const [loading, setLoading] = useState(true);
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);

  // Page annotations
  const annotations = usePdfStore((state) => state.annotations[page.id] || []);

  const isActive = activePageId === page.id;

  // Render PDF page background
  useEffect(() => {
    let isMounted = true;
    let renderTask: any = null;

    const renderPdfPage = async () => {
      setLoading(true);
      try {
        const doc = documents.find((d) => d.id === page.docId);
        if (!doc || !canvasRef.current) return;

        const loadingTask = pdfjsLib.getDocument({ data: doc.fileBytes.slice() });
        const pdf = await loadingTask.promise;
        const pdfPage = await pdf.getPage(page.originalPageNumber);

        if (!isMounted || !canvasRef.current) return;

        const viewportUnrotated = pdfPage.getViewport({ scale: 1.0 });

        // Base width of 600px at 100% zoom
        const scale = (600 / viewportUnrotated.width) * zoom;
        const viewport = pdfPage.getViewport({ scale, rotation: page.rotation });

        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const context = canvas.getContext('2d');
        if (!context) return;

        renderTask = pdfPage.render({
          canvasContext: context,
          viewport: viewport,
        });

        await renderTask.promise;

        if (isMounted) {
          setDimensions({
            wView: viewport.width,
            hView: viewport.height,
            wPdf: viewportUnrotated.width,
            hPdf: viewportUnrotated.height,
          });
          setLoading(false);
        }
      } catch (err) {
        console.error('Error rendering page:', page.id, err);
      }
    };

    renderPdfPage();

    return () => {
      isMounted = false;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [page.docId, page.originalPageNumber, page.rotation, zoom, documents]);

  // Click on stage to add text annotation
  const handleStageClick = (e: any) => {
    if (editingAnnId) {
      setEditingAnnId(null);
      return;
    }

    if (activeTool !== 'text' && activeTool !== 'qr') {
      // De-select selected elements if clicking empty stage
      if (e.target === e.target.getStage()) {
        selectAnnotation(null);
      }
      return;
    }

    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;

    // Default on-canvas dimensions of the new element
    const initialWidthCanvas = activeTool === 'qr' ? 100 : 150;
    const initialHeightCanvas = activeTool === 'qr' ? 100 : 30;

    // Convert click position to PDF points
    const pdfCoords = canvasToPdfCoords(
      pointerPosition.x,
      pointerPosition.y,
      initialWidthCanvas,
      initialHeightCanvas,
      dimensions.wView,
      dimensions.hView,
      dimensions.wPdf,
      dimensions.hPdf,
      page.rotation
    );

    const baseId = `ann-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    let newAnnotation: Annotation;

    if (activeTool === 'qr') {
      // Keep the QR square using the smaller of the mapped dimensions.
      const size = Math.min(pdfCoords.width, pdfCoords.height);
      newAnnotation = {
        id: baseId,
        type: 'qr',
        x: pdfCoords.x,
        y: pdfCoords.y,
        width: size,
        height: size,
        data: 'https://example.com',
        darkColor: '#000000',
        opacity: 1,
      };
    } else {
      newAnnotation = {
        id: baseId,
        type: 'text',
        x: pdfCoords.x,
        y: pdfCoords.y,
        width: pdfCoords.width,
        height: pdfCoords.height,
        text: 'Double-click to edit',
        fontFamily: 'Helvetica',
        fontSize: 14,
        fontColor: '#000000',
        align: 'left',
        lineHeight: 1.2,
        opacity: 1,
      };
    }

    addAnnotation(page.id, newAnnotation);
    selectAnnotation(newAnnotation.id);

    // Switch tool back to select after adding
    usePdfStore.getState().setActiveTool('select');
  };

  return (
    <div
      ref={containerRef}
      className={`pdf-page-wrapper ${isActive ? 'active' : ''}`}
      onClick={() => setActivePageId(page.id)}
      style={{
        width: dimensions.wView || 600,
        height: dimensions.hView || 848,
        position: 'relative',
      }}
    >
      {loading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(24, 24, 28, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          color: 'var(--text-secondary)'
        }}>
          Rendering Page {index + 1}...
        </div>
      )}

      <canvas ref={canvasRef} className="pdf-canvas-layer" />

      {!loading && (
        <Stage
          width={dimensions.wView}
          height={dimensions.hView}
          className="konva-overlay-layer"
          onClick={handleStageClick}
          onTap={handleStageClick}
        >
          <Layer>
            {annotations.map((ann) =>
              ann.type === 'qr' ? (
                <QrImageWrapper
                  key={ann.id}
                  ann={ann}
                  page={page}
                  dimensions={dimensions}
                  isSelected={selectedAnnotationId === ann.id}
                  selectAnnotation={selectAnnotation}
                  updateAnnotation={updateAnnotation}
                />
              ) : (
                <KonvaTextWrapper
                  key={ann.id}
                  ann={ann}
                  page={page}
                  dimensions={dimensions}
                  zoom={zoom}
                  isSelected={selectedAnnotationId === ann.id}
                  editingAnnId={editingAnnId}
                  setEditingAnnId={setEditingAnnId}
                  selectAnnotation={selectAnnotation}
                  updateAnnotation={updateAnnotation}
                />
              )
            )}
          </Layer>
        </Stage>
      )}

      {/* Direct textarea editing overlay */}
      {editingAnnId && (() => {
        const ann = annotations.find(a => a.id === editingAnnId);
        if (!ann || ann.type !== 'text') return null;
        return (
          <TextareaOverlay
            ann={ann}
            pageId={page.id}
            dimensions={dimensions}
            rotation={page.rotation}
            updateAnnotation={updateAnnotation}
            setEditingAnnId={setEditingAnnId}
          />
        );
      })()}
    </div>
  );
};

interface KonvaTextWrapperProps {
  ann: TextAnnotation;
  page: PdfPage;
  dimensions: { wView: number; hView: number; wPdf: number; hPdf: number };
  zoom: number;
  isSelected: boolean;
  editingAnnId: string | null;
  setEditingAnnId: (id: string | null) => void;
  selectAnnotation: (id: string | null) => void;
  updateAnnotation: (pageId: string, annId: string, updates: Partial<Annotation>) => void;
}

const KonvaTextWrapper: React.FC<KonvaTextWrapperProps> = ({
  ann,
  page,
  dimensions,
  isSelected,
  editingAnnId,
  setEditingAnnId,
  selectAnnotation,
  updateAnnotation,
}) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  // Position on screen
  const screenPos = pdfToCanvasCoords(
    ann.x,
    ann.y,
    ann.width,
    ann.height,
    dimensions.wView,
    dimensions.hView,
    dimensions.wPdf,
    dimensions.hPdf,
    page.rotation
  );

  const scale = dimensions.wView / dimensions.wPdf;

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current && editingAnnId !== ann.id) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected, editingAnnId, ann.id, screenPos.x, screenPos.y]);

  // Auto-fit the box to the rendered text so larger fonts / longer lines never
  // overflow it. The text does not wrap, so the box grows to the right (left
  // edge fixed) and downward (top edge fixed).
  useEffect(() => {
    const node = shapeRef.current;
    if (!node || scale <= 0) return;
    const measuredWidthPdf = node.width() / scale;
    const measuredHeightPdf = node.height() / scale;
    if (
      Math.abs(measuredWidthPdf - ann.width) > 0.5 ||
      Math.abs(measuredHeightPdf - ann.height) > 0.5
    ) {
      const topPdf = ann.y + ann.height; // keep the top edge anchored
      usePdfStore
        .getState()
        .resizeAnnotationBox(
          page.id,
          ann.id,
          measuredWidthPdf,
          measuredHeightPdf,
          topPdf - measuredHeightPdf
        );
    }
  }, [
    ann.text,
    ann.fontSize,
    ann.fontFamily,
    ann.isBold,
    ann.isItalic,
    ann.lineHeight,
    ann.width,
    ann.height,
    ann.y,
    scale,
    page.id,
    ann.id,
  ]);

  const handleDragEnd = (e: any) => {
    const node = e.target;

    const pdfCoords = canvasToPdfCoords(
      node.x(),
      node.y(),
      screenPos.width,
      screenPos.height,
      dimensions.wView,
      dimensions.hView,
      dimensions.wPdf,
      dimensions.hPdf,
      page.rotation
    );

    updateAnnotation(page.id, ann.id, {
      x: pdfCoords.x,
      y: pdfCoords.y,
    });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scales
    node.scaleX(1);
    node.scaleY(1);

    const newWidthCanvas = screenPos.width * scaleX;
    const newHeightCanvas = screenPos.height * scaleY;

    const pdfCoords = canvasToPdfCoords(
      node.x(),
      node.y(),
      newWidthCanvas,
      newHeightCanvas,
      dimensions.wView,
      dimensions.hView,
      dimensions.wPdf,
      dimensions.hPdf,
      page.rotation
    );

    updateAnnotation(page.id, ann.id, {
      x: pdfCoords.x,
      y: pdfCoords.y,
      width: pdfCoords.width,
      height: pdfCoords.height,
    });
  };

  const isEditing = editingAnnId === ann.id;

  return (
    <>
      {ann.highlightColor && !isEditing && (
        <KonvaRect
          x={screenPos.x}
          y={screenPos.y}
          width={screenPos.width}
          height={screenPos.height}
          fill={ann.highlightColor}
          opacity={ann.opacity ?? 1}
          listening={false}
        />
      )}
      <KonvaText
        ref={shapeRef}
        x={screenPos.x}
        y={screenPos.y}
        text={ann.text}
        fontSize={ann.fontSize * scale}
        fontFamily={ann.fontFamily}
        lineHeight={ann.lineHeight ?? 1.2}
        align={ann.align ?? 'left'}
        wrap="none"
        fill={ann.fontColor}
        fontStyle={`${ann.isBold ? 'bold' : ''} ${ann.isItalic ? 'italic' : ''}`.trim() || 'normal'}
        textDecoration={ann.isUnderline ? 'underline' : ''}
        draggable={!isEditing}
        opacity={isEditing ? 0 : (ann.opacity ?? 1)}
        onClick={(e) => {
          e.cancelBubble = true;
          selectAnnotation(ann.id);
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          selectAnnotation(ann.id);
        }}
        onDblClick={() => {
          setEditingAnnId(ann.id);
        }}
        onDblTap={() => {
          setEditingAnnId(ann.id);
        }}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
      {isSelected && !isEditing && (
        <Transformer
          ref={trRef}
          resizeEnabled={false} // Box auto-sizes to its text; no manual resize
          rotateEnabled={false}
          enabledAnchors={[]}
        />
      )}
    </>
  );
};

interface QrImageWrapperProps {
  ann: QrAnnotation;
  page: PdfPage;
  dimensions: { wView: number; hView: number; wPdf: number; hPdf: number };
  isSelected: boolean;
  selectAnnotation: (id: string | null) => void;
  updateAnnotation: (pageId: string, annId: string, updates: Partial<Annotation>) => void;
}

const QrImageWrapper: React.FC<QrImageWrapperProps> = ({
  ann,
  page,
  dimensions,
  isSelected,
  selectAnnotation,
  updateAnnotation,
}) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  // (Re)generate the QR image whenever its content or color changes.
  useEffect(() => {
    let cancelled = false;
    generateQrDataUrl(ann.data, ann.darkColor)
      .then((url) => {
        if (cancelled) return;
        const img = new window.Image();
        img.onload = () => {
          if (!cancelled) setImage(img);
        };
        img.src = url;
      })
      .catch((err) => console.error('QR generation failed:', err));
    return () => {
      cancelled = true;
    };
  }, [ann.data, ann.darkColor]);

  const screenPos = pdfToCanvasCoords(
    ann.x,
    ann.y,
    ann.width,
    ann.height,
    dimensions.wView,
    dimensions.hView,
    dimensions.wPdf,
    dimensions.hPdf,
    page.rotation
  );

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected, screenPos.x, screenPos.y, image]);

  const handleDragEnd = (e: any) => {
    const node = e.target;
    const pdfCoords = canvasToPdfCoords(
      node.x(),
      node.y(),
      screenPos.width,
      screenPos.height,
      dimensions.wView,
      dimensions.hView,
      dimensions.wPdf,
      dimensions.hPdf,
      page.rotation
    );
    updateAnnotation(page.id, ann.id, { x: pdfCoords.x, y: pdfCoords.y });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    // Keep it square: use the larger scale so dragging any corner resizes evenly.
    const newSizeCanvas = Math.max(screenPos.width * scaleX, screenPos.height * scaleY);
    const pdfCoords = canvasToPdfCoords(
      node.x(),
      node.y(),
      newSizeCanvas,
      newSizeCanvas,
      dimensions.wView,
      dimensions.hView,
      dimensions.wPdf,
      dimensions.hPdf,
      page.rotation
    );
    updateAnnotation(page.id, ann.id, {
      x: pdfCoords.x,
      y: pdfCoords.y,
      width: pdfCoords.width,
      height: pdfCoords.height,
    });
  };

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        image={image ?? undefined}
        x={screenPos.x}
        y={screenPos.y}
        width={screenPos.width}
        height={screenPos.height}
        opacity={ann.opacity ?? 1}
        draggable
        onClick={(e) => {
          e.cancelBubble = true;
          selectAnnotation(ann.id);
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          selectAnnotation(ann.id);
        }}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          keepRatio
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 20 ? oldBox : newBox)}
        />
      )}
    </>
  );
};

export const Viewer: React.FC = () => {
  const { pages, addDocuments } = usePdfStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleUpload = async (files: File[]) => {
    const docsInfo = [];
    for (const file of files) {
      if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) continue;
      try {
        const info = await loadPdfInfo(file);
        docsInfo.push(info);
      } catch (err) {
        console.error(err);
        alert(`Failed to load PDF: ${file.name}`);
      }
    }
    if (docsInfo.length > 0) {
      addDocuments(docsInfo);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      await handleUpload(files);
    }
  };

  if (pages.length === 0) {
    return (
      <div
        className="viewer-container"
        style={{ justifyContent: 'center' }}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <div className={`upload-dropzone ${dragActive ? 'drag-active' : ''}`} onClick={() => fileInputRef.current?.click()}>
          <Upload className="upload-icon" size={48} />
          <h3 className="upload-title">Upload your PDF files</h3>
          <p className="upload-subtitle">Drag and drop or click to browse files from your computer</p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files && handleUpload(Array.from(e.target.files))}
            multiple
            accept=".pdf,application/pdf"
            className="file-input"
          />
          <button className="btn btn-primary">Choose Files</button>
        </div>
      </div>
    );
  }

  return (
    <div className="viewer-container">
      {pages.map((page, index) => (
        <SinglePageView
          key={page.id}
          page={page}
          index={index}
        />
      ))}
    </div>
  );
};
