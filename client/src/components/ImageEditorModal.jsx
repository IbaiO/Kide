import { useEffect, useRef, useState } from 'react';
import './ImageEditorModal.css';

const MAX_CANVAS_SIZE = 320;
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.5;
const OUTPUT_SIZE = 480;   
const OUTPUT_QUALITY = 0.85;

export default function ImageEditorModal({
  show,
  file,
  shape = 'square',
  title = 'Irudia egokitu',
  onConfirm,
  onCancel,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const progressCanvasRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef(null);

  const [canvasSize, setCanvasSize] = useState(280);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imageReady, setImageReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!show || !file) return;

    setError('');
    setImageReady(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });

    const url = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = () => {
      imgRef.current = img;
      setImageReady(true);
    };
    img.onerror = () => setError('Ezin izan da irudia kargatu.');
    img.src = url;

    return () => URL.revokeObjectURL(url);
  }, [show, file]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !show) return;

    function resize() {
      const available = wrap.clientWidth;
      setCanvasSize(Math.max(200, Math.min(MAX_CANVAS_SIZE, available)));
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [show]);

  function getFrameSize() {
    return canvasSize * 0.72;
  }

  function getNaturalScale() {
    const img = imgRef.current;
    if (!img) return 1;
    return getFrameSize() / Math.min(img.naturalWidth, img.naturalHeight);
  }

  function clampOffset(nextOffset, currentZoom) {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const frameSize = getFrameSize();
    const scale = getNaturalScale() * currentZoom;
    const drawnWidth = img.naturalWidth * scale;
    const drawnHeight = img.naturalHeight * scale;
    const maxX = Math.max(0, (drawnWidth - frameSize) / 2);
    const maxY = Math.max(0, (drawnHeight - frameSize) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, nextOffset.x)),
      y: Math.max(-maxY, Math.min(maxY, nextOffset.y)),
    };
  }

  function tracePath(ctx, cx, cy, frameSize) {
    if (shape === 'circle') {
      ctx.arc(cx, cy, frameSize / 2, 0, Math.PI * 2);
      return;
    }
    const half = frameSize / 2;
    const r = 14;
    ctx.moveTo(cx - half + r, cy - half);
    ctx.lineTo(cx + half - r, cy - half);
    ctx.arcTo(cx + half, cy - half, cx + half, cy - half + r, r);
    ctx.lineTo(cx + half, cy + half - r);
    ctx.arcTo(cx + half, cy + half, cx + half - r, cy + half, r);
    ctx.lineTo(cx - half + r, cy + half);
    ctx.arcTo(cx - half, cy + half, cx - half, cy + half - r, r);
    ctx.lineTo(cx - half, cy - half + r);
    ctx.arcTo(cx - half, cy - half, cx - half + r, cy - half, r);
    ctx.closePath();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvasSize * dpr);
    canvas.height = Math.round(canvasSize * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    const rootStyles = getComputedStyle(document.documentElement);
    const colorAccent = rootStyles.getPropertyValue('--accent').trim() || '#7c6af7';
    const colorText1  = rootStyles.getPropertyValue('--text-1').trim() || '#f5f5f7';
    const colorHover  = rootStyles.getPropertyValue('--bg-hover').trim() || 'rgba(255,255,255,0.06)';

    ctx.fillStyle = colorHover;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    const cx = canvasSize / 2;
    const cy = canvasSize / 2;

    if (imageReady && img) {
      const scale = getNaturalScale() * zoom;
      const drawnWidth = img.naturalWidth * scale;
      const drawnHeight = img.naturalHeight * scale;

      ctx.drawImage(
        img,
        cx + offset.x - drawnWidth / 2,
        cy + offset.y - drawnHeight / 2,
        drawnWidth,
        drawnHeight
      );

      const frameSize = getFrameSize();
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, canvasSize, canvasSize);
      tracePath(ctx, cx, cy, frameSize);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fill('evenodd');
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      tracePath(ctx, cx, cy, frameSize);
      ctx.strokeStyle = colorAccent;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = colorText1;
      ctx.font = '500 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Kargatzen…', cx, cy);
    }
  }, [imageReady, canvasSize, zoom, offset, shape]);

  function handlePointerDown(e) {
    if (!imageReady || processing) return; // Bloqueado si está procesando
    canvasRef.current.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, offset };
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return;
    if (e.cancelable) e.preventDefault(); 
    
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(clampOffset(
      { x: dragRef.current.offset.x + dx, y: dragRef.current.offset.y + dy },
      zoom
    ));
  }

  function handlePointerUp(e) {
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture?.(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  }

  function handleZoomChange(e) {
    const nextZoom = parseFloat(e.target.value);
    setZoom(nextZoom);
    setOffset(prev => clampOffset(prev, nextZoom));
  }

  function drawProgressBar(fraction) {
    const canvas = progressCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rootStyles = getComputedStyle(document.documentElement);
    const colorTrack  = rootStyles.getPropertyValue('--bg-hover').trim() || 'rgba(255,255,255,0.08)';
    const colorAccent = rootStyles.getPropertyValue('--accent').trim()   || '#7c6af7';

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colorTrack;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = colorAccent;
    ctx.fillRect(0, 0, width * Math.max(0, Math.min(1, fraction)), height);
  }

  function handleConfirm() {
    const img = imgRef.current;
    if (!img || processing) return;

    setError('');
    setProcessing(true);

    let cancelled = false;
    let rafId = null;
    let start = null;

    function animateProgress(timestamp) {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const fraction = Math.min(0.85, (elapsed / 500) * 0.85);
      drawProgressBar(fraction);
      if (!cancelled && fraction < 0.85) {
        rafId = requestAnimationFrame(animateProgress);
      }
    }
    rafId = requestAnimationFrame(animateProgress);

    const frameSize = getFrameSize();
    const scale = getNaturalScale() * zoom;
    const drawnWidth = img.naturalWidth * scale;
    const drawnHeight = img.naturalHeight * scale;

    const frameLeftInCanvas = canvasSize / 2 - frameSize / 2;
    const frameTopInCanvas  = canvasSize / 2 - frameSize / 2;
    const imageLeftInCanvas = canvasSize / 2 + offset.x - drawnWidth / 2;
    const imageTopInCanvas  = canvasSize / 2 + offset.y - drawnHeight / 2;

    const sx = (frameLeftInCanvas - imageLeftInCanvas) / scale;
    const sy = (frameTopInCanvas - imageTopInCanvas) / scale;
    const sSize = frameSize / scale;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = OUTPUT_SIZE;
    outCanvas.height = OUTPUT_SIZE;
    const outCtx = outCanvas.getContext('2d');

    if (shape === 'circle') {
      outCtx.save();
      outCtx.beginPath();
      outCtx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
      outCtx.closePath();
      outCtx.clip();
    }

    outCtx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    if (shape === 'circle') outCtx.restore();

    outCanvas.toBlob(
      (blob) => {
        cancelled = true;
        if (rafId) cancelAnimationFrame(rafId);
        drawProgressBar(1);
        setTimeout(() => {
          setProcessing(false);
          if (blob) {
            onConfirm(blob);
          } else {
            setError('Ezin izan da irudia prestatu.');
          }
        }, 150);
      },
      'image/jpeg',
      OUTPUT_QUALITY
    );
  }

  if (!show) return null;

  return (
    <div className="iem-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="iem-dialog">
        <h3>{title}</h3>

        <div className="iem-canvas-wrap" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            className="iem-canvas"
            style={{ width: canvasSize, height: canvasSize }}
            aria-label="Irudia kokatu: arrastatu mugitzeko"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>

        {error && <p className="iem-error">{error}</p>}

        <label className="iem-zoom">
          <span>Zooma</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step="0.01"
            value={zoom}
            onChange={handleZoomChange}
            disabled={!imageReady || processing}
          />
        </label>

        {processing && (
          <div className="iem-progress">
            <canvas ref={progressCanvasRef} className="iem-progress-canvas" aria-hidden="true" />
            <span className="iem-progress-label">Irudia prestatzen…</span>
          </div>
        )}

        <div className="iem-actions">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={processing}>
            Utzi
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleConfirm}
            disabled={!imageReady || processing}
          >
            {processing ? 'Prestatzen…' : 'Egokitu eta gorde'}
          </button>
        </div>
      </div>
    </div>
  );
}