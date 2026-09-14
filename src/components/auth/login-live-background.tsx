import { useEffect, useMemo, useRef, useState } from 'react';
import { LoginAuroraCanvas } from '@/components/auth/login-aurora-canvas';
import { LoginParticleCanvas } from '@/components/auth/login-particle-canvas';

const ORBS = [
  { id: '1', className: 'login-orb login-orb-1 left-[5%] top-[8%] h-80 w-80 bg-[#6366f1]/28' },
  { id: '2', className: 'login-orb login-orb-2 right-[4%] top-[14%] h-[28rem] w-[28rem] bg-[#ef4444]/14' },
  { id: '3', className: 'login-orb login-orb-3 bottom-[8%] left-[18%] h-96 w-96 bg-[#818cf8]/20' },
  { id: '4', className: 'login-orb login-orb-4 bottom-[12%] right-[12%] h-72 w-72 bg-[#f43f5e]/12' },
] as const;

const WAVE_BARS = [0.35, 0.55, 0.8, 1, 0.7, 0.45, 0.9, 0.6, 0.75, 0.5, 0.85, 0.4, 0.65, 0.95, 0.55, 0.7, 0.45, 0.8, 0.6, 0.5, 0.72, 0.58, 0.88, 0.42] as const;

const MONITORS = [
  { id: 'm1', className: 'left-[4%] top-[22%] h-28 w-44 rotate-[-6deg]' },
  { id: 'm2', className: 'right-[5%] top-[28%] h-32 w-48 rotate-[5deg]' },
  { id: 'm3', className: 'left-[10%] bottom-[18%] h-24 w-40 rotate-[4deg]' },
  { id: 'm4', className: 'right-[8%] bottom-[22%] h-28 w-44 rotate-[-4deg]' },
] as const;

const CHAT_BUBBLES = [
  { id: 'c1', user: 'vip***88', text: 'vào phòng live', side: 'left' as const, delay: 0 },
  { id: 'c2', user: 'fan***12', text: '🔥 hay quá idol ơi!', side: 'right' as const, delay: 4 },
  { id: 'c3', user: 'abc***56', text: 'tặng 500 xu 🎁', side: 'left' as const, delay: 8 },
  { id: 'c4', user: 'pro***31', text: 'live chất lượng!', side: 'right' as const, delay: 12 },
  { id: 'c5', user: 'new***09', text: 'follow rồi nhé ❤️', side: 'left' as const, delay: 16 },
  { id: 'c6', user: 'top***77', text: 'bình luận +1', side: 'right' as const, delay: 20 },
] as const;

const REACTIONS = ['❤️', '🔥', '👏', '✨', '🎁', '💎', '⭐', '🔥'] as const;

function parallaxOffset(center: number, amount: number) {
  return (center - 50) * amount;
}

