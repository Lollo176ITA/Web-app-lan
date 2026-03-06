import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../server/app";

const temporaryDirectories: string[] = [];

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

  it("persists uploads and restores them on restart", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ storageRoot });

    await request(app)
      .post("/api/items")
      .attach("files", Buffer.from("hello routeroom"), {
        filename: "notes.txt",
        contentType: "text/plain"
      })
      .expect(201);

    close();

    const reloaded = await createApp({ storageRoot });
    const itemsResponse = await request(reloaded.app).get("/api/items").expect(200);

    expect(itemsResponse.body).toHaveLength(1);
    expect(itemsResponse.body[0].kind).toBe("document");
    reloaded.close();
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

  it("rejects unknown or malicious download identifiers", async () => {
    const storageRoot = await createTemporaryStorage();
    const { app, close } = await createApp({ storageRoot });

    await request(app).get("/api/items/does-not-exist/download").expect(404);
    await request(app).get("/api/items/%2e%2e%2fetc%2fpasswd/download").expect(404);
    close();
  });
});
