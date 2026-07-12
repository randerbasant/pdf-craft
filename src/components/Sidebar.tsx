import React, { useEffect, useRef } from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy, 
  useSortable 
} from '@dnd-kit/sortable';
import { RotateCw, Trash2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { usePdfStore } from '../store/usePdfStore';
import type { PdfPage, PdfDocument } from '../types';

interface SortableThumbnailItemProps {
  page: PdfPage;
  index: number;
  documents: PdfDocument[];
  activePageId: string | null;
  setActivePageId: (id: string) => void;
  rotatePage: (id: string, dir: 'cw' | 'ccw') => void;
  deletePage: (id: string) => void;
}

const SortableThumbnailItem: React.FC<SortableThumbnailItemProps> = ({
  page,
  index,
  documents,
  activePageId,
  setActivePageId,
  rotatePage,
  deletePage
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: page.id });

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const style = {
    transform: transform 
      ? `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scaleX ?? 1}, ${transform.scaleY ?? 1})` 
      : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
  };

  useEffect(() => {
    let isMounted = true;
    let renderTask: any = null;

    const renderThumbnail = async () => {
      try {
        const doc = documents.find((d) => d.id === page.docId);
        if (!doc || !canvasRef.current) return;

        // Load document through PDF.js
        const loadingTask = pdfjsLib.getDocument({ data: doc.fileBytes.slice() });
        const pdf = await loadingTask.promise;
        const pdfPage = await pdf.getPage(page.originalPageNumber);

        if (!isMounted || !canvasRef.current) return;

        const viewportUnrotated = pdfPage.getViewport({ scale: 1.0 });
        const scale = 110 / viewportUnrotated.width; // Max width of thumbnail
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
      } catch (err) {
        console.error('Error drawing thumbnail:', page.id, err);
      }
    };

    renderThumbnail();

    return () => {
      isMounted = false;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [page.docId, page.originalPageNumber, page.rotation, documents]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`thumbnail-item ${activePageId === page.id ? 'active' : ''}`}
      onClick={() => setActivePageId(page.id)}
    >
      <div 
        className="thumbnail-canvas-container"
        {...attributes}
        {...listeners}
        style={{ cursor: 'grab' }}
      >
        <canvas ref={canvasRef} />
      </div>

      <div className="thumbnail-label">
        <span>Page {index + 1}</span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          {page.rotation}°
        </span>
      </div>

      <div className="thumbnail-actions">
        <button
          className="action-btn-small"
          onClick={(e) => {
            e.stopPropagation();
            rotatePage(page.id, 'cw');
          }}
          title="Rotate Page 90° CW"
        >
          <RotateCw size={12} />
        </button>
        <button
          className="action-btn-small"
          onClick={(e) => {
            e.stopPropagation();
            deletePage(page.id);
          }}
          title="Delete Page"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const {
    pages,
    documents,
    activePageId,
    setActivePageId,
    reorderPages,
    rotatePage,
    deletePage
  } = usePdfStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Avoid accidental drags when clicking to select
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);

    const reordered = arrayMove(pages, oldIndex, newIndex);
    reorderPages(reordered);
  };

  if (pages.length === 0) return null;

  return (
    <aside className="pages-sidebar">
      <div className="sidebar-title">Pages ({pages.length})</div>
      <div className="thumbnail-list">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={pages.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {pages.map((page, index) => (
              <SortableThumbnailItem
                key={page.id}
                page={page}
                index={index}
                documents={documents}
                activePageId={activePageId}
                setActivePageId={setActivePageId}
                rotatePage={rotatePage}
                deletePage={deletePage}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </aside>
  );
};
