import patch from "textdiff-patch";
import { z } from "zod";
import { initTRPC, TRPCError } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import StorageService from "../services/StorageService";
import { Workspace } from "../lib";
import { PageService } from "../services/PageService";
import { WorkspaceService } from "../services/WorkspaceService";

export type Context = {
  workspace?: string;
};

export const t = initTRPC.context<Context>().create();

const storage = await StorageService.create("./.workspaces");
const pageService = new PageService(storage);
const workspaceService = new WorkspaceService(storage);

export const createContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions): Context => ({});

// Corresponds to {Change} type in textdiff-patch package
const zChange = z.array(
  z.union([
    z.tuple([z.literal(1), z.string()]),
    z.tuple([z.literal(0), z.number()]),
    z.tuple([z.literal(-1), z.number()]),
  ])
);

const publicProcedure = t.procedure;

const workspacedProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;
  if (!ctx.workspace) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return opts.next({
    ctx: {
      workspace: ctx.workspace,
    },
  });
});

const pagesRouter = t.router({
  list: workspacedProcedure.query(async (opts) => {
    console.log("LIST", opts);

    return await storage.listPages();
  }),
  create: workspacedProcedure
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
  delete: workspacedProcedure.input(z.string()).query((opts) => {
    return storage.deletePage(opts.input);
  }),
  load: workspacedProcedure.input(z.string()).query((opts) => {
    return storage.loadPage(opts.input);
  }),
  edit: workspacedProcedure
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

const workspaceRouter = t.router({
  pages: pagesRouter,
});

export const appRouter = t.router({
  getWorkspaces: publicProcedure.query((opts) => {
    return workspaceService.getAll();
  }),
  loadWorkspace: publicProcedure.input(z.string()).query(async (opts) => {
    opts.ctx.workspace = opts.input;
  }),
  workspace: workspaceRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
