import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { resolvePlaybackPosition } from "../shared/playback.js";
import type {
  ChatMessage,
  ChatThreadSummary,
  LanIdentity,
  PlaybackState,
  PrivateChatMessage,
  RoomChatMessage,
  StreamRoomPlaybackAction
} from "../shared/types.js";

const MANIFEST_FILENAME = "realtime.json";
const MESSAGE_LIMIT = 200;
const MAX_MESSAGE_LENGTH = 800;

interface RoomRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  playback: PlaybackState;
}

interface RealtimeManifest {
  globalMessages: ChatMessage[];
  privateMessages?: Record<string, PrivateChatMessage[]>;
  roomMessages: Record<string, RoomChatMessage[]>;
  rooms: RoomRecord[];
}

function createEmptyPlaybackState(timestamp: string): PlaybackState {
  return {
    videoItemId: null,
    status: "paused",
    positionSeconds: 0,
    updatedAt: timestamp,
    startedAt: null
  };
}

function clampPositionSeconds(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
}

function fallbackIdentityId(nickname: string) {
  return `legacy-${nickname.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "guest"}`;
}

function normalizeIdentity(identity: Partial<LanIdentity> | undefined) {
  const nickname = typeof identity?.nickname === "string" ? identity.nickname.trim().slice(0, 48) : "";
  const idSource = typeof identity?.id === "string" ? identity.id.trim().slice(0, 80) : "";
  const id = idSource || (nickname ? fallbackIdentityId(nickname) : "");

  if (!id || !nickname) {
    return null;
  }

  return { id, nickname };
}

function normalizeText(text: string) {
  return text.trim().replace(/\s+/g, " ").slice(0, MAX_MESSAGE_LENGTH);
}

function trimMessages<T>(messages: T[]) {
  return messages.slice(-MESSAGE_LIMIT);
}

function buildConversationId(leftUserId: string, rightUserId: string) {
  return [leftUserId, rightUserId].sort().join(":");
}

function normalizePlaybackState(value: Partial<PlaybackState> | undefined, timestamp: string): PlaybackState {
  const positionSeconds = clampPositionSeconds(typeof value?.positionSeconds === "number" ? value.positionSeconds : 0);
  const status = value?.status === "playing" ? "playing" : "paused";
  const startedAt = status === "playing" && typeof value?.startedAt === "string" ? value.startedAt : null;

  return {
    videoItemId: typeof value?.videoItemId === "string" && value.videoItemId ? value.videoItemId : null,
    status,
    positionSeconds,
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : timestamp,
    startedAt
  };
}

function normalizeRoomRecord(value: Partial<RoomRecord> | undefined, timestamp: string): RoomRecord | null {
  const name = typeof value?.name === "string" ? value.name.trim().slice(0, 80) : "";
  const id = typeof value?.id === "string" ? value.id : "";

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    createdAt: typeof value?.createdAt === "string" ? value.createdAt : timestamp,
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : timestamp,
    playback: normalizePlaybackState(value?.playback, timestamp)
  };
}

function normalizeChatMessage(value: Partial<ChatMessage> | undefined, timestamp: string): ChatMessage | null {
  const identity = normalizeIdentity(value?.identity);
  const text = typeof value?.text === "string" ? normalizeText(value.text) : "";
  const id = typeof value?.id === "string" ? value.id : "";

  if (!id || !identity || !text) {
    return null;
  }

  return {
    id,
    identity,
    text,
    sentAt: typeof value?.sentAt === "string" ? value.sentAt : timestamp
  };
}

function normalizePrivateChatMessage(
  value: Partial<PrivateChatMessage> | undefined,
  timestamp: string
): PrivateChatMessage | null {
  const base = normalizeChatMessage(value, timestamp);
  const recipient = normalizeIdentity(value?.recipient);

  if (!base || !recipient || recipient.id === base.identity.id) {
    return null;
  }

  return {
    ...base,
    conversationId:
      typeof value?.conversationId === "string" && value.conversationId
        ? value.conversationId
        : buildConversationId(base.identity.id, recipient.id),
    recipient
  };
}

function normalizeRoomChatMessage(
  value: Partial<RoomChatMessage> | undefined,
  timestamp: string
): RoomChatMessage | null {
  const base = normalizeChatMessage(value, timestamp);
  const roomId = typeof value?.roomId === "string" ? value.roomId : "";

  if (!base || !roomId) {
    return null;
  }

  return {
    ...base,
    roomId
  };
}

function registerKnownUser(map: Map<string, LanIdentity>, identity: LanIdentity) {
  const existing = map.get(identity.id);

  if (!existing || existing.nickname !== identity.nickname) {
    map.set(identity.id, identity);
  }
}

export class CollaborationStore {
  readonly manifestPath: string;
  private globalMessages: ChatMessage[] = [];
  private privateMessages = new Map<string, PrivateChatMessage[]>();
  private roomMessages = new Map<string, RoomChatMessage[]>();
  private rooms: RoomRecord[] = [];

  constructor(rootDir: string) {
    this.manifestPath = path.join(path.resolve(rootDir), MANIFEST_FILENAME);
  }

