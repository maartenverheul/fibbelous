import express, { Express } from "express";
import cors from "cors";
import RestApiRouter from "@/routers/rest";
import { start as startWSS } from "./routers/trpc";

class Server {
  private app: Express;
  private port = 3000;

  constructor() {
    this.app = express();
    this.init();
  }

  private init() {
    this.app.use(cors());

    this.app.use("/api", RestApiRouter);
  }

  async start() {
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
