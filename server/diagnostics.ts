import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  HostDiagnosticCheck,
  HostDiagnosticCommand,
  HostDiagnosticsResponse
} from "../shared/types.js";

const execFileAsync = promisify(execFile);

interface CollectDiagnosticsOptions {
  lanUrl: string;
  secureLanUrl: string | null;
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

  if (options.secureLanUrl) {
    checks.push({
      id: "https-share",
      label: "URL sicuro locale",
      status: "info",
      message:
        `Routy espone anche ${options.secureLanUrl}. ` +
        "Alla prima apertura il browser potrebbe chiedere di accettare il certificato locale."
    });
  }

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
        message: `Regola firewall trovata per Routeroom ${options.port}.`
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
        reason: "Permette ai dispositivi della rete locale di raggiungere Routeroom."
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
    secureLanUrl: options.secureLanUrl,
    listenHost: options.listenHost,
    checks,
    commands
  };
}
