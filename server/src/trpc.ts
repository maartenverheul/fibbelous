import patch, { Change } from "textdiff-patch";
import { z } from "zod";
import { initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import { Page } from "./lib/Page";
import StorageService from "./services/StorageService";

export const t = initTRPC.create();

const storage = await StorageService.create("./.data");

export const createContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => ({}); // no context
export type Context = Awaited<ReturnType<typeof createContext>>;

// Corresponds to {Change} type in textdiff-patch package
const zChange = z.array(
  z.union([
    z.tuple([z.literal(1), z.string()]),
    z.tuple([z.literal(0), z.number()]),
    z.tuple([z.literal(-1), z.number()]),
  ])
);

const pagesRouter = t.router({
  list: t.procedure.query(async (opts) => {
    return await storage.listPages();
  }),
  create: t.procedure
    .input(
      z.object({
        title: z.string().optional(),
      })
    )
    .query(async (opts) => {
      const title = opts.input.title ?? "New page";
      const page = await storage.createPage(title);
      return page;
    }),
  delete: t.procedure.input(z.string()).query((opts) => {
    return storage.deletePage(opts.input);
  }),
  load: t.procedure.input(z.string()).query((opts) => {
    return storage.loadPage(opts.input);
  }),
  edit: t.procedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
        diff: zChange.optional(),
      })
    )
    .mutation(async (opts) => {
      const page = await storage.loadPage(opts.input.id);
      if (!page) throw new Error("Page not found");
      if (opts.input.title) page.title = opts.input.title;
      if (opts.input.content) {
        page.content = opts.input.content;
      } else if (opts.input.diff) {
        // Diff
        const newContent = patch(page.content, opts.input.diff);
        page.content = newContent;
      }
      return storage.updatePage(page);
    }),
});

export const appRouter = t.router({
  pages: pagesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
