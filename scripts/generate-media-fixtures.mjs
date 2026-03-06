import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(currentDirectory, "..");
const fixturesDirectory = path.join(rootDirectory, "tests", "fixtures");
const bundleDirectory = path.join(fixturesDirectory, "sample-bundle");

function createWaveFile({ seconds = 1.1, sampleRate = 44_100, frequency = 440 }) {
  const sampleCount = Math.floor(seconds * sampleRate);
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.sin((2 * Math.PI * frequency * index) / sampleRate);
    buffer.writeInt16LE(Math.round(sample * 0x5fff), 44 + index * 2);
  }

  return buffer;
}

async function createVideoFixture(destination) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const base64 = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas context unavailable");
      }

      const stream = canvas.captureStream(12);
      const chunks = [];
      const candidateTypes = [
        "video/webm;codecs=vp8",
        "video/webm;codecs=vp9",
        "video/webm"
      ];
      const mimeType = candidateTypes.find((value) => MediaRecorder.isTypeSupported(value)) ?? "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      const stopPromise = new Promise((resolve) => {
        recorder.onstop = resolve;
      });

      const frames = 12;
      recorder.start();

      for (let frame = 0; frame < frames; frame += 1) {
        const progress = frame / (frames - 1);
        context.fillStyle = "#08131e";
        context.fillRect(0, 0, canvas.width, canvas.height);

        const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, "#1769aa");
        gradient.addColorStop(1, "#0f9d94");

        context.fillStyle = gradient;
        context.fillRect(36, 36, canvas.width - 72, canvas.height - 72);

        context.fillStyle = "rgba(255,255,255,0.92)";
        context.font = "700 42px sans-serif";
        context.fillText("Routeroom", 64, 115);

        context.font = "500 24px sans-serif";
        context.fillText("Streaming locale in LAN", 64, 156);

        context.fillStyle = "#ffffff";
        context.beginPath();
        context.arc(110 + progress * 360, 246, 28, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = "#08131e";
        context.beginPath();
        context.moveTo(104 + progress * 360, 232);
        context.lineTo(104 + progress * 360, 260);
        context.lineTo(130 + progress * 360, 246);
        context.closePath();
        context.fill();

        await new Promise((resolve) => setTimeout(resolve, 90));
      }

      recorder.stop();
      await stopPromise;

      const blob = new Blob(chunks, { type: mimeType });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";

      for (const byte of bytes) {
        binary += String.fromCharCode(byte);
      }

      return btoa(binary);
    });

    await fs.writeFile(destination, Buffer.from(base64, "base64"));
  } finally {
    await browser.close();
  }
}

async function createPdfFixture(destination) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setContent(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 56px; color: #10273a;">
          <h1 style="margin: 0 0 16px;">Guida Routeroom</h1>
          <p style="font-size: 16px; line-height: 1.6;">
            Routeroom usa la rete locale per condividere file, cartelle e preview documenti.
          </p>
          <ul style="font-size: 16px; line-height: 1.7;">
            <li>Upload in cartella corrente</li>
            <li>Esplorazione a colonne stile Finder</li>
            <li>Preview per TXT, PDF e Word</li>
          </ul>
        </body>
      </html>
    `);

    await page.pdf({
      path: destination,
      format: "A4",
      margin: {
        top: "24px",
        right: "24px",
        bottom: "24px",
        left: "24px"
      }
    });
  } finally {
    await browser.close();
  }
}

async function createDocxFixture(destination) {
  const document = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun("Brief Routeroom")]
          }),
          new Paragraph({
            children: [
              new TextRun(
                "Routeroom mantiene file e cartelle nella stessa LAN e offre anteprime locali per i documenti principali."
              )
            ]
          }),
          new Paragraph({
            bullet: {
              level: 0
            },
            children: [new TextRun("Vista a colonne per navigare nelle cartelle")]
          }),
          new Paragraph({
            bullet: {
              level: 0
            },
            children: [new TextRun("Tre modalita di layout per le card della libreria")]
          }),
          new Paragraph({
            bullet: {
              level: 0
            },
            children: [new TextRun("Cancellazione diretta con conferma visuale nella UI")]
          })
        ]
      }
    ]
  });

  const buffer = await Packer.toBuffer(document);
  await fs.writeFile(destination, buffer);
}

await fs.mkdir(fixturesDirectory, { recursive: true });
await fs.rm(bundleDirectory, { recursive: true, force: true });
await fs.mkdir(path.join(bundleDirectory, "Guide"), { recursive: true });
await fs.mkdir(path.join(bundleDirectory, "Docs"), { recursive: true });

await fs.writeFile(
  path.join(fixturesDirectory, "sample-note.txt"),
  [
    "Routeroom tiene i file nella stessa LAN e li condivide senza cloud.",
    "Le cartelle aiutano a organizzare documenti, media e archivi per stanza o progetto.",
    "La preview locale mostra testo e documenti senza passare da servizi esterni."
  ].join("\n"),
  "utf8"
);

await fs.writeFile(
  path.join(fixturesDirectory, "sample-photo.svg"),
  `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-label="Routeroom graphic">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1769aa"/>
      <stop offset="100%" stop-color="#0f9d94"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" rx="48" fill="#08131e"/>
  <rect x="44" y="44" width="1512" height="812" rx="36" fill="url(#bg)"/>
  <circle cx="390" cy="330" r="150" fill="rgba(255,255,255,0.16)"/>
  <circle cx="1190" cy="580" r="188" fill="rgba(255,255,255,0.12)"/>
  <text x="130" y="220" font-size="96" font-family="Arial, sans-serif" font-weight="700" fill="white">Routeroom</text>
  <text x="130" y="302" font-size="42" font-family="Arial, sans-serif" fill="white">Condivisione locale senza passare da Internet</text>
  <rect x="130" y="394" width="520" height="186" rx="32" fill="rgba(8,19,30,0.26)"/>
  <text x="176" y="470" font-size="34" font-family="Arial, sans-serif" font-weight="700" fill="white">URL LAN pronto</text>
  <text x="176" y="524" font-size="28" font-family="Arial, sans-serif" fill="white">http://192.168.1.45:8787</text>
  <text x="176" y="568" font-size="28" font-family="Arial, sans-serif" fill="white">Upload, stream e download locali</text>
</svg>`,
  "utf8"
);

await fs.writeFile(path.join(fixturesDirectory, "sample-audio.wav"), createWaveFile({}));
await createPdfFixture(path.join(fixturesDirectory, "sample-guide.pdf"));
await createDocxFixture(path.join(fixturesDirectory, "sample-brief.docx"));
await createVideoFixture(path.join(fixturesDirectory, "sample-video.webm"));

await fs.copyFile(path.join(fixturesDirectory, "sample-note.txt"), path.join(bundleDirectory, "Guide", "sample-note.txt"));
await fs.copyFile(path.join(fixturesDirectory, "sample-guide.pdf"), path.join(bundleDirectory, "Guide", "sample-guide.pdf"));
await fs.copyFile(path.join(fixturesDirectory, "sample-brief.docx"), path.join(bundleDirectory, "Docs", "sample-brief.docx"));
