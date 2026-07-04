import { socket } from "./socket";

function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let c = "";
  for (let i = 0; i < 4; i++) {
    c += chars[Math.floor(Math.random() * chars.length)];
  }
  return c;
}

// ---------------- Create room ----------------
export const createRoom = async ({
  data,
}: {
  data: { displayName: string; avatarSeed: string; userId?: string };
}) => {
  const code = generateCode();
  const res = await joinRoom({
    data: {
      code,
      displayName: data.displayName,
      avatarSeed: data.avatarSeed,
      userId: data.userId,
    },
  });
  return { code, roomId: res.roomId, playerId: res.playerId };
};

// ---------------- Join room ----------------
export const joinRoom = async ({
  data,
}: {
  data: { code: string; displayName: string; avatarSeed: string; userId?: string };
}) => {
  return new Promise<{ roomId: string; playerId: string }>((resolve, reject) => {
    const finalUserId = data.userId || localStorage.getItem("tmi:anon:userId");

    if (!finalUserId) {
      return reject(new Error("No user session found"));
    }

    socket.emit(
      "join-room",
      {
        code: data.code,
        displayName: data.displayName,
        avatarSeed: data.avatarSeed,
        userId: finalUserId,
      },
      (res: { error?: string; roomId?: string; playerId?: string } | null) => {
        if (res && res.error) {
          reject(new Error(res.error));
        } else if (res && res.roomId && res.playerId) {
          resolve({ roomId: res.roomId, playerId: res.playerId });
        } else {
          reject(new Error("Failed to join room"));
        }
      },
    );
  });
};

// ---------------- Leave room ----------------
export const leaveRoom = async ({ data }: { data: { roomId: string; playerId: string } }) => {
  socket.emit("leave-room", data);
  return { ok: true };
};

// ---------------- Kick player ----------------
export const kickPlayer = async ({
  data,
}: {
  data: { roomId: string; targetPlayerId: string };
}) => {
  socket.emit("kick-player", data);
  return { ok: true };
};

// ---------------- Start game ----------------
export const startGame = async ({ data }: { data: { roomId: string } }) => {
  socket.emit("start-game", data);
  return { ok: true };
};

// ---------------- Submit clue ----------------
export const submitClue = async ({
  data,
}: {
  data: { roomId: string; gameId: string; playerId: string; round: number; text: string };
}) => {
  socket.emit("submit-clue", data);
  return { ok: true };
};

// ---------------- Advance phase ----------------
export const advancePhase = async ({
  data,
}: {
  data: { roomId: string; to: string; round?: number };
}) => {
  socket.emit("advance-phase", data);
  return { ok: true };
};

// ---------------- Cast vote ----------------
export const castVote = async ({
  data,
}: {
  data: { roomId: string; gameId: string; voterPlayerId: string; targetPlayerId: string };
}) => {
  socket.emit("cast-vote", data);
  return { ok: true };
};

// ---------------- Toggle play again ----------------
export const togglePlayAgain = async ({
  data,
}: {
  data: { roomId: string; gameId: string; playerId: string };
}) => {
  socket.emit("toggle-play-again", data);
  return { ok: true };
};

// ---------------- Chat / Message ----------------
export const sendChat = async ({
  data,
}: {
  data: { roomId: string; playerId: string; phase: string; text: string };
}) => {
  socket.emit("send-chat", data);
  return { ok: true };
};

// ---------------- Reactions ----------------
export const sendReaction = async ({
  data,
}: {
  data: { roomId: string; playerId: string; emoji: string };
}) => {
  socket.emit("send-reaction", data);
  return { ok: true };
};

// ---------------- Heartbeat ----------------
export const heartbeat = async ({ data }: { data: { playerId: string } }) => {
  socket.emit("heartbeat", data.playerId);
  return { ok: true };
};

// ---------------- Custom Movies ----------------
export const addCustomMovie = async ({
  data,
}: {
  data: { roomId: string; title: string; clue: string };
}) => {
  return new Promise<{ ok: boolean }>((resolve) => {
    const userId = localStorage.getItem("tmi:anon:userId");
    socket.emit("add-custom-movie", { ...data, userId }, () => {
      resolve({ ok: true });
    });
  });
};

export const updateCustomMovie = async ({
  data,
}: {
  data: { id: string; title: string; clue: string };
}) => {
  socket.emit("update-custom-movie", data);
  return { ok: true };
};

export const deleteCustomMovie = async ({ data }: { data: { id: string } }) => {
  socket.emit("delete-custom-movie", data);
  return { ok: true };
};

// ---------------- AI clue generation ----------------
export const generateAIClue = async ({ data }: { data: { title: string } }) => {
  const getApiUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) return `${envUrl}/api/generate-ai-clue`;
    if (window.location.port === "3000") {
      return `${window.location.protocol}//${window.location.hostname}:3001/api/generate-ai-clue`;
    }
    return "/api/generate-ai-clue";
  };

  const resp = await fetch(getApiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!resp.ok) {
    throw new Error("AI Clue generation failed");
  }

  return resp.json() as Promise<{ clue: string }>;
};
