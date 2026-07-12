import React, { useRef } from 'react';
import { 
  Upload, 
  Download, 
  Undo2, 
  Redo2, 
  ZoomIn, 
  ZoomOut, 
  Type,
  MousePointer,
  FilePlus,
  RotateCcw,
  QrCode
} from 'lucide-react';
import { usePdfStore } from '../store/usePdfStore';
import { loadPdfInfo, exportModifiedPdf } from '../utils/pdfHelpers';

export const Header: React.FC = () => {
  const {
    documents,
    pages,
    annotations,
    activeTool,
    zoom,
    undoStack,
    redoStack,
    addDocuments,
    setActiveTool,
    setZoom,
    undo,
    redo,
    clearProject
  } = usePdfStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mergeInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const docsInfo = [];

    for (const file of files) {
      if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) continue;
      try {
        const info = await loadPdfInfo(file);
        docsInfo.push(info);
      } catch (err) {
        console.error('Error reading PDF file:', file.name, err);
        alert(`Failed to parse PDF: ${file.name}. It might be encrypted or corrupted.`);
      }
    }

    if (docsInfo.length > 0) {
      addDocuments(docsInfo);
    }
  };

  const handleExport = async () => {
    if (pages.length === 0) return;
    try {
      const bytes = await exportModifiedPdf(documents, pages, annotations);
      const blob = new Blob([bytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      // Use name of first document with "-edited" suffix, or fallback
      const baseName = documents.length > 0 ? documents[0].filename.replace(/\.pdf$/i, '') : 'document';
      a.download = `${baseName}_edited.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Error exporting PDF. Please check your page operations and try again.');
    }
  };

  return (
    <header className="app-header">
      <div className="logo-section">
        <span className="logo-text">PDFcraft</span>
      </div>

      {pages.length > 0 && (
        <>
          <div className="header-controls">
            {/* Tool Selector */}
            <div className="control-group">
              <button 
                className={`btn-icon-only ${activeTool === 'select' ? 'active' : ''}`}
                onClick={() => setActiveTool('select')}
                title="Select / Move Tool"
              >
                <MousePointer size={18} />
              </button>
              <button
                className={`btn-icon-only ${activeTool === 'text' ? 'active' : ''}`}
                onClick={() => setActiveTool('text')}
                title="Add Text Tool"
              >
                <Type size={18} />
              </button>
              <button
                className={`btn-icon-only ${activeTool === 'qr' ? 'active' : ''}`}
                onClick={() => setActiveTool('qr')}
                title="Add QR Code (click on the page to place)"
              >
                <QrCode size={18} />
              </button>
            </div>

            {/* History Controls */}
            <div className="control-group">
              <button 
                className="btn-icon-only" 
                onClick={undo} 
                disabled={undoStack.length === 0}
                title="Undo"
              >
                <Undo2 size={18} />
              </button>
              <button 
                className="btn-icon-only" 
                onClick={redo} 
                disabled={redoStack.length === 0}
                title="Redo"
              >
                <Redo2 size={18} />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="control-group">
              <button 
                className="btn-icon-only" 
                onClick={() => setZoom(zoom - 0.1)}
                disabled={zoom <= 0.5}
                title="Zoom Out"
              >
                <ZoomOut size={18} />
              </button>
              <span style={{ fontSize: '13px', padding: '0 8px', minWidth: '45px', textAlign: 'center' }}>
                {Math.round(zoom * 100)}%
              </span>
              <button 
                className="btn-icon-only" 
                onClick={() => setZoom(zoom + 0.1)}
                disabled={zoom >= 3.0}
                title="Zoom In"
              >
                <ZoomIn size={18} />
              </button>
            </div>

            {/* Merge addition */}
            <input 
              type="file" 
              ref={mergeInputRef} 
              onChange={handleUpload} 
              multiple 
              accept=".pdf,application/pdf"
              className="file-input"
            />
            <button 
              className="btn btn-secondary"
              onClick={() => mergeInputRef.current?.click()}
            >
              <FilePlus size={16} />
              <span>Merge PDF</span>
            </button>
          </div>

          <div className="header-controls">
            <button className="btn btn-secondary btn-danger" onClick={clearProject}>
              <RotateCcw size={16} />
              <span>Reset</span>
            </button>
            <button className="btn btn-primary" onClick={handleExport}>
              <Download size={16} />
              <span>Export PDF</span>
            </button>
          </div>
        </>
      )}

      {pages.length === 0 && (
        <div className="header-controls">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleUpload} 
            multiple 
            accept=".pdf,application/pdf"
            className="file-input"
          />
          <button 
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} />
            <span>Upload PDF(s)</span>
          </button>
        </div>
      )}
    </header>
  );
};
