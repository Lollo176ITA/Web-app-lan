import { useEffect, useState, type DependencyList } from "react";
import { openLanEvents, openLibraryEvents } from "./api";

export type LiveState = "live" | "fallback" | "connecting";

interface UseLanLiveStateOptions {
  source?: "lan" | "library";
  handlers?: Record<string, (payload?: unknown) => void>;
  onEvent?: () => void;
  onFallback?: () => void | (() => void);
  onOpen?: () => void;
}

export function useLanLiveState(
  { source = "lan", handlers = {}, onEvent, onFallback, onOpen }: UseLanLiveStateOptions = {},
  deps: DependencyList = []
) {
  const [liveState, setLiveState] = useState<LiveState>("connecting");

  useEffect(() => {
    let fallbackCleanup: (() => void) | undefined;

    const handleFallback = () => {
      const cleanup = onFallback?.();

      if (typeof cleanup === "function") {
        fallbackCleanup = cleanup;
      }

      setLiveState("fallback");
    };

    const sourceConnection =
      source === "library"
        ? openLibraryEvents(
            () => {
              setLiveState("live");
              onEvent?.();
            },
            handleFallback,
            () => {
              setLiveState("live");
              onOpen?.();
            }
          )
        : openLanEvents(
            Object.fromEntries(
              Object.entries(handlers).map(([eventName, handler]) => [
                eventName,
                (payload?: unknown) => {
                  setLiveState("live");
                  handler(payload);
                }
              ])
            ),
            handleFallback,
            () => {
              setLiveState("live");
              onOpen?.();
            }
          );

    return () => {
      sourceConnection.close();
      fallbackCleanup?.();
    };
  }, deps);

  return liveState;
}
