import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../server/app";
import { uploadFiles } from "../src/lib/api";

const temporaryDirectories: string[] = [];
const fixturesDirectory = path.resolve(process.cwd(), "tests", "fixtures");

async function createTemporaryStorage() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "routeroom-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      fs.rm(directory, { recursive: true, force: true })
    )
  );
});

function createUploadFile(name: string, relativePath?: string, sizeBytes?: number) {
  const file = new File([sizeBytes ? new Uint8Array(sizeBytes) : `payload-${name}`], name, {
    type: "text/plain"
  });

  if (relativePath) {
    Object.defineProperty(file, "webkitRelativePath", {
      configurable: true,
      value: relativePath
    });
  }

  return file;
}

describe("Routeroom API", () => {
  it("returns session details with LAN metadata", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ port: 8787, storageRoot });

    const response = await request(app).get("/api/session").expect(200);

    expect(response.body.appName).toBe("Routeroom");
    expect(response.body.storagePath).toBe(storageRoot);
    expect(response.body.lanUrl).toContain("http://");
    expect(response.body.availableArchiveFormats).toContain("zip");
    expect(response.body.itemCount).toBe(0);
    close();
  });

  it("preserves nested folder structure during directory uploads and restores it on restart", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ storageRoot });
    const [textBuffer, docxBuffer] = await Promise.all([
      fs.readFile(path.join(fixturesDirectory, "sample-note.txt")),
      fs.readFile(path.join(fixturesDirectory, "sample-brief.docx"))
    ]);

    const folderResponse = await request(app)
      .post("/api/folders")
      .send({ name: "Salotto" })
      .expect(201);

    await request(app)
      .post("/api/items")
      .field("parentId", folderResponse.body.item.id)
      .field("relativePaths", "sample-bundle/Guide/sample-note.txt")
      .field("relativePaths", "sample-bundle/Docs/sample-brief.docx")
      .attach("files", textBuffer, {
        filename: "sample-note.txt",
        contentType: "text/plain"
      })
      .attach("files", docxBuffer, {
        filename: "sample-brief.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      })
      .expect(201);

    close();

    const reloaded = await createApp({ storageRoot });
    const itemsResponse = await request(reloaded.app).get("/api/items").expect(200);

    expect(itemsResponse.body.some((item: { kind: string; name: string }) => item.kind === "folder" && item.name === "Salotto")).toBe(true);
    expect(itemsResponse.body.some((item: { kind: string; name: string }) => item.kind === "folder" && item.name === "sample-bundle")).toBe(true);
    expect(itemsResponse.body.some((item: { kind: string; name: string }) => item.kind === "folder" && item.name === "Guide")).toBe(true);
    expect(itemsResponse.body.some((item: { kind: string; name: string }) => item.kind === "folder" && item.name === "Docs")).toBe(true);
    expect(itemsResponse.body.some((item: { kind: string; name: string }) => item.kind === "document" && item.name === "sample-note.txt")).toBe(true);
    expect(itemsResponse.body.some((item: { kind: string; name: string }) => item.kind === "document" && item.name === "sample-brief.docx")).toBe(true);
    reloaded.close();
  });

  it("returns previews for txt, docx, and pdf documents", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ storageRoot });
    const [textBuffer, docxBuffer, pdfBuffer] = await Promise.all([
      fs.readFile(path.join(fixturesDirectory, "sample-note.txt")),
      fs.readFile(path.join(fixturesDirectory, "sample-brief.docx")),
      fs.readFile(path.join(fixturesDirectory, "sample-guide.pdf"))
    ]);

    const uploadResponse = await request(app)
      .post("/api/items")
      .attach("files", textBuffer, {
        filename: "sample-note.txt",
        contentType: "text/plain"
      })
      .attach("files", docxBuffer, {
        filename: "sample-brief.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      })
      .attach("files", pdfBuffer, {
        filename: "sample-guide.pdf",
        contentType: "application/pdf"
      })
      .expect(201);

    const uploaded = uploadResponse.body.items as Array<{ id: string; name: string }>;
    const textId = uploaded.find((item) => item.name === "sample-note.txt")?.id;
    const docxId = uploaded.find((item) => item.name === "sample-brief.docx")?.id;
    const pdfId = uploaded.find((item) => item.name === "sample-guide.pdf")?.id;

    const textPreview = await request(app).get(`/api/items/${textId}/preview`).expect(200);
    const docxPreview = await request(app).get(`/api/items/${docxId}/preview`).expect(200);
    const pdfPreview = await request(app).get(`/api/items/${pdfId}/preview`).expect(200);

    expect(textPreview.body.mode).toBe("text");
    expect(textPreview.body.text).toContain("Routeroom tiene i file");
    expect(docxPreview.body.mode).toBe("text");
    expect(docxPreview.body.text).toContain("Brief Routeroom");
    expect(pdfPreview.body.mode).toBe("pdf");
    expect(pdfPreview.body.url).toContain(`/api/items/${pdfId}/content`);
    close();
  });

  it("truncates long text previews earlier when documents are very large", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ storageRoot });
    const longText = Array.from({ length: 900 }, (_, index) => `Riga ${index} Routeroom LAN`).join("\n");

    const uploadResponse = await request(app)
      .post("/api/items")
      .attach("files", Buffer.from(longText, "utf8"), {
        filename: "very-long.txt",
        contentType: "text/plain"
      })
      .expect(201);

    const [{ id }] = uploadResponse.body.items as Array<{ id: string }>;
    const previewResponse = await request(app).get(`/api/items/${id}/preview`).expect(200);

    expect(previewResponse.body.mode).toBe("text");
    expect(previewResponse.body.truncated).toBe(true);
    expect(previewResponse.body.text.length).toBeLessThanOrEqual(2800);
    close();
  });

  it("downloads folders as archives and creates archive items in supported formats", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ storageRoot });

    const folderResponse = await request(app)
      .post("/api/folders")
      .send({ name: "Pacchetto" })
      .expect(201);

    await request(app)
      .post("/api/items")
      .field("parentId", folderResponse.body.item.id)
      .attach("files", Buffer.from("ciao routeroom"), {
        filename: "note.txt",
        contentType: "text/plain"
      })
      .expect(201);

    const sessionResponse = await request(app).get("/api/session").expect(200);

    const downloadResponse = await request(app)
      .get(`/api/items/${folderResponse.body.item.id}/download?format=zip`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(downloadResponse.headers["content-disposition"]).toContain("Pacchetto.zip");
    expect(downloadResponse.headers["content-type"]).toContain("application/zip");
    expect(downloadResponse.headers["content-length"]).toBeUndefined();
    expect(downloadResponse.headers["transfer-encoding"]).toBe("chunked");
    expect(downloadResponse.body.length).toBeGreaterThan(0);

    const zipArchiveResponse = await request(app)
      .post(`/api/items/${folderResponse.body.item.id}/archive`)
      .send({ format: "zip" })
      .expect(201);

    expect(zipArchiveResponse.body.item.kind).toBe("archive");
    expect(zipArchiveResponse.body.item.name).toBe("Pacchetto.zip");

    if ((sessionResponse.body.availableArchiveFormats as string[]).includes("7z")) {
      const sevenZipResponse = await request(app)
        .post(`/api/items/${folderResponse.body.item.id}/archive`)
        .send({ format: "7z" })
        .expect(201);

      expect(sevenZipResponse.body.item.kind).toBe("archive");
      expect(sevenZipResponse.body.item.name).toBe("Pacchetto.7z");
    }

    close();
  });

  it("streams media with range support", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ storageRoot });

    const uploadResponse = await request(app)
      .post("/api/items")
      .attach("files", Buffer.from("routeroom-video-bytes"), {
        filename: "clip.mp4",
        contentType: "video/mp4"
      })
      .expect(201);

    const [{ id }] = uploadResponse.body.items as Array<{ id: string }>;

    const streamResponse = await request(app)
      .get(`/api/items/${id}/stream`)
      .set("Range", "bytes=0-6")
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      })
      .expect(206);

    expect(streamResponse.headers["content-range"]).toContain("bytes 0-6/");
    expect(streamResponse.body.toString("utf8")).toBe("routero");
    close();
  });

  it("deletes folders recursively", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ storageRoot });

    const folderResponse = await request(app)
      .post("/api/folders")
      .send({ name: "Da eliminare" })
      .expect(201);

    await request(app)
      .post("/api/items")
      .field("parentId", folderResponse.body.item.id)
      .attach("files", Buffer.from("hello routeroom"), {
        filename: "notes.txt",
        contentType: "text/plain"
      })
      .expect(201);

    const deleteResponse = await request(app)
      .delete(`/api/items/${folderResponse.body.item.id}`)
      .expect(200);

    expect(deleteResponse.body.deletedIds).toHaveLength(2);
    const itemsResponse = await request(app).get("/api/items").expect(200);
    expect(itemsResponse.body).toHaveLength(0);
    close();
  });

  it("persists chat, stream rooms, and playback state across restarts", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ storageRoot });
    const videoBuffer = await fs.readFile(path.join(fixturesDirectory, "sample-video.webm"));

    const uploadResponse = await request(app)
      .post("/api/items")
      .attach("files", videoBuffer, {
        filename: "sample-video.webm",
        contentType: "video/webm"
      })
      .expect(201);

    const [{ id: videoId }] = uploadResponse.body.items as Array<{ id: string }>;

    const roomResponse = await request(app)
      .post("/api/stream/rooms")
      .send({ name: "Salotto sync" })
      .expect(201);

    const roomId = roomResponse.body.room.id as string;

    await request(app)
      .post("/api/chat/messages")
      .send({ identity: { nickname: "Anna" }, text: "Ciao LAN" })
      .expect(201);

    await request(app)
      .post(`/api/stream/rooms/${roomId}/messages`)
      .send({ identity: { nickname: "Bruno" }, text: "Video pronto" })
      .expect(201);

    await request(app)
      .post(`/api/stream/rooms/${roomId}/video`)
      .send({ videoItemId: videoId })
      .expect(200);

    await request(app)
      .post(`/api/stream/rooms/${roomId}/playback`)
      .send({ action: "play", positionSeconds: 12.5 })
      .expect(200);

    await delay(40);

    const roomSnapshot = await request(app).get(`/api/stream/rooms/${roomId}`).expect(200);
    expect(roomSnapshot.body.room.playback.status).toBe("playing");
    expect(roomSnapshot.body.room.playback.positionSeconds).toBeGreaterThanOrEqual(12.5);
    close();

    const reloaded = await createApp({ storageRoot });
    const chatSnapshot = await request(reloaded.app).get("/api/chat").expect(200);
    const restoredRoom = await request(reloaded.app).get(`/api/stream/rooms/${roomId}`).expect(200);

    expect(chatSnapshot.body.messages).toHaveLength(1);
    expect(chatSnapshot.body.messages[0].text).toBe("Ciao LAN");
    expect(restoredRoom.body.room.name).toBe("Salotto sync");
    expect(restoredRoom.body.room.currentVideoName).toBe("sample-video.webm");
    expect(restoredRoom.body.room.messages).toHaveLength(1);
    expect(restoredRoom.body.room.messages[0].text).toBe("Video pronto");
    expect(restoredRoom.body.room.playback.status).toBe("playing");
    expect(restoredRoom.body.room.playback.positionSeconds).toBeGreaterThanOrEqual(12.5);
    reloaded.close();
  });

  it("rejects selecting a non-video item for a streaming room", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ storageRoot });

    const uploadResponse = await request(app)
      .post("/api/items")
      .attach("files", Buffer.from("routeroom"), {
        filename: "notes.txt",
        contentType: "text/plain"
      })
      .expect(201);

    const roomResponse = await request(app)
      .post("/api/stream/rooms")
      .send({ name: "Solo video" })
      .expect(201);

    const [{ id: itemId }] = uploadResponse.body.items as Array<{ id: string }>;

    await request(app)
      .post(`/api/stream/rooms/${roomResponse.body.room.id}/video`)
      .send({ videoItemId: itemId })
      .expect(400);

    close();
  });

  it("removes room chat when a stream room is deleted", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ storageRoot });

    const roomResponse = await request(app)
      .post("/api/stream/rooms")
      .send({ name: "Stanza temporanea" })
      .expect(201);

    const roomId = roomResponse.body.room.id as string;

    await request(app)
      .post(`/api/stream/rooms/${roomId}/messages`)
      .send({ identity: { nickname: "Luca" }, text: "Ci sono" })
      .expect(201);

    await request(app).delete(`/api/stream/rooms/${roomId}`).expect(200);
    await request(app).get(`/api/stream/rooms/${roomId}`).expect(404);
    const roomsResponse = await request(app).get("/api/stream/rooms").expect(200);
    expect(roomsResponse.body.rooms).toHaveLength(0);
    close();
  });

  it("emits new SSE events for global chat and stream rooms", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ storageRoot });
    const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
      const nextServer = app.listen(0, "127.0.0.1", () => {
        resolve(nextServer);
      });
    });
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Expected an ephemeral port");
    }

    const controller = new AbortController();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/events`, {
      signal: controller.signal
    });

    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error("Expected SSE body reader");
    }

    const readPromise = (async () => {
      let transcript = "";

      while (
        !transcript.includes("event: stream-room-created") ||
        !transcript.includes("event: chat-global-updated")
      ) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        transcript += Buffer.from(value).toString("utf8");
      }

      return transcript;
    })();

    await request(server)
      .post("/api/stream/rooms")
      .send({ name: "Event room" })
      .expect(201);

    await request(server)
      .post("/api/chat/messages")
      .send({ identity: { nickname: "Marta" }, text: "Evento globale" })
      .expect(201);

    const transcript = await Promise.race([
      readPromise,
      delay(3000).then(() => {
        throw new Error("Timed out waiting for SSE events");
      })
    ]);

    controller.abort();
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });

    expect(transcript).toContain("event: stream-room-created");
    expect(transcript).toContain("event: chat-global-updated");
    close();
  });

  it("rejects unknown or malicious download identifiers", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ storageRoot });

    await request(app).get("/api/items/does-not-exist/download").expect(404);
    await request(app).get("/api/items/%2e%2e%2fetc%2fpasswd/download").expect(404);
    close();
  });
});

describe("client upload api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("packs many small directory uploads into a single request and drops the shared root folder name", async () => {
    const calls: Array<{ relativePaths: string[]; parentId: FormDataEntryValue | null }> = [];
    const fetchMock = vi.fn(async (_resource: string | URL | Request, init?: RequestInit) => {
      const body = init?.body;

      expect(body).toBeInstanceOf(FormData);

      const formData = body as FormData;
      const relativePaths = formData.getAll("relativePaths").map((entry) => String(entry));
      calls.push({
        relativePaths,
        parentId: formData.get("parentId")
      });

      return new Response(
        JSON.stringify({
          items: relativePaths.map((relativePath, index) => ({
            id: `item-${calls.length}-${index}`,
            name: relativePath.split("/").at(-1) ?? relativePath,
            storedName: `stored-${calls.length}-${index}`,
            mimeType: "text/plain",
            kind: "document",
            sizeBytes: 1,
            createdAt: "2026-03-17T00:00:00.000Z",
            parentId: "salotto"
          }))
        }),
        {
          status: 201,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const files = Array.from({ length: 25 }, (_, index) =>
      createUploadFile(
        `note-${index}.txt`,
        index % 2 === 0
          ? `Vacanze LAN lunghissime/Guide/note-${index}.txt`
          : `Vacanze LAN lunghissime/Docs/note-${index}.txt`
      )
    );

    const response = await uploadFiles(files, "salotto");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.items).toHaveLength(25);
    expect(calls[0]?.relativePaths).toHaveLength(25);
    expect(calls.every((call) => call.parentId === "salotto")).toBe(true);
    expect(calls.flatMap((call) => call.relativePaths)).toContain("Guide/note-0.txt");
    expect(calls.flatMap((call) => call.relativePaths)).toContain("Docs/note-1.txt");
    expect(calls.flatMap((call) => call.relativePaths).every((relativePath) => !relativePath.startsWith("Vacanze LAN lunghissime/"))).toBe(true);
  });

  it("isolates very large files into smaller requests", async () => {
    const calls: Array<{ relativePaths: string[]; parentId: FormDataEntryValue | null }> = [];
    const fetchMock = vi.fn(async (_resource: string | URL | Request, init?: RequestInit) => {
      const body = init?.body;

      expect(body).toBeInstanceOf(FormData);

      const formData = body as FormData;
      const relativePaths = formData.getAll("relativePaths").map((entry) => String(entry));
      calls.push({
        relativePaths,
        parentId: formData.get("parentId")
      });

      return new Response(
        JSON.stringify({
          items: relativePaths.map((relativePath, index) => ({
            id: `large-${calls.length}-${index}`,
            name: relativePath.split("/").at(-1) ?? relativePath,
            storedName: `stored-large-${calls.length}-${index}`,
            mimeType: "video/mp4",
            kind: "video",
            sizeBytes: 1,
            createdAt: "2026-03-17T00:00:00.000Z",
            parentId: null
          }))
        }),
        {
          status: 201,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const files = [
      createUploadFile("clip-a.mp4", undefined, 18 * 1024 * 1024),
      createUploadFile("clip-b.mp4", undefined, 20 * 1024 * 1024),
      createUploadFile("clip-c.mp4", undefined, 22 * 1024 * 1024)
    ];

    const response = await uploadFiles(files);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(response.items).toHaveLength(3);
    expect(calls.map((call) => call.relativePaths)).toEqual([["clip-a.mp4"], ["clip-b.mp4"], ["clip-c.mp4"]]);
    expect(calls.every((call) => call.parentId === null)).toBe(true);
  });

  it("allows aborting an upload before the current batch completes", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_resource: string | URL | Request, init?: RequestInit) => {
      const signal = init?.signal;

      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener(
          "abort",
          () => {
            const error = new Error("Upload aborted");
            error.name = "AbortError";
            reject(error);
          },
          { once: true }
        );
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const uploadPromise = uploadFiles(
      [
        createUploadFile("slow-note.txt", undefined, 4 * 1024 * 1024),
        createUploadFile("slow-note-2.txt", undefined, 4 * 1024 * 1024)
      ],
      "salotto",
      { signal: controller.signal }
    );

    controller.abort();

    await expect(uploadPromise).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
