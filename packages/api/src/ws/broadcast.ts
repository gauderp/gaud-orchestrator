import type { WebSocket } from 'ws'

const clients = new Set<WebSocket>()

export function addClient(ws: WebSocket): void {
  clients.add(ws)
  ws.on('close', () => clients.delete(ws))
}

export function broadcast(type: string, payload: unknown): void {
  const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() })
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(message)
    }
  }
}

export function clientCount(): number {
  return clients.size
}
