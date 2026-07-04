import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateCode() {
  let out = "";
  for (let i = 0; i < 6; i++)
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

function admin() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

// ---------------- Create room ----------------
export const createRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ displayName: z.string().min(1).max(20), avatarSeed: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = admin();
    // unique code
    let code = "";
    for (let i = 0; i < 8; i++) {
      code = generateCode();
      const { data: existing } = await sb.from("rooms").select("id").eq("code", code).maybeSingle();
      if (!existing) break;
    }
    const { data: room, error: rErr } = await sb
      .from("rooms")
      .insert({ code, status: "lobby" })
      .select()
      .single();
    if (rErr || !room) throw new Error(rErr?.message ?? "room create failed");

    const { data: player, error: pErr } = await sb
      .from("players")
      .insert({
        room_id: room.id,
        user_id: context.userId,
        display_name: data.displayName,
        avatar_seed: data.avatarSeed,
        is_host: true,
      })
      .select()
      .single();
    if (pErr || !player) throw new Error(pErr?.message ?? "player create failed");

    await sb.from("rooms").update({ host_player_id: player.id }).eq("id", room.id);
    return { code: room.code, roomId: room.id, playerId: player.id };
  });

// ---------------- Join room ----------------
export const joinRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        code: z.string().min(4).max(10),
        displayName: z.string().min(1).max(20),
        avatarSeed: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = admin();
    const code = data.code.toUpperCase();
    const { data: room } = await sb.from("rooms").select("*").eq("code", code).maybeSingle();
    if (!room) throw new Error("Room not found");

    // Already a player?
    const { data: existing } = await sb
      .from("players")
      .select("*")
      .eq("room_id", room.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) {
      if (existing.kicked) throw new Error("You were removed from this room");
      await sb
        .from("players")
        .update({ display_name: data.displayName, last_seen_at: new Date().toISOString() })
        .eq("id", existing.id);
      return { roomId: room.id, playerId: existing.id };
    }

    // Count active players
    const { count } = await sb
      .from("players")
      .select("*", { count: "exact", head: true })
      .eq("room_id", room.id)
      .eq("kicked", false);
    if ((count ?? 0) >= 8) throw new Error("Room is full (8 players max)");
    if (room.status !== "lobby") throw new Error("Game already in progress");

    const { data: player, error } = await sb
      .from("players")
      .insert({
        room_id: room.id,
        user_id: context.userId,
        display_name: data.displayName,
        avatar_seed: data.avatarSeed,
      })
      .select()
      .single();
    if (error || !player) throw new Error(error?.message ?? "join failed");
    return { roomId: room.id, playerId: player.id };
  });

// ---------------- Heartbeat ----------------
export const heartbeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ playerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = admin();
    const nowStr = new Date().toISOString();

    // 1. Update player heartbeat
    await sb
      .from("players")
      .update({ last_seen_at: nowStr })
      .eq("id", data.playerId)
      .eq("user_id", context.userId);

    // 2. Fetch the player's room and host info
    const { data: player } = await sb
      .from("players")
      .select("room_id")
      .eq("id", data.playerId)
      .maybeSingle();

    if (player?.room_id) {
      const { data: room } = await sb
        .from("rooms")
        .select("id, host_player_id")
        .eq("id", player.room_id)
        .maybeSingle();

      if (room?.host_player_id) {
        const { data: hostPlayer } = await sb
          .from("players")
          .select("id, last_seen_at")
          .eq("id", room.host_player_id)
          .maybeSingle();

        const hostCutoff = new Date(Date.now() - 30000); // 30 seconds
        const hostDisconnected = !hostPlayer || new Date(hostPlayer.last_seen_at) < hostCutoff;

        if (hostDisconnected) {
          // Find the oldest active player (min joined_at) who is online (last_seen_at within 30 seconds) and not kicked
          const { data: activePlayers } = await sb
            .from("players")
            .select("id, joined_at")
            .eq("room_id", room.id)
            .eq("kicked", false)
            .gte("last_seen_at", hostCutoff.toISOString())
            .order("joined_at", { ascending: true });

          const nextHost = activePlayers?.[0];
          if (nextHost && nextHost.id !== room.host_player_id) {
            // Atomic update using old host player id as condition to prevent duplicate promotion
            const { error: roomUpErr } = await sb
              .from("rooms")
              .update({ host_player_id: nextHost.id })
              .eq("id", room.id)
              .eq("host_player_id", room.host_player_id);

            if (!roomUpErr) {
              // Set is_host true for nextHost, and is_host false for everyone else
              await sb.from("players").update({ is_host: true }).eq("id", nextHost.id);

              await sb
                .from("players")
                .update({ is_host: false })
                .eq("room_id", room.id)
                .neq("id", nextHost.id);
            }
          }
        }
      }
    }
    return { ok: true };
  });

