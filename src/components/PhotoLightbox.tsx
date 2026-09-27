import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Photo } from '../types';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface PhotoLightboxProps {
  photos: Photo[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photos,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  // Refs for zero-jitter gesture tracking
  const scaleRef = useRef<number>(1);
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Gesture state refs
  const touchModeRef = useRef<'none' | 'pan' | 'pinch' | 'swipe'>('none');
  const lastTouchRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPinchDistRef = useRef<number>(0);
  const pinchStartScaleRef = useRef<number>(1);
  const pinchCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const swipeStartRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const lastTapTimeRef = useRef<number>(0);

  // Current photo reference
  const currentPhoto = photos[currentIndex];
  const photoUrl = currentPhoto ? currentPhoto.file_url || (currentPhoto as any).url : '';

  // Synchronize state with refs
  const applyTransform = useCallback((newScale: number, newPos: { x: number; y: number }, animate = false) => {
    scaleRef.current = newScale;
    positionRef.current = newPos;
    setScale(newScale);
    setPosition(newPos);
    if (animate) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 200);
    }
  }, []);

  // Compute maximum allowable pan boundaries so the image NEVER flies off-screen
  const getPanBounds = useCallback((targetScale: number) => {
    if (targetScale <= 1 || !containerRef.current) {
      return { maxX: 0, maxY: 0 };
    }
    const container = containerRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    // Boundary allows dragging up to the edge of the scaled content
    const maxX = Math.max(0, (cw * (targetScale - 1)) / 2);
    const maxY = Math.max(0, (ch * (targetScale - 1)) / 2);

    return { maxX, maxY };
  }, []);

  // Clamp translation within computed boundaries
  const clampPosition = useCallback((pos: { x: number; y: number }, targetScale: number) => {
    if (targetScale <= 1) return { x: 0, y: 0 };
    const { maxX, maxY } = getPanBounds(targetScale);
    return {
      x: Math.min(Math.max(pos.x, -maxX), maxX),
      y: Math.min(Math.max(pos.y, -maxY), maxY),
    };
  }, [getPanBounds]);

  // Reset transform to 1x centered
  const resetTransform = useCallback((animate = true) => {
    applyTransform(1, { x: 0, y: 0 }, animate);
  }, [applyTransform]);

  // Reset when photo changes or modal opens
  useEffect(() => {
    if (isOpen) {
      resetTransform(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, currentIndex, resetTransform]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        if (scaleRef.current === 1 && currentIndex < photos.length - 1) {
          onNavigate(currentIndex + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        if (scaleRef.current === 1 && currentIndex > 0) {
          onNavigate(currentIndex - 1);
        }
      } else if (e.key === '+' || e.key === '=') {
        const next = Math.min(scaleRef.current + 0.5, 4);
        applyTransform(next, clampPosition(positionRef.current, next), true);
      } else if (e.key === '-') {
        const next = Math.max(scaleRef.current - 0.5, 1);
        applyTransform(next, clampPosition(positionRef.current, next), true);
      } else if (e.key === '0') {
        resetTransform(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, photos.length, onClose, onNavigate, applyTransform, clampPosition, resetTransform]);

  // Zoom In / Out Buttons
  const handleZoomIn = () => {
    const next = Math.min(scaleRef.current + 0.6, 4);
    applyTransform(next, clampPosition(positionRef.current, next), true);
  };

  const handleZoomOut = () => {
    const next = Math.max(scaleRef.current - 0.6, 1);
    applyTransform(next, clampPosition(positionRef.current, next), true);
  };

  // Double tap handler
  const handleDoubleTap = (clientX: number, clientY: number) => {
    if (scaleRef.current > 1) {
      resetTransform(true);
    } else {
      // Zoom into tapped point
      const nextScale = 2.5;
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const offsetX = clientX - (rect.left + rect.width / 2);
        const offsetY = clientY - (rect.top + rect.height / 2);
        const targetPos = {
          x: -offsetX * (nextScale - 1) * 0.6,
          y: -offsetY * (nextScale - 1) * 0.6,
        };
        applyTransform(nextScale, clampPosition(targetPos, nextScale), true);
      } else {
        applyTransform(nextScale, { x: 0, y: 0 }, true);
      }
    }
  };

  // TOUCH GESTURE HANDLING FOR MOBILE / ANDROID
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch Gesture Start
      touchModeRef.current = 'pinch';
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      initialPinchDistRef.current = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      pinchStartScaleRef.current = scaleRef.current;
      pinchCenterRef.current = {
        x: (t0.clientX + t1.clientX) / 2,
        y: (t0.clientY + t1.clientY) / 2,
      };
    } else if (e.touches.length === 1) {
      const now = Date.now();
      const touch = e.touches[0];

      // Double-tap detection (< 280ms)
      if (now - lastTapTimeRef.current < 280) {
        lastTapTimeRef.current = 0;
        touchModeRef.current = 'none';
        handleDoubleTap(touch.clientX, touch.clientY);
        return;
      }
      lastTapTimeRef.current = now;

      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };

      if (scaleRef.current > 1) {
        // Single finger PAN when zoomed in
        touchModeRef.current = 'pan';
      } else {
        // Single finger potential horizontal SWIPE when zoom is 1x
        touchModeRef.current = 'swipe';
        swipeStartRef.current = { x: touch.clientX, y: touch.clientY, time: now };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchModeRef.current === 'pinch' && e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const currentDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);

      if (initialPinchDistRef.current > 0) {
        const factor = currentDist / initialPinchDistRef.current;
        // Limit zoom between 1x and 4x
        const newScale = Math.min(Math.max(pinchStartScaleRef.current * factor, 0.9), 4.2);
        const clampedPos = clampPosition(positionRef.current, newScale);

        scaleRef.current = newScale;
        positionRef.current = clampedPos;
        setScale(newScale);
        setPosition(clampedPos);
      }
    } else if (touchModeRef.current === 'pan' && e.touches.length === 1) {
      // Incremental pan delta tracking: NEVER leaps or jumps!
      const touch = e.touches[0];
      const deltaX = touch.clientX - lastTouchRef.current.x;
      const deltaY = touch.clientY - lastTouchRef.current.y;

      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };

      const targetX = positionRef.current.x + deltaX;
      const targetY = positionRef.current.y + deltaY;
      const clamped = clampPosition({ x: targetX, y: targetY }, scaleRef.current);

      positionRef.current = clamped;
      setPosition(clamped);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchModeRef.current === 'pinch') {
      touchModeRef.current = 'none';
      if (scaleRef.current < 1) {
        resetTransform(true);
      } else {
        const clampedScale = Math.min(Math.max(scaleRef.current, 1), 4);
        const clampedPos = clampPosition(positionRef.current, clampedScale);
        applyTransform(clampedScale, clampedPos, true);
      }
    } else if (touchModeRef.current === 'swipe' && scaleRef.current === 1) {
      touchModeRef.current = 'none';
      const touch = e.changedTouches[0];
      if (touch) {
        const deltaX = touch.clientX - swipeStartRef.current.x;
        const deltaY = touch.clientY - swipeStartRef.current.y;
        const duration = Date.now() - swipeStartRef.current.time;

        // Valid horizontal swipe only if scale is 1x and horizontal move dominates
        if (duration < 400 && Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
          if (deltaX < 0 && currentIndex < photos.length - 1) {
            onNavigate(currentIndex + 1);
          } else if (deltaX > 0 && currentIndex > 0) {
            onNavigate(currentIndex - 1);
          }
        }
      }
    } else if (touchModeRef.current === 'pan') {
      touchModeRef.current = 'none';
      // Smoothly ensure position stays within strict boundaries after drag ends
      const clamped = clampPosition(positionRef.current, scaleRef.current);
      applyTransform(scaleRef.current, clamped, true);
    }
  };

  // Mouse pan support for desktop browser testing
  const [isMouseDown, setIsMouseDown] = useState(false);
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scaleRef.current > 1) {
      setIsMouseDown(true);
      lastTouchRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMouseDown && scaleRef.current > 1) {
      const deltaX = e.clientX - lastTouchRef.current.x;
      const deltaY = e.clientY - lastTouchRef.current.y;
      lastTouchRef.current = { x: e.clientX, y: e.clientY };

      const clamped = clampPosition(
        { x: positionRef.current.x + deltaX, y: positionRef.current.y + deltaY },
        scaleRef.current
      );
      positionRef.current = clamped;
      setPosition(clamped);
    }
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
  };

  if (!isOpen || !currentPhoto) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between select-none touch-none overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top Header Controls Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 backdrop-blur-md text-white z-30 pt-safe border-b border-white/10">
        {/* Photo Counter */}
        <div className="text-xs sm:text-sm font-bold tracking-wide">
          <span className="text-emerald-400">FOTO {currentIndex + 1}</span>{' '}
          <span className="text-white/60">/ {photos.length}</span>
        </div>

        {/* Zoom Controls & Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={handleZoomOut}
            disabled={scale <= 1}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            title="Perkecil (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="text-xs font-mono px-1 min-w-[2.8rem] text-center text-white/90">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={handleZoomIn}
            disabled={scale >= 4}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            title="Perbesar (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {scale > 1 && (
            <button
              onClick={() => resetTransform(true)}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white transition-all cursor-pointer"
              title="Kembalikan ke Ukuran Normal (1x)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          <div className="w-px h-5 bg-white/20 mx-1" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white transition-all cursor-pointer"
            title="Tutup (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Touch Canvas */}
      <div
        className="relative flex-1 flex items-center justify-center overflow-hidden w-full h-full cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        <img
          ref={imgRef}
          src={photoUrl}
          alt={`Foto Menu ${currentIndex + 1}`}
          referrerPolicy="no-referrer"
          className={`max-h-[82vh] max-w-[95vw] object-contain select-none pointer-events-auto will-change-transform ${
            isAnimating ? 'transition-transform duration-200 ease-out' : 'transition-none'
          }`}
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
          draggable={false}
        />

        {/* Previous navigation arrow (Only accessible or visible at 1x or easily reachable) */}
        {currentIndex > 0 && scale === 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(currentIndex - 1);
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-2xl bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all z-20 cursor-pointer shadow-lg active:scale-90"
            title="Foto Sebelumnya"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Next navigation arrow */}
        {currentIndex < photos.length - 1 && scale === 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(currentIndex + 1);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-2xl bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all z-20 cursor-pointer shadow-lg active:scale-90"
            title="Foto Berikutnya"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Touch instruction hint bar */}
      <div className="py-2.5 px-4 bg-slate-950/80 border-t border-white/10 text-center text-xs text-white/70 select-none pb-safe">
        {scale > 1 ? (
          <span className="text-emerald-400 font-medium">Geser untuk melihat detail menu · Ketuk 2x untuk reset</span>
        ) : (
          <span>Pinch dua jari untuk zoom · Geser foto kiri/kanan untuk menu berikutnya</span>
        )}
      </div>
    </div>
  );
};