  async init() {
    const timestamp = new Date().toISOString();

    try {
      const manifest = JSON.parse(await fs.readFile(this.manifestPath, "utf8")) as Partial<RealtimeManifest>;
      this.rooms = (manifest.rooms ?? [])
        .map((room) => normalizeRoomRecord(room, timestamp))
        .filter((room): room is RoomRecord => room !== null)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      this.globalMessages = trimMessages(
        (manifest.globalMessages ?? [])
          .map((message) => normalizeChatMessage(message, timestamp))
          .filter((message): message is ChatMessage => message !== null)
      );

      this.privateMessages = new Map(
        Object.entries(manifest.privateMessages ?? {}).map(([conversationId, messages]) => [
          conversationId,
          trimMessages(
            messages
              .map((message) => normalizePrivateChatMessage(message, timestamp))
              .filter(
                (message): message is PrivateChatMessage =>
                  message !== null && message.conversationId === conversationId
              )
          )
        ])
      );

      this.roomMessages = new Map(
        Object.entries(manifest.roomMessages ?? {}).map(([roomId, messages]) => [
          roomId,
          trimMessages(
            messages
              .map((message) => normalizeRoomChatMessage(message, timestamp))
              .filter((message): message is RoomChatMessage => message !== null && message.roomId === roomId)
          )
        ])
      );
    } catch {
      this.rooms = [];
      this.globalMessages = [];
      this.privateMessages = new Map();
      this.roomMessages = new Map();
    }

    await this.persist();
  }

  getGlobalMessages() {
    return [...this.globalMessages];
  }

  getKnownUsers() {
    const knownUsers = new Map<string, LanIdentity>();

    for (const message of this.globalMessages) {
      registerKnownUser(knownUsers, message.identity);
    }

    for (const messages of this.privateMessages.values()) {
      for (const message of messages) {
        registerKnownUser(knownUsers, message.identity);
        registerKnownUser(knownUsers, message.recipient);
      }
    }

    for (const messages of this.roomMessages.values()) {
      for (const message of messages) {
        registerKnownUser(knownUsers, message.identity);
      }
    }

    return [...knownUsers.values()].sort((left, right) => left.nickname.localeCompare(right.nickname, "it"));
  }

  findKnownUser(userId: string) {
    return this.getKnownUsers().find((user) => user.id === userId) ?? null;
  }

  getPrivateMessages(leftUserId: string, rightUserId: string) {
    const conversationId = buildConversationId(leftUserId, rightUserId);
    return [...(this.privateMessages.get(conversationId) ?? [])];
  }

  listPrivateThreads(userId: string): ChatThreadSummary[] {
    const threads = [...this.privateMessages.values()].reduce<ChatThreadSummary[]>(
      (summaries, messages) => {
        const lastMessage = messages.at(-1) ?? null;

        if (!lastMessage) {
          return summaries;
        }

        const isSender = lastMessage.identity.id === userId;
        const isRecipient = lastMessage.recipient.id === userId;

        if (!isSender && !isRecipient) {
          return summaries;
        }

        summaries.push({
          participant: isSender ? lastMessage.recipient : lastMessage.identity,
          messageCount: messages.length,
          lastMessage
        });

        return summaries;
      },
      []
    );

    return threads.sort((left, right) => {
      const leftDate = left.lastMessage?.sentAt ?? "";
      const rightDate = right.lastMessage?.sentAt ?? "";
      return rightDate.localeCompare(leftDate);
    });
  }

