import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";
import type express from "express";
import type {
  HostDiagnosticCheck,
  HostDiagnosticCommand,
  HostDiagnosticsResponse,
  HostRuntimeSample,
  HostRuntimeStatsResponse
} from "../shared/types.js";

const execFileAsync = promisify(execFile);

interface CollectDiagnosticsOptions {
  lanUrl: string;
  listenHost: string;
  port: number;
}

interface WindowsProfile {
  Name?: string;
  InterfaceAlias?: string;
  NetworkCategory?: string;
  IPv4Connectivity?: string;
}

interface WindowsFirewallRule {
  DisplayName?: string;
  Profile?: string;
}

interface HostRuntimeStatsMonitorOptions {
  sampleIntervalMs?: number;
  maxSamples?: number;
}

interface CpuSnapshot {
  idle: number;
  total: number;
}

interface NetworkByteSnapshot {
  receivedBytes: number;
  sentBytes: number;
}

function normalizeArray<T>(value: T | T[] | null | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

async function runPowerShellJson<T>(script: string) {
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      {
        windowsHide: true,
        maxBuffer: 1024 * 1024
      }
    );

    const trimmed = stdout.trim();
    return trimmed ? (JSON.parse(trimmed) as T) : null;
  } catch {
    return null;
  }
}

async function collectWindowsProfiles() {
  return runPowerShellJson<WindowsProfile | WindowsProfile[]>(
    [
      "$profiles = Get-NetConnectionProfile | Select-Object Name, InterfaceAlias, NetworkCategory, IPv4Connectivity",
      "if ($null -eq $profiles) { '[]' } else { $profiles | ConvertTo-Json -Compress }"
    ].join("; ")
  );
}

async function collectWindowsFirewallRule(port: number) {
  return runPowerShellJson<WindowsFirewallRule | WindowsFirewallRule[]>(
    [
      `$rule = Get-NetFirewallRule -DisplayName "Routeroom ${port}" -ErrorAction SilentlyContinue |`,
      'Where-Object { $_.Enabled -eq "True" -and $_.Direction -eq "Inbound" -and $_.Action -eq "Allow" } |',
      "Select-Object DisplayName, Profile",
      "if ($null -eq $rule) { '[]' } else { $rule | ConvertTo-Json -Compress }"
    ].join(" ")
  );
}

async function probeLanHealth(lanUrl: string) {
  try {
    const response = await fetch(new URL("/api/health", lanUrl), {
      signal: AbortSignal.timeout(2500)
    });
    return response.ok;
  } catch {
    return false;
  }
}

function readCpuSnapshot(): CpuSnapshot {
  let idle = 0;
  let total = 0;

  for (const cpu of os.cpus()) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
  }

  return { idle, total };
}

function roundPercent(value: number) {
  return Number(value.toFixed(1));
}

function normalizeEncoding(value: unknown): BufferEncoding | undefined {
  return typeof value === "string" ? (value as BufferEncoding) : undefined;
}

function getChunkByteLength(chunk: unknown, encoding?: BufferEncoding) {
  if (chunk === null || chunk === undefined) {
    return 0;
  }

  if (typeof chunk === "string") {
    return Buffer.byteLength(chunk, encoding);
  }

  if (Buffer.isBuffer(chunk)) {
    return chunk.length;
  }

  if (chunk instanceof Uint8Array) {
    return chunk.byteLength;
  }

  return 0;
}

async function readLinuxHostNetworkSnapshot() {
  const interfaces = os.networkInterfaces();
  const interfaceNames = Object.entries(interfaces)
    .filter(([, addresses]) => (addresses ?? []).some((address) => !address.internal))
    .map(([name]) => name)
    .filter((name, index, values) => name !== "lo" && values.indexOf(name) === index);

  if (interfaceNames.length === 0) {
    return null;
  }

  let receivedBytes = 0;
  let sentBytes = 0;

  await Promise.all(
    interfaceNames.map(async (name) => {
      try {
        const [receivedText, sentText] = await Promise.all([
          readFile(`/sys/class/net/${name}/statistics/rx_bytes`, "utf8"),
          readFile(`/sys/class/net/${name}/statistics/tx_bytes`, "utf8")
        ]);

        receivedBytes += Number.parseInt(receivedText.trim(), 10) || 0;
        sentBytes += Number.parseInt(sentText.trim(), 10) || 0;
      } catch {
        // Ignore interfaces that do not expose Linux byte counters.
      }
    })
  );

  return { receivedBytes, sentBytes };
}

