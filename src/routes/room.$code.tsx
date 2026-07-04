import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Copy,
  Crown,
  UserMinus,
  Play,
  Film,
  ArrowLeft,
  BookOpen,
  Vote as VoteIcon,
  Check,
  Repeat,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  advancePhase,
  castVote,
  joinRoom,
  kickPlayer,
  leaveRoom,
  startGame,
  submitClue,
  togglePlayAgain,
} from "@/lib/game.functions";
import { useAnonSession } from "@/lib/anon-auth";
import { useHeartbeat } from "@/lib/heartbeat";
import { useRoomState } from "@/lib/room-state";
import { SecretCard } from "@/components/game/SecretCard";
import { EmojiReactionBar, ReactionOverlay } from "@/components/game/Reactions";
import { ChatBox } from "@/components/game/ChatBox";
import { CustomMovieManager } from "@/components/game/CustomMovieManager";
import type { Database } from "@/integrations/supabase/types";

type Player = Database["public"]["Tables"]["players"]["Row"];

export const Route = createFileRoute("/room/$code")({
  component: RoomPage,
});

const AVATARS = ["🎬", "🎭", "🎪", "🎯", "🎨", "🎧", "🎤", "🕵️", "🦸", "🧙", "🐯", "🦊"];

function useMyPlayer(roomId: string | null, userId: string | null, players: Player[]) {
  return useMemo(() => {
    if (!userId) return null;
    return players.find((p) => p.user_id === userId) ?? null;
  }, [players, userId, roomId]);
}

