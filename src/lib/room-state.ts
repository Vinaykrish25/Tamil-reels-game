import { useEffect, useState, useCallback, useMemo } from "react";
import { socket } from "./socket";
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
    // No-op, managed reactively via Socket.io events
  }, []);

  useEffect(() => {
    if (!code || !userId) return;

    setState((s) => ({ ...s, loading: true }));

    // Register active user
    socket.emit("register-user", userId);

    const onRoomState = (newState: RoomState | null) => {
      setState((s) => {
        if (!newState) return { ...s, loading: false, room: null };
        return {
          ...newState,
          reactions: newState.reactions || [],
        };
      });
    };

    const onReaction = (r: Reaction) => {
      setState((s) => {
        if (s.reactions.some((x) => x.id === r.id)) return s;
        return { ...s, reactions: [...s.reactions, r] };
      });
    };

    socket.on("room-state", onRoomState);
    socket.on("reaction", onReaction);

    // Auto rejoin if name exists
    const savedName = localStorage.getItem("tmi:name");
    const savedAvatar = localStorage.getItem("tmi:avatar") || "🎬";
    if (savedName) {
      socket.emit(
        "join-room",
        {
          code,
          displayName: savedName,
          avatarSeed: savedAvatar,
          userId,
        },
        (res: { roomId?: string; playerId?: string } | null) => {
          if (res && res.roomId && res.playerId) {
            localStorage.setItem(`tmi:player:${res.roomId}`, res.playerId);
          }
        },
      );
    } else {
      setState((s) => ({ ...s, loading: false }));
    }

    return () => {
      socket.off("room-state", onRoomState);
      socket.off("reaction", onReaction);
    };
  }, [code, userId]);

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

  // Socket emissions linked to optimistic updates
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

      socket.emit("send-chat", {
        roomId: state.room?.id,
        playerId,
        phase,
        text,
      });

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

      socket.emit("send-reaction", {
        roomId: state.room?.id,
        playerId,
        emoji,
      });

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

      socket.emit("cast-vote", {
        roomId: state.room?.id,
        gameId,
        voterPlayerId,
        targetPlayerId,
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

      socket.emit("toggle-play-again", {
        roomId: state.room?.id,
        gameId,
        playerId,
      });

      return prevPA;
    },
    [state.playAgain, state.room?.id],
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

      socket.emit("add-custom-movie", {
        roomId: state.room?.id,
        title,
        clue,
        userId,
      });

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

      socket.emit("update-custom-movie", {
        roomId: state.room?.id,
        id,
        title,
        clue,
      });

      return prevMovies;
    },
    [state.customMovies, state.room?.id],
  );

  const deleteOptimisticMovie = useCallback(
    (id: string) => {
      const prevMovies = [...state.customMovies];
      setState((s) => ({
        ...s,
        customMovies: s.customMovies.filter((m) => m.id !== id),
      }));

      socket.emit("delete-custom-movie", {
        roomId: state.room?.id,
        id,
      });

      return prevMovies;
    },
    [state.customMovies, state.room?.id],
  );

  const kickOptimisticPlayer = useCallback(
    (targetPlayerId: string) => {
      const prevPlayers = [...state.players];
      setState((s) => ({
        ...s,
        players: s.players.map((p) => (p.id === targetPlayerId ? { ...p, kicked: true } : p)),
      }));

      socket.emit("kick-player", {
        roomId: state.room?.id,
        targetPlayerId,
      });

      return prevPlayers;
    },
    [state.players, state.room?.id],
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

      socket.emit("advance-phase", {
        roomId: state.room?.id,
        to: toStatus,
        round,
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