export function LoginLiveBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 50, y: 50 });
  const [reducedMotion, setReducedMotion] = useState(false);

  const radarDetectDots = useMemo(() => {
    const count = 22;
    return Array.from({ length: count }, (_, idx) => {
      const angle = Math.random() * Math.PI * 2;
      // radius as percentage from center (18..42%)
      const radius = 18 + Math.random() * 24;
      const left = 50 + radius * Math.cos(angle);
      const top = 50 + radius * Math.sin(angle);
      const size = 3 + Math.random() * 3;
      // sync roughly with radar cycle (6s spin)
      const delay = (Math.random() * 6).toFixed(2);
      const duration = (1.3 + Math.random() * 0.8).toFixed(2);
      return { id: `dot-${idx}`, left, top, size, delay, duration };
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;

    const handleMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMouse({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      });
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMove);
  }, [reducedMotion]);

  const px = parallaxOffset(mouse.x, 0.4);
  const py = parallaxOffset(mouse.y, 0.4);
  const pxDeep = parallaxOffset(mouse.x, 0.9);
  const pyDeep = parallaxOffset(mouse.y, 0.9);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0e1016]"
    >
      <LoginAuroraCanvas active />
      <LoginParticleCanvas active />

      <div className="absolute inset-0 bg-grid opacity-14" />
      {/* Tùy chọn 2: warp-speed nhẹ (màu trầm, streak mảnh) */}
      <div className="login-warp-core absolute inset-0" />
      <div className="login-warp-streaks absolute inset-0" />
      <div
        className="absolute inset-0 transition-transform duration-700 ease-out"
        style={{ transform: `translate(${pxDeep * 0.5}px, ${pyDeep * 0.5}px)` }}
      >
        {ORBS.map((orb) => (
          <div key={orb.id} className={`absolute rounded-full blur-3xl ${orb.className}`} />
        ))}
      </div>

      <>
        <div className="login-spotlight login-spotlight-a absolute -left-1/4 top-0 h-full w-1/2 opacity-40" />
        <div className="login-spotlight login-spotlight-b absolute -right-1/4 top-0 h-full w-1/2 opacity-35" />

        <div
          className="absolute inset-0 transition-transform duration-500 ease-out"
          style={{ transform: `translate(${px}px, ${py}px)` }}
        >
          {MONITORS.map((m) => (
            <div
              key={m.id}
              className={`login-monitor absolute overflow-hidden rounded-lg border border-[#4c5a7a]/80 bg-[#161922]/60 shadow-lg shadow-black/30 backdrop-blur-sm ${m.className}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#6366f1]/25 via-[#1a1e28] to-[#ef4444]/15" />
              <div className="absolute bottom-1.5 left-2 flex items-center gap-1.5">
                <span className="login-live-dot h-1.5 w-1.5 rounded-full bg-[#ef4444]" />
                <span className="text-[8px] font-semibold uppercase tracking-wider text-[#eef0f6]/80">Live</span>
              </div>
            </div>
          ))}
        </div>

        {CHAT_BUBBLES.map((chat) => (
          <div
            key={chat.id}
            className={`login-chat-bubble absolute max-w-[220px] rounded-lg border border-[#556389]/75 bg-[#161922]/72 px-3 py-2 backdrop-blur-md ${
              chat.side === 'left' ? 'left-[6%]' : 'right-[6%]'
            }`}
            style={{
              animationDelay: `${chat.delay}s`,
              bottom: chat.side === 'left' ? '18%' : '24%',
            }}
          >
            <p className="truncate text-[10px] font-semibold text-[#a5b4fc]">{chat.user}</p>
            <p className="text-xs text-[#eef0f6]/95">{chat.text}</p>
          </div>
        ))}

        {REACTIONS.map((emoji, i) => (
          <span
            key={`${emoji}-${i}`}
            className="login-reaction absolute text-lg opacity-100"
            style={{
              left: `${10 + i * 11}%`,
              animationDelay: `${i * 1.4}s`,
              fontSize: i % 2 === 0 ? '1.25rem' : '1rem',
            }}
          >
            {emoji}
          </span>
        ))}
      </>

      <div
        className="absolute inset-0 opacity-42 transition-[background] duration-500 ease-out"
        style={{
          background: reducedMotion
            ? 'radial-gradient(ellipse 56% 44% at 50% 50%, rgba(99,102,241,0.24), transparent 76%)'
            : `radial-gradient(560px circle at ${mouse.x}% ${mouse.y}%, rgba(99,102,241,0.26), transparent 54%)`,
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-[#0e1016]/5 via-transparent to-[#0e1016]/52" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#0e1016_50%)]" />

      <>
        <div className="login-radar absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2">
          <span className="login-radar-ring login-radar-ring-1" />
          <span className="login-radar-ring login-radar-ring-2" />
          <span className="login-radar-ring login-radar-ring-3" />
          <span className="login-radar-sweep" />

          <div className="login-radar-detect-spin">
            {radarDetectDots.map((d) => (
              <span
                key={d.id}
                className="login-radar-detect-dot"
                style={
                  {
                    left: `${d.left}%`,
                    top: `${d.top}%`,
                    width: `${d.size}px`,
                    height: `${d.size}px`,
                    // used in CSS for animation delay/duration
                    ['--delay' as `--${string}`]: `${d.delay}s`,
                    ['--dur' as `--${string}`]: `${d.duration}s`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </div>

        <div className="login-scan-line absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#818cf8]/50 to-transparent" />
        <div className="login-noise absolute inset-0 opacity-[0.015]" />

        <div className="absolute bottom-0 left-0 right-0 flex h-28 items-end justify-center gap-1 px-8 pb-8 opacity-55">
          {WAVE_BARS.map((scale, i) => (
            <span
              key={i}
              className="login-wave-bar w-1 rounded-full bg-gradient-to-t from-[#ef4444]/15 via-[#6366f1]/30 to-[#818cf8]/80"
              style={{
                height: `${scale * 100}%`,
                animationDelay: `${i * 0.06}s`,
              }}
            />
          ))}
        </div>

        <div className="absolute left-5 top-5 flex items-center gap-3 sm:left-6 sm:top-6">
          <div className="flex items-center gap-2 rounded-full border border-[#2a3040]/80 bg-[#161922]/70 px-3 py-1.5 backdrop-blur-md">
            <span className="login-live-dot h-2 w-2 rounded-full bg-[#ef4444]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#eef0f6]/90">Live</span>
          </div>
          <div className="hidden items-center gap-1.5 rounded-full border border-[#2a3040]/60 bg-[#161922]/50 px-3 py-1.5 backdrop-blur-md sm:flex">
            <span className="text-[10px] text-[#9aa3b5]">đang xem</span>
            <span className="login-viewer-count text-xs font-bold tabular-nums text-[#eef0f6]">12,847</span>
          </div>
        </div>

        <div className="absolute right-5 top-5 hidden items-center gap-1.5 sm:right-6 sm:top-6 md:flex">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="login-signal-ring h-9 w-9 rounded-full border border-[#6366f1]/30"
              style={{ animationDelay: `${i * 0.6}s` }}
            />
          ))}
        </div>
      </>
    </div>
  );
}
