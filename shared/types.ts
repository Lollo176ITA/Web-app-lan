export type LibraryKind =
  | "folder"
  | "video"
  | "image"
  | "audio"
  | "document"
  | "archive"
  | "other";

export type LibraryLayoutMode = "minimal" | "compact";
export type ArchiveFormat = "zip" | "7z" | "rar";

export interface LibraryItem {
  id: string;
  name: string;
  storedName: string;
  mimeType: string;
  kind: LibraryKind;
  sizeBytes: number;
  createdAt: string;
  parentId: string | null;
  childrenCount?: number;
  durationSeconds?: number;
  downloadUrl?: string;
  contentUrl?: string;
  streamUrl?: string;
}

export interface CreateFolderRequest {
  name: string;
  parentId?: string | null;
}

export interface CreateFolderResponse {
  item: LibraryItem;
}

export interface CreateArchiveRequest {
  format: ArchiveFormat;
}

export interface CreateArchiveResponse {
  item: LibraryItem;
}

export interface DeleteItemResponse {
  deletedIds: string[];
}

export type ItemPreview =
  | {
      mode: "text";
      text: string;
      truncated: boolean;
      source: "text" | "word";
    }
  | {
      mode: "pdf";
      url: string;
    }
  | {
      mode: "folder";
      childCount: number;
    }
  | {
      mode: "none";
      notice: string;
    };

export interface SessionInfo {
  appName: string;
  hostName: string;
  lanUrl: string;
  storagePath: string;
  itemCount: number;
  totalBytes: number;
  availableArchiveFormats: ArchiveFormat[];
}

export type HostDiagnosticStatus = "pass" | "warn" | "fail" | "info";

export interface HostDiagnosticCheck {
  id: string;
  label: string;
  status: HostDiagnosticStatus;
  message: string;
}

export interface HostDiagnosticCommand {
  id: string;
  label: string;
  shell: "powershell" | "bash";
  command: string;
  reason: string;
}

export interface HostDiagnosticsResponse {
  supported: boolean;
  platform: string;
  port: number;
  lanUrl: string;
  listenHost: string;
  checks: HostDiagnosticCheck[];
  commands: HostDiagnosticCommand[];
}

export interface UploadResponse {
  items: LibraryItem[];
}

export interface LanIdentity {
  id: string;
  nickname: string;
}

export interface ChatMessage {
  id: string;
  identity: LanIdentity;
  text: string;
  sentAt: string;
}

export interface RoomChatMessage extends ChatMessage {
  roomId: string;
}

export type PlaybackStatus = "paused" | "playing";
export type StreamRoomPlaybackAction = "play" | "pause" | "seek";

export interface PlaybackState {
  videoItemId: string | null;
  status: PlaybackStatus;
  positionSeconds: number;
  updatedAt: string;
  startedAt: string | null;
}

export interface StreamRoom {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  playback: PlaybackState;
  currentVideoName: string | null;
}

export interface StreamRoomSummary extends StreamRoom {
  messageCount: number;
}

export interface StreamRoomDetail extends StreamRoomSummary {
  messages: RoomChatMessage[];
  videoItem: LibraryItem | null;
}

export interface ChatSnapshotResponse {
  globalMessages: ChatMessage[];
  threads: ChatThreadSummary[];
  knownUsers: LanIdentity[];
}

export interface PostChatMessageRequest {
  identity: LanIdentity;
  text: string;
}

export interface SendChatMessageResponse {
  message: ChatMessage;
}

export interface ClearGlobalChatResponse {
  clearedMessages: number;
}

export interface PrivateChatMessage extends ChatMessage {
  conversationId: string;
  recipient: LanIdentity;
}

export interface ChatThreadSummary {
  participant: LanIdentity;
  messageCount: number;
  lastMessage: PrivateChatMessage | null;
}

export interface DirectChatSnapshotResponse {
  participant: LanIdentity | null;
  messages: PrivateChatMessage[];
  knownUsers: LanIdentity[];
}

export interface SendPrivateChatMessageResponse {
  message: PrivateChatMessage;
}

export interface ClientProfileResponse {
  clientIp: string | null;
  userAgent: string | null;
  isHost: boolean;
}

export interface StreamRoomsResponse {
  rooms: StreamRoomSummary[];
}

export interface CreateStreamRoomRequest {
  name: string;
}

export interface CreateStreamRoomResponse {
  room: StreamRoomSummary;
}

export interface StreamRoomResponse {
  room: StreamRoomDetail;
}

export interface DeleteStreamRoomResponse {
  deletedRoomId: string;
}

export interface PostRoomMessageRequest {
  identity: LanIdentity;
  text: string;
}

export interface SendRoomMessageResponse {
  message: RoomChatMessage;
}

export interface SetStreamRoomVideoRequest {
  videoItemId: string;
}

export interface SetStreamRoomVideoResponse {
  room: StreamRoomDetail;
}

export interface UpdateStreamRoomPlaybackRequest {
  action: StreamRoomPlaybackAction;
  positionSeconds: number;
}

export interface UpdateStreamRoomPlaybackResponse {
  room: StreamRoomDetail;
}
