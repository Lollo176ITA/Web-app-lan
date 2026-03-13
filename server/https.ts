import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";
import selfsigned from "selfsigned";

const CERT_FILENAME = "routy-local.key";
const PEM_FILENAME = "routy-local.crt";
const META_FILENAME = "routy-local.json";

interface StoredCertificateMetadata {
  hosts?: string[];
}

interface TlsCertificateMaterial {
  key: string;
  cert: string;
  keyPath: string;
  certPath: string;
}

function normalizeHosts(hosts: string[]) {
  return [...new Set(hosts.map((host) => host.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function buildAltNames(hosts: string[]) {
  return hosts.map((host) => {
    const ipVersion = net.isIP(host);

    if (ipVersion === 4 || ipVersion === 6) {
      return {
        type: 7 as const,
        ip: host
      };
    }

    return {
      type: 2 as const,
      value: host
    };
  });
}

async function loadProvidedHttpsCertificate(
  keyFilePath: string,
  certFilePath: string
): Promise<TlsCertificateMaterial> {
  const resolvedKeyPath = path.resolve(keyFilePath);
  const resolvedCertPath = path.resolve(certFilePath);
  const [key, cert] = await Promise.all([
    fs.readFile(resolvedKeyPath, "utf8"),
    fs.readFile(resolvedCertPath, "utf8")
  ]);

  return {
    key,
    cert,
    keyPath: resolvedKeyPath,
    certPath: resolvedCertPath
  };
}

export async function ensureLocalHttpsCertificate(certDir: string, hosts: string[]) {
  const customKeyPath = process.env.HTTPS_KEY_FILE?.trim();
  const customCertPath = process.env.HTTPS_CERT_FILE?.trim();

  if (customKeyPath || customCertPath) {
    if (!customKeyPath || !customCertPath) {
      throw new Error(
        "HTTPS_KEY_FILE e HTTPS_CERT_FILE devono essere impostate insieme per usare un certificato personalizzato."
      );
    }

    return loadProvidedHttpsCertificate(customKeyPath, customCertPath);
  }

  const normalizedHosts = normalizeHosts(hosts);
  const resolvedDir = path.resolve(certDir);
  const keyPath = path.join(resolvedDir, CERT_FILENAME);
  const certPath = path.join(resolvedDir, PEM_FILENAME);
  const metaPath = path.join(resolvedDir, META_FILENAME);

  await fs.mkdir(resolvedDir, { recursive: true });

  try {
    const [key, cert, metaRaw] = await Promise.all([
      fs.readFile(keyPath, "utf8"),
      fs.readFile(certPath, "utf8"),
      fs.readFile(metaPath, "utf8")
    ]);
    const metadata = JSON.parse(metaRaw) as StoredCertificateMetadata;
    const savedHosts = normalizeHosts(metadata.hosts ?? []);

    if (savedHosts.length === normalizedHosts.length && savedHosts.every((host, index) => host === normalizedHosts[index])) {
      return {
        key,
        cert,
        keyPath,
        certPath
      };
    }
  } catch {
    // Missing or outdated certificate: regenerate below.
  }

  const primaryHost = normalizedHosts[0] ?? "localhost";
  const attributes = [{ name: "commonName", value: primaryHost }];
  const generated = await selfsigned.generate(attributes, {
    algorithm: "sha256",
    keySize: 2048,
    days: 30,
    extensions: [
      {
        name: "basicConstraints",
        cA: true
      },
      {
        name: "keyUsage",
        keyCertSign: true,
        digitalSignature: true,
        keyEncipherment: true
      },
      {
        name: "extKeyUsage",
        serverAuth: true
      },
      {
        name: "subjectAltName",
        altNames: buildAltNames(normalizedHosts)
      }
    ]
  } as never);

  await Promise.all([
    fs.writeFile(keyPath, generated.private, "utf8"),
    fs.writeFile(certPath, generated.cert, "utf8"),
    fs.writeFile(
      metaPath,
      JSON.stringify(
        {
          hosts: normalizedHosts
        },
        null,
        2
      ),
      "utf8"
    )
  ]);

  return {
    key: generated.private,
    cert: generated.cert,
    keyPath,
    certPath
  };
}
