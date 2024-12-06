import express from "express";
import cors, { CorsOptions } from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter, createHttpContext, createWsContext } from "./trpc";
import { WebSocketServer } from "ws";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { getLogger } from "./logger";

const corsOptions: CorsOptions = {
  origin(requestOrigin, callback) {
    const allowedOrigins = ["http://localhost:5173"];
    const isAllowed = requestOrigin && allowedOrigins.includes(requestOrigin);
    callback(null, isAllowed);
  },
};

const app = express();
const port = 3000;

const logger = getLogger("Server");

const wss = new WebSocketServer({ noServer: true });

const handler = applyWSSHandler({
  wss,
  router: appRouter,
  createContext: createWsContext,
});

wss.on("connection", (ws) => {
  logger.info(`➕➕ Connection (${wss.clients.size})`);
  ws.once("close", () => {
    logger.info(`➖➖ Connection (${wss.clients.size})`);
  });
});

app.use(cors(corsOptions));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: createHttpContext,
  })
);

const server = app.listen(port, () => {
  logger.info(`Fibbelous server listening on port ${port}`);
});

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (socket) => {
    wss.emit("connection", socket, request);
  });
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM");
  handler.broadcastReconnectNotification();
  wss.close();
});
