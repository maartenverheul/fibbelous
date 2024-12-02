import express from "express";
import http from "http";
import StorageService from "./services/StorageService";
import { Server as SocketIOServer } from "socket.io";
import { ClientCommandHandler } from "./lib";
import cors, { CorsOptions } from "cors";
import patch, { Change } from "textdiff-patch";

const corsOptions: CorsOptions = {
  origin(requestOrigin, callback) {
    const allowedOrigins = ["http://localhost:5173"];
    const isAllowed = requestOrigin && allowedOrigins.includes(requestOrigin);
    callback(null, isAllowed);
  },
};

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: corsOptions,
});
const port = 3000;

const storage = new StorageService("./.data");

app.use(cors(corsOptions));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

io.on("connection", (socket) => {
  console.log("Socket connected");

  const handler: ClientCommandHandler = {
    async listPages() {
      console.log(`Listing pages`);
      const pages = await storage.listPages();
      socket.emit("listPages", pages);
    },
    async createPage(name: string) {
      console.log(`Creating page ${name}`);
      await storage.createPage(name);
      io.emit("pageCreated", name);
    },
    async deletePage(id: string) {
      console.log(`Deleting page ${id}`);
      await storage.deletePage(id);
      io.emit("pageDeleted", id);
    },
    async loadPage(id: string) {
      console.log(`Loading page ${id}`);
      const content = await storage.loadPage(id);
      socket.emit("pageLoaded", id, content);
    },
    async editPage(id: string, diff: Change[]) {
      console.log(`Editing page ${id}`);
      const oldContent = await storage.loadPage(id);
      const newContent = patch(oldContent, diff);
      await storage.updatePage(id, newContent);
      socket.emit("pageUpdated", id, newContent);
    },
  };

  socket.onAny(async (event, ...args) => {
    if (event in handler) {
      const e = event as keyof ClientCommandHandler;
      const fn = handler[e] as any;
      try {
        await fn(...args);
      } catch (e) {
        console.error(e);
      }
    } else {
      console.log(`Unknown command ${event}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected");
  });
});
