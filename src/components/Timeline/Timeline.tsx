import React, { useRef, useEffect, useCallback } from 'react';
import { useVideoStore } from '../../stores/videoStore';

const HANDLE_W = 8;
const RULER_H = 18;
const TRACK_H = 44;
const TOTAL_H = RULER_H + TRACK_H;

const Timeline: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<null | 'start' | 'end' | 'seek'>(null);

  const duration = useVideoStore((s) => s.duration);
  const currentTime = useVideoStore((s) => s.currentTime);
  const trimStart = useVideoStore((s) => s.trimStart);
  const trimEnd = useVideoStore((s) => s.trimEnd);
  const setCurrentTime = useVideoStore((s) => s.setCurrentTime);
  const setTrimStart = useVideoStore((s) => s.setTrimStart);
  const setTrimEnd = useVideoStore((s) => s.setTrimEnd);

  const toX = useCallback(
    (t: number, w: number) => (duration > 0 ? (t / duration) * (w - HANDLE_W * 2) + HANDLE_W : HANDLE_W),
    [duration],
  );
  const toT = useCallback(
    (x: number, w: number) => Math.max(0, Math.min(duration, ((x - HANDLE_W) / (w - HANDLE_W * 2)) * duration)),
    [duration],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);

    if (duration <= 0) {
      ctx.fillStyle = '#333';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('無影片', w / 2, h / 2 + 4);
      return;
    }

    // Ruler
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, RULER_H);

    const step = calcStep(duration, (w - HANDLE_W * 2) / 80);
    ctx.fillStyle = '#555';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    for (let t = 0; t <= duration + 0.001; t += step) {
      const x = toX(t, w);
      ctx.fillStyle = '#333';
      ctx.fillRect(x, RULER_H - 4, 1, 4);
      ctx.fillStyle = '#666';
      ctx.fillText(fmtTime(t), x, RULER_H - 6);
    }

    // Track background
    const ty = RULER_H;
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(HANDLE_W, ty, w - HANDLE_W * 2, TRACK_H);

    // Selection region
    const sx = toX(trimStart, w);
    const ex = toX(trimEnd, w);
    ctx.fillStyle = 'rgba(64, 128, 255, 0.18)';
    ctx.fillRect(sx, ty, ex - sx, TRACK_H);

    // Outside selection (dimmed)
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(HANDLE_W, ty, sx - HANDLE_W, TRACK_H);
    ctx.fillRect(ex, ty, w - HANDLE_W - ex, TRACK_H);

    // Selection border
    ctx.strokeStyle = 'rgba(64, 128, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, ty, ex - sx, TRACK_H);

    // Trim handles
    drawHandle(ctx, sx, ty, HANDLE_W, TRACK_H, '#4080ff');
    drawHandle(ctx, ex - HANDLE_W, ty, HANDLE_W, TRACK_H, '#4080ff');

    // Playhead
    const px = toX(currentTime, w);
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.stroke();

    // Playhead top marker
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.moveTo(px - 4, 0);
    ctx.lineTo(px + 4, 0);
    ctx.lineTo(px, 7);
    ctx.closePath();
    ctx.fill();
  }, [duration, currentTime, trimStart, trimEnd, toX]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const observer = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = TOTAL_H;
      draw();
    });
    observer.observe(container);
    canvas.width = container.clientWidth;
    canvas.height = TOTAL_H;
    draw();
    return () => observer.disconnect();
  }, [draw]);

  useEffect(() => { draw(); }, [draw]);

  const getXFromEvent = (e: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return e.clientX - rect.left;
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (duration <= 0) return;
    const x = getXFromEvent(e);
    const w = canvasRef.current!.width;
    const sx = toX(trimStart, w);
    const ex = toX(trimEnd, w);
    if (Math.abs(x - sx) <= HANDLE_W + 2) {
      drag.current = 'start';
    } else if (Math.abs(x - ex) <= HANDLE_W + 2) {
      drag.current = 'end';
    } else {
      drag.current = 'seek';
      setCurrentTime(toT(x, w));
    }
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!drag.current || !canvasRef.current) return;
      const x = getXFromEvent(e);
      const w = canvasRef.current.width;
      const t = toT(x, w);
      if (drag.current === 'start') setTrimStart(Math.min(t, trimEnd - 0.1));
      else if (drag.current === 'end') setTrimEnd(Math.max(t, trimStart + 0.1));
      else setCurrentTime(t);
    };
    const onUp = () => { drag.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [toT, trimStart, trimEnd, setCurrentTime, setTrimStart, setTrimEnd]);

  return (
    <div ref={containerRef} className="timeline-wrapper" style={{ width: '100%', height: TOTAL_H }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', cursor: 'crosshair', width: '100%', height: TOTAL_H }}
        onMouseDown={onMouseDown}
      />
    </div>
  );
};

function drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const r = 3;
  ctx.roundRect(x, y, w, h, [r]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  const cx = x + w / 2;
  for (let i = -1; i <= 1; i++) {
    ctx.fillRect(cx - 0.5, y + h / 2 + i * 5 - 1, 1, 3);
  }
}

function calcStep(duration: number, maxTicks: number): number {
  const nice = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];
  const raw = duration / maxTicks;
  return nice.find((s) => s >= raw) ?? 3600;
}

function fmtTime(t: number): string {
  const s = Math.floor(t % 60);
  const m = Math.floor(t / 60) % 60;
  const h = Math.floor(t / 3600);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default Timeline;
