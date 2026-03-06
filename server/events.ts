import type { Response } from "express";

export class EventHub {
  private clients = new Set<Response>();

  addClient(response: Response) {
    this.clients.add(response);
  }

  removeClient(response: Response) {
    this.clients.delete(response);
  }

  broadcast(event: string, payload: unknown) {
    const data = JSON.stringify(payload);

    for (const client of this.clients) {
      client.write(`event: ${event}\n`);
      client.write(`data: ${data}\n\n`);
    }
  }

  keepAlive() {
    for (const client of this.clients) {
      client.write(": ping\n\n");
    }
  }
}
