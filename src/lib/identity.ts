import type { LanIdentity } from "../../shared/types";

const NICKNAME_STORAGE_KEY = "routeroom.nickname";
const IDENTITY_ID_STORAGE_KEY = "routeroom.identity-id";

export function normalizeNickname(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 48);
}

export function readStoredIdentity(): LanIdentity | null {
  if (typeof window === "undefined") {
    return null;
  }

  const id = readOrCreateIdentityId();
  const nickname = normalizeNickname(window.localStorage.getItem(NICKNAME_STORAGE_KEY) ?? "");

  if (!nickname) {
    return null;
  }

  return { id, nickname };
}

export function persistIdentity(identity: LanIdentity) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(IDENTITY_ID_STORAGE_KEY, identity.id);
  window.localStorage.setItem(NICKNAME_STORAGE_KEY, normalizeNickname(identity.nickname));
}

export function readOrCreateIdentityId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existingId = window.localStorage.getItem(IDENTITY_ID_STORAGE_KEY)?.trim();

  if (existingId) {
    return existingId;
  }

  const nextId =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `user-${Math.random().toString(36).slice(2, 12)}`;

  window.localStorage.setItem(IDENTITY_ID_STORAGE_KEY, nextId);
  return nextId;
}

export function createIdentityFromNickname(nickname: string): LanIdentity {
  return {
    id: readOrCreateIdentityId(),
    nickname: normalizeNickname(nickname)
  };
}
