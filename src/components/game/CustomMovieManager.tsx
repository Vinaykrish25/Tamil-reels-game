import { useState, useMemo } from "react";
import { X, Plus, Sparkles, Trash2, Search, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
function useServerFn<T>(fn: T): T {
  return fn;
}
import {
  addCustomMovie,
  deleteCustomMovie,
  generateAIClue,
  updateCustomMovie,
} from "@/lib/game.functions";
import type { Database } from "@/integrations/supabase/types";

type Movie = Database["public"]["Tables"]["movies"]["Row"];

export function CustomMovieManager({
  roomId,
  movies,
  onClose,
  onAddOptimistic,
  onAddFailed,
  onUpdateOptimistic,
  onUpdateFailed,
  onDeleteOptimistic,
  onDeleteFailed,
}: {
  roomId: string;
  movies: Movie[];
  onClose: () => void;
  onAddOptimistic?: (title: string, clue: string) => { tempId: string; prevMovies: Movie[] };
  onAddFailed?: (prevMovies: Movie[]) => void;
  onUpdateOptimistic?: (id: string, title: string, clue: string) => Movie[];
  onUpdateFailed?: (prevMovies: Movie[]) => void;
  onDeleteOptimistic?: (id: string) => Movie[];
  onDeleteFailed?: (prevMovies: Movie[]) => void;
}) {
  const [title, setTitle] = useState("");
  const [clue, setClue] = useState("");
  const [q, setQ] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const add = useServerFn(addCustomMovie);
  const update = useServerFn(updateCustomMovie);
  const del = useServerFn(deleteCustomMovie);
  const gen = useServerFn(generateAIClue);

  const filtered = useMemo(() => {
    const list = movies
      .filter((m) => m.title.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (sortAsc ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)));
    return list;
  }, [movies, q, sortAsc]);

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    let effectiveClue = clue.trim();
    if (!effectiveClue) {
      setAiLoading(true);
      try {
        const res = await gen({ data: { title: title.trim() } });
        effectiveClue = res.clue;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "AI failed");
        setAiLoading(false);
        return;
      }
      setAiLoading(false);
    }

    let prevMovies: Movie[] | null = null;
    if (editId) {
      if (onUpdateOptimistic) {
        prevMovies = onUpdateOptimistic(editId, title.trim(), effectiveClue);
      }
    } else {
      if (onAddOptimistic) {
        const res = onAddOptimistic(title.trim(), effectiveClue);
        prevMovies = res.prevMovies;
      }
    }

    setSaving(true);
    try {
      if (editId) {
        await update({ data: { id: editId, title: title.trim(), clue: effectiveClue } });
      } else {
        await add({ data: { roomId, title: title.trim(), clue: effectiveClue } });
      }
      setTitle("");
      setClue("");
      setEditId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      if (editId) {
        if (onUpdateFailed && prevMovies) onUpdateFailed(prevMovies);
      } else {
        if (onAddFailed && prevMovies) onAddFailed(prevMovies);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAI() {
    if (!title.trim()) {
      toast.error("Enter a title first");
      return;
    }
    setAiLoading(true);
    try {
      const res = await gen({ data: { title: title.trim() } });
      setClue(res.clue);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI failed");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="glass max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-t-3xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="text-lg font-bold">Custom Movies</h2>
            <p className="text-xs text-muted-foreground">Add your own titles for this room</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-secondary hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-4">
          <div className="grid gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 80))}
              placeholder="Movie title (e.g. Leo)"
              className="h-11 rounded-xl border border-input bg-background/40 px-3 text-sm outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <input
                value={clue}
                onChange={(e) => setClue(e.target.value.slice(0, 120))}
                placeholder="Clue (optional — leave blank to auto-generate)"
                className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background/40 px-3 text-sm outline-none focus:border-accent"
              />
              <button
                onClick={handleAI}
                disabled={aiLoading}
                className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-semibold text-accent-foreground hover:brightness-110 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {aiLoading ? "…" : "AI Clue"}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || aiLoading}
                className="neon-btn hover:neon-btn-hover inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> {editId ? "Update movie" : "Add movie"}
              </button>
              {editId && (
                <button
                  onClick={() => {
                    setEditId(null);
                    setTitle("");
                    setClue("");
                  }}
                  className="h-11 rounded-xl border border-border bg-secondary px-4 text-sm"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search"
                className="h-10 w-full rounded-xl border border-input bg-background/40 pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={() => setSortAsc((s) => !s)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-secondary text-muted-foreground"
              aria-label="Sort"
            >
              <ArrowUpDown className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-background/30">
            {filtered.length === 0 ? (
              <div className="grid h-32 place-items-center text-xs text-muted-foreground">
                No custom movies yet
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{m.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{m.clue}</div>
                    </div>
                    <button
                      onClick={() => {
                        setEditId(m.id);
                        setTitle(m.title);
                        setClue(m.clue);
                      }}
                      className="rounded-lg border border-border bg-secondary px-2 py-1 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        let prevMovies: Movie[] | null = null;
                        if (onDeleteOptimistic) {
                          prevMovies = onDeleteOptimistic(m.id);
                        }
                        try {
                          await del({ data: { id: m.id } });
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Delete failed");
                          if (onDeleteFailed && prevMovies) {
                            onDeleteFailed(prevMovies);
                          }
                        }
                      }}
                      className="grid h-8 w-8 place-items-center rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
