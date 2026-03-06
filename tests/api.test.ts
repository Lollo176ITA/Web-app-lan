import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
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

describe("Routeroom API", () => {
  it("returns session details with LAN metadata", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ port: 8787, storageRoot });

    const response = await request(app).get("/api/session").expect(200);

    expect(response.body.appName).toBe("Routeroom");
    expect(response.body.storagePath).toBe(storageRoot);
    expect(response.body.lanUrl).toContain("http://");
    expect(response.body.itemCount).toBe(0);
    close();
  });

  it("creates folders, uploads into them, and restores the tree on restart", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ storageRoot });

    const folderResponse = await request(app)
      .post("/api/folders")
      .send({ name: "Salotto" })
      .expect(201);

    await request(app)
      .post("/api/items")
      .field("parentId", folderResponse.body.item.id)
      .attach("files", Buffer.from("hello routeroom"), {
        filename: "notes.txt",
        contentType: "text/plain"
      })
      .expect(201);

    close();

    const reloaded = await createApp({ storageRoot });
    const itemsResponse = await request(reloaded.app).get("/api/items").expect(200);

    expect(itemsResponse.body).toHaveLength(2);
    expect(itemsResponse.body.some((item: { kind: string; name: string }) => item.kind === "folder" && item.name === "Salotto")).toBe(true);
    expect(itemsResponse.body.some((item: { parentId: string; kind: string }) => item.parentId === folderResponse.body.item.id && item.kind === "document")).toBe(true);
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

  it("rejects unknown or malicious download identifiers", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ storageRoot });

    await request(app).get("/api/items/does-not-exist/download").expect(404);
    await request(app).get("/api/items/%2e%2e%2fetc%2fpasswd/download").expect(404);
    close();
  });
});
