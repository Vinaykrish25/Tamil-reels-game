import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Player = Database["public"]["Tables"]["players"]["Row"];
type Clue = Database["public"]["Tables"]["clues"]["Row"];
type Vote = Database["public"]["Tables"]["votes"]["Row"];
type ChatMessage = Database["public"]["Tables"]["chat_messages"]["Row"];
type Reaction = Database["public"]["Tables"]["reactions"]["Row"];
type Assignment = Database["public"]["Tables"]["assignments"]["Row"];
type Movie = Database["public"]["Tables"]["movies"]["Row"];
type Game = Database["public"]["Tables"]["games"]["Row"];
type PlayAgain = Database["public"]["Tables"]["play_again"]["Row"];

export type RoomState = {
  room: Room | null;
  players: Player[];
  clues: Clue[];
  votes: Vote[];
  chats: ChatMessage[];
  reactions: Reaction[];
  playAgain: PlayAgain[];
  assignment: Assignment | null;
  game: Game | null;
  customMovies: Movie[];
  movie: Movie | null;
  loading: boolean;
};

export function useRoomState(code: string, userId: string | null) {
  const [state, setState] = useState<RoomState>({
    room: null,
    players: [],
    clues: [],
    votes: [],
    chats: [],
    reactions: [],
    playAgain: [],
    assignment: null,
    game: null,
    customMovies: [],
    movie: null,
    loading: true,
  });

  const load = useCallback(async () => {
    const { data: room } = await supabase.from("rooms").select("*").eq("code", code).maybeSingle();
    if (!room) {
      setState((s) => ({ ...s, loading: false, room: null }));
      return;
    }
    const [{ data: players }, { data: chats }, { data: reactions }, { data: customMovies }] =
      await Promise.all([
        supabase.from("players").select("*").eq("room_id", room.id).order("joined_at"),
        supabase
          .from("chat_messages")
          .select("*")
          .eq("room_id", room.id)
          .order("created_at", { ascending: true })
          .limit(200),
        supabase
          .from("reactions")
          .select("*")
          .eq("room_id", room.id)
          .gte("created_at", new Date(Date.now() - 15000).toISOString()),
        supabase.from("movies").select("*").eq("room_id", room.id),
      ]);

    let clues: Clue[] = [];
    let votes: Vote[] = [];
    let assignment: Assignment | null = null;
    let game: Game | null = null;
    let movie: Movie | null = null;
    let playAgain: PlayAgain[] = [];
    if (room.current_game_id) {
      const [g, c, v, a, pa] = await Promise.all([
        supabase.from("games").select("*").eq("id", room.current_game_id).maybeSingle(),
        supabase.from("clues").select("*").eq("game_id", room.current_game_id).order("created_at"),
        supabase.from("votes").select("*").eq("game_id", room.current_game_id),
        userId
          ? supabase
              .from("assignments")
              .select("*")
              .eq("game_id", room.current_game_id)
              .eq("user_id", userId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("play_again").select("*").eq("game_id", room.current_game_id),
      ]);
      game = g.data ?? null;
      clues = c.data ?? [];
      votes = v.data ?? [];
      assignment = (a as { data: Assignment | null }).data ?? null;
      playAgain = pa.data ?? [];
      if (game?.revealed_movie_id) {
        const { data: m } = await supabase
          .from("movies")
          .select("*")
          .eq("id", game.revealed_movie_id)
          .maybeSingle();
        movie = m ?? null;
      }
    }
    setState({
      room,
      players: players ?? [],
      clues,
      votes,
      chats: chats ?? [],
      reactions: reactions ?? [],
      playAgain,
      assignment,
      game,
      customMovies: customMovies ?? [],
      movie,
      loading: false,
    });
  }, [code, userId]);

  const loadGame = useCallback(
    async (gameId: string) => {
      const [g, c, v, a, pa] = await Promise.all([
        supabase.from("games").select("*").eq("id", gameId).maybeSingle(),
        supabase.from("clues").select("*").eq("game_id", gameId).order("created_at"),
        supabase.from("votes").select("*").eq("game_id", gameId),
        userId
          ? supabase
              .from("assignments")
              .select("*")
              .eq("game_id", gameId)
              .eq("user_id", userId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("play_again").select("*").eq("game_id", gameId),
      ]);
      let movie: Movie | null = null;
      if (g.data?.revealed_movie_id) {
        const { data: m } = await supabase
          .from("movies")
          .select("*")
          .eq("id", g.data.revealed_movie_id)
          .maybeSingle();
        movie = m ?? null;
      }
      setState((s) => {
        if (s.room?.current_game_id !== gameId) return s;
        return {
          ...s,
          game: g.data ?? null,
          clues: c.data ?? [],
          votes: v.data ?? [],
          assignment: (a as { data: Assignment | null }).data ?? null,
          playAgain: pa.data ?? [],
          movie,
        };
      });
    },
    [userId],
  );

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime subscription (delta synchronization)
  useEffect(() => {
    if (!state.room) return;
    const roomId = state.room.id;
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const newRoom = payload.new as Room;
          setState((s) => {
            if (!newRoom || !newRoom.id) return s;
            const prevGameId = s.room?.current_game_id;
            const nextGameId = newRoom.current_game_id;
            if (nextGameId && nextGameId !== prevGameId) {
              void loadGame(nextGameId);
            } else if (!nextGameId && prevGameId) {
              return {
                ...s,
                room: newRoom,
                game: null,
                clues: [],
                votes: [],
                assignment: null,
                playAgain: [],
                movie: null,
              };
            }
            return { ...s, room: newRoom };
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
        (payload) => {
          setState((s) => {
            if (payload.eventType === "INSERT") {
              const p = payload.new as Player;
              if (s.players.some((x) => x.id === p.id)) return s;
              return {
                ...s,
                players: [...s.players, p].sort(
                  (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
                ),
              };
            }
            if (payload.eventType === "UPDATE") {
              const p = payload.new as Player;
              return { ...s, players: s.players.map((x) => (x.id === p.id ? p : x)) };
            }
            if (payload.eventType === "DELETE") {
              const p = payload.old as { id: string };
              return { ...s, players: s.players.filter((x) => x.id !== p.id) };
            }
            return s;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clues", filter: `room_id=eq.${roomId}` },
        (payload) => {
          setState((s) => {
            if (payload.eventType === "INSERT") {
              const c = payload.new as Clue;
              if (s.clues.some((x) => x.id === c.id)) return s;
              return { ...s, clues: [...s.clues, c] };
            }
            if (payload.eventType === "UPDATE") {
              const c = payload.new as Clue;
              return { ...s, clues: s.clues.map((x) => (x.id === c.id ? c : x)) };
            }
            if (payload.eventType === "DELETE") {
              const c = payload.old as { id: string };
              return { ...s, clues: s.clues.filter((x) => x.id !== c.id) };
            }
            return s;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes", filter: `room_id=eq.${roomId}` },
        (payload) => {
          setState((s) => {
            if (payload.eventType === "INSERT") {
              const v = payload.new as Vote;
              if (s.votes.some((x) => x.id === v.id)) return s;
              return { ...s, votes: [...s.votes, v] };
            }
            if (payload.eventType === "UPDATE") {
              const v = payload.new as Vote;
              return { ...s, votes: s.votes.map((x) => (x.id === v.id ? v : x)) };
            }
            if (payload.eventType === "DELETE") {
              const v = payload.old as { id: string };
              return { ...s, votes: s.votes.filter((x) => x.id !== v.id) };
            }
            return s;
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const c = payload.new as ChatMessage;
          setState((s) => {
            if (s.chats.some((x) => x.id === c.id)) return s;
            return {
              ...s,
              chats: [...s.chats, c].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
              ),
            };
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reactions", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const r = payload.new as Reaction;
          setState((s) => {
            if (s.reactions.some((x) => x.id === r.id)) return s;
            return { ...s, reactions: [...s.reactions, r] };
          });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "play_again" }, (payload) => {
        setState((s) => {
          if (!s.room?.current_game_id) return s;
          if (payload.eventType === "INSERT") {
            const pa = payload.new as PlayAgain;
            if (pa.game_id !== s.room.current_game_id) return s;
            if (s.playAgain.some((x) => x.id === pa.id)) return s;
            return { ...s, playAgain: [...s.playAgain, pa] };
          }
          if (payload.eventType === "DELETE") {
            const pa = payload.old as { id: string };
            return { ...s, playAgain: s.playAgain.filter((x) => x.id !== pa.id) };
          }
          return s;
        });
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "assignments" },
        (payload) => {
          const a = payload.new as Assignment;
          setState((s) => {
            if (a.game_id !== s.room?.current_game_id) return s;
            if (a.user_id !== userId) return s;
            return { ...s, assignment: a };
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `room_id=eq.${roomId}` },
        (payload) => {
          setState((s) => {
            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              const g = payload.new as Game;
              if (g.id !== s.room?.current_game_id) return s;
              if (g.revealed_movie_id && g.revealed_movie_id !== s.game?.revealed_movie_id) {
                supabase
                  .from("movies")
                  .select("*")
                  .eq("id", g.revealed_movie_id)
                  .maybeSingle()
                  .then(({ data: m }) => {
                    if (m) setState((prev) => ({ ...prev, movie: m }));
                  });
              }
              return { ...s, game: g };
            }
            return s;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "movies", filter: `room_id=eq.${roomId}` },
        (payload) => {
          setState((s) => {
            if (payload.eventType === "INSERT") {
              const m = payload.new as Movie;
              if (s.customMovies.some((x) => x.id === m.id)) return s;
              return { ...s, customMovies: [...s.customMovies, m] };
            }
            if (payload.eventType === "UPDATE") {
              const m = payload.new as Movie;
              return { ...s, customMovies: s.customMovies.map((x) => (x.id === m.id ? m : x)) };
            }
            if (payload.eventType === "DELETE") {
              const m = payload.old as { id: string };
              return { ...s, customMovies: s.customMovies.filter((x) => x.id !== m.id) };
            }
            return s;
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [state.room?.id, userId, loadGame]);

  // periodic prune of stale reactions
  useEffect(() => {
    const t = setInterval(() => {
      setState((s) => {
        const cutoff = Date.now() - 5000;
        const filtered = s.reactions.filter((r) => new Date(r.created_at).getTime() > cutoff);
        if (filtered.length === s.reactions.length) return s;
        return { ...s, reactions: filtered };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Optimistic UI Updaters
  const addOptimisticChat = useCallback(
    (text: string, phase: "lobby" | "game" | "voting" | "postgame", playerId: string) => {
      const tempId = "temp-" + Math.random().toString();
      const newChat: ChatMessage = {
        id: tempId,
        room_id: state.room?.id ?? "",
        player_id: playerId,
        phase,
        text,
        created_at: new Date().toISOString(),
      };
      setState((s) => ({ ...s, chats: [...s.chats, newChat] }));
      return tempId;
    },
    [state.room?.id],
  );

  const removeOptimisticChat = useCallback((tempId: string) => {
    setState((s) => ({ ...s, chats: s.chats.filter((c) => c.id !== tempId) }));
  }, []);

  const addOptimisticReaction = useCallback(
    (emoji: string, playerId: string) => {
      const tempId = "temp-" + Math.random().toString();
      const newReaction: Reaction = {
        id: tempId,
        room_id: state.room?.id ?? "",
        player_id: playerId,
        emoji,
        created_at: new Date().toISOString(),
      };
      setState((s) => ({ ...s, reactions: [...s.reactions, newReaction] }));
      return tempId;
    },
    [state.room?.id],
  );

  const removeOptimisticReaction = useCallback((tempId: string) => {
    setState((s) => ({ ...s, reactions: s.reactions.filter((r) => r.id !== tempId) }));
  }, []);

  const castOptimisticVote = useCallback(
    (voterPlayerId: string, targetPlayerId: string, gameId: string) => {
      const prevVotes = [...state.votes];
      setState((s) => {
        const filtered = s.votes.filter((v) => v.voter_player_id !== voterPlayerId);
        const newVote: Vote = {
          id: "temp-" + Math.random().toString(),
          game_id: gameId,
          room_id: s.room?.id ?? "",
          voter_player_id: voterPlayerId,
          target_player_id: targetPlayerId,
          created_at: new Date().toISOString(),
        };
        return { ...s, votes: [...filtered, newVote] };
      });
      return prevVotes;
    },
    [state.votes, state.room?.id],
  );

  const rollbackVotes = useCallback((prevVotes: Vote[]) => {
    setState((s) => ({ ...s, votes: prevVotes }));
  }, []);

  const toggleOptimisticPlayAgain = useCallback(
    (playerId: string, gameId: string) => {
      const prevPA = [...state.playAgain];
      setState((s) => {
        const exists = s.playAgain.some((pa) => pa.player_id === playerId);
        if (exists) {
          return { ...s, playAgain: s.playAgain.filter((pa) => pa.player_id !== playerId) };
        } else {
          const newPA: PlayAgain = {
            id: "temp-" + Math.random().toString(),
            game_id: gameId,
            player_id: playerId,
            created_at: new Date().toISOString(),
          };
          return { ...s, playAgain: [...s.playAgain, newPA] };
        }
      });
      return prevPA;
    },
    [state.playAgain],
  );

  const rollbackPlayAgain = useCallback((prevPA: PlayAgain[]) => {
    setState((s) => ({ ...s, playAgain: prevPA }));
  }, []);

  const addOptimisticMovie = useCallback(
    (title: string, clue: string) => {
      const prevMovies = [...state.customMovies];
      const tempId = "temp-" + Math.random().toString();
      const newMovie: Movie = {
        id: tempId,
        title,
        clue,
        source: "custom",
        room_id: state.room?.id ?? null,
        created_by: userId,
        created_at: new Date().toISOString(),
      };
      setState((s) => ({ ...s, customMovies: [...s.customMovies, newMovie] }));
      return { tempId, prevMovies };
    },
    [state.customMovies, state.room?.id, userId],
  );

  const rollbackMovies = useCallback((prevMovies: Movie[]) => {
    setState((s) => ({ ...s, customMovies: prevMovies }));
  }, []);

  const updateOptimisticMovie = useCallback(
    (id: string, title: string, clue: string) => {
      const prevMovies = [...state.customMovies];
      setState((s) => ({
        ...s,
        customMovies: s.customMovies.map((m) => (m.id === id ? { ...m, title, clue } : m)),
      }));
      return prevMovies;
    },
    [state.customMovies],
  );

  const deleteOptimisticMovie = useCallback(
    (id: string) => {
      const prevMovies = [...state.customMovies];
      setState((s) => ({
        ...s,
        customMovies: s.customMovies.filter((m) => m.id !== id),
      }));
      return prevMovies;
    },
    [state.customMovies],
  );

  const kickOptimisticPlayer = useCallback(
    (targetPlayerId: string) => {
      const prevPlayers = [...state.players];
      setState((s) => ({
        ...s,
        players: s.players.map((p) => (p.id === targetPlayerId ? { ...p, kicked: true } : p)),
      }));
      return prevPlayers;
    },
    [state.players],
  );

  const rollbackPlayers = useCallback((prevPlayers: Player[]) => {
    setState((s) => ({ ...s, players: prevPlayers }));
  }, []);

  const changeRoomStatusOptimistic = useCallback(
    (toStatus: Room["status"], round?: number) => {
      const prevRoom = state.room ? { ...state.room } : null;
      setState((s) => {
        if (!s.room) return s;
        const updated = { ...s.room, status: toStatus };
        if (round !== undefined) updated.current_round = round;
        return { ...s, room: updated };
      });
      return prevRoom;
    },
    [state.room],
  );

  const rollbackRoom = useCallback((prevRoom: Room | null) => {
    setState((s) => ({ ...s, room: prevRoom }));
  }, []);

  return useMemo(
    () => ({
      ...state,
      reload: load,
      addOptimisticChat,
      removeOptimisticChat,
      addOptimisticReaction,
      removeOptimisticReaction,
      castOptimisticVote,
      rollbackVotes,
      toggleOptimisticPlayAgain,
      rollbackPlayAgain,
      addOptimisticMovie,
      updateOptimisticMovie,
      deleteOptimisticMovie,
      rollbackMovies,
      kickOptimisticPlayer,
      rollbackPlayers,
      changeRoomStatusOptimistic,
      rollbackRoom,
    }),
    [
      state,
      load,
      addOptimisticChat,
      removeOptimisticChat,
      addOptimisticReaction,
      removeOptimisticReaction,
      castOptimisticVote,
      rollbackVotes,
      toggleOptimisticPlayAgain,
      rollbackPlayAgain,
      addOptimisticMovie,
      updateOptimisticMovie,
      deleteOptimisticMovie,
      rollbackMovies,
      kickOptimisticPlayer,
      rollbackPlayers,
      changeRoomStatusOptimistic,
      rollbackRoom,
    ],
  );
}
