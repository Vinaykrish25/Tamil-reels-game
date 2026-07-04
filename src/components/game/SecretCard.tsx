import { useState, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";

type Props = {
  isImposter: boolean;
  secretText: string;
  clueHint: string | null;
};

export function SecretCard({ isImposter, secretText, clueHint }: Props) {
  const [revealed, setRevealed] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 3D tilt coordinates
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Map mouse coordinate offset to rotation angles
  const rotateX = useTransform(y, [-50, 50], [15, -15]);
  const rotateY = useTransform(x, [-80, 80], [-15, 15]);

  // Holographic reflection background shift
  const sheen = useTransform([x, y], (latest) => {
    const latestX = latest[0] as number;
    const latestY = latest[1] as number;
    const pctX = ((latestX + 80) / 160) * 100;
    const pctY = ((latestY + 50) / 100) * 100;
    return `radial-gradient(circle at ${pctX}% ${pctY}%, rgba(255, 255, 255, 0.4) 0%, transparent 60%)`;
  });

  const start = () => {
    // small delay to avoid accidental peeks
    holdTimer.current = setTimeout(() => setRevealed(true), 80);
  };

  const stop = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setRevealed(false);
    x.set(0);
    y.set(0);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left - width / 2;
    const mouseY = e.clientY - rect.top - height / 2;
    x.set(mouseX);
    y.set(mouseY);
  };

  return (
    <div className="pointer-events-auto fixed left-3 top-3 z-40 sm:left-5 sm:top-5">
      <motion.button
        aria-label="Hold to reveal your secret"
        onMouseDown={start}
        onMouseUp={stop}
        onMouseLeave={stop}
        onMouseMove={handleMouseMove}
        onTouchStart={(e) => {
          e.preventDefault();
          start();
        }}
        onTouchEnd={stop}
        onTouchCancel={stop}
        whileTap={{ scale: 0.97 }}
        style={{
          perspective: 1000,
          rotateX,
          rotateY,
        }}
        className="relative h-24 w-40 select-none rounded-2xl sm:h-28 sm:w-52 transition-shadow duration-300 hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]"
      >
        <motion.div
          animate={{ rotateY: revealed ? 180 : 0 }}
          transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
          className="relative h-full w-full"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Back / cover */}
          <div
            className="glass absolute inset-0 flex flex-col items-center justify-center rounded-2xl p-2 text-center overflow-hidden border border-white/10"
            style={{ backfaceVisibility: "hidden" }}
          >
            {/* Ambient inner glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-accent/5 pointer-events-none" />

            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground relative z-10">
              Hold to peek
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-bold neon-text relative z-10">
              <Eye className="h-4 w-4 text-primary animate-pulse" /> Your secret
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground relative z-10">
              Release to hide
            </div>
          </div>

          {/* Front / secret */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl p-3 text-center overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background: "linear-gradient(135deg, #a855f7, #ec4899)",
              color: "white",
              boxShadow: "0 12px 32px -8px rgba(168, 85, 247, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            {/* Holographic shimmer effect */}
            <motion.div
              className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-60"
              style={{
                background: sheen,
              }}
            />

            {isImposter ? (
              <div className="relative z-10">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-pink-200">
                  Imposter
                </div>
                <div className="mt-1 text-xs font-semibold">Bluff with these clues</div>
                {clueHint && (
                  <div className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-tight bg-black/20 rounded px-1.5 py-0.5">
                    {clueHint}
                  </div>
                )}
              </div>
            ) : (
              <div className="relative z-10">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-purple-200">
                  Your movie
                </div>
                <div className="mt-1 line-clamp-2 text-base font-extrabold leading-tight tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                  {secretText}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.button>
      <AnimatePresence>
        {!revealed && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground flex flex-col items-center"
          >
            <EyeOff className="h-3.5 w-3.5 animate-bounce" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
