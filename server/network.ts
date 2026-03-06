import os from "node:os";

const PRIVATE_RANGES = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./
];

function isPrivateIpv4(address: string) {
  return PRIVATE_RANGES.some((pattern) => pattern.test(address));
}

export function getPrivateLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates: Array<{ name: string; address: string }> = [];

  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const addressInfo of addresses ?? []) {
      if (addressInfo.family !== "IPv4" || addressInfo.internal) {
        continue;
      }

      if (isPrivateIpv4(addressInfo.address)) {
        candidates.push({ name, address: addressInfo.address });
      }
    }
  }

  candidates.sort((left, right) => {
    const score = (name: string) => {
      const lowerName = name.toLowerCase();
      if (lowerName.startsWith("en")) {
        return 0;
      }

      if (lowerName.includes("wi") || lowerName.includes("wl")) {
        return 1;
      }

      return 2;
    };

    return score(left.name) - score(right.name);
  });

  return candidates[0]?.address;
}

export function getSessionUrls(port: number) {
  const lanIp = getPrivateLanIp();
  const localUrl = `http://127.0.0.1:${port}`;

  return {
    localUrl,
    lanUrl: lanIp ? `http://${lanIp}:${port}` : localUrl
  };
}
