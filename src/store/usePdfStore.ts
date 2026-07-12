import { create } from 'zustand';
import type { EditorState, Annotation, PdfPage, PdfDocument, HistoryState } from '../types';

interface PdfStoreActions {
  addDocuments: (docs: { filename: string; fileBytes: Uint8Array; pagesCount: number }[]) => void;
  reorderPages: (pages: PdfPage[]) => void;
  rotatePage: (pageId: string, direction: 'cw' | 'ccw') => void;
  deletePage: (pageId: string) => void;
  addAnnotation: (pageId: string, annotation: Annotation) => void;
  updateAnnotation: (pageId: string, annId: string, updates: Partial<Annotation>) => void;
  resizeAnnotationBox: (pageId: string, annId: string, width: number, height: number, y: number) => void;
  deleteAnnotation: (pageId: string, annId: string) => void;
  selectAnnotation: (annId: string | null) => void;
  setActivePageId: (pageId: string | null) => void;
  setZoom: (zoom: number) => void;
  setActiveTool: (tool: 'select' | 'text' | 'qr') => void;
  undo: () => void;
  redo: () => void;
  clearProject: () => void;
}

export const usePdfStore = create<EditorState & PdfStoreActions>((set, get) => {
  const recordHistory = (): HistoryState => {
    const { pages, annotations } = get();
    return {
      pages: [...pages],
      annotations: JSON.parse(JSON.stringify(annotations)),
    };
  };

  const pushToUndo = (prevState: HistoryState) => {
    set((state) => ({
      undoStack: [...state.undoStack, prevState].slice(-50), // Cap at 50 steps
      redoStack: [],
    }));
  };

  return {
    documents: [],
    pages: [],
    annotations: {},
    activePageId: null,
    selectedAnnotationId: null,
    zoom: 1.0,
    activeTool: 'select',
    undoStack: [],
    redoStack: [],

    addDocuments: (docs) => {
      const currentHistory = recordHistory();
      
      set((state) => {
        const newDocs: PdfDocument[] = [...state.documents];
        const newPages: PdfPage[] = [...state.pages];
        const newAnnotations = { ...state.annotations };

        docs.forEach((doc) => {
          const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          newDocs.push({
            id: docId,
            filename: doc.filename,
            fileBytes: doc.fileBytes,
            pagesCount: doc.pagesCount,
          });

          // Generate PdfPage objects for all pages in this document
          for (let i = 1; i <= doc.pagesCount; i++) {
            const pageId = `page-${docId}-${i}-${Math.random().toString(36).substr(2, 5)}`;
            newPages.push({
              id: pageId,
              docId: docId,
              originalPageNumber: i,
              rotation: 0,
            });
            newAnnotations[pageId] = [];
          }
        });

        const nextActivePageId = state.activePageId || (newPages.length > 0 ? newPages[0].id : null);

        return {
          documents: newDocs,
          pages: newPages,
          annotations: newAnnotations,
          activePageId: nextActivePageId,
        };
      });

      pushToUndo(currentHistory);
    },

    reorderPages: (newPages) => {
      const currentHistory = recordHistory();
      set({ pages: newPages });
      pushToUndo(currentHistory);
    },

    rotatePage: (pageId, direction) => {
      const currentHistory = recordHistory();
      set((state) => {
        const newPages = state.pages.map((p) => {
          if (p.id !== pageId) return p;
          const delta = direction === 'cw' ? 90 : -90;
          let newRotation = (p.rotation + delta) % 360;
          if (newRotation < 0) newRotation += 360;
          return { ...p, rotation: newRotation };
        });
        return { pages: newPages };
      });
      pushToUndo(currentHistory);
    },

    deletePage: (pageId) => {
      const currentHistory = recordHistory();
      set((state) => {
        const newPages = state.pages.filter((p) => p.id !== pageId);
        
        // Find next active page if current active page is deleted
        let newActivePageId = state.activePageId;
        if (state.activePageId === pageId) {
          const deletedIndex = state.pages.findIndex((p) => p.id === pageId);
          if (newPages.length > 0) {
            newActivePageId = newPages[Math.min(deletedIndex, newPages.length - 1)].id;
          } else {
            newActivePageId = null;
          }
        }

        const newAnnotations = { ...state.annotations };
        delete newAnnotations[pageId];

        return {
          pages: newPages,
          activePageId: newActivePageId,
          annotations: newAnnotations,
          selectedAnnotationId: null,
        };
      });
      pushToUndo(currentHistory);
    },

    addAnnotation: (pageId, annotation) => {
      const currentHistory = recordHistory();
      set((state) => {
        const pageAnns = state.annotations[pageId] || [];
        return {
          annotations: {
            ...state.annotations,
            [pageId]: [...pageAnns, annotation],
          },
          selectedAnnotationId: annotation.id,
        };
      });
      pushToUndo(currentHistory);
    },

    updateAnnotation: (pageId, annId, updates) => {
      const currentHistory = recordHistory();
      set((state) => {
        const pageAnns = state.annotations[pageId] || [];
        const newPageAnns = pageAnns.map((ann) => {
          if (ann.id !== annId) return ann;
          // updates is a Partial of the union; the caller only ever passes
          // fields valid for this annotation's variant, so the merge is safe.
          return { ...ann, ...updates } as Annotation;
        });
        return {
          annotations: {
            ...state.annotations,
            [pageId]: newPageAnns,
          },
        };
      });
      pushToUndo(currentHistory);
    },

    // Auto-fit the box (width + height) to the on-screen text measurement.
    // Intentionally does NOT record undo history (it's a layout side-effect of
    // text/size edits, which already pushed their own history entry) and guards
    // against no-op updates to avoid a measure->set->render loop.
    resizeAnnotationBox: (pageId, annId, width, height, y) => {
      set((state) => {
        const pageAnns = state.annotations[pageId] || [];
        let changed = false;
        const newPageAnns = pageAnns.map((ann) => {
          if (ann.id !== annId) return ann;
          if (
            Math.abs(ann.width - width) < 0.5 &&
            Math.abs(ann.height - height) < 0.5 &&
            Math.abs(ann.y - y) < 0.5
          ) {
            return ann;
          }
          changed = true;
          return { ...ann, width, height, y };
        });
        if (!changed) return {};
        return {
          annotations: {
            ...state.annotations,
            [pageId]: newPageAnns,
          },
        };
      });
    },

    deleteAnnotation: (pageId, annId) => {
      const currentHistory = recordHistory();
      set((state) => {
        const pageAnns = state.annotations[pageId] || [];
        const newPageAnns = pageAnns.filter((ann) => ann.id !== annId);
        return {
          annotations: {
            ...state.annotations,
            [pageId]: newPageAnns,
          },
          selectedAnnotationId: state.selectedAnnotationId === annId ? null : state.selectedAnnotationId,
        };
      });
      pushToUndo(currentHistory);
    },

    selectAnnotation: (annId) => {
      set({ selectedAnnotationId: annId });
    },

    setActivePageId: (pageId) => {
      set({ activePageId: pageId });
    },

    setZoom: (zoom) => {
      set({ zoom: Math.max(0.5, Math.min(3.0, zoom)) });
    },

    setActiveTool: (tool) => {
      set({ activeTool: tool, selectedAnnotationId: null });
    },

    undo: () => {
      const { undoStack, redoStack } = get();
      if (undoStack.length === 0) return;

      const previous = undoStack[undoStack.length - 1];
      const newUndoStack = undoStack.slice(0, -1);
      const currentHistory = recordHistory();

      set({
        pages: previous.pages,
        annotations: previous.annotations,
        undoStack: newUndoStack,
        redoStack: [...redoStack, currentHistory],
        selectedAnnotationId: null,
      });
    },

    redo: () => {
      const { undoStack, redoStack } = get();
      if (redoStack.length === 0) return;

      const next = redoStack[redoStack.length - 1];
      const newRedoStack = redoStack.slice(0, -1);
      const currentHistory = recordHistory();

      set({
        pages: next.pages,
        annotations: next.annotations,
        undoStack: [...undoStack, currentHistory],
        redoStack: newRedoStack,
        selectedAnnotationId: null,
      });
    },

    clearProject: () => {
      set({
        documents: [],
        pages: [],
        annotations: {},
        activePageId: null,
        selectedAnnotationId: null,
        zoom: 1.0,
        activeTool: 'select',
        undoStack: [],
        redoStack: [],
      });
    },
  };
});
