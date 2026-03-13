import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../server/app";

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

describe("Routy API", () => {
  it("returns session details with LAN metadata", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ port: 8787, storageRoot });

    const response = await request(app).get("/api/session").expect(200);

    expect(response.body.appName).toBe("Routy");
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
      .send({ identity: { id: "anna-1", nickname: "Anna" }, text: "Ciao LAN" })
      .expect(201);

    await request(app)
      .post(`/api/stream/rooms/${roomId}/messages`)
      .send({ identity: { id: "bruno-1", nickname: "Bruno" }, text: "Video pronto" })
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

    expect(chatSnapshot.body.globalMessages).toHaveLength(1);
    expect(chatSnapshot.body.globalMessages[0].text).toBe("Ciao LAN");
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

  it("starts a room screen share once and rejects concurrent presenters", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ storageRoot });

    const roomResponse = await request(app)
      .post("/api/stream/rooms")
      .send({ name: "Presentazione LAN" })
      .expect(201);

    const roomId = roomResponse.body.room.id as string;

    const startResponse = await request(app)
      .post(`/api/stream/rooms/${roomId}/screen-share/start`)
      .send({
        identity: { id: "host-1", nickname: "Host" },
        hasAudio: true
      })
      .expect(200);

    expect(startResponse.body.room.sourceMode).toBe("screen");
    expect(startResponse.body.room.screenShare.status).toBe("live");
    expect(startResponse.body.room.screenShare.presenter.nickname).toBe("Host");
    expect(startResponse.body.room.screenShare.hasAudio).toBe(true);

    await request(app)
      .post(`/api/stream/rooms/${roomId}/screen-share/start`)
      .send({
        identity: { id: "guest-1", nickname: "Guest" },
        hasAudio: true
      })
      .expect(409);

    close();
  });

  it("locks video controls during screen share and only lets the presenter stop it", async () => {
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
      .send({ name: "Sala demo" })
      .expect(201);

    const roomId = roomResponse.body.room.id as string;

    await request(app)
      .post(`/api/stream/rooms/${roomId}/video`)
      .send({ videoItemId: videoId })
      .expect(200);

    const startResponse = await request(app)
      .post(`/api/stream/rooms/${roomId}/screen-share/start`)
      .send({
        identity: { id: "presenter-1", nickname: "Presenter" },
        hasAudio: true
      })
      .expect(200);

    const sessionId = startResponse.body.room.screenShare.sessionId as string;

    await request(app)
      .post(`/api/stream/rooms/${roomId}/video`)
      .send({ videoItemId: videoId })
      .expect(409);

    await request(app)
      .post(`/api/stream/rooms/${roomId}/playback`)
      .send({ action: "play", positionSeconds: 3 })
      .expect(409);

    await request(app)
      .post(`/api/stream/rooms/${roomId}/screen-share/stop`)
      .send({
        identity: { id: "viewer-1", nickname: "Viewer" },
        sessionId
      })
      .expect(403);

    const stopResponse = await request(app)
      .post(`/api/stream/rooms/${roomId}/screen-share/stop`)
      .send({
        identity: { id: "presenter-1", nickname: "Presenter" },
        sessionId
      })
      .expect(200);

    expect(stopResponse.body.room.sourceMode).toBe("video");
    expect(stopResponse.body.room.screenShare.status).toBe("idle");
    close();
  });

  it("resets active screen share state after restart", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ storageRoot });

    const roomResponse = await request(app)
      .post("/api/stream/rooms")
      .send({ name: "Restart room" })
      .expect(201);

    const roomId = roomResponse.body.room.id as string;

    await request(app)
      .post(`/api/stream/rooms/${roomId}/screen-share/start`)
      .send({
        identity: { id: "presenter-1", nickname: "Presenter" },
        hasAudio: true
      })
      .expect(200);

    close();

    const reloaded = await createApp({ storageRoot });
    const roomSnapshot = await request(reloaded.app).get(`/api/stream/rooms/${roomId}`).expect(200);

    expect(roomSnapshot.body.room.sourceMode).toBe("video");
    expect(roomSnapshot.body.room.screenShare.status).toBe("idle");
    expect(roomSnapshot.body.room.screenShare.presenter).toBeNull();
    reloaded.close();
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
      .send({ identity: { id: "luca-1", nickname: "Luca" }, text: "Ci sono" })
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
      .send({ identity: { id: "marta-1", nickname: "Marta" }, text: "Evento globale" })
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