async function readDarwinHostNetworkSnapshot() {
  try {
    const { stdout } = await execFileAsync("netstat", ["-ibn"], {
      maxBuffer: 1024 * 1024
    });
    const lines = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const headerLine = lines.find((line) => line.startsWith("Name "));

    if (!headerLine) {
      return null;
    }

    const headerParts = headerLine.split(/\s+/);
    const nameIndex = headerParts.indexOf("Name");
    const receivedIndex = headerParts.indexOf("Ibytes");
    const sentIndex = headerParts.indexOf("Obytes");

    if (nameIndex === -1 || receivedIndex === -1 || sentIndex === -1) {
      return null;
    }

    const totalsByInterface = new Map<string, NetworkByteSnapshot>();

    for (const line of lines) {
      if (line.startsWith("Name ")) {
        continue;
      }

      const parts = line.split(/\s+/);
      const name = parts[nameIndex];
      const receivedValue = Number.parseInt(parts[receivedIndex] ?? "", 10);
      const sentValue = Number.parseInt(parts[sentIndex] ?? "", 10);

      if (!name || name.startsWith("lo") || Number.isNaN(receivedValue) || Number.isNaN(sentValue)) {
        continue;
      }

      const current = totalsByInterface.get(name) ?? { receivedBytes: 0, sentBytes: 0 };
      totalsByInterface.set(name, {
        receivedBytes: Math.max(current.receivedBytes, receivedValue),
        sentBytes: Math.max(current.sentBytes, sentValue)
      });
    }

    let receivedBytes = 0;
    let sentBytes = 0;

    for (const totals of totalsByInterface.values()) {
      receivedBytes += totals.receivedBytes;
      sentBytes += totals.sentBytes;
    }

    return { receivedBytes, sentBytes };
  } catch {
    return null;
  }
}

interface WindowsAdapterStats {
  Name?: string;
  ReceivedBytes?: number;
  SentBytes?: number;
}

async function readWindowsHostNetworkSnapshot() {
  const statistics = normalizeArray(
    await runPowerShellJson<WindowsAdapterStats | WindowsAdapterStats[]>(
      [
        "$stats = Get-NetAdapterStatistics -ErrorAction SilentlyContinue |",
        'Where-Object { $_.Name -notmatch "Loopback|isatap|Teredo" } |',
        "Select-Object Name, ReceivedBytes, SentBytes",
        "if ($null -eq $stats) { '[]' } else { $stats | ConvertTo-Json -Compress }"
      ].join(" ")
    )
  );

  if (statistics.length === 0) {
    return null;
  }

  let receivedBytes = 0;
  let sentBytes = 0;

  for (const entry of statistics) {
    receivedBytes += typeof entry.ReceivedBytes === "number" ? entry.ReceivedBytes : 0;
    sentBytes += typeof entry.SentBytes === "number" ? entry.SentBytes : 0;
  }

  return { receivedBytes, sentBytes };
}

async function readHostNetworkSnapshot() {
  if (process.platform === "linux") {
    return readLinuxHostNetworkSnapshot();
  }

  if (process.platform === "darwin") {
    return readDarwinHostNetworkSnapshot();
  }

  if (process.platform === "win32") {
    return readWindowsHostNetworkSnapshot();
  }

  return null;
}

export class HostRuntimeStatsMonitor {
  private readonly sampleIntervalMs: number;
  private readonly maxSamples: number;
  private readonly timer: NodeJS.Timeout;
  private readonly samples: HostRuntimeSample[] = [];
  private previousCpuSnapshot = readCpuSnapshot();
  private previousProcessCpuUsage = process.cpuUsage();
  private previousProcessHrtime = process.hrtime.bigint();
  private previousHostNetworkSnapshot: NetworkByteSnapshot | null = null;
  private pendingUploadBytes = 0;
  private pendingDownloadBytes = 0;
  private captureInFlight = false;