// ---------------- Leave ----------------
export const leaveRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ roomId: z.string().uuid(), playerId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = admin();
    const { data: room } = await sb.from("rooms").select("*").eq("id", data.roomId).single();
    if (!room) return { ok: true };

    // Delete this player
    await sb.from("players").delete().eq("id", data.playerId).eq("user_id", context.userId);

    // If this was the host, promote next
    if (room.host_player_id === data.playerId) {
      const { data: next } = await sb
        .from("players")
        .select("id")
        .eq("room_id", data.roomId)
        .eq("kicked", false)
        .order("joined_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (next) {
        await sb.from("players").update({ is_host: true }).eq("id", next.id);
        await sb.from("rooms").update({ host_player_id: next.id }).eq("id", data.roomId);
      } else {
        // no one left — delete the room
        await sb.from("rooms").delete().eq("id", data.roomId);
      }
    }
    return { ok: true };
  });

async function assertHost(sb: ReturnType<typeof admin>, roomId: string, userId: string) {
  const { data: me } = await sb
    .from("players")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!me?.is_host) throw new Error("Only the host can do this");
  return me;
}

// ---------------- Kick ----------------
export const kickPlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ roomId: z.string().uuid(), targetPlayerId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = admin();
    await assertHost(sb, data.roomId, context.userId);
    await sb.from("players").update({ kicked: true }).eq("id", data.targetPlayerId);
    return { ok: true };
  });

// ---------------- Start game ----------------
export const startGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = admin();
    await assertHost(sb, data.roomId, context.userId);

    const { data: players } = await sb
      .from("players")
      .select("*")
      .eq("room_id", data.roomId)
      .eq("kicked", false);
    if (!players || players.length < 3) throw new Error("Need at least 3 players");
    if (players.length > 8) throw new Error("Max 8 players");

    // pick a movie: builtin OR custom for this room
    const { data: movies } = await sb
      .from("movies")
      .select("*")
      .or(`source.eq.builtin,room_id.eq.${data.roomId}`);
    if (!movies || movies.length === 0) throw new Error("No movies available");
    const movie = movies[Math.floor(Math.random() * movies.length)];

    // create game
    const { data: game, error: gErr } = await sb
      .from("games")
      .insert({ room_id: data.roomId })
      .select()
      .single();
    if (gErr || !game) throw new Error(gErr?.message ?? "game create failed");

    // pick imposter
    const imposter = players[Math.floor(Math.random() * players.length)];

    const assignments = players.map((p) => ({
      game_id: game.id,
      player_id: p.id,
      user_id: p.user_id,
      is_imposter: p.id === imposter.id,
      secret_text: p.id === imposter.id ? "You are the IMPOSTER" : movie.title,
      clue_hint: p.id === imposter.id ? movie.clue : null,
    }));
    await sb.from("assignments").insert(assignments);

    await sb
      .from("rooms")
      .update({
        status: "clue",
        current_round: 1,
        current_game_id: game.id,
        revealed: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.roomId);

    // clear old play_again from prior games (safety) — implicit via new game_id
    return { gameId: game.id };
  });

