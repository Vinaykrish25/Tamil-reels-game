import { io } from "socket.io-client";

const isBrowser = typeof window !== "undefined";

// Use environment variable VITE_WS_URL, otherwise default to hostname on port 3001
const getSocketUrl = () => {
  if (!isBrowser) return "";
  const envUrl = import.meta.env.VITE_WS_URL;
  if (envUrl) return envUrl;
  if (window.location.port === "3000") {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return window.location.origin;
};

export const socket = io(getSocketUrl(), {
  autoConnect: isBrowser,
  transports: ["websocket"],
});

if (isBrowser) {
  socket.on("connect", () => {
    console.log("[Socket] Connected to server:", socket.id);
    const savedUserId = localStorage.getItem("tmi:anon:userId");
    if (savedUserId) {
      socket.emit("register-user", savedUserId);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket] Disconnected:", reason);
  });
}
