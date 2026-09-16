import { useEffect, useRef, useState, useCallback } from 'react';

interface DirtCanvasProps {
  emoji: string;
  size: number;
  onClean: (percent: number) => void;
  onComplete: () => void;
}

export default function DirtCanvas({ emoji, size, onClean, onComplete }: DirtCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const cleanPercentRef = useRef(0);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef(false);
  const completedRef = useRef(false);
  const totalPixelsRef = useRef(size * size);
  const [flies, setFlies] = useState<Array<{ id: number; x: number; y: number; angle: number }>>([]);
  const [showFlies, setShowFlies] = useState(true);

  // Initialize flies OUTSIDE the item area
  useEffect(() => {
    const initialFlies = Array.from({ length: 3 }, (_, i) => ({
      id: i,
      x: Math.random() * size,
      y: Math.random() * size,
      angle: Math.random() * Math.PI * 2,
    }));
    setFlies(initialFlies);
  }, [size]);

  // Animate flies outside the canvas (around edges)
  useEffect(() => {
    if (!showFlies) return;

    let frame = 0;
    let running = true;
    const animateFlies = () => {
      if (!running) return;
      frame++;
      setFlies(prev => prev.map(fly => {
        // Move in circular pattern around edges
        fly.angle += 0.02 + Math.random() * 0.01;
        const radius = size * 0.58 + Math.sin(frame * 0.05 + fly.id) * 25;
        const centerX = size / 2;
        const centerY = size / 2;
        fly.x = centerX + Math.cos(fly.angle) * radius;
        fly.y = centerY + Math.sin(fly.angle) * radius;
        return fly;
      }));
      animFrameRef.current = requestAnimationFrame(animateFlies);
    };
    animFrameRef.current = requestAnimationFrame(animateFlies);
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [size, showFlies]);

  // Draw emoji on base canvas and init mask
  useEffect(() => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !maskCanvas) return;

    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!ctx || !maskCtx) return;

    // Draw emoji
    ctx.clearRect(0, 0, size, size);
    ctx.font = `${size * 0.6}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2);

    // Draw dirt on mask canvas (fully opaque brown)
    maskCtx.fillStyle = '#654321';
    maskCtx.fillRect(0, 0, size, size);

    // Add noise texture
    for (let i = 0; i < 800; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const alpha = Math.random() * 0.4;
      maskCtx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      maskCtx.fillRect(x, y, 2, 2);
    }

    // Add lighter spots
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const alpha = Math.random() * 0.3;
      maskCtx.fillStyle = `rgba(139, 90, 43, ${alpha})`;
      maskCtx.fillRect(x, y, 3, 3);
    }

    totalPixelsRef.current = size * size;
  }, [emoji, size]);

  // Calculate clean percentage from mask canvas
  const calculateCleanPercent = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;

    // Sample pixels (every 4th pixel for performance)
    const imageData = maskCtx.getImageData(0, 0, size, size);
    let transparentCount = 0;
    const step = 4; // Sample every 4th pixel

    for (let i = 3; i < imageData.data.length; i += 4 * step) {
      if (imageData.data[i] < 128) { // If alpha < 128, it's transparent
        transparentCount++;
      }
    }

    const totalSampled = Math.floor(totalPixelsRef.current / step);
    const percent = (transparentCount / totalSampled) * 100;
    cleanPercentRef.current = Math.min(100, percent);
    onClean(cleanPercentRef.current);

    // Hide flies when nearly clean
    if (cleanPercentRef.current >= 90) {
      setShowFlies(false);
    }

    // Auto-complete at 95%
    if (cleanPercentRef.current >= 95 && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [size, onClean, onComplete]);

  // Erase dirt at position
  const eraseAt = useCallback((x: number, y: number) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;

    maskCtx.globalCompositeOperation = 'destination-out';
    maskCtx.beginPath();
    maskCtx.arc(x, y, 18, 0, Math.PI * 2);
    maskCtx.fill();
    maskCtx.globalCompositeOperation = 'source-over';
  }, []);

  // Pointer handlers
  const getPos = (e: React.PointerEvent) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = size / rect.width;
    const scaleY = size / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isDrawingRef.current = true;
    const pos = getPos(e);
    if (pos) {
      lastPosRef.current = pos;
      eraseAt(pos.x, pos.y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const pos = getPos(e);
    if (!pos) return;

    // Draw line from last position for smooth erasing
    if (lastPosRef.current) {
      const dx = pos.x - lastPosRef.current.x;
      const dy = pos.y - lastPosRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(1, Math.floor(dist / 8));

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = lastPosRef.current.x + dx * t;
        const y = lastPosRef.current.y + dy * t;
        eraseAt(x, y);
      }
    }

    lastPosRef.current = pos;
    calculateCleanPercent();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    isDrawingRef.current = false;
    lastPosRef.current = null;
    calculateCleanPercent();
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Flies around the edges (outside the item) */}
      {showFlies && flies.map(fly => (
        <div
          key={fly.id}
          className="absolute pointer-events-none z-30"
          style={{
            left: fly.x - 6,
            top: fly.y - 6,
            transition: 'left 0.05s linear, top 0.05s linear',
          }}
        >
          <div className="relative">
            {/* Fly body */}
            <div className="w-2 h-3 bg-gray-800 rounded-full" />
            {/* Wings */}
            <div
              className="absolute -top-1 -left-2 w-3 h-2 bg-gray-300/60 rounded-full"
              style={{ animation: 'flyWing 0.1s infinite alternate' }}
            />
            <div
              className="absolute -top-1 -right-2 w-3 h-2 bg-gray-300/60 rounded-full"
              style={{ animation: 'flyWing 0.1s infinite alternate-reverse' }}
            />
          </div>
        </div>
      ))}

      {/* Base emoji canvas */}
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="absolute inset-0 w-full h-full"
        style={{ imageRendering: 'auto' }}
      />

      {/* Dirt mask canvas (on top) */}
      <canvas
        ref={maskCanvasRef}
        width={size}
        height={size}
        className="absolute inset-0 w-full h-full cursor-pointer touch-none"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      <style>{`
        @keyframes flyWing {
          0% { transform: scaleY(1); }
          100% { transform: scaleY(0.3); }
        }
      `}</style>
    </div>
  );
}
