function buildLanAwareUrl(pathname: string, lanUrl?: string | null) {
  const browserUrl = new URL(window.location.href);
  const shareUrl = new URL(browserUrl.href);

  if (lanUrl) {
    const sessionUrl = new URL(lanUrl);

    if (browserUrl.hostname === "localhost" || browserUrl.hostname === "127.0.0.1") {
      shareUrl.protocol = sessionUrl.protocol;
      shareUrl.hostname = sessionUrl.hostname;
      shareUrl.port = sessionUrl.port;
    }
  }

  shareUrl.pathname = pathname;
  shareUrl.search = "";
  shareUrl.hash = "";

  return shareUrl;
}

export function buildLibraryPreviewShareUrl(lanUrl: string, itemId: string) {
  const shareUrl = buildLanAwareUrl("/app", lanUrl);
  shareUrl.searchParams.set("item", itemId);
  return shareUrl.toString();
}

export function buildVideoPlayerShareUrl(lanUrl: string, itemId: string) {
  return buildLanAwareUrl(`/player/${itemId}`, lanUrl).toString();
}

export function buildStreamRoomShareUrl(roomId: string, lanUrl?: string | null) {
  return buildLanAwareUrl(`/stream/room/${roomId}`, lanUrl).toString();
}
