import { useEffect, useRef, useState, useCallback } from 'react';

interface DirtCanvasProps {
  emoji: string;
  size: number;
  onClean: (percent: number) => void;
  onComplete: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface Fly {
  x: number;
  y: number;
  angle: number;
  speed: number;
  phase: number;
}

export default function DirtCanvas({ emoji, size, onClean, onComplete }: DirtCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dirtCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const fliesRef = useRef<Fly[]>([]);
  const cleanPercentRef = useRef(0);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [completed, setCompleted] = useState(false);

  // Initialize flies
  useEffect(() => {
    fliesRef.current = Array.from({ length: 3 }, () => ({
      x: Math.random() * size,
      y: Math.random() * size,
      angle: Math.random() * Math.PI * 2,
      speed: 1 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
    }));
  }, [size]);

  // Draw emoji on base canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);
    ctx.font = `${size * 0.6}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2);
  }, [emoji, size]);

  // Draw dirt layer
  useEffect(() => {
    const dirtCanvas = dirtCanvasRef.current;
    if (!dirtCanvas) return;
    const ctx = dirtCanvas.getContext('2d');
    if (!ctx) return;

    // Fill with dirt texture
    ctx.fillStyle = '#654321';
    ctx.fillRect(0, 0, size, size);

    // Add noise texture
    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const alpha = Math.random() * 0.3;
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.fillRect(x, y, 2, 2);
    }

    // Add lighter spots
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const alpha = Math.random() * 0.2;
      ctx.fillStyle = `rgba(139, 90, 43, ${alpha})`;
      ctx.fillRect(x, y, 3, 3);
    }
  }, [size]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      const dirtCanvas = dirtCanvasRef.current;
      if (!dirtCanvas) return;
      const ctx = dirtCanvas.getContext('2d');
      if (!ctx) return;

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.life--;
        return p.life > 0;
      });

      // Draw particles on dirt canvas (they appear as dust)
      particlesRef.current.forEach(p => {
        const alpha = p.life / p.maxLife;
        ctx.fillStyle = p.color.replace('1)', `${alpha})`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Update flies
      if (cleanPercentRef.current < 100) {
        fliesRef.current.forEach(fly => {
          fly.phase += 0.1;
          fly.angle += (Math.random() - 0.5) * 0.3;
          fly.x += Math.cos(fly.angle) * fly.speed;
          fly.y += Math.sin(fly.angle) * fly.speed + Math.sin(fly.phase) * 2;

          // Keep flies in bounds
          if (fly.x < 0 || fly.x > size) fly.angle = Math.PI - fly.angle;
          if (fly.y < 0 || fly.y > size) fly.angle = -fly.angle;
          fly.x = Math.max(0, Math.min(size, fly.x));
          fly.y = Math.max(0, Math.min(size, fly.y));
        });

        // Draw flies
        fliesRef.current.forEach(fly => {
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.arc(fly.x, fly.y, 3, 0, Math.PI * 2);
          ctx.fill();
          // Wings
          ctx.fillStyle = 'rgba(200, 200, 200, 0.6)';
          ctx.beginPath();
          ctx.ellipse(fly.x - 3, fly.y - 2, 4, 2, fly.phase, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(fly.x + 3, fly.y - 2, 4, 2, -fly.phase, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [size]);

  const spawnParticles = useCallback((x: number, y: number) => {
    const colors = ['rgba(139, 90, 43, 1)', 'rgba(101, 67, 33, 1)', 'rgba(160, 120, 60, 1)'];
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        size: 1 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = dirtCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    lastPosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 0 || !lastPosRef.current) return;
    const rect = dirtCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = x - lastPosRef.current.x;
    const dy = y - lastPosRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
      const dirtCanvas = dirtCanvasRef.current;
      if (!dirtCanvas) return;
      const ctx = dirtCanvas.getContext('2d');
      if (!ctx) return;

      // Erase dirt
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // Spawn particles
      spawnParticles(x, y);

      // Calculate clean percentage
      const imageData = ctx.getImageData(0, 0, size, size);
      let transparentPixels = 0;
      for (let i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] === 0) transparentPixels++;
      }
      const percent = (transparentPixels / (size * size)) * 100;
      cleanPercentRef.current = percent;
      onClean(percent);

      if (percent >= 95 && !completed) {
        setCompleted(true);
        onComplete();
      }

      lastPosRef.current = { x, y };
    }
  };

  const handlePointerUp = () => {
    lastPosRef.current = null;
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Base emoji canvas */}
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="absolute inset-0"
      />
      {/* Dirt layer canvas */}
      <canvas
        ref={dirtCanvasRef}
        width={size}
        height={size}
        className="absolute inset-0 cursor-pointer"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
}
