import { createHash, randomBytes, randomInt } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import type {
  CreatePairingCodeResponse,
  PlanSyncMappingEntry,
  PlanSyncMappingResponse,
  RegisterSyncDeviceResponse,
  SyncDeviceConfigResponse,
  SyncDeviceSummary,
  SyncFolderMapping,
  SyncJobSummary,
  SyncOverviewResponse,
  SyncUploadResponse,
  UpdateSyncFoldersRequest,
  UpdateSyncFoldersResponse
} from "../shared/types.js";
import type { LibraryStore } from "./storage.js";

interface PersistedSyncFileRecord {
  relativePath: string;
  sizeBytes: number;
  modifiedAtMs: number;
  itemId: string;
}

interface PersistedSyncFolderMappingRecord {
  id: string;
  sourceName: string;
  targetFolderId: string;
  trackedFiles: PersistedSyncFileRecord[];
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string | null;
}

interface PersistedSyncDeviceRecord {
  id: string;
  deviceName: string;
  deviceFolderName: string;
  platform: "android";
  tokenHash: string;
  createdAt: string;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  mappings: PersistedSyncFolderMappingRecord[];
}

interface PersistedSyncState {
  devices: PersistedSyncDeviceRecord[];
  jobs: SyncJobSummary[];
}

interface ActivePairingCodeRecord extends CreatePairingCodeResponse {}

interface SyncUploadEntry {
  relativePath: string;
  sizeBytes: number;
  modifiedAtMs: number;
  mimeType: string;
  sourcePath: string;
}

const SYNC_FILENAME = "sync.json";
const PAIRING_TTL_MS = 10 * 60 * 1000;
const MAX_SYNC_JOBS = 25;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeFolderLabel(value: string, fallback: string) {
  const trimmed = value.replace(/[\\/]+/g, " ").trim();
  return trimmed || fallback;
}

function normalizeRelativePath(value: string) {
  const normalized = value
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (normalized.length === 0 || normalized.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Invalid relative path");
  }

  return normalized.join("/");
}

export class SyncStore {
  readonly manifestPath: string;
  private devices: PersistedSyncDeviceRecord[] = [];
  private jobs: SyncJobSummary[] = [];
  private activePairingCode: ActivePairingCodeRecord | null = null;

  constructor(private readonly rootDir: string) {
    this.manifestPath = path.join(rootDir, SYNC_FILENAME);
  }

  async init() {
    try {
      const raw = await fs.readFile(this.manifestPath, "utf8");
      const parsed = JSON.parse(raw) as PersistedSyncState;
      this.devices = Array.isArray(parsed.devices) ? parsed.devices : [];
      this.jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
    } catch {
      this.devices = [];
      this.jobs = [];
    }

    await this.persist();
  }

  getOverview(): SyncOverviewResponse {
    this.expirePairingCodeIfNeeded();

    return {
      activePairingCode: this.activePairingCode,
      devices: this.devices.map((device) => this.toDeviceSummary(device)),
      jobs: [...this.jobs]
    };
  }

  createPairingCode() {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + PAIRING_TTL_MS);
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

    this.activePairingCode = {
      code,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    return this.activePairingCode;
  }

  async registerDevice(
    pairingCode: string,
    deviceName: string,
    platform: "android",
    store: LibraryStore
  ): Promise<RegisterSyncDeviceResponse> {
    this.expirePairingCodeIfNeeded();

    const activeCode = this.activePairingCode;

    if (!activeCode || activeCode.code !== pairingCode.trim()) {
      throw new Error("Invalid pairing code");
    }

    this.activePairingCode = null;

    const now = new Date().toISOString();
    const syncRoot = await this.ensureSyncRootFolder(store);
    const normalizedDeviceName = normalizeFolderLabel(deviceName, "Android");
    const deviceFolderName = await this.buildUniqueChildFolderName(store, syncRoot.id, normalizedDeviceName);
    const deviceFolder = await store.ensureFolderPath([deviceFolderName], syncRoot.id);

    if (!deviceFolder) {
      throw new Error("Unable to create device folder");
    }

    const authToken = randomBytes(24).toString("hex");
    const device: PersistedSyncDeviceRecord = {
      id: nanoid(10),
      deviceName: normalizedDeviceName,
      deviceFolderName,
      platform,
      tokenHash: hashToken(authToken),
      createdAt: now,
      lastSeenAt: now,
      lastSyncAt: null,
      mappings: []
    };

    this.devices = [device, ...this.devices];
    await this.persist();

    return {
      authToken,
      device: this.toDeviceSummary(device)
    };
  }