// ---------------- Submit clue ----------------
export const submitClue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        roomId: z.string().uuid(),
        gameId: z.string().uuid(),
        playerId: z.string().uuid(),
        round: z.number().int().min(1).max(3),
        text: z.string().min(1).max(60),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = admin();
    // Verify player owned by user
    const { data: me } = await sb
      .from("players")
      .select("*")
      .eq("id", data.playerId)
      .eq("user_id", context.userId)
      .single();
    if (!me) throw new Error("Not your player");
    // Prevent duplicates
    const { data: existing } = await sb
      .from("clues")
      .select("id")
      .eq("game_id", data.gameId)
      .eq("player_id", data.playerId)
      .eq("round", data.round)
      .maybeSingle();
    if (existing) return { ok: true };
    await sb.from("clues").insert({
      game_id: data.gameId,
      room_id: data.roomId,
      player_id: data.playerId,
      round: data.round,
      text: data.text.trim(),
    });
    return { ok: true };
  });

// ---------------- Advance phase ----------------
export const advancePhase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        roomId: z.string().uuid(),
        to: z.enum(["clue", "discussion", "voting", "results", "lobby"]),
        round: z.number().int().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = admin();
    await assertHost(sb, data.roomId, context.userId);
    const update: {
      status: typeof data.to;
      updated_at: string;
      current_round?: number;
      current_game_id?: string | null;
      revealed?: boolean;
    } = {
      status: data.to,
      updated_at: new Date().toISOString(),
    };
    if (data.round !== undefined) update.current_round = data.round;

    if (data.to === "results") {
      // reveal
      const { data: room } = await sb.from("rooms").select("*").eq("id", data.roomId).single();
      if (room?.current_game_id) {
        const { data: any1 } = await sb
          .from("assignments")
          .select("*")
          .eq("game_id", room.current_game_id)
          .eq("is_imposter", false)
          .limit(1)
          .maybeSingle();
        const { data: imp } = await sb
          .from("assignments")
          .select("*")
          .eq("game_id", room.current_game_id)
          .eq("is_imposter", true)
          .single();
        if (imp) {
          await sb
            .from("games")
            .update({
              revealed_imposter_player_id: imp.player_id,
              revealed_movie_id: null,
              ended_at: new Date().toISOString(),
            })
            .eq("id", room.current_game_id);
        }
        // Also store the movie title into games (via revealed_movie_id)
        if (any1) {
          const { data: movie } = await sb
            .from("movies")
            .select("id")
            .eq("title", any1.secret_text)
            .limit(1)
            .maybeSingle();
          if (movie) {
            await sb
              .from("games")
              .update({ revealed_movie_id: movie.id })
              .eq("id", room.current_game_id);
          }
        }
      }
      update.revealed = true;
    }

    if (data.to === "lobby") {
      update.current_game_id = null;
      update.current_round = 0;
      update.revealed = false;
    }

    await sb.from("rooms").update(update).eq("id", data.roomId);
    return { ok: true };
  });

// ---------------- Vote ----------------
export const castVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        roomId: z.string().uuid(),
        gameId: z.string().uuid(),
        voterPlayerId: z.string().uuid(),
        targetPlayerId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = admin();
    const { data: me } = await sb
      .from("players")
      .select("*")
      .eq("id", data.voterPlayerId)
      .eq("user_id", context.userId)
      .single();
    if (!me) throw new Error("Not your player");
    await sb.from("votes").upsert(
      {
        game_id: data.gameId,
        room_id: data.roomId,
        voter_player_id: data.voterPlayerId,
        target_player_id: data.targetPlayerId,
      },
      { onConflict: "game_id,voter_player_id" },
    );
    return { ok: true };
  });

// ---------------- Play again ----------------
export const togglePlayAgain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ gameId: z.string().uuid(), playerId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = admin();
    const { data: me } = await sb
      .from("players")
      .select("*")
      .eq("id", data.playerId)
      .eq("user_id", context.userId)
      .single();
    if (!me) throw new Error("Not your player");
    const { data: existing } = await sb
      .from("play_again")
      .select("id")
      .eq("game_id", data.gameId)
      .eq("player_id", data.playerId)
      .maybeSingle();
    if (existing) {
      await sb.from("play_again").delete().eq("id", existing.id);
      return { ready: false };
    }
    await sb.from("play_again").insert({ game_id: data.gameId, player_id: data.playerId });

    // If everyone active is ready, auto-return to lobby
    const { data: room } = await sb.from("rooms").select("*").eq("id", me.room_id).single();
    if (room && room.current_game_id === data.gameId) {
      const { data: players } = await sb
        .from("players")
        .select("id")
        .eq("room_id", me.room_id)
        .eq("kicked", false);
      const { data: ready } = await sb
        .from("play_again")
        .select("player_id")
        .eq("game_id", data.gameId);
      if (players && ready && ready.length >= players.length) {
        await sb
          .from("rooms")
          .update({
            status: "lobby",
            current_game_id: null,
            current_round: 0,
            revealed: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", me.room_id);
      }
    }
    return { ready: true };
  });

