import React from 'react';
import {
  Bold,
  Italic,
  Underline,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { usePdfStore } from '../store/usePdfStore';

export const TextPropertiesPanel: React.FC = () => {
  const {
    activePageId,
    selectedAnnotationId,
    annotations,
    updateAnnotation,
    deleteAnnotation,
  } = usePdfStore();

  // Find the selected annotation in the store
  let selectedAnn = null;
  let pageIdContainingAnn = '';

  if (selectedAnnotationId && activePageId) {
    // Check active page first
    const pageAnns = annotations[activePageId] || [];
    const found = pageAnns.find((a) => a.id === selectedAnnotationId);
    if (found) {
      selectedAnn = found;
      pageIdContainingAnn = activePageId;
    } else {
      // Look across all pages if not in active page
      for (const [pId, anns] of Object.entries(annotations)) {
        const f = anns.find((a) => a.id === selectedAnnotationId);
        if (f) {
          selectedAnn = f;
          pageIdContainingAnn = pId;
          break;
        }
      }
    }
  }

  if (!selectedAnn) {
    return (
      <aside className="properties-sidebar">
        <div className="sidebar-title">Properties</div>
        <div className="properties-content" style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>
          Select a text element on the canvas to edit its properties.
        </div>
      </aside>
    );
  }

  const handleUpdate = (updates: any) => {
    if (pageIdContainingAnn && selectedAnnotationId) {
      updateAnnotation(pageIdContainingAnn, selectedAnnotationId, updates);
    }
  };

  const handleDelete = () => {
    if (pageIdContainingAnn && selectedAnnotationId) {
      deleteAnnotation(pageIdContainingAnn, selectedAnnotationId);
    }
  };

  // QR code annotations get their own panel.
  if (selectedAnn.type === 'qr') {
    return (
      <aside className="properties-sidebar">
        <div className="sidebar-title">QR Code</div>
        <div className="properties-content">
          <div className="prop-section">
            <label className="prop-label">Content (URL or text)</label>
            <textarea
              className="select-input"
              style={{ width: '100%', minHeight: '70px', resize: 'vertical' }}
              value={selectedAnn.data}
              onChange={(e) => handleUpdate({ data: e.target.value })}
              placeholder="https://example.com"
            />
          </div>

          <div className="prop-section">
            <label className="prop-label">Color</label>
            <div className="color-picker-wrapper">
              <input
                type="color"
                className="color-input"
                value={selectedAnn.darkColor}
                onChange={(e) => handleUpdate({ darkColor: e.target.value })}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {selectedAnn.darkColor.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="prop-section">
            <label className="prop-label">
              Opacity — {Math.round((selectedAnn.opacity ?? 1) * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round((selectedAnn.opacity ?? 1) * 100)}
              onChange={(e) => handleUpdate({ opacity: (parseInt(e.target.value) || 0) / 100 })}
              style={{ width: '100%' }}
            />
          </div>

          <div className="prop-section" style={{ marginTop: '20px' }}>
            <button
              className="btn btn-secondary btn-danger"
              onClick={handleDelete}
              style={{ width: '100%' }}
            >
              <Trash2 size={16} />
              <span>Delete QR Code</span>
            </button>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="properties-sidebar">
      <div className="sidebar-title">Text Style</div>
      <div className="properties-content">
        {/* Font Family */}
        <div className="prop-section">
          <label className="prop-label">Font Family</label>
          <select
            className="select-input"
            value={selectedAnn.fontFamily}
            onChange={(e) => handleUpdate({ fontFamily: e.target.value })}
          >
            <option value="Helvetica">Helvetica</option>
            <option value="Times-Roman">Times New Roman</option>
            <option value="Courier">Courier</option>
            <option value="Arial">Arial</option>
          </select>
        </div>

        {/* Font Size & Color */}
        <div className="prop-section">
          <label className="prop-label">Size & Color</label>
          <div className="prop-row">
            <input
              type="number"
              className="select-input font-size-input"
              value={selectedAnn.fontSize}
              min={6}
              max={120}
              onChange={(e) => handleUpdate({ fontSize: parseInt(e.target.value) || 12 })}
            />
            <div className="color-picker-wrapper">
              <input
                type="color"
                className="color-input"
                value={selectedAnn.fontColor}
                onChange={(e) => handleUpdate({ fontColor: e.target.value })}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {selectedAnn.fontColor.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Text Decoration Controls */}
        <div className="prop-section">
          <label className="prop-label">Formatting</label>
          <div className="prop-row" style={{ gap: '4px' }}>
            <button
              className={`btn-icon-only ${selectedAnn.isBold ? 'active' : ''}`}
              onClick={() => handleUpdate({ isBold: !selectedAnn.isBold })}
              title="Bold"
            >
              <Bold size={16} />
            </button>
            <button
              className={`btn-icon-only ${selectedAnn.isItalic ? 'active' : ''}`}
              onClick={() => handleUpdate({ isItalic: !selectedAnn.isItalic })}
              title="Italic"
            >
              <Italic size={16} />
            </button>
            <button
              className={`btn-icon-only ${selectedAnn.isUnderline ? 'active' : ''}`}
              onClick={() => handleUpdate({ isUnderline: !selectedAnn.isUnderline })}
              title="Underline"
            >
              <Underline size={16} />
            </button>
          </div>
        </div>

        {/* Alignment */}
        <div className="prop-section">
          <label className="prop-label">Alignment</label>
          <div className="prop-row" style={{ gap: '4px' }}>
            <button
              className={`btn-icon-only ${(selectedAnn.align ?? 'left') === 'left' ? 'active' : ''}`}
              onClick={() => handleUpdate({ align: 'left' })}
              title="Align Left"
            >
              <AlignLeft size={16} />
            </button>
            <button
              className={`btn-icon-only ${selectedAnn.align === 'center' ? 'active' : ''}`}
              onClick={() => handleUpdate({ align: 'center' })}
              title="Align Center"
            >
              <AlignCenter size={16} />
            </button>
            <button
              className={`btn-icon-only ${selectedAnn.align === 'right' ? 'active' : ''}`}
              onClick={() => handleUpdate({ align: 'right' })}
              title="Align Right"
            >
              <AlignRight size={16} />
            </button>
          </div>
        </div>

        {/* Line Height */}
        <div className="prop-section">
          <label className="prop-label">Line Height</label>
          <input
            type="number"
            className="select-input"
            value={selectedAnn.lineHeight ?? 1.2}
            min={0.8}
            max={3}
            step={0.1}
            onChange={(e) => handleUpdate({ lineHeight: parseFloat(e.target.value) || 1.2 })}
          />
        </div>

        {/* Opacity */}
        <div className="prop-section">
          <label className="prop-label">
            Opacity — {Math.round((selectedAnn.opacity ?? 1) * 100)}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((selectedAnn.opacity ?? 1) * 100)}
            onChange={(e) => handleUpdate({ opacity: (parseInt(e.target.value) || 0) / 100 })}
            style={{ width: '100%' }}
          />
        </div>

        {/* Highlight */}
        <div className="prop-section">
          <label className="prop-label">Highlight</label>
          <div className="prop-row" style={{ gap: '8px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={!!selectedAnn.highlightColor}
                onChange={(e) =>
                  handleUpdate({ highlightColor: e.target.checked ? '#FFF176' : undefined })
                }
              />
              Enable
            </label>
            {selectedAnn.highlightColor && (
              <div className="color-picker-wrapper">
                <input
                  type="color"
                  className="color-input"
                  value={selectedAnn.highlightColor}
                  onChange={(e) => handleUpdate({ highlightColor: e.target.value })}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {selectedAnn.highlightColor.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Delete Action */}
        <div className="prop-section" style={{ marginTop: '20px' }}>
          <button className="btn btn-secondary btn-danger" onClick={handleDelete} style={{ width: '100%' }}>
            <Trash2 size={16} />
            <span>Delete Text</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
