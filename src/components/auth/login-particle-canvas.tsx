import { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  hue: number;
};

type LoginParticleCanvasProps = {
  active?: boolean;
};

function particleCount() {
  if (typeof window === 'undefined') return 1000;
  return window.innerWidth < 768 ? 700 : 1400;
}

export function LoginParticleCanvas({ active = true }: LoginParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;

    const initParticles = () => {
      const count = particleCount();
      particlesRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        size: Math.random() * 2 + 0.6,
        alpha: Math.random() * 0.6 + 0.3,
        hue: Math.random() > 0.75 ? 0 : 235 + Math.random() * 30,
      }));
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (particlesRef.current.length === 0) initParticles();
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const onLeave = () => {
      mouseRef.current.active = false;
    };

    const drawLaser = (mx: number, my: number) => {
      const cx = width * 0.5;
      const cy = height * 0.08;

      const grad = ctx.createLinearGradient(cx, cy, mx, my);
      grad.addColorStop(0, 'rgba(129, 140, 248, 0)');
      grad.addColorStop(0.35, 'rgba(99, 102, 241, 0.12)');
      grad.addColorStop(0.7, 'rgba(239, 68, 68, 0.18)');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0.35)');

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(129, 140, 248, 0.6)';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(mx, my);
      ctx.stroke();

      for (let i = -2; i <= 2; i++) {
        ctx.globalAlpha = 0.08 - Math.abs(i) * 0.02;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(mx + i * 14, my + i * 8);
        ctx.stroke();
      }

      const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 80);
      glow.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
      glow.addColorStop(0.4, 'rgba(99, 102, 241, 0.12)');
      glow.addColorStop(1, 'rgba(99, 102, 241, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(mx, my, 80, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, width, height);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 120 && dist > 0.1) {
            p.vx += (dx / dist) * 0.008;
            p.vy += (dy / dist) * 0.008;
          }
        }

        p.vx *= 0.995;
        p.vy *= 0.995;

        ctx.beginPath();
        ctx.fillStyle =
          p.hue < 100
            ? `rgba(239, 68, 68, ${p.alpha})`
            : `rgba(129, 140, 248, ${p.alpha})`;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (mouse.active) {
        drawLaser(mouse.x, mouse.y);

        for (const p of particles) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 90) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(129, 140, 248, ${0.15 * (1 - dist / 90)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }
    };

    resize();
    initParticles();
    rafRef.current = requestAnimationFrame(draw);

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      particlesRef.current = [];
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
