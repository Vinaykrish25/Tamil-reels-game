import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { heartbeat } from "./game.functions";

export function useHeartbeat(playerId: string | null) {
  const pingFn = useServerFn(heartbeat);
  const ref = useRef(playerId);
  ref.current = playerId;

  useEffect(() => {
    if (!playerId) return;
    async function ping() {
      const id = ref.current;
      if (!id) return;
      try {
        await pingFn({ data: { playerId: id } });
      } catch (err) {
        console.error("Heartbeat error", err);
      }
    }
    void ping();
    const t = setInterval(() => void ping(), 5000);
    const onVis = () => document.visibilityState === "visible" && void ping();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [playerId, pingFn]);
}
