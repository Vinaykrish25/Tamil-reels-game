import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Film, Users, ArrowRight, Sparkles } from "lucide-react";
import { useAnonSession } from "@/lib/anon-auth";
function useServerFn<T>(fn: T): T {
  return fn;
}
import { createRoom, joinRoom } from "@/lib/game.functions";

export const Route = createFileRoute("/")({
  component: Landing,
});

const AVATARS = ["🎬", "🎭", "🎪", "🎯", "🎨", "🎧", "🎤", "🕵️", "🦸", "🧙", "🐯", "🦊"];

function randomSeed() {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

function Landing() {
  const session = useAnonSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [avatar, setAvatar] = useState(() => randomSeed());
  const [loading, setLoading] = useState<null | "create" | "join">(null);

  const createRoomFn = useServerFn(createRoom);
  const joinRoomFn = useServerFn(joinRoom);

  const disabled = !session || !name.trim();

  async function handleCreate() {
    if (disabled) return;
    setLoading("create");
    try {
      const res = await createRoomFn({
        data: { displayName: name.trim(), avatarSeed: avatar },
      });
      localStorage.setItem(`tmi:player:${res.roomId}`, res.playerId);
      localStorage.setItem("tmi:name", name.trim());
      localStorage.setItem("tmi:avatar", avatar);
      navigate({ to: "/room/$code", params: { code: res.code } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create room");
    } finally {
      setLoading(null);
    }
  }

  async function handleJoin() {
    if (disabled || !code.trim()) return;
    setLoading("join");
    try {
      const res = await joinRoomFn({
        data: {
          code: code.trim().toUpperCase(),
          displayName: name.trim(),
          avatarSeed: avatar,
        },
      });
      localStorage.setItem(`tmi:player:${res.roomId}`, res.playerId);
      localStorage.setItem("tmi:name", name.trim());
      localStorage.setItem("tmi:avatar", avatar);
      navigate({ to: "/room/$code", params: { code: code.trim().toUpperCase() } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to join");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl text-center"
      >
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Multiplayer Party Game
        </div>
        <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-6xl">
          <span className="neon-text">Tamil Movie</span>
          <br />
          <span>Imposter</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground">
          Everyone gets a Tamil movie. One of you gets nothing but keywords. Drop clues, spot the
          imposter, laugh a lot. 3–8 players.
        </p>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="glass mt-10 w-full max-w-2xl rounded-3xl p-6 sm:p-8"
      >
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your name
        </label>
        <div className="mt-2 flex items-center gap-3">
          <button
            aria-label="Change avatar"
            onClick={() => setAvatar(randomSeed())}
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-secondary text-3xl hover:bg-muted"
          >
            {avatar}
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            placeholder="Enter your name"
            className="h-14 min-w-0 flex-1 rounded-2xl border border-input bg-background/40 px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button
            onClick={handleCreate}
            disabled={disabled || loading !== null}
            className="neon-btn hover:neon-btn-hover flex items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>
              <span className="flex items-center gap-2 text-lg font-bold">
                <Film className="h-5 w-5" /> Create room
              </span>
              <span className="mt-0.5 block text-xs opacity-80">Host a new game</span>
            </span>
            <ArrowRight className="h-5 w-5" />
          </button>

          <div className="rounded-2xl border border-border bg-secondary/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4" /> Join a room
            </div>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="CODE"
                className="h-11 w-full min-w-0 rounded-xl border border-input bg-background/40 px-3 text-center font-mono text-lg tracking-[0.35em] uppercase outline-none focus:border-accent focus:ring-2 focus:ring-accent/50"
              />
              <button
                onClick={handleJoin}
                disabled={disabled || !code.trim() || loading !== null}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground hover:brightness-110 disabled:opacity-50"
                aria-label="Join"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="mt-8 text-center text-xs text-muted-foreground">
        150+ Tamil movies • AI clue generator • Live reactions
      </div>
    </main>
  );
}
