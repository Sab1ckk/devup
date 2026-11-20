import { useEffect, useRef, useState } from "react";
import { intervals, CHAT_CHANGED } from "./constants";

export default function usePolling(
  task,
  enabled,
  interval,
  hidden = interval,
  key = null,
) {
  const latest = useRef(task);
  const [error, setError] = useState(null);
  useEffect(() => {
    latest.current = task;
  }, [task]);
  useEffect(() => {
    if (!enabled) return;
    let active = true,
      running = false,
      stopped = false,
      timer,
      failures = 0;
    async function tick() {
      if (!active || running || stopped) return;
      clearTimeout(timer);
      running = true;
      try {
        await latest.current();
        if (active) setError(null);
        failures = 0;
      } catch (error) {
        if (active) setError(error);
        stopped = error.status === 401;
        failures++;
      } finally {
        running = false;
        if (active && !stopped) {
          const delay = document.hidden ? hidden : interval;
          timer = setTimeout(
            tick,
            Math.min(delay * 2 ** Math.min(failures, 4), intervals.maxRetry),
          );
        }
      }
    }
    document.addEventListener("visibilitychange", tick);
    window.addEventListener(CHAT_CHANGED, tick);
    tick();
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener(CHAT_CHANGED, tick);
    };
  }, [enabled, interval, hidden, key]);
  return error;
}