function RoomPage() {
  const { code } = Route.useParams();
  const session = useAnonSession();
  const navigate = useNavigate();
  const state = useRoomState(code, session?.userId ?? null);
  const me = useMyPlayer(
    state.room?.id ?? null,
    session?.userId ?? null,
    state.players.filter((p) => !p.kicked),
  );
  useHeartbeat(me?.id ?? null);
  const kick = useServerFn(kickPlayer);

  const [joinName, setJoinName] = useState(() =>
    typeof window !== "undefined" ? (localStorage.getItem("tmi:name") ?? "") : "",
  );
  const [joinAvatar, setJoinAvatar] = useState(() =>
    typeof window !== "undefined" ? (localStorage.getItem("tmi:avatar") ?? AVATARS[0]) : AVATARS[0],
  );
  const [joining, setJoining] = useState(false);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const joinFn = useServerFn(joinRoom);
  const leaveFn = useServerFn(leaveRoom);

  // detect kick
  useEffect(() => {
    if (!session || !state.room) return;
    const myRow = state.players.find((p) => p.user_id === session.userId);
    if (myRow?.kicked) {
      toast.error("You were removed from this room");
      navigate({ to: "/" });
    }
  }, [state.players, session, state.room, navigate]);

  if (state.loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Loading room…</div>
      </div>
    );
  }

  if (!state.room) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="glass max-w-sm rounded-3xl p-8 text-center">
          <h1 className="text-2xl font-bold">Room not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Code <span className="font-mono">{code}</span> doesn&apos;t exist.
          </p>
          <Link
            to="/"
            className="neon-btn hover:neon-btn-hover mt-5 inline-flex rounded-full px-5 py-2.5 text-sm"
          >
            Home
          </Link>
        </div>
      </div>
    );
  }

  // Need to join
  if (!me) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="glass w-full max-w-md rounded-3xl p-6">
          <h1 className="text-xl font-bold">
            Join room <span className="font-mono neon-text">{code}</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">Pick an avatar and enter your name</p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setJoinAvatar(AVATARS[Math.floor(Math.random() * AVATARS.length)])}
              className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-3xl"
            >
              {joinAvatar}
            </button>
            <input
              value={joinName}
              onChange={(e) => setJoinName(e.target.value.slice(0, 20))}
              placeholder="Your name"
              className="h-14 flex-1 rounded-2xl border border-input bg-background/40 px-4 outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={async () => {
              if (!joinName.trim() || !session) return;
              setJoining(true);
              try {
                const res = await joinFn({
                  data: {
                    code,
                    displayName: joinName.trim(),
                    avatarSeed: joinAvatar,
                  },
                });
                localStorage.setItem(`tmi:player:${res.roomId}`, res.playerId);
                localStorage.setItem("tmi:name", joinName.trim());
                localStorage.setItem("tmi:avatar", joinAvatar);
                state.reload();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Join failed");
              } finally {
                setJoining(false);
              }
            }}
            disabled={!joinName.trim() || joining || !session}
            className="neon-btn hover:neon-btn-hover mt-4 w-full rounded-2xl py-3 text-sm font-bold disabled:opacity-50"
          >
            {joining ? "Joining…" : "Join room"}
          </button>
          <Link
            to="/"
            className="mt-3 block text-center text-xs text-muted-foreground hover:text-foreground"
          >
            ← Home
          </Link>
        </div>
      </div>
    );
  }

  const room = state.room;
  const activePlayers = state.players.filter((p) => !p.kicked);
  const isHost = me.id === room.host_player_id;

  return (
    <div className="relative min-h-screen">
      {/* Persistent secret card during game phases */}
      {state.assignment && room.status !== "lobby" && (
        <SecretCard
          isImposter={state.assignment.is_imposter}
          secretText={state.assignment.secret_text}
          clueHint={state.assignment.clue_hint}
        />
      )}

      {/* Reaction overlay */}
      <PlayerReactionOverlay reactions={state.reactions} players={activePlayers} />

      {/* Emoji bar */}
      <EmojiReactionBar
        roomId={room.id}
        playerId={me.id}
        onReactOptimistic={(emoji) => state.addOptimisticReaction(emoji, me.id)}
        onReactFailed={(tid) => state.removeOptimisticReaction(tid)}
      />

      <main className="mx-auto max-w-5xl px-4 pb-40 pt-32 sm:px-6 sm:pt-36">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            onClick={async () => {
              await leaveFn({ data: { roomId: room.id, playerId: me.id } });
              navigate({ to: "/" });
            }}
            className="glass flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Leave
          </button>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Room</div>
            <div className="flex items-center gap-2">
              <div className="font-mono text-xl font-bold neon-text sm:text-2xl">{code}</div>
              <button
                onClick={() => {
                  const url = `${location.origin}/room/${code}`;
                  navigator.clipboard.writeText(url);
                  toast.success("Invite link copied");
                }}
                className="grid h-8 w-8 place-items-center rounded-full bg-secondary hover:bg-muted"
                aria-label="Copy invite link"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowPlayersModal(true)}
            className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold hover:brightness-110"
          >
            <Users className="h-4 w-4" />
            {activePlayers.length}/8
          </button>
        </div>

        <AnimatePresence mode="wait">
          {room.status === "lobby" && (
            <motion.div key="lobby" {...pageAnim}>
              <LobbyView
                roomId={room.id}
                isHost={isHost}
                me={me}
                players={activePlayers}
                chats={state.chats}
                customMovies={state.customMovies}
                state={state}
              />
            </motion.div>
          )}
          {room.status === "clue" && (
            <motion.div key="clue" {...pageAnim}>
              <CluePhase
                roomId={room.id}
                gameId={room.current_game_id!}
                round={room.current_round}
                isHost={isHost}
                me={me}
                players={activePlayers}
                clues={state.clues}
                state={state}
              />
            </motion.div>
          )}
          {room.status === "discussion" && (
            <motion.div key="discuss" {...pageAnim}>
              <DiscussionPhase
                roomId={room.id}
                isHost={isHost}
                me={me}
                players={activePlayers}
                clues={state.clues}
                chats={state.chats}
                state={state}
              />
            </motion.div>
          )}
          {room.status === "voting" && (
            <motion.div key="vote" {...pageAnim}>
              <VotingPhase
                roomId={room.id}
                gameId={room.current_game_id!}
                isHost={isHost}
                me={me}
                players={activePlayers}
                votes={state.votes}
                chats={state.chats}
                clues={state.clues}
                state={state}
              />
            </motion.div>
          )}
          {room.status === "results" && (
            <motion.div key="results" {...pageAnim}>
              <ResultsPhase
                roomId={room.id}
                gameId={room.current_game_id!}
                me={me}
                players={activePlayers}
                votes={state.votes}
                movieTitle={state.movie?.title ?? "—"}
                imposterId={state.game?.revealed_imposter_player_id ?? null}
                playAgain={state.playAgain}
                state={state}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Player Management Modal */}
      <AnimatePresence>
        {showPlayersModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPlayersModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            {/* Content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass relative w-full max-w-md overflow-hidden rounded-3xl p-6 shadow-glow"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">Room Players</h3>
                <button
                  onClick={() => setShowPlayersModal(false)}
                  className="rounded-full bg-secondary p-1.5 hover:bg-muted"
                  aria-label="Close modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto pr-1">
                <PlayerGrid
                  players={activePlayers}
                  me={me}
                  isHost={isHost}
                  onKick={async (pid) => {
                    const prev = state.kickOptimisticPlayer(pid);
                    try {
                      await kick({ data: { roomId: room.id, targetPlayerId: pid } });
                    } catch (err) {
                      toast.error("Kick failed");
                      state.rollbackPlayers(prev);
                    }
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const pageAnim = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.25 },
};

/* ---------------- Reaction anchoring ---------------- */
function PlayerReactionOverlay({
  reactions,
  players,
}: {
  reactions: Database["public"]["Tables"]["reactions"]["Row"][];
  players: Player[];
}) {
  const anchor = (playerId: string) => {
    if (typeof document === "undefined") return null;
    const el = document.querySelector<HTMLElement>(`[data-player-avatar="${playerId}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  void players; // avoid unused
  return <ReactionOverlay reactions={reactions} anchor={anchor} />;
}

/* ---------------- Lobby ---------------- */
function LobbyView({
  roomId,
  isHost,
  me,
  players,
  chats,
  customMovies,
  state,
}: {
  roomId: string;
  isHost: boolean;
  me: Player;
  players: Player[];
  chats: Database["public"]["Tables"]["chat_messages"]["Row"][];
  customMovies: Database["public"]["Tables"]["movies"]["Row"][];
  state: ReturnType<typeof useRoomState>;
}) {
  const [manager, setManager] = useState(false);
  const start = useServerFn(startGame);
  const kick = useServerFn(kickPlayer);
  const canStart = players.length >= 3 && players.length <= 8;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="grid gap-6">
        <section className="glass rounded-3xl p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Players</h2>
            <div className="text-xs text-muted-foreground">{players.length}/8</div>
          </div>
          <PlayerGrid
            players={players}
            me={me}
            isHost={isHost}
            onKick={async (pid) => {
              const prev = state.kickOptimisticPlayer(pid);
              try {
                await kick({ data: { roomId, targetPlayerId: pid } });
              } catch (err) {
                toast.error("Kick failed");
                state.rollbackPlayers(prev);
              }
            }}
          />
          {isHost ? (
            <button
              disabled={!canStart}
              onClick={async () => {
                try {
                  await start({ data: { roomId } });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Start failed");
                }
              }}
              className="neon-btn hover:neon-btn-hover mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-base font-bold disabled:opacity-40"
            >
              <Play className="h-5 w-5" />
              {canStart
                ? "Start game"
                : `Need ${3 - players.length > 0 ? 3 - players.length : 0} more`}
            </button>
          ) : (
            <p className="mt-5 text-center text-xs text-muted-foreground">
              Waiting for host to start…
            </p>
          )}
        </section>

        {isHost && (
          <section className="glass rounded-3xl p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Movies</h3>
                <p className="text-xs text-muted-foreground">
                  150 built-in Tamil movies + {customMovies.length} custom
                </p>
              </div>
              <button
                onClick={() => setManager(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-semibold text-accent-foreground"
              >
                <Sparkles className="h-4 w-4" /> Manage
              </button>
            </div>
          </section>
        )}
      </div>

      <ChatBox
        roomId={roomId}
        playerId={me.id}
        phase="lobby"
        players={players}
        messages={chats.filter((c) => c.phase === "lobby" || c.phase === "postgame")}
        title="Lobby chat"
        onSendOptimistic={(t) => state.addOptimisticChat(t, "lobby", me.id)}
        onSendFailed={(tid) => state.removeOptimisticChat(tid)}
      />

      {manager && (
        <CustomMovieManager
          roomId={roomId}
          movies={customMovies}
          onClose={() => setManager(false)}
          onAddOptimistic={(title, clue) => state.addOptimisticMovie(title, clue)}
          onAddFailed={(prev) => state.rollbackMovies(prev)}
          onUpdateOptimistic={(id, title, clue) => state.updateOptimisticMovie(id, title, clue)}
          onUpdateFailed={(prev) => state.rollbackMovies(prev)}
          onDeleteOptimistic={(id) => state.deleteOptimisticMovie(id)}
          onDeleteFailed={(prev) => state.rollbackMovies(prev)}
        />
      )}
    </div>
  );
}

function PlayerGrid({
  players,
  me,
  isHost,
  onKick,
}: {
  players: Player[];
  me: Player;
  isHost: boolean;
  onKick?: (playerId: string) => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {players.map((p) => {
        const diff = now - new Date(p.last_seen_at).getTime();
        const status = diff > 30000 ? "disconnected" : diff > 15000 ? "idle" : "online";
        const isRoomHost = p.is_host;
        return (
          <div
            key={p.id}
            data-player-avatar={p.id}
            className="glass flex items-center gap-3 rounded-2xl p-3"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-2xl">
              {p.avatar_seed}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-sm font-semibold">
                <span className="truncate">{p.display_name}</span>
                {isRoomHost && <Crown className="h-3.5 w-3.5 shrink-0 text-gold" />}
                {p.id === me.id && (
                  <span className="text-[10px] font-normal text-muted-foreground">(you)</span>
                )}
              </div>
              <div className="text-[10px]">
                {status === "disconnected" && (
                  <span className="text-destructive font-semibold">disconnected</span>
                )}
                {status === "idle" && <span className="text-yellow-500 font-semibold">idle</span>}
                {status === "online" && <span className="text-accent font-semibold">online</span>}
              </div>
            </div>
            {isHost && p.id !== me.id && onKick && (
              <button
                onClick={() => onKick(p.id)}
                aria-label="Kick player"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30"
              >
                <UserMinus className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Clue phase ---------------- */
function CluePhase({
  roomId,
  gameId,
  round,
  isHost,
  me,
  players,
  clues,
  state,
}: {
  roomId: string;
  gameId: string;
  round: number;
  isHost: boolean;
  me: Player;
  players: Player[];
  clues: Database["public"]["Tables"]["clues"]["Row"][];
  state: ReturnType<typeof useRoomState>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const submit = useServerFn(submitClue);
  const advance = useServerFn(advancePhase);
  const roundClues = clues.filter((c) => c.round === round);
  const mineThisRound = roundClues.find((c) => c.player_id === me.id);
  const allSubmitted = roundClues.length >= players.length;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="grid gap-6">
        <section className="glass rounded-3xl p-6 text-center">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Round {round} of 3 · Clue phase
          </div>
          <h2 className="mt-1 text-2xl font-bold">
            Drop a <span className="neon-text">clue</span> about your movie
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            One word or a short phrase. Don&apos;t say the title.
          </p>

          {!mineThisRound ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!text.trim()) return;
                setSending(true);
                try {
                  await submit({
                    data: { roomId, gameId, playerId: me.id, round, text: text.trim() },
                  });
                  setText("");
                } finally {
                  setSending(false);
                }
              }}
              className="mx-auto mt-5 flex max-w-md gap-2"
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 60))}
                placeholder="Your clue…"
                className="h-12 min-w-0 flex-1 rounded-2xl border border-input bg-background/40 px-4 text-center text-base font-semibold outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={!text.trim() || sending}
                className="neon-btn hover:neon-btn-hover rounded-2xl px-5 text-sm font-bold disabled:opacity-40"
              >
                Send
              </button>
            </form>
          ) : (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-accent/50 bg-accent/10 px-4 py-2 text-sm text-accent">
              <Check className="h-4 w-4" /> Clue submitted — {mineThisRound.text}
            </div>
          )}
        </section>

        <section className="glass rounded-3xl p-5">
          <div className="mb-3 flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-widest text-muted-foreground">
              This round
            </span>
            <span className="text-muted-foreground">
              {roundClues.length}/{players.length} submitted
            </span>
          </div>
          <ul className="grid gap-2">
            {players.map((p) => {
              const c = roundClues.find((x) => x.player_id === p.id);
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3">
                  <div
                    data-player-avatar={p.id}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background/60 text-lg"
                  >
                    {p.avatar_seed}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{p.display_name}</div>
                    {c ? (
                      <div className="truncate text-sm text-foreground">"{c.text}"</div>
                    ) : (
                      <div className="text-xs text-muted-foreground">Thinking…</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {isHost && (
          <div className="flex flex-wrap justify-center gap-2">
            {round < 3 && (
              <button
                disabled={!allSubmitted}
                onClick={async () => {
                  const prev = state.changeRoomStatusOptimistic("clue", round + 1);
                  try {
                    await advance({ data: { roomId, to: "clue", round: round + 1 } });
                  } catch {
                    toast.error("Failed to advance round");
                    state.rollbackRoom(prev);
                  }
                }}
                className="rounded-full bg-secondary px-5 py-2 text-sm font-semibold disabled:opacity-40"
              >
                Next round →
              </button>
            )}
            <button
              disabled={!allSubmitted && round < 3}
              onClick={async () => {
                const prev = state.changeRoomStatusOptimistic("discussion");
                try {
                  await advance({ data: { roomId, to: "discussion" } });
                } catch {
                  toast.error("Failed to go to discussion");
                  state.rollbackRoom(prev);
                }
              }}
              className="neon-btn hover:neon-btn-hover rounded-full px-5 py-2 text-sm disabled:opacity-40"
            >
              Go to discussion
            </button>
          </div>
        )}
      </div>

      <ChatBox
        roomId={roomId}
        playerId={me.id}
        phase="game"
        players={players}
        messages={[]}
        title="Save chat for discussion"
        compact
        onSendOptimistic={(t) => state.addOptimisticChat(t, "game", me.id)}
        onSendFailed={(tid) => state.removeOptimisticChat(tid)}
      />
    </div>
  );
}

/* ---------------- Discussion ---------------- */
function DiscussionPhase({
  roomId,
  isHost,
  me,
  players,
  clues,
  chats,
  state,
}: {
  roomId: string;
  isHost: boolean;
  me: Player;
  players: Player[];
  clues: Database["public"]["Tables"]["clues"]["Row"][];
  chats: Database["public"]["Tables"]["chat_messages"]["Row"][];
  state: ReturnType<typeof useRoomState>;
}) {
  const advance = useServerFn(advancePhase);
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <section className="glass rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <BookOpen className="h-4 w-4" /> Discussion
        </div>
        <h2 className="mt-1 text-2xl font-bold">
          Study every clue. <span className="neon-text">Spot the fake.</span>
        </h2>
        <div className="mt-5 grid gap-4">
          {[1, 2, 3].map((r) => (
            <div key={r}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Round {r}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {players.map((p) => {
                  const c = clues.find((x) => x.round === r && x.player_id === p.id);
                  return (
                    <div
                      key={p.id + r}
                      className="flex items-center gap-3 rounded-xl bg-secondary/60 p-2.5"
                    >
                      <div
                        data-player-avatar={p.id}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background/60 text-base"
                      >
                        {p.avatar_seed}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold">{p.display_name}</div>
                        <div className="truncate text-sm">
                          {c ? `"${c.text}"` : <span className="text-muted-foreground">—</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {isHost && (
          <button
            onClick={async () => {
              const prev = state.changeRoomStatusOptimistic("voting");
              try {
                await advance({ data: { roomId, to: "voting" } });
              } catch {
                toast.error("Failed to start voting");
                state.rollbackRoom(prev);
              }
            }}
            className="neon-btn hover:neon-btn-hover mt-6 w-full rounded-2xl py-3 text-sm font-bold"
          >
            Start voting →
          </button>
        )}
      </section>

      <ChatBox
        roomId={roomId}
        playerId={me.id}
        phase="game"
        players={players}
        messages={chats.filter((c) => c.phase === "game")}
        title="Discussion chat"
        onSendOptimistic={(t) => state.addOptimisticChat(t, "game", me.id)}
        onSendFailed={(tid) => state.removeOptimisticChat(tid)}
      />
    </div>
  );
}

/* ---------------- Voting ---------------- */
function VotingPhase({
  roomId,
  gameId,
  isHost,
  me,
  players,
  votes,
  chats,
  clues,
  state,
}: {
  roomId: string;
  gameId: string;
  isHost: boolean;
  me: Player;
  players: Player[];
  votes: Database["public"]["Tables"]["votes"]["Row"][];
  chats: Database["public"]["Tables"]["chat_messages"]["Row"][];
  clues: Database["public"]["Tables"]["clues"]["Row"][];
  state: ReturnType<typeof useRoomState>;
}) {
  const vote = useServerFn(castVote);
  const advance = useServerFn(advancePhase);
  const myVote = votes.find((v) => v.voter_player_id === me.id);
  const allVoted = votes.length >= players.length;
  void clues;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <section className="glass rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <VoteIcon className="h-4 w-4" /> Voting
        </div>
        <h2 className="mt-1 text-2xl font-bold">Who&apos;s the imposter?</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {players.map((p) => {
            const count = votes.filter((v) => v.target_player_id === p.id).length;
            const selected = myVote?.target_player_id === p.id;
            return (
              <button
                key={p.id}
                disabled={p.id === me.id}
                onClick={async () => {
                  const prev = state.castOptimisticVote(me.id, p.id, gameId);
                  try {
                    await vote({
                      data: {
                        roomId,
                        gameId,
                        voterPlayerId: me.id,
                        targetPlayerId: p.id,
                      },
                    });
                  } catch (err) {
                    toast.error("Vote failed");
                    state.rollbackVotes(prev);
                  }
                }}
                className={`glass relative flex flex-col items-center gap-2 rounded-2xl p-4 transition ${
                  selected ? "ring-2 ring-primary" : ""
                } ${p.id === me.id ? "opacity-40" : "hover:brightness-110"}`}
              >
                <div
                  data-player-avatar={p.id}
                  className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-3xl"
                >
                  {p.avatar_seed}
                </div>
                <div className="max-w-full truncate text-sm font-semibold">{p.display_name}</div>
                <div className="absolute right-2 top-2 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">
                  {count}
                </div>
              </button>
            );
          })}
        </div>

        {isHost && (
          <button
            disabled={!allVoted}
            onClick={async () => {
              const prev = state.changeRoomStatusOptimistic("results");
              try {
                await advance({ data: { roomId, to: "results" } });
              } catch {
                toast.error("Failed to reveal results");
                state.rollbackRoom(prev);
              }
            }}
            className="neon-btn hover:neon-btn-hover mt-5 w-full rounded-2xl py-3 text-sm font-bold disabled:opacity-40"
          >
            Reveal results →
          </button>
        )}
        {!isHost && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {votes.length}/{players.length} voted · waiting for host to reveal
          </p>
        )}
      </section>

      <ChatBox
        roomId={roomId}
        playerId={me.id}
        phase="voting"
        players={players}
        messages={chats.filter((c) => c.phase === "voting")}
        title="Vote chat"
        onSendOptimistic={(t) => state.addOptimisticChat(t, "voting", me.id)}
        onSendFailed={(tid) => state.removeOptimisticChat(tid)}
      />
    </div>
  );
}

/* ---------------- Results ---------------- */
function ResultsPhase({
  roomId,
  gameId,
  me,
  players,
  votes,
  movieTitle,
  imposterId,
  playAgain,
  state,
}: {
  roomId: string;
  gameId: string;
  me: Player;
  players: Player[];
  votes: Database["public"]["Tables"]["votes"]["Row"][];
  movieTitle: string;
  imposterId: string | null;
  playAgain: Database["public"]["Tables"]["play_again"]["Row"][];
  state: ReturnType<typeof useRoomState>;
}) {
  const toggle = useServerFn(togglePlayAgain);
  const imposter = players.find((p) => p.id === imposterId);
  const counts = players
    .map((p) => ({ p, n: votes.filter((v) => v.target_player_id === p.id).length }))
    .sort((a, b) => b.n - a.n);
  const top = counts[0];
  const caught = top && imposterId && top.p.id === imposterId && top.n > (counts[1]?.n ?? 0);
  const myReady = playAgain.some((pa) => pa.player_id === me.id);
  void roomId;

  return (
    <div className="grid gap-6">
      <section className="glass rounded-3xl p-6 text-center">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Reveal</div>
        <h2 className="mt-1 text-3xl font-extrabold">
          {caught ? (
            <span className="neon-text">Crew wins! 🎉</span>
          ) : (
            <span className="text-destructive">Imposter escapes 🕵️</span>
          )}
        </h2>
        <div className="mx-auto mt-5 grid max-w-lg gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-secondary/60 p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              The movie was
            </div>
            <div className="mt-1 flex items-center justify-center gap-2 text-lg font-bold">
              <Film className="h-4 w-4 text-accent" />
              {movieTitle}
            </div>
          </div>
          <div className="rounded-2xl bg-secondary/60 p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              The imposter was
            </div>
            <div className="mt-1 flex items-center justify-center gap-2 text-lg font-bold">
              <span className="text-2xl">{imposter?.avatar_seed}</span>
              {imposter?.display_name ?? "—"}
            </div>
          </div>
        </div>
      </section>

      <section className="glass rounded-3xl p-5">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Votes
        </h3>
        <ul className="mt-3 grid gap-2">
          {counts.map(({ p, n }) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl bg-secondary/60 p-2.5">
              <div
                data-player-avatar={p.id}
                className="grid h-8 w-8 place-items-center rounded-lg bg-background/60 text-base"
              >
                {p.avatar_seed}
              </div>
              <div className="flex-1 text-sm">{p.display_name}</div>
              <div className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">
                {n}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <button
        onClick={async () => {
          const prev = state.toggleOptimisticPlayAgain(me.id, gameId);
          try {
            await toggle({ data: { gameId, playerId: me.id } });
          } catch (err) {
            toast.error("Failed to toggle play again");
            state.rollbackPlayAgain(prev);
          }
        }}
        className={`neon-btn hover:neon-btn-hover flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold ${
          myReady ? "opacity-70" : ""
        }`}
      >
        <Repeat className="h-5 w-5" />
        {myReady ? `Ready ✓ (${playAgain.length}/${players.length})` : "Play again"}
      </button>
      <p className="text-center text-xs text-muted-foreground">
        When everyone taps play again, the room returns to the lobby.
      </p>
    </div>
  );
}
