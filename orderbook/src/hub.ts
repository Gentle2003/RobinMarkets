/** Minimal pub/sub hub broadcasting JSON messages to all connected WS clients. */
export class Hub {
  private sockets = new Set<{ send: (data: string) => void }>();

  add(socket: { send: (data: string) => void; on: (ev: string, cb: () => void) => void }): void {
    this.sockets.add(socket);
    socket.on("close", () => this.sockets.delete(socket));
  }

  broadcast(message: unknown): void {
    const data = JSON.stringify(message);
    for (const s of this.sockets) {
      try {
        s.send(data);
      } catch {
        this.sockets.delete(s);
      }
    }
  }
}
