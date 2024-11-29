import express from "express";
import http from "http";
import StorageService from "./services/StorageService";
import { Server as SocketIOServer } from "socket.io";
import { ClientCommandHandler } from "./lib";

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);
const port = 3000;

const storage = new StorageService("./.data");

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
      socket.emit("pageLoaded", content);
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