  listRooms() {
    return [...this.rooms].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  findRoom(roomId: string) {
    return this.rooms.find((room) => room.id === roomId);
  }

  getRoomMessages(roomId: string) {
    return [...(this.roomMessages.get(roomId) ?? [])];
  }

  async addGlobalMessage(identity: LanIdentity, text: string) {
    const normalizedIdentity = normalizeIdentity(identity);
    const normalizedText = normalizeText(text);

    if (!normalizedIdentity || !normalizedText) {
      throw new Error("Invalid message");
    }

    const message: ChatMessage = {
      id: nanoid(10),
      identity: normalizedIdentity,
      text: normalizedText,
      sentAt: new Date().toISOString()
    };

    this.globalMessages = trimMessages([...this.globalMessages, message]);
    await this.persist();
    return message;
  }

  async addPrivateMessage(identity: LanIdentity, recipient: LanIdentity, text: string) {
    const normalizedIdentity = normalizeIdentity(identity);
    const normalizedRecipient = normalizeIdentity(recipient);
    const normalizedText = normalizeText(text);

    if (!normalizedIdentity || !normalizedRecipient || !normalizedText || normalizedIdentity.id === normalizedRecipient.id) {
      throw new Error("Invalid message");
    }

    const conversationId = buildConversationId(normalizedIdentity.id, normalizedRecipient.id);
    const message: PrivateChatMessage = {
      id: nanoid(10),
      conversationId,
      identity: normalizedIdentity,
      recipient: normalizedRecipient,
      text: normalizedText,
      sentAt: new Date().toISOString()
    };

    this.privateMessages.set(
      conversationId,
      trimMessages([...(this.privateMessages.get(conversationId) ?? []), message])
    );
    await this.persist();
    return message;
  }

  async createRoom(name: string) {
    const trimmedName = name.trim().slice(0, 80);

    if (!trimmedName) {
      throw new Error("Room name required");
    }

    const timestamp = new Date().toISOString();
    const room: RoomRecord = {
      id: nanoid(10),
      name: trimmedName,
      createdAt: timestamp,
      updatedAt: timestamp,
      playback: createEmptyPlaybackState(timestamp)
    };

    this.rooms = [room, ...this.rooms];
    this.roomMessages.set(room.id, []);
    await this.persist();
    return room;
  }

  async deleteRoom(roomId: string) {
    const room = this.findRoom(roomId);

    if (!room) {
      return false;
    }

    this.rooms = this.rooms.filter((entry) => entry.id !== roomId);
    this.roomMessages.delete(roomId);
    await this.persist();
    return true;
  }

  async addRoomMessage(roomId: string, identity: LanIdentity, text: string) {
    const room = this.findRoom(roomId);

    if (!room) {
      return null;
    }

    const normalizedIdentity = normalizeIdentity(identity);
    const normalizedText = normalizeText(text);

    if (!normalizedIdentity || !normalizedText) {
      throw new Error("Invalid message");
    }

    const message: RoomChatMessage = {
      id: nanoid(10),
      roomId,
      identity: normalizedIdentity,
      text: normalizedText,
      sentAt: new Date().toISOString()
    };

    this.roomMessages.set(roomId, trimMessages([...(this.roomMessages.get(roomId) ?? []), message]));
    room.updatedAt = message.sentAt;
    await this.persist();
    return message;
  }

  async setRoomVideo(roomId: string, videoItemId: string) {
    const room = this.findRoom(roomId);

    if (!room) {
      return null;
    }

    const timestamp = new Date().toISOString();
    room.updatedAt = timestamp;
    room.playback = {
      videoItemId,
      status: "paused",
      positionSeconds: 0,
      updatedAt: timestamp,
      startedAt: null
    };

    await this.persist();
    return room;
  }

  async updatePlayback(roomId: string, action: StreamRoomPlaybackAction, positionSeconds: number) {
    const room = this.findRoom(roomId);

    if (!room) {
      return null;
    }

    if (!room.playback.videoItemId) {
      throw new Error("Missing room video");
    }

    const timestamp = new Date().toISOString();
    const nextPosition = clampPositionSeconds(positionSeconds);

    if (action === "play") {
      room.playback = {
        ...room.playback,
        status: "playing",
        positionSeconds: nextPosition,
        updatedAt: timestamp,
        startedAt: timestamp
      };
    }

    if (action === "pause") {
      room.playback = {
        ...room.playback,
        status: "paused",
        positionSeconds: nextPosition,
        updatedAt: timestamp,
        startedAt: null
      };
    }

    if (action === "seek") {
      room.playback = {
        ...room.playback,
        positionSeconds: nextPosition,
        updatedAt: timestamp,
        startedAt: room.playback.status === "playing" ? timestamp : null
      };
    }

    room.updatedAt = timestamp;
    await this.persist();
    return room;
  }

  async clearDeletedVideos(deletedIds: string[]) {
    const deletedIdSet = new Set(deletedIds);
    const changedRoomIds: string[] = [];

    for (const room of this.rooms) {
      if (!room.playback.videoItemId || !deletedIdSet.has(room.playback.videoItemId)) {
        continue;
      }

      const timestamp = new Date().toISOString();
      room.updatedAt = timestamp;
      room.playback = createEmptyPlaybackState(timestamp);
      changedRoomIds.push(room.id);
    }

    if (changedRoomIds.length > 0) {
      await this.persist();
    }

    return changedRoomIds;
  }

  async pruneMissingVideos(hasVideo: (videoItemId: string) => boolean) {
    const changedRoomIds: string[] = [];

    for (const room of this.rooms) {
      if (!room.playback.videoItemId || hasVideo(room.playback.videoItemId)) {
        continue;
      }

      const timestamp = new Date().toISOString();
      room.updatedAt = timestamp;
      room.playback = createEmptyPlaybackState(timestamp);
      changedRoomIds.push(room.id);
    }

    if (changedRoomIds.length > 0) {
      await this.persist();
    }

    return changedRoomIds;
  }

  materializePlayback(room: RoomRecord) {
    return {
      ...room.playback,
      positionSeconds: resolvePlaybackPosition(room.playback)
    };
  }

  private async persist() {
    const privateMessages = Object.fromEntries(this.privateMessages.entries());
    const roomMessages = Object.fromEntries(this.roomMessages.entries());
    const payload: RealtimeManifest = {
      globalMessages: this.globalMessages,
      privateMessages,
      roomMessages,
      rooms: this.listRooms()
    };

    await fs.mkdir(path.dirname(this.manifestPath), { recursive: true });
    await fs.writeFile(this.manifestPath, JSON.stringify(payload, null, 2), "utf8");
  }
}