  constructor(options: HostRuntimeStatsMonitorOptions = {}) {
    this.sampleIntervalMs = options.sampleIntervalMs ?? 1000;
    this.maxSamples = options.maxSamples ?? 60;

    void this.captureSample();
    this.timer = setInterval(() => {
      void this.captureSample();
    }, this.sampleIntervalMs);
    this.timer.unref?.();
  }

  createTrafficMiddleware(): express.RequestHandler {
    return (request, response, next) => {
      if (request.path === "/api/diagnostics/stats") {
        next();
        return;
      }

      let receivedBytes = 0;
      let sentBytes = 0;
      let settled = false;

      request.on("data", (chunk: Buffer | string) => {
        receivedBytes += getChunkByteLength(chunk);
      });

      const originalWrite = response.write.bind(response);
      const originalEnd = response.end.bind(response);

      response.write = ((chunk: unknown, encoding?: unknown, callback?: unknown) => {
        sentBytes += getChunkByteLength(chunk, normalizeEncoding(encoding));
        return originalWrite(chunk as never, encoding as never, callback as never);
      }) as typeof response.write;

      response.end = ((chunk?: unknown, encoding?: unknown, callback?: unknown) => {
        sentBytes += getChunkByteLength(chunk, normalizeEncoding(encoding));
        return originalEnd(chunk as never, encoding as never, callback as never);
      }) as typeof response.end;

      const finalize = () => {
        if (settled) {
          return;
        }

        settled = true;
        this.pendingUploadBytes += receivedBytes;
        this.pendingDownloadBytes += sentBytes;
      };

      response.on("finish", finalize);
      response.on("close", finalize);
      next();
    };
  }

  getSnapshot(): HostRuntimeStatsResponse {
    const history = [...this.samples];
    const current = history[history.length - 1] ?? this.buildFallbackSample();
    const peaks = history.reduce(
      (accumulator, sample) => ({
        hostCpuUsagePercent: Math.max(accumulator.hostCpuUsagePercent, sample.hostCpuUsagePercent),
        processCpuUsagePercent: Math.max(accumulator.processCpuUsagePercent, sample.processCpuUsagePercent),
        hostMemoryUsedBytes: Math.max(accumulator.hostMemoryUsedBytes, sample.hostMemoryUsedBytes),
        processMemoryBytes: Math.max(accumulator.processMemoryBytes, sample.processMemoryBytes),
        hostUploadBytesPerSecond: Math.max(accumulator.hostUploadBytesPerSecond, sample.hostUploadBytesPerSecond),
        hostDownloadBytesPerSecond: Math.max(accumulator.hostDownloadBytesPerSecond, sample.hostDownloadBytesPerSecond),
        hostTotalBytesPerSecond: Math.max(accumulator.hostTotalBytesPerSecond, sample.hostTotalBytesPerSecond),
        processUploadBytesPerSecond: Math.max(accumulator.processUploadBytesPerSecond, sample.processUploadBytesPerSecond),
        processDownloadBytesPerSecond: Math.max(accumulator.processDownloadBytesPerSecond, sample.processDownloadBytesPerSecond),
        processTotalBytesPerSecond: Math.max(accumulator.processTotalBytesPerSecond, sample.processTotalBytesPerSecond)
      }),
      {
        hostCpuUsagePercent: current.hostCpuUsagePercent,
        processCpuUsagePercent: current.processCpuUsagePercent,
        hostMemoryUsedBytes: current.hostMemoryUsedBytes,
        processMemoryBytes: current.processMemoryBytes,
        hostUploadBytesPerSecond: current.hostUploadBytesPerSecond,
        hostDownloadBytesPerSecond: current.hostDownloadBytesPerSecond,
        hostTotalBytesPerSecond: current.hostTotalBytesPerSecond,
        processUploadBytesPerSecond: current.processUploadBytesPerSecond,
        processDownloadBytesPerSecond: current.processDownloadBytesPerSecond,
        processTotalBytesPerSecond: current.processTotalBytesPerSecond
      }
    );

    return {
      sampleIntervalMs: this.sampleIntervalMs,
      historyWindowMs: history.length * this.sampleIntervalMs,
      generatedAt: new Date().toISOString(),
      current,
      history,
      peaks
    };
  }