  authenticate(token: string) {
    const normalized = token.trim();

    if (!normalized) {
      return null;
    }

    const tokenHash = hashToken(normalized);
    return this.devices.find((device) => device.tokenHash === tokenHash) ?? null;
  }

  async getDeviceConfig(deviceId: string): Promise<SyncDeviceConfigResponse> {
    const device = this.findDevice(deviceId);

    if (!device) {
      throw new Error("Unknown sync device");
    }

    this.markDeviceSeen(device);
    await this.persist();

    return {
      device: this.toDeviceSummary(device)
    };
  }

  async updateDeviceConfig(
    deviceId: string,
    request: UpdateSyncFoldersRequest,
    store: LibraryStore
  ): Promise<UpdateSyncFoldersResponse> {
    const device = this.findDevice(deviceId);

    if (!device) {
      throw new Error("Unknown sync device");
    }

    const deviceFolder = await this.ensureDeviceFolder(device, store);
    const existingMappings = new Map(device.mappings.map((mapping) => [mapping.id, mapping]));
    const nextMappings: PersistedSyncFolderMappingRecord[] = [];

    for (const entry of request.mappings) {
      const sourceName = normalizeFolderLabel(entry.sourceName, "Cartella");
      const existingMapping =
        typeof entry.id === "string" && entry.id.trim() ? existingMappings.get(entry.id.trim()) : undefined;

      if (existingMapping) {
        nextMappings.push(existingMapping);
        continue;
      }

      const targetFolderName = await this.buildUniqueChildFolderName(store, deviceFolder.id, sourceName);
      const targetFolder = await store.ensureFolderPath([targetFolderName], deviceFolder.id);

      if (!targetFolder) {
        throw new Error("Unable to create mapping folder");
      }

      const now = new Date().toISOString();
      nextMappings.push({
        id: nanoid(10),
        sourceName,
        targetFolderId: targetFolder.id,
        trackedFiles: [],
        createdAt: now,
        updatedAt: now,
        lastSyncedAt: null
      });
    }

    device.mappings = nextMappings;
    this.markDeviceSeen(device);
    await this.persist();

    return {
      device: this.toDeviceSummary(device)
    };
  }

  async revokeDevice(deviceId: string) {
    const nextDevices = this.devices.filter((device) => device.id !== deviceId);

    if (nextDevices.length === this.devices.length) {
      return false;
    }

    this.devices = nextDevices;
    this.jobs = this.jobs.filter((job) => job.deviceId !== deviceId);
    await this.persist();
    return true;
  }

  async planMapping(
    deviceId: string,
    mappingId: string,
    entries: PlanSyncMappingEntry[]
  ): Promise<PlanSyncMappingResponse> {
    const { device, mapping } = this.requireMapping(deviceId, mappingId);
    const trackedFiles = new Map(mapping.trackedFiles.map((entry) => [entry.relativePath, entry]));
    const decisions = entries.map((entry) => {
      const relativePath = normalizeRelativePath(entry.relativePath);
      const tracked = trackedFiles.get(relativePath);
      const unchanged =
        tracked &&
        tracked.sizeBytes === entry.sizeBytes &&
        tracked.modifiedAtMs === entry.modifiedAtMs;

      return {
        relativePath,
        action: unchanged ? ("skip" as const) : ("upload" as const),
        reason: unchanged ? ("unchanged" as const) : tracked ? ("changed" as const) : ("new" as const)
      };
    });

    this.markDeviceSeen(device);
    await this.persist();

    return {
      mapping: this.toMappingSummary(mapping),
      decisions,
      uploadCount: decisions.filter((decision) => decision.action === "upload").length,
      skippedCount: decisions.filter((decision) => decision.action === "skip").length
    };
  }

