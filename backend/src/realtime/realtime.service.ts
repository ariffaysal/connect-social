import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage, Server } from 'http';
import { Role } from '../auth/roles.enum';

type WsClient = {
  socket: WebSocket;
  role?: string;
  userId?: number;
};

@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private wss: WebSocketServer | null = null;
  private readonly clients = new Set<WsClient>();

  constructor(private readonly jwtService: JwtService) {}

  /** Attach the WebSocket server to the running HTTP server (call after app.listen). */
  init(server: Server) {
    if (this.wss) return;
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (socket, req) => {
      this.handleConnection(socket, req).catch(() => {
        socket.close(4001, 'Unauthorized');
      });
    });
    this.logger.log('Realtime WebSocket server listening on /ws');
  }

  private async handleConnection(socket: WebSocket, req: IncomingMessage) {
    const url = new URL(req.url ?? '', 'http://localhost');
    const token = url.searchParams.get('token');
    if (!token) throw new Error('missing token');
    const payload = await this.jwtService.verifyAsync(token);
    if (!payload?.sub) throw new Error('invalid token');

    const client: WsClient = {
      socket,
      role: payload.role,
      userId: payload.sub,
    };
    this.clients.add(client);
    socket.on('close', () => this.clients.delete(client));
    socket.on('error', () => this.clients.delete(client));
  }

  /** Send an event to every connected SuperAdmin/Moderator. */
  sendToModerators(type: string, data: Record<string, unknown>) {
    this.sendTo(
      (client) =>
        client.role === Role.SuperAdmin || client.role === Role.Moderator,
      type,
      data,
    );
  }

  /** Send an event to every connected client. */
  sendToAll(type: string, data: Record<string, unknown>) {
    this.sendTo(() => true, type, data);
  }

  /** Send an event to every socket belonging to a specific user. */
  sendToUser(userId: number, type: string, data: Record<string, unknown>) {
    this.sendTo((client) => client.userId === userId, type, data);
  }

  private sendTo(
    predicate: (client: WsClient) => boolean,
    type: string,
    data: Record<string, unknown>,
  ) {
    const message = JSON.stringify({ type, ...data });
    for (const client of this.clients) {
      if (predicate(client) && client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(message);
      }
    }
  }

  onModuleDestroy() {
    for (const client of this.clients) {
      client.socket.close();
    }
    this.clients.clear();
    this.wss?.close();
    this.wss = null;
  }
}
