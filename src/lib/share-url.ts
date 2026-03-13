import type { SessionInfo } from "../../shared/types";

function isLocalBrowserHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function resolvePreferredSessionUrl(session: Pick<SessionInfo, "lanUrl" | "secureLanUrl">) {
  return session.secureLanUrl ?? session.lanUrl;
}

export function createLanShareUrl(preferredLanUrl?: string | null) {
  const browserUrl = new URL(window.location.href);
  const shareUrl = new URL(browserUrl.href);

  if (!preferredLanUrl) {
    return shareUrl;
  }

  const sessionUrl = new URL(preferredLanUrl);

  if (isLocalBrowserHost(browserUrl.hostname)) {
    shareUrl.protocol = sessionUrl.protocol;
    shareUrl.hostname = sessionUrl.hostname;
    return shareUrl;
  }

  if (browserUrl.protocol !== "https:" && sessionUrl.protocol === "https:") {
    shareUrl.protocol = sessionUrl.protocol;
    shareUrl.hostname = sessionUrl.hostname;
    shareUrl.port = sessionUrl.port;
  }

  return shareUrl;
}