  async applyUpload(
    deviceId: string,
    mappingId: string,
    entries: SyncUploadEntry[],
    store: LibraryStore
  ): Promise<SyncUploadResponse> {
    const { device, mapping } = this.requireMapping(deviceId, mappingId);
    const trackedFiles = new Map(mapping.trackedFiles.map((entry) => [entry.relativePath, entry]));
    let uploadedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const startedAt = new Date().toISOString();

    for (const entry of entries) {
      try {
        const relativePath = normalizeRelativePath(entry.relativePath);
        const tracked = trackedFiles.get(relativePath);
        const unchanged =
          tracked &&
          tracked.sizeBytes === entry.sizeBytes &&
          tracked.modifiedAtMs === entry.modifiedAtMs;

        if (unchanged) {
          skippedCount += 1;
          continue;
        }

        const pathSegments = relativePath.split("/");
        const fileName = pathSegments.at(-1) ?? "file";
        const folderSegments = pathSegments.slice(0, -1);
        const folder =
          folderSegments.length > 0 ? await store.ensureFolderPath(folderSegments, mapping.targetFolderId) : null;
        const parentId = folder?.id ?? mapping.targetFolderId;
        const result = await store.upsertFileFromPath(entry.sourcePath, fileName, entry.mimeType, parentId);

        trackedFiles.set(relativePath, {
          relativePath,
          sizeBytes: entry.sizeBytes,
          modifiedAtMs: entry.modifiedAtMs,
          itemId: result.item.id
        });
        uploadedCount += 1;
      } catch {
        failedCount += 1;
      } finally {
        await fs.rm(entry.sourcePath, { force: true });
      }
    }

    const completedAt = new Date().toISOString();
    mapping.trackedFiles = [...trackedFiles.values()].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    mapping.updatedAt = completedAt;
    mapping.lastSyncedAt = completedAt;
    this.markDeviceSeen(device, completedAt);
    device.lastSyncAt = completedAt;
    this.jobs = [
      {
        id: nanoid(10),
        deviceId: device.id,
        deviceName: device.deviceName,
        mappingId: mapping.id,
        mappingSourceName: mapping.sourceName,
        startedAt,
        completedAt,
        uploadedCount,
        skippedCount,
        failedCount
      },
      ...this.jobs
    ].slice(0, MAX_SYNC_JOBS);

    await this.persist();

    return {
      uploadedCount,
      skippedCount,
      failedCount,
      lastSyncedAt: completedAt,
      mapping: this.toMappingSummary(mapping)
    };
  }

  private findDevice(deviceId: string) {
    return this.devices.find((device) => device.id === deviceId) ?? null;
  }

  private requireMapping(deviceId: string, mappingId: string) {
    const device = this.findDevice(deviceId);

    if (!device) {
      throw new Error("Unknown sync device");
    }

    const mapping = device.mappings.find((candidate) => candidate.id === mappingId);

    if (!mapping) {
      throw new Error("Unknown sync mapping");
    }

    return { device, mapping };
  }

  private toMappingSummary(mapping: PersistedSyncFolderMappingRecord): SyncFolderMapping {
    return {
      id: mapping.id,
      sourceName: mapping.sourceName,
      targetFolderId: mapping.targetFolderId,
      trackedFileCount: mapping.trackedFiles.length,
      lastSyncedAt: mapping.lastSyncedAt,
      createdAt: mapping.createdAt,
      updatedAt: mapping.updatedAt
    };
  }

  private toDeviceSummary(device: PersistedSyncDeviceRecord): SyncDeviceSummary {
    return {
      id: device.id,
      deviceName: device.deviceName,
      platform: device.platform,
      createdAt: device.createdAt,
      lastSeenAt: device.lastSeenAt,
      lastSyncAt: device.lastSyncAt,
      mappings: device.mappings.map((mapping) => this.toMappingSummary(mapping))
    };
  }

  private markDeviceSeen(device: PersistedSyncDeviceRecord, seenAt = new Date().toISOString()) {
    device.lastSeenAt = seenAt;
  }

  private expirePairingCodeIfNeeded() {
    if (!this.activePairingCode) {
      return;
    }

    if (new Date(this.activePairingCode.expiresAt).getTime() <= Date.now()) {
      this.activePairingCode = null;
    }
  }

  private async ensureSyncRootFolder(store: LibraryStore) {
    const existing = store.findChildItemByName(null, "Sync");

    if (existing) {
      if (existing.kind !== "folder") {
        throw new Error("Sync root conflicts with an existing file");
      }

      return existing;
    }

    return store.createFolder("Sync", null);
  }

  private async ensureDeviceFolder(device: PersistedSyncDeviceRecord, store: LibraryStore) {
    const syncRoot = await this.ensureSyncRootFolder(store);
    const existing = store.findChildItemByName(syncRoot.id, device.deviceFolderName);

    if (existing) {
      if (existing.kind !== "folder") {
        throw new Error("Device folder conflicts with an existing file");
      }

      return existing;
    }

    const folder = await store.ensureFolderPath([device.deviceFolderName], syncRoot.id);

    if (!folder) {
      throw new Error("Unable to create device folder");
    }

    return folder;
  }

  private async buildUniqueChildFolderName(store: LibraryStore, parentId: string, baseName: string) {
    let suffix = 1;
    let candidate = baseName;

    while (store.findChildItemByName(parentId, candidate)) {
      suffix += 1;
      candidate = `${baseName} ${suffix}`;
    }

    return candidate;
  }

  private async persist() {
    const payload: PersistedSyncState = {
      devices: this.devices,
      jobs: this.jobs
    };

    await fs.mkdir(this.rootDir, { recursive: true });
    await fs.writeFile(this.manifestPath, JSON.stringify(payload, null, 2), "utf8");
  }
}
