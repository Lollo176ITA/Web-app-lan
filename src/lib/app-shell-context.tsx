import { createContext, useContext } from "react";
import type { ClientProfileResponse, FeatureFlags, SessionInfo } from "../../shared/types";

const FEATURE_FLAGS_STORAGE_KEY = "routy.feature-flags";

export const fallbackFeatureFlags: FeatureFlags = {
  homepage: true,
  chat: true,
  streaming: true,
  sync: true
};

function isFeatureFlags(value: unknown): value is FeatureFlags {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.homepage === "boolean" &&
    typeof candidate.chat === "boolean" &&
    typeof candidate.streaming === "boolean" &&
    typeof candidate.sync === "boolean"
  );
}

export interface AppShellContextValue {
  clientProfile: ClientProfileResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
  session: SessionInfo | null;
}

export const AppShellContext = createContext<AppShellContextValue>({
  clientProfile: null,
  loading: true,
  refresh: async () => {},
  session: null
});

export function useAppShell() {
  return useContext(AppShellContext);
}

export function readStoredFeatureFlags() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(FEATURE_FLAGS_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    return isFeatureFlags(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function persistFeatureFlags(featureFlags: FeatureFlags) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FEATURE_FLAGS_STORAGE_KEY, JSON.stringify(featureFlags));
}

export function getFeatureFlags(session: SessionInfo | null) {
  return session?.featureFlags ?? fallbackFeatureFlags;
}
