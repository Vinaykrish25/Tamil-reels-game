import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/generate-ai-clue", async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "Missing or invalid title parameter" });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
    if (!geminiKey && !openaiKey) {
      return res.status(500).json({ error: "AI API Key is not configured on the server." });
    }

    const prompt = `You are generating an "Imposter game" clue for a Tamil movie called "${title}".
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
        return res.status(500).json({ error: "AI generation failed" });
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
        return res.status(500).json({ error: "AI generation failed" });
      }
      const j = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
      clue = j.choices?.[0]?.message?.content?.trim() ?? "";
    }

    const titleTokens = title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const cleaned = clue
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !titleTokens.some((t) => s.toLowerCase().includes(t)))
      .slice(0, 4)
      .join(", ");

    return res.json({ clue: cleaned || clue });
  } catch (error) {
    console.error("API error in generate-ai-clue:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Adjust in production
    methods: ["GET", "POST"],
  },
});

// Built-in Tamil Movies list
const DEFAULT_MOVIES = [
  { id: "m1", title: "Vikram", clue: "black ops, mask, drug bust, agent", source: "built-in" },
  {
    id: "m2",
    title: "Jailer",
    clue: "retired warden, hidden weapons, tiger, son rescue",
    source: "built-in",
  },
  {
    id: "m3",
    title: "Ghilli",
    clue: "kabbadi player, Madurai temple, lighthouse, run away bride",
    source: "built-in",
  },
  {
    id: "m4",
    title: "Sivaji",
    clue: "computer engineer, black money, coin flip, free education",
    source: "built-in",
  },
  {
    id: "m5",
    title: "Enthiran",
    clue: "humanoid robot, blue light, memory card, chitti",
    source: "built-in",
  },
  {
    id: "m6",
    title: "Kaithi",
    clue: "cargo truck, police station defense, biryani, father daughter",
    source: "built-in",
  },
  {
    id: "m7",
    title: "Mankatha",
    clue: "500 crores, heist, gambling, corrupt cop",
    source: "built-in",
  },
  {
    id: "m8",
    title: "Leo",
    clue: "cafe owner, hyena attack, chocolate factory, identity cover",
    source: "built-in",
  },
  {
    id: "m9",
    title: "Baahubali",
    clue: "golden statue, waterfall, royal sword, mahishmati",
    source: "built-in",
  },
  {
    id: "m10",
    title: "Ponniyin Selvan",
    clue: "chola dynasty, sea voyage, golden era, crown prince",
    source: "built-in",
  },
  {
    id: "m11",
    title: "Anniyan",
    clue: "multiple personalities, garuda puranam, split mind, digital camera",
    source: "built-in",
  },
  {
    id: "m12",
    title: "Vada Chennai",
    clue: "carrom board, jail fight, sea breeze, local politics",
    source: "built-in",
  },
  {
    id: "m13",
    title: "Master",
    clue: "alcoholic professor, observation home, kabaddi match, archery",
    source: "built-in",
  },
  {
    id: "m14",
    title: "Asuran",
    clue: "sickle, land rights, caste oppression, father sacrifice",
    source: "built-in",
  },
  {
    id: "m15",
    title: "96",
    clue: "high school reunion, yellow shirt, travel photographer, unresolved love",
    source: "built-in",
  },
  {
    id: "m16",
    title: "Ok Kanmani",
    clue: "live-in relationship, game developer, rain romance, Mumbai life",
    source: "built-in",
  },
  {
    id: "m17",
    title: "Thuppakki",
    clue: "sleeper cells, activation, army captain, Mumbai suburbs",
    source: "built-in",
  },
  {
    id: "m18",
    title: "Kaththi",
    clue: "coin water fight, lookalike, farmer suicide, corporate greed",
    source: "built-in",
  },
  {
    id: "m19",
    title: "Petta",
    clue: "hostel warden, retro style, family feud, hill station",
    source: "built-in",
  },
  {
    id: "m20",
    title: "Mersal",
    clue: "triple roles, magic tricks, medical fraud, temple fire",
    source: "built-in",
  },
  {
    id: "m21",
    title: "Soorarai Pottru",
    clue: "cheap airlines, air force pilot, dream flight, village support",
    source: "built-in",
  },
  {
    id: "m22",
    title: "Vikram Vedha",
    clue: "encounter cop, gangster narrator, truth logic, bullet bike",
    source: "built-in",
  },
  {
    id: "m23",
    title: "Mudhalvan",
    clue: "one day CM, interview challenge, tv reporter, corruption",
    source: "built-in",
  },
  {
    id: "m24",
    title: "Ayan",
    clue: "customs smuggling, diamond theft, friendship betrayal, barcode",
    source: "built-in",
  },
  {
    id: "m25",
    title: "24",
    clue: "time travel watch, twin brothers, watchmaker, freeze time",
    source: "built-in",
  },
  {
    id: "m26",
    title: "Padayappa",
    clue: "swing scene, dynamic music, snake hole, massive pride",
    source: "built-in",
  },
  {
    id: "m27",
    title: "Basha",
    clue: "auto driver, bombay flashback, medical seat, local don",
    source: "built-in",
  },
  {
    id: "m28",
    title: "Nayakan",
    clue: "slum savior, dharavi, police enmity, absolute classic",
    source: "built-in",
  },
  {
    id: "m29",
    title: "Panchatanthiram",
    clue: "five friends, diamonds in teddy, hotel confusion, fake wife",
    source: "built-in",
  },
  {
    id: "m30",
    title: "Boss Engira Bhaskaran",
    clue: "tutorial class, hair salon, exam cheat, comedy duo",
    source: "built-in",
  },
  {
    id: "m31",
    title: "Minnale",
    clue: "fake identity, rain song, telephone booth, engineer romance",
    source: "built-in",
  },
  {
    id: "m32",
    title: "Vinnaithaandi Varuvaayaa",
    clue: "cinema director, assistant, Kerala house, church wedding",
    source: "built-in",
  },
  {
    id: "m33",
    title: "Irudhi Suttru",
    clue: "boxing coach, fish vendor girl, national championship, angry man",
    source: "built-in",
  },
  {
    id: "m34",
    title: "Madras",
    clue: "wall dispute, local politics, blue paint, housing board",
    source: "built-in",
  },
  {
    id: "m35",
    title: "Jigarthanda",
    clue: "gangster film, filmmaking attempt, assault setup, comedy don",
    source: "built-in",
  },
  {
    id: "m36",
    title: "Pizza",
    clue: "food delivery, haunted mansion, diamonds hidden, fake ghosts",
    source: "built-in",
  },
  {
    id: "m37",
    title: "Soodhu Kavvum",
    clue: "rules of kidnapping, money exchange, imaginary friend, escape route",
    source: "built-in",
  },
];

// In-memory Database state
interface Player {
  id: string;
  user_id: string;
  display_name: string;
  avatar_seed: string;
  is_host: boolean;
  joined_at: string;
  last_seen_at: string;
  kicked: boolean;
}

interface Clue {
  id: string;
  room_id: string;
  game_id: string;
  player_id: string;
  round: number;
  text: string;
  created_at: string;
}

interface Vote {
  id: string;
  room_id: string;
  game_id: string;
  voter_player_id: string;
  target_player_id: string;
  created_at: string;
}

interface ChatMessage {
  id: string;
  room_id: string;
  player_id: string;
  phase: "lobby" | "game" | "voting" | "postgame";
  text: string;
  created_at: string;
}

interface Reaction {
  id: string;
  room_id: string;
  player_id: string;
  emoji: string;
  created_at: string;
}

interface Assignment {
  id: string;
  game_id: string;
  user_id: string;
  is_imposter: boolean;
  secret_text: string;
  clue_hint: string;
}

interface Game {
  id: string;
  room_id: string;
  status: string;
  revealed_imposter_player_id: string | null;
  revealed_movie_id: string | null;
  created_at: string;
}

interface Movie {
  id: string;
  room_id: string | null;
  title: string;
  clue: string;
  source: string;
  created_by?: string | null;
}

interface PlayAgain {
  id: string;
  game_id: string;
  player_id: string;
  created_at: string;
}

interface Room {
  id: string;
  code: string;
  status: "lobby" | "clue" | "discussion" | "voting" | "results";
  current_round: number;
  host_player_id: string | null;
  current_game_id: string | null;
  created_at: string;
}

const db = {
  rooms: {} as Record<string, Room>,
  players: {} as Record<string, Player[]>, // roomId -> Player[]
  clues: {} as Record<string, Clue[]>, // roomId -> Clue[]
  votes: {} as Record<string, Vote[]>, // roomId -> Vote[]
  chats: {} as Record<string, ChatMessage[]>, // roomId -> ChatMessage[]
  reactions: {} as Record<string, Reaction[]>, // roomId -> Reaction[]
  playAgain: {} as Record<string, PlayAgain[]>, // roomId -> PlayAgain[]
  games: {} as Record<string, Game[]>, // roomId -> Game[]
  customMovies: {} as Record<string, Movie[]>, // roomId -> Movie[]
  assignments: {} as Record<string, Assignment[]>, // gameId -> Assignment[]
};

// Helpers
function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

function getRoomByCode(code: string): Room | undefined {
  return Object.values(db.rooms).find((r) => r.code.toUpperCase() === code.toUpperCase());
}

function cleanRoomData(roomId: string) {
  delete db.rooms[roomId];
  delete db.players[roomId];
  delete db.clues[roomId];
  delete db.votes[roomId];
  delete db.chats[roomId];
  delete db.reactions[roomId];
  delete db.playAgain[roomId];
  delete db.games[roomId];
  delete db.customMovies[roomId];
}

// Function to construct clean room state payload for a specific client
function getClientRoomState(roomId: string, userId: string | null) {
  const room = db.rooms[roomId];
  if (!room) return null;

  const players = db.players[roomId] ?? [];
  const clues = db.clues[roomId] ?? [];
  const votes = db.votes[roomId] ?? [];
  const chats = db.chats[roomId] ?? [];
  const reactions = db.reactions[roomId] ?? [];
  const playAgain = db.playAgain[roomId] ?? [];
  const game = room.current_game_id
    ? ((db.games[roomId] ?? []).find((g) => g.id === room.current_game_id) ?? null)
    : null;
  const customMovies = db.customMovies[roomId] ?? [];

  // Assignment for this specific user
  let userAssignment: Assignment | null = null;
  if (room.current_game_id && userId) {
    const list = db.assignments[room.current_game_id] ?? [];
    userAssignment = list.find((a) => a.user_id === userId) ?? null;
  }

  // Get current game's movie
  let movie: Movie | null = null;
  if (game && game.revealed_movie_id) {
    if (game.revealed_movie_id.startsWith("m")) {
      movie = DEFAULT_MOVIES.find((m) => m.id === game.revealed_movie_id) ?? null;
    } else {
      movie = customMovies.find((m) => m.id === game.revealed_movie_id) ?? null;
    }
  }

  // Omit details from the game object if not in results phase (prevention of cheating)
  let cleanGame: Partial<Game> | null = null;
  if (game) {
    cleanGame = { ...game };
    if (room.status !== "results") {
      cleanGame.revealed_imposter_player_id = null;
      cleanGame.revealed_movie_id = null;
    }
  }

  return {
    room,
    players,
    clues,
    votes,
    chats,
    reactions,
    playAgain,
    assignment: userAssignment,
    game: cleanGame,
    customMovies,
    movie: room.status === "results" ? movie : null,
    loading: false,
  };
}

function broadcastRoomState(roomId: string) {
  const players = db.players[roomId] ?? [];
  players.forEach((p) => {
    // find all socket connections of this player
    const state = getClientRoomState(roomId, p.user_id);
    io.to(`user:${p.user_id}`).emit("room-state", state);
  });
}

// Socket Connection handling
io.on("connection", (socket) => {
  let activeUserId: string | null = null;
  let activeRoomId: string | null = null;

  socket.on("register-user", (userId: string) => {
    activeUserId = userId;
    socket.join(`user:${userId}`);
  });

  socket.on("join-room", ({ code, displayName, avatarSeed, userId }, callback) => {
    activeUserId = userId;
    socket.join(`user:${userId}`);

    let room = getRoomByCode(code);
    if (!room) {
      const newRoomId = generateId();
      room = {
        id: newRoomId,
        code: code.toUpperCase(),
        status: "lobby",
        current_round: 1,
        host_player_id: null,
        current_game_id: null,
        created_at: new Date().toISOString(),
      };
      db.rooms[newRoomId] = room;
    }

    const roomId = room.id;
    activeRoomId = roomId;
    socket.join(roomId);

    if (!db.players[roomId]) db.players[roomId] = [];
    if (!db.clues[roomId]) db.clues[roomId] = [];
    if (!db.votes[roomId]) db.votes[roomId] = [];
    if (!db.chats[roomId]) db.chats[roomId] = [];
    if (!db.reactions[roomId]) db.reactions[roomId] = [];
    if (!db.playAgain[roomId]) db.playAgain[roomId] = [];
    if (!db.games[roomId]) db.games[roomId] = [];
    if (!db.customMovies[roomId]) db.customMovies[roomId] = [];

    const existingPlayer = db.players[roomId].find((p) => p.user_id === userId);
    let playerId = "";
    if (existingPlayer) {
      existingPlayer.display_name = displayName;
      existingPlayer.avatar_seed = avatarSeed;
      existingPlayer.last_seen_at = new Date().toISOString();
      existingPlayer.kicked = false;
      playerId = existingPlayer.id;
    } else {
      playerId = generateId();
      const newPlayer: Player = {
        id: playerId,
        user_id: userId,
        display_name: displayName,
        avatar_seed: avatarSeed,
        is_host: db.players[roomId].length === 0,
        joined_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        kicked: false,
      };
      db.players[roomId].push(newPlayer);
      if (newPlayer.is_host) {
        room.host_player_id = playerId;
      }
    }

    callback({ roomId, playerId });
    broadcastRoomState(roomId);
  });

  socket.on("leave-room", ({ roomId, playerId }) => {
    if (db.players[roomId]) {
      db.players[roomId] = db.players[roomId].filter((p) => p.id !== playerId);

      // Re-assign host if host left
      const room = db.rooms[roomId];
      if (room && room.host_player_id === playerId) {
        const nextPlayer = db.players[roomId].find((p) => !p.kicked);
        if (nextPlayer) {
          nextPlayer.is_host = true;
          room.host_player_id = nextPlayer.id;
        } else {
          room.host_player_id = null;
        }
      }

      // Cleanup room if empty
      if (db.players[roomId].filter((p) => !p.kicked).length === 0) {
        cleanRoomData(roomId);
      } else {
        broadcastRoomState(roomId);
      }
    }
  });

  socket.on("kick-player", ({ roomId, targetPlayerId }) => {
    if (db.players[roomId]) {
      const player = db.players[roomId].find((p) => p.id === targetPlayerId);
      if (player) {
        player.kicked = true;
        // Broadcast kick event
        io.to(`user:${player.user_id}`).emit("kicked");
      }
      broadcastRoomState(roomId);
    }
  });

  socket.on("start-game", ({ roomId }) => {
    const room = db.rooms[roomId];
    if (!room) return;

    const activePlayers = (db.players[roomId] ?? []).filter((p) => !p.kicked);
    if (activePlayers.length < 3) {
      return socket.emit("error", "Needs at least 3 players to start!");
    }

    // Select movie
    const custom = db.customMovies[roomId] ?? [];
    const allAvailable = [...DEFAULT_MOVIES, ...custom];
    const selectedMovie = allAvailable[Math.floor(Math.random() * allAvailable.length)];

    // Select imposter
    const imposterPlayer = activePlayers[Math.floor(Math.random() * activePlayers.length)];

    // Create game
    const gameId = generateId();
    const game: Game = {
      id: gameId,
      room_id: roomId,
      status: "clue",
      revealed_imposter_player_id: imposterPlayer.id,
      revealed_movie_id: selectedMovie.id,
      created_at: new Date().toISOString(),
    };

    if (!db.games[roomId]) db.games[roomId] = [];
    db.games[roomId].push(game);

    // Assign roles
    db.assignments[gameId] = activePlayers.map((p) => {
      const isImposter = p.id === imposterPlayer.id;
      return {
        id: generateId(),
        game_id: gameId,
        user_id: p.user_id,
        is_imposter,
        secret_text: isImposter ? "You are the Imposter!" : selectedMovie.title,
        clue_hint: isImposter ? "" : selectedMovie.clue,
      };
    });

    room.status = "clue";
    room.current_round = 1;
    room.current_game_id = gameId;

    // Reset clues, votes, and play again for the new game
    db.clues[roomId] = [];
    db.votes[roomId] = [];
    db.playAgain[roomId] = [];

    broadcastRoomState(roomId);
  });

  socket.on("submit-clue", ({ roomId, gameId, playerId, round, text }) => {
    if (!db.clues[roomId]) db.clues[roomId] = [];

    // Check if clue already submitted
    const exists = db.clues[roomId].some(
      (c) => c.game_id === gameId && c.player_id === playerId && c.round === round,
    );
    if (exists) return;

    const newClue: Clue = {
      id: generateId(),
      room_id: roomId,
      game_id: gameId,
      player_id: playerId,
      round,
      text,
      created_at: new Date().toISOString(),
    };
    db.clues[roomId].push(newClue);

    broadcastRoomState(roomId);
  });

  socket.on("advance-phase", ({ roomId, to, round }) => {
    const room = db.rooms[roomId];
    if (!room) return;

    room.status = to;
    if (round !== undefined) {
      room.current_round = round;
    }

    broadcastRoomState(roomId);
  });

  socket.on("cast-vote", ({ roomId, gameId, voterPlayerId, targetPlayerId }) => {
    if (!db.votes[roomId]) db.votes[roomId] = [];

    db.votes[roomId] = db.votes[roomId].filter((v) => v.voter_player_id !== voterPlayerId);

    const newVote: Vote = {
      id: generateId(),
      room_id: roomId,
      game_id: gameId,
      voter_player_id: voterPlayerId,
      target_player_id: targetPlayerId,
      created_at: new Date().toISOString(),
    };
    db.votes[roomId].push(newVote);

    broadcastRoomState(roomId);
  });

  socket.on("toggle-play-again", ({ roomId, gameId, playerId }) => {
    if (!db.playAgain[roomId]) db.playAgain[roomId] = [];

    const exists = db.playAgain[roomId].some((pa) => pa.player_id === playerId);
    if (exists) {
      db.playAgain[roomId] = db.playAgain[roomId].filter((pa) => pa.player_id !== playerId);
    } else {
      db.playAgain[roomId].push({
        id: generateId(),
        game_id: gameId,
        player_id: playerId,
        created_at: new Date().toISOString(),
      });
    }

    // If everyone is ready, reset to lobby
    const activeCount = (db.players[roomId] ?? []).filter((p) => !p.kicked).length;
    if (db.playAgain[roomId].length >= activeCount && activeCount > 0) {
      const room = db.rooms[roomId];
      if (room) {
        room.status = "lobby";
        room.current_game_id = null;
        room.current_round = 1;
        db.clues[roomId] = [];
        db.votes[roomId] = [];
        db.playAgain[roomId] = [];
      }
    }

    broadcastRoomState(roomId);
  });

  socket.on("send-chat", ({ roomId, playerId, phase, text }) => {
    if (!db.chats[roomId]) db.chats[roomId] = [];

    const msg: ChatMessage = {
      id: generateId(),
      room_id: roomId,
      player_id: playerId,
      phase,
      text,
      created_at: new Date().toISOString(),
    };
    db.chats[roomId].push(msg);

    // limit message storage
    if (db.chats[roomId].length > 150) {
      db.chats[roomId].shift();
    }

    broadcastRoomState(roomId);
  });

  socket.on("send-reaction", ({ roomId, playerId, emoji }) => {
    if (!db.reactions[roomId]) db.reactions[roomId] = [];

    const reaction: Reaction = {
      id: generateId(),
      room_id: roomId,
      player_id: playerId,
      emoji,
      created_at: new Date().toISOString(),
    };
    db.reactions[roomId].push(reaction);

    // Broadcast reaction immediately to the room group
    io.to(roomId).emit("reaction", reaction);

    // prune local reactions list older than 10 seconds
    const cutoff = Date.now() - 10000;
    db.reactions[roomId] = db.reactions[roomId].filter(
      (r) => new Date(r.created_at).getTime() > cutoff,
    );
  });

  // Custom movie handlers
  socket.on("add-custom-movie", ({ roomId, title, clue, userId }, callback) => {
    if (!db.customMovies[roomId]) db.customMovies[roomId] = [];
    const newMovie: Movie = {
      id: generateId(),
      room_id: roomId,
      title,
      clue,
      source: "custom",
      created_by: userId,
    };
    db.customMovies[roomId].push(newMovie);
    if (callback) callback({ success: true });
    broadcastRoomState(roomId);
  });

  socket.on("update-custom-movie", ({ roomId, id, title, clue }) => {
    const rid =
      roomId ||
      Object.keys(db.customMovies).find((key) => db.customMovies[key].some((m) => m.id === id));
    if (rid && db.customMovies[rid]) {
      const movie = db.customMovies[rid].find((m) => m.id === id);
      if (movie) {
        movie.title = title;
        movie.clue = clue;
      }
      broadcastRoomState(rid);
    }
  });

  socket.on("delete-custom-movie", ({ roomId, id }) => {
    const rid =
      roomId ||
      Object.keys(db.customMovies).find((key) => db.customMovies[key].some((m) => m.id === id));
    if (rid && db.customMovies[rid]) {
      db.customMovies[rid] = db.customMovies[rid].filter((m) => m.id !== id);
      broadcastRoomState(rid);
    }
  });

  socket.on("heartbeat", (playerId) => {
    if (activeRoomId && db.players[activeRoomId]) {
      const player = db.players[activeRoomId].find((p) => p.id === playerId);
      if (player) {
        player.last_seen_at = new Date().toISOString();
      }
    }
  });

  socket.on("disconnect", () => {
    // We keep players as "offline" in room state and let heartbeat/stale status handle it
  });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, "../.output/public");
app.use(express.static(publicPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }
  res.sendFile(path.join(publicPath, "index.html"), (err) => {
    if (err) {
      res.status(404).send("Not Found");
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[Socket Server] Running on port ${PORT}`);
});