  dispose() {
    clearInterval(this.timer);
  }

  private async captureSample() {
    if (this.captureInFlight) {
      return;
    }

    this.captureInFlight = true;

    try {
    const nextCpuSnapshot = readCpuSnapshot();
    const idleDelta = nextCpuSnapshot.idle - this.previousCpuSnapshot.idle;
    const totalDelta = nextCpuSnapshot.total - this.previousCpuSnapshot.total;
    const hostCpuUsagePercent = totalDelta > 0 ? (1 - idleDelta / totalDelta) * 100 : 0;
    const nextProcessHrtime = process.hrtime.bigint();
    const elapsedProcessMicros = Number((nextProcessHrtime - this.previousProcessHrtime) / 1000n);
    const processCpuDelta = process.cpuUsage(this.previousProcessCpuUsage);
    const processCpuMicros = processCpuDelta.user + processCpuDelta.system;
    const processCpuUsagePercent =
      elapsedProcessMicros > 0 ? (processCpuMicros / elapsedProcessMicros / os.cpus().length) * 100 : 0;
    const memoryTotalBytes = os.totalmem();
    const hostMemoryUsedBytes = Math.max(memoryTotalBytes - os.freemem(), 0);
    const processMemoryBytes = process.memoryUsage().rss;
    const processUploadBytesPerSecond = Math.round((this.pendingUploadBytes * 1000) / this.sampleIntervalMs);
    const processDownloadBytesPerSecond = Math.round((this.pendingDownloadBytes * 1000) / this.sampleIntervalMs);
    const nextHostNetworkSnapshot = await readHostNetworkSnapshot();
    const hostUploadBytesPerSecond =
      nextHostNetworkSnapshot && this.previousHostNetworkSnapshot
        ? Math.max(
            Math.round(
              ((nextHostNetworkSnapshot.sentBytes - this.previousHostNetworkSnapshot.sentBytes) * 1000) /
                this.sampleIntervalMs
            ),
            0
          )
        : 0;
    const hostDownloadBytesPerSecond =
      nextHostNetworkSnapshot && this.previousHostNetworkSnapshot
        ? Math.max(
            Math.round(
              ((nextHostNetworkSnapshot.receivedBytes - this.previousHostNetworkSnapshot.receivedBytes) * 1000) /
                this.sampleIntervalMs
            ),
            0
          )
        : 0;
    const sample: HostRuntimeSample = {
      recordedAt: new Date().toISOString(),
      hostCpuUsagePercent: roundPercent(Math.max(hostCpuUsagePercent, 0)),
      processCpuUsagePercent: roundPercent(Math.max(processCpuUsagePercent, 0)),
      hostMemoryUsedBytes,
      memoryTotalBytes,
      processMemoryBytes,
      hostUploadBytesPerSecond,
      hostDownloadBytesPerSecond,
      hostTotalBytesPerSecond: hostUploadBytesPerSecond + hostDownloadBytesPerSecond,
      processUploadBytesPerSecond,
      processDownloadBytesPerSecond,
      processTotalBytesPerSecond: processUploadBytesPerSecond + processDownloadBytesPerSecond
    };

    this.previousCpuSnapshot = nextCpuSnapshot;
    this.previousProcessCpuUsage = process.cpuUsage();
    this.previousProcessHrtime = nextProcessHrtime;
    this.previousHostNetworkSnapshot = nextHostNetworkSnapshot;
    this.pendingUploadBytes = 0;
    this.pendingDownloadBytes = 0;
    this.samples.push(sample);

    if (this.samples.length > this.maxSamples) {
      this.samples.splice(0, this.samples.length - this.maxSamples);
    }
    } finally {
      this.captureInFlight = false;
    }
  }

  private buildFallbackSample(): HostRuntimeSample {
    const memoryTotalBytes = os.totalmem();
    const hostMemoryUsedBytes = Math.max(memoryTotalBytes - os.freemem(), 0);

    return {
      recordedAt: new Date().toISOString(),
      hostCpuUsagePercent: 0,
      processCpuUsagePercent: 0,
      hostMemoryUsedBytes,
      memoryTotalBytes,
      processMemoryBytes: process.memoryUsage().rss,
      hostUploadBytesPerSecond: 0,
      hostDownloadBytesPerSecond: 0,
      hostTotalBytesPerSecond: 0,
      processUploadBytesPerSecond: 0,
      processDownloadBytesPerSecond: 0,
      processTotalBytesPerSecond: 0
    };
  }
}

