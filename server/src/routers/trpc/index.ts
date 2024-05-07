import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { WebSocketServer } from "ws";
import { appRouter } from "./router";

export function start() {
  const wss = new WebSocketServer({
    port: 3001,
  });

  const handler = applyWSSHandler({ wss, router: appRouter });

  wss.on("connection", (ws) => {
    console.log(`➕ Connection (${wss.clients.size})`);
    ws.once("close", () => {
      console.log(`➖ Connection (${wss.clients.size})`);
    });
  });
  console.log("WebSocket server listening on ws://localhost:3001");

  function stop() {
    console.log("Stop signal received, gracefully closing websockets..");

    handler.broadcastReconnectNotification();
    wss.close();

    console.log("Bye");
    process.exit();
  }

  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  process.on("SIGKILL", stop);
}
