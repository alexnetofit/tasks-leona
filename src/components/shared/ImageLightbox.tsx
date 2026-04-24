import { useState, useEffect, useCallback } from 'react';
import { IconZoomIn, IconZoomOut, IconX, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

interface ImageLightboxProps {
  images: string[];
  currentIndex: number;
  opened: boolean;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export default function ImageLightbox({ images, currentIndex, opened, onClose, onIndexChange }: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => { setZoom(1); setPosition({ x: 0, y: 0 }); }, [currentIndex, opened]);

  useEffect(() => {
    if (!opened) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && currentIndex > 0) onIndexChange(currentIndex - 1);
      if (e.key === 'ArrowRight' && currentIndex < images.length - 1) onIndexChange(currentIndex + 1);
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(z + 0.25, 5));
      if (e.key === '-') setZoom((z) => Math.max(z - 0.25, 0.5));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [opened, currentIndex, images.length, onClose, onIndexChange]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(Math.max(z + (e.deltaY > 0 ? -0.15 : 0.15), 0.5), 5));
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setDragging(false);

  if (!opened || images.length === 0) return null;

  return (
    <div className="lightbox-overlay" onClick={onClose} onWheel={handleWheel}>
      <div className="lightbox-controls">
        <button className="lightbox-btn" onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(z + 0.5, 5)); }} title="Zoom in">
          <IconZoomIn size={18} />
        </button>
        <button className="lightbox-btn" onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.max(z - 0.5, 0.5)); }} title="Zoom out">
          <IconZoomOut size={18} />
        </button>
        <button className="lightbox-btn" onClick={(e) => { e.stopPropagation(); onClose(); }} title="Fechar">
          <IconX size={18} />
        </button>
      </div>

      {images.length > 1 && currentIndex > 0 && (
        <button className="lightbox-btn" style={{ position: 'fixed', left: 16, top: '50%', transform: 'translateY(-50%)' }}
          onClick={(e) => { e.stopPropagation(); onIndexChange(currentIndex - 1); }}>
          <IconChevronLeft size={20} />
        </button>
      )}

      <img
        src={images[currentIndex]}
        alt="Visualização"
        className="lightbox-image"
        style={{ transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)` }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        draggable={false}
      />

      {images.length > 1 && currentIndex < images.length - 1 && (
        <button className="lightbox-btn" style={{ position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)' }}
          onClick={(e) => { e.stopPropagation(); onIndexChange(currentIndex + 1); }}>
          <IconChevronRight size={20} />
        </button>
      )}

      {images.length > 1 && (
        <div className="lightbox-counter">{currentIndex + 1} / {images.length}</div>
      )}
    </div>
  );
}