// ---------------- Send reaction ----------------
export const sendReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        roomId: z.string().uuid(),
        playerId: z.string().uuid(),
        emoji: z.string().min(1).max(8),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = admin();
    const { data: me } = await sb
      .from("players")
      .select("id")
      .eq("id", data.playerId)
      .eq("user_id", context.userId)
      .single();
    if (!me) throw new Error("Not your player");
    await sb
      .from("reactions")
      .insert({ room_id: data.roomId, player_id: data.playerId, emoji: data.emoji });
    return { ok: true };
  });

// ---------------- Send chat ----------------
export const sendChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        roomId: z.string().uuid(),
        playerId: z.string().uuid(),
        text: z.string().min(1).max(300),
        phase: z.enum(["lobby", "game", "voting", "postgame"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = admin();
    const { data: me } = await sb
      .from("players")
      .select("id")
      .eq("id", data.playerId)
      .eq("user_id", context.userId)
      .single();
    if (!me) throw new Error("Not your player");
    await sb.from("chat_messages").insert({
      room_id: data.roomId,
      player_id: data.playerId,
      text: data.text.trim(),
      phase: data.phase,
    });
    return { ok: true };
  });

// ---------------- Custom movie CRUD ----------------
export const addCustomMovie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        roomId: z.string().uuid(),
        title: z.string().min(1).max(80),
        clue: z.string().min(1).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = admin();
    await assertHost(sb, data.roomId, context.userId);
    const { data: movie, error } = await sb
      .from("movies")
      .insert({
        title: data.title.trim(),
        clue: data.clue.trim(),
        source: "custom",
        room_id: data.roomId,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return movie;
  });

export const updateCustomMovie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(80),
        clue: z.string().min(1).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = admin();
    await sb
      .from("movies")
      .update({ title: data.title.trim(), clue: data.clue.trim() })
      .eq("id", data.id)
      .eq("created_by", context.userId);
    return { ok: true };
  });

export const deleteCustomMovie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = admin();
    await sb.from("movies").delete().eq("id", data.id).eq("created_by", context.userId);
    return { ok: true };
  });

// ---------------- AI clue ----------------
export const generateAIClue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ title: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
    if (!geminiKey && !openaiKey) {
      throw new Error("AI API Key is not configured. Please set GEMINI_API_KEY or OPENAI_API_KEY.");
    }
    const prompt = `You are generating an "Imposter game" clue for a Tamil movie called "${data.title}".
Return 2 to 4 short English keywords or a short phrase (max 10 words) that hint at the movie's THEME, iconic setting, character archetype, or plot element — WITHOUT using the movie's title words or a direct English translation of the title. Do not reveal an obvious spoiler. Prefer subtle thematic hints over famous dialogue.
Respond with ONLY the clue text (comma-separated keywords), no quotes, no explanation.`;

    let clue = "";
    if (geminiKey) {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        },
      );
      if (!resp.ok) {
        console.error("Gemini API error:", await resp.text());
        throw new Error("AI generation failed");
      }
      const j = (await resp.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      clue = j.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    } else {
      const baseUrl = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
      const model = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!resp.ok) {
        console.error("OpenAI API error:", await resp.text());
        throw new Error("AI generation failed");
      }
      const j = (await resp.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      clue = j.choices?.[0]?.message?.content?.trim() ?? "";
    }

    // strip title tokens
    const titleTokens = data.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const cleaned = clue
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !titleTokens.some((t) => s.toLowerCase().includes(t)))
      .slice(0, 4)
      .join(", ");
    return { clue: cleaned || clue };
  });
