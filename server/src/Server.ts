import express, { Express } from "express";
import cors from "cors";
import RestApiRouter from "@/routers/rest";
import { start as startWSS } from "./routers/trpc";
import { storageService } from "./services/StorageService";
import { pageService } from "./services/PageService";

class Server {
  private app: Express;
  private port = 3000;

  constructor() {
    this.app = express();
  }

  private async init() {
    await storageService.init();
    await pageService.init();

    this.app.use(cors());

    this.app.use("/api", RestApiRouter);
  }

  async start() {
    await this.init();

    startWSS();

    return new Promise<void>((resolve) => {
      this.app.listen(this.port, () => {
        console.log(`Http server listening on http://localhost:${this.port}`);
        resolve();
      });
    });
  }
}

export default Server;
