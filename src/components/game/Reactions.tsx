import { motion, AnimatePresence } from "framer-motion";
function useServerFn<T>(fn: T): T {
  return fn;
}
import { sendReaction } from "@/lib/game.functions";
import type { Database } from "@/integrations/supabase/types";

type Reaction = Database["public"]["Tables"]["reactions"]["Row"];

const EMOJIS = ["😂", "🤔", "🧐", "😮", "👏", "👍", "👎", "❤️", "🔥", "😭"];

export function EmojiReactionBar({
  roomId,
  playerId,
  onReactOptimistic,
  onReactFailed,
}: {
  roomId: string;
  playerId: string;
  onReactOptimistic?: (emoji: string) => string;
  onReactFailed?: (tempId: string) => void;
}) {
  const send = useServerFn(sendReaction);
  return (
    <div className="pointer-events-none fixed bottom-3 left-1/2 z-40 -translate-x-1/2 sm:bottom-5">
      <div className="glass pointer-events-auto flex items-center gap-1 rounded-full px-2 py-1.5 shadow-glow sm:gap-1.5 sm:px-3 sm:py-2">
        {EMOJIS.map((e) => (
          <motion.button
            key={e}
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.15, y: -2 }}
            onClick={async () => {
              let tempId: string | null = null;
              if (onReactOptimistic) {
                tempId = onReactOptimistic(e);
              }
              try {
                await send({ data: { roomId, playerId, emoji: e } });
              } catch {
                if (tempId && onReactFailed) {
                  onReactFailed(tempId);
                }
              }
            }}
            className="grid h-9 w-9 place-items-center rounded-full text-xl sm:h-10 sm:w-10 sm:text-2xl"
            aria-label={`React ${e}`}
          >
            {e}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export function ReactionOverlay({
  reactions,
  anchor,
}: {
  reactions: Reaction[];
  anchor: (playerId: string) => { x: number; y: number } | null;
}) {
  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      <AnimatePresence>
        {reactions.map((r) => {
          const pos = anchor(r.player_id);
          if (!pos) return null;
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 0, scale: 0.6 }}
              animate={{ opacity: 1, y: -80, scale: 1.1 }}
              exit={{ opacity: 0, y: -140, scale: 0.8 }}
              transition={{ duration: 2.2, ease: [0.2, 0.7, 0.3, 1] }}
              style={{ left: pos.x, top: pos.y }}
              className="absolute -translate-x-1/2 text-3xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]"
            >
              {r.emoji}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
