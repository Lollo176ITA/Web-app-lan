import { promises as fs } from "node:fs";
import path from "node:path";
import type { FeatureFlags } from "../shared/types.js";

const SETTINGS_FILENAME = "settings.json";

interface PersistedSettingsState {
  featureFlags?: Partial<FeatureFlags>;
}

export const defaultFeatureFlags: FeatureFlags = {
  homepage: true,
  chat: true,
  streaming: true,
  sync: true
};

function normalizeFeatureFlags(value: Partial<FeatureFlags> | undefined): FeatureFlags {
  return {
    homepage: value?.homepage ?? defaultFeatureFlags.homepage,
    chat: value?.chat ?? defaultFeatureFlags.chat,
    streaming: value?.streaming ?? defaultFeatureFlags.streaming,
    sync: value?.sync ?? defaultFeatureFlags.sync
  };
}

export class SettingsStore {
  readonly manifestPath: string;
  private featureFlags: FeatureFlags = { ...defaultFeatureFlags };

  constructor(private readonly rootDir: string) {
    this.manifestPath = path.join(path.resolve(rootDir), SETTINGS_FILENAME);
  }

  async init() {
    try {
      const raw = await fs.readFile(this.manifestPath, "utf8");
      const parsed = JSON.parse(raw) as PersistedSettingsState;
      this.featureFlags = normalizeFeatureFlags(parsed.featureFlags);
    } catch {
      this.featureFlags = { ...defaultFeatureFlags };
    }

    await this.persist();
  }

  getFeatureFlags() {
    return { ...this.featureFlags };
  }

  async updateFeatureFlags(nextFlags: Partial<FeatureFlags>) {
    this.featureFlags = normalizeFeatureFlags({
      ...this.featureFlags,
      ...nextFlags
    });
    await this.persist();
    return this.getFeatureFlags();
  }

  private async persist() {
    const payload: PersistedSettingsState = {
      featureFlags: this.featureFlags
    };

    await fs.mkdir(this.rootDir, { recursive: true });
    await fs.writeFile(this.manifestPath, JSON.stringify(payload, null, 2), "utf8");
  }
}
