import express from "express";
import cors, { CorsOptions } from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import patch, { Change } from "textdiff-patch";
import StorageService from "./services/StorageService";
import { appRouter, createContext } from "./trpc";

const corsOptions: CorsOptions = {
  origin(requestOrigin, callback) {
    const allowedOrigins = ["http://localhost:5173"];
    const isAllowed = requestOrigin && allowedOrigins.includes(requestOrigin);
    callback(null, isAllowed);
  },
};

const app = express();
const port = 3000;

app.use(cors(corsOptions));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
