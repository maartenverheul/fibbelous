import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { WebSocketServer } from "ws";
import { appRouter } from "./router";
import getLogger from "@/logger";

const logger = getLogger("trcp");

export function start() {
  const wss = new WebSocketServer({
    port: 3001,
  });

  const handler = applyWSSHandler({ wss, router: appRouter });

  wss.on("connection", (ws) => {
    logger.info(`➕ Connection (${wss.clients.size})`);
    ws.once("close", () => {
      logger.info(`➖ Connection (${wss.clients.size})`);
    });
  });
  logger.info("WebSocket server listening on ws://localhost:3001");

  function stop() {
    logger.info("Stop signal received, gracefully closing websockets..");

    handler.broadcastReconnectNotification();
    wss.close();

    logger.info("Bye");
    process.exit();
  }

  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  process.on("SIGKILL", stop);
}
