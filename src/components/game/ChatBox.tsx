import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
function useServerFn<T>(fn: T): T {
  return fn;
}
import { sendChat } from "@/lib/game.functions";
import type { Database } from "@/integrations/supabase/types";

type ChatMessage = Database["public"]["Tables"]["chat_messages"]["Row"];
type Player = Database["public"]["Tables"]["players"]["Row"];

type Props = {
  roomId: string;
  playerId: string;
  phase: "lobby" | "game" | "voting" | "postgame";
  messages: ChatMessage[];
  players: Player[];
  title?: string;
  compact?: boolean;
  onSendOptimistic?: (text: string) => string;
  onSendFailed?: (tempId: string) => void;
};

export function ChatBox({
  roomId,
  playerId,
  phase,
  messages,
  players,
  title,
  compact,
  onSendOptimistic,
  onSendFailed,
}: Props) {
  const [text, setText] = useState("");
  const send = useServerFn(sendChat);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const playerMap = new Map(players.map((p) => [p.id, p]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");

    let tempId: string | null = null;
    if (onSendOptimistic) {
      tempId = onSendOptimistic(t);
    }

    try {
      await send({ data: { roomId, playerId, text: t, phase } });
    } catch {
      if (tempId && onSendFailed) {
        onSendFailed(tempId);
      }
    }
  }

  return (
    <div className={`glass flex flex-col rounded-2xl ${compact ? "h-64" : "h-80"}`}>
      {title && (
        <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
      )}
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-2 text-sm">
        {messages.length === 0 && (
          <div className="grid h-full place-items-center text-xs text-muted-foreground">
            Say hi 👋
          </div>
        )}
        {messages.map((m) => {
          const p = playerMap.get(m.player_id);
          const mine = m.player_id === playerId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-1.5 ${
                  mine ? "bg-primary text-primary-foreground" : "bg-secondary"
                }`}
              >
                {!mine && (
                  <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>{p?.avatar_seed}</span>
                    <span>{p?.display_name ?? "…"}</span>
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-border p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 300))}
          placeholder="Type a message"
          className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-background/40 px-3 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Send"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground hover:brightness-110 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
