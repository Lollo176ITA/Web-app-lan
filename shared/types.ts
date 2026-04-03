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

export interface FeatureFlags {
  homepage: boolean;
  chat: boolean;
  streaming: boolean;
  sync: boolean;
}

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
  appVersion: string;
  hostName: string;
  lanUrl: string;
  storagePath: string;
  itemCount: number;
  totalBytes: number;
  availableArchiveFormats: ArchiveFormat[];
  featureFlags: FeatureFlags;
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

export interface HostRuntimeSample {
  recordedAt: string;
  hostCpuUsagePercent: number;
  processCpuUsagePercent: number;
  hostMemoryUsedBytes: number;
  memoryTotalBytes: number;
  processMemoryBytes: number;
  hostUploadBytesPerSecond: number;
  hostDownloadBytesPerSecond: number;
  hostTotalBytesPerSecond: number;
  processUploadBytesPerSecond: number;
  processDownloadBytesPerSecond: number;
  processTotalBytesPerSecond: number;
}

export interface HostRuntimeStatsPeaks {
  hostCpuUsagePercent: number;
  processCpuUsagePercent: number;
  hostMemoryUsedBytes: number;
  processMemoryBytes: number;
  hostUploadBytesPerSecond: number;
  hostDownloadBytesPerSecond: number;
  hostTotalBytesPerSecond: number;
  processUploadBytesPerSecond: number;
  processDownloadBytesPerSecond: number;
  processTotalBytesPerSecond: number;
}

export interface HostRuntimeStatsResponse {
  sampleIntervalMs: number;
  historyWindowMs: number;
  generatedAt: string;
  current: HostRuntimeSample;
  history: HostRuntimeSample[];
  peaks: HostRuntimeStatsPeaks;
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

export interface UpdateFeatureFlagsRequest {
  featureFlags: Partial<FeatureFlags>;
}

export interface UpdateFeatureFlagsResponse {
  featureFlags: FeatureFlags;
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

export interface CreatePairingCodeResponse {
  code: string;
  issuedAt: string;
  expiresAt: string;
}

export interface SyncFolderMapping {
  id: string;
  sourceName: string;
  targetFolderId: string;
  trackedFileCount: number;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncDeviceSummary {
  id: string;
  deviceName: string;
  platform: "android";
  createdAt: string;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  mappings: SyncFolderMapping[];
}

export interface SyncJobSummary {
  id: string;
  deviceId: string;
  deviceName: string;
  mappingId: string;
  mappingSourceName: string;
  startedAt: string;
  completedAt: string;
  uploadedCount: number;
  skippedCount: number;
  failedCount: number;
}

export interface SyncActiveUploadSummary {
  deviceId: string;
  deviceName: string;
  mappingId: string;
  mappingSourceName: string;
  startedAt: string;
  uploadedBytes: number;
  totalBytes: number;
  uploadedFiles: number;
  totalFiles: number;
  percentage: number;
}

export interface SyncOverviewResponse {
  activePairingCode: CreatePairingCodeResponse | null;
  devices: SyncDeviceSummary[];
  jobs: SyncJobSummary[];
  activeUploads: SyncActiveUploadSummary[];
}

export interface RegisterSyncDeviceRequest {
  pairingCode: string;
  deviceName: string;
  platform: "android";
}

export interface RegisterSyncDeviceResponse {
  authToken: string;
  device: SyncDeviceSummary;
}

export interface UpdateSyncFoldersRequest {
  mappings: Array<{
    id?: string;
    sourceName: string;
  }>;
}

export interface UpdateSyncFoldersResponse {
  device: SyncDeviceSummary;
}

export interface SyncDeviceConfigResponse {
  device: SyncDeviceSummary;
}

export interface PlanSyncMappingEntry {
  relativePath: string;
  sizeBytes: number;
  modifiedAtMs: number;
}

export interface PlanSyncMappingRequest {
  entries: PlanSyncMappingEntry[];
}

export interface PlanSyncMappingDecision {
  relativePath: string;
  action: "upload" | "skip";
  reason: "new" | "changed" | "unchanged";
}

export interface PlanSyncMappingResponse {
  mapping: SyncFolderMapping;
  decisions: PlanSyncMappingDecision[];
  uploadCount: number;
  skippedCount: number;
}

export interface SyncUploadResponse {
  uploadedCount: number;
  skippedCount: number;
  failedCount: number;
  lastSyncedAt: string;
  mapping: SyncFolderMapping;
}

export interface UpdateSyncUploadProgressRequest {
  uploadedBytes: number;
  totalBytes: number;
  uploadedFiles: number;
  totalFiles: number;
}