export async function collectHostDiagnostics(
  options: CollectDiagnosticsOptions
): Promise<HostDiagnosticsResponse> {
  const checks: HostDiagnosticCheck[] = [];
  const commands: HostDiagnosticCommand[] = [];

  checks.push({
    id: "listen-host",
    label: "Bind del server",
    status: options.listenHost === "0.0.0.0" ? "pass" : "fail",
    message:
      options.listenHost === "0.0.0.0"
        ? `Il server ascolta su ${options.listenHost}:${options.port}.`
        : `Il server ascolta su ${options.listenHost}:${options.port}; i client LAN non lo raggiungeranno.`
  });

  const reachable = await probeLanHealth(options.lanUrl);
  checks.push({
    id: "lan-health",
    label: "Raggiungibilita host",
    status: reachable ? "pass" : "warn",
    message: reachable
      ? `L'host risponde a ${new URL("/api/health", options.lanUrl).toString()}.`
      : `L'host non risponde al proprio URL LAN ${options.lanUrl}.`
  });

  if (process.platform === "win32") {
    const profiles = normalizeArray(await collectWindowsProfiles());
    const activeProfile =
      profiles.find((profile) => profile.IPv4Connectivity === "Internet") ??
      profiles.find((profile) => profile.InterfaceAlias === "Wi-Fi") ??
      null;

    if (activeProfile?.NetworkCategory === "Private") {
      checks.push({
        id: "windows-profile",
        label: "Profilo rete Windows",
        status: "pass",
        message: `La rete ${activeProfile.Name ?? activeProfile.InterfaceAlias ?? "attiva"} e impostata come Private.`
      });
    } else if (activeProfile?.NetworkCategory === "Public") {
      checks.push({
        id: "windows-profile",
        label: "Profilo rete Windows",
        status: "fail",
        message:
          `La rete ${activeProfile.Name ?? activeProfile.InterfaceAlias ?? "attiva"} e impostata come Public. ` +
          "Una regola firewall limitata a Private non si applica."
      });
      commands.push({
        id: "set-network-private",
        label: "Imposta rete su Private",
        shell: "powershell",
        command: `Set-NetConnectionProfile -InterfaceAlias "${activeProfile.InterfaceAlias ?? "Wi-Fi"}" -NetworkCategory Private`,
        reason: "Consente alla regola firewall Private di funzionare sulla rete Wi-Fi attiva."
      });
    } else {
      checks.push({
        id: "windows-profile",
        label: "Profilo rete Windows",
        status: "warn",
        message: "Non sono riuscito a determinare con certezza il profilo rete attivo."
      });
    }

    const firewallRules = normalizeArray(await collectWindowsFirewallRule(options.port));
    if (firewallRules.length > 0) {
      checks.push({
        id: "windows-firewall",
        label: "Firewall Windows",
        status: "pass",
        message: `Regola firewall trovata perRouty ${options.port}.`
      });
    } else {
      checks.push({
        id: "windows-firewall",
        label: "Firewall Windows",
        status: "warn",
        message: `Nessuna regola firewall esplicita trovata per TCP/${options.port}.`
      });
      commands.push({
        id: "add-firewall-rule",
        label: "Aggiungi regola firewall",
        shell: "powershell",
        command: `New-NetFirewallRule -DisplayName "Routeroom ${options.port}" -Direction Inbound -Action Allow -Protocol TCP -LocalPort ${options.port} -Profile Private`,
        reason: "Permette ai dispositivi della rete locale di raggiungereRouty."
      });
    }
  }

  commands.push({
    id: "test-health-url",
    label: "Test rapido LAN",
    shell: "bash",
    command: new URL("/api/health", options.lanUrl).toString(),
    reason: "Apri questo URL da un altro dispositivo della stessa rete."
  });

  return {
    supported: true,
    platform: process.platform,
    port: options.port,
    lanUrl: options.lanUrl,
    listenHost: options.listenHost,
    checks,
    commands
  };
}
