import navigatorRouter from "./routers/navigatorRouter";
import pagesRouter from "./routers/pagesRouter";
import { t } from "./trpc";
import getLogger from "@/logger";

const logger = getLogger("trpc/router");

export const appRouter = t.router({
  pages: pagesRouter,
  navigator: navigatorRouter,
});

export type AppRouter = typeof appRouter;
