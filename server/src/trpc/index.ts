import patch from "textdiff-patch";
import { z } from "zod";
import EventEmitter from "events";
import { initTRPC, TRPCError } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import StorageService from "../services/StorageService";
import { PageService } from "../services/PageService";
import { WorkspaceService } from "../services/WorkspaceService";
import { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";
import { observable } from "@trpc/server/observable";
import { Page, Workspace } from "../lib";

export type Context = {
  workspace?: Workspace;
};

export const t = initTRPC.context<Context>().create();

const storage = await StorageService.create("./.workspaces");
const pageService = await PageService.create(storage);
const workspaceService = new WorkspaceService(storage);

export const createHttpContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions): Context => ({});

export const createWsContext = (
  opts: CreateWSSContextFnOptions
): Context => ({});

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

const ee = new EventEmitter();

const pagesRouter = t.router({
  onAdd: workspacedProcedure.subscription((opts) => {
    return observable<Page>((emit) => {
      const fn = (data: Page) => emit.next(data);
      ee.on("add", fn);
      return () => ee.off("add", fn);
    });
  }),
  onDelete: workspacedProcedure.subscription((opts) => {
    return observable<string>((emit) => {
      const fn = (data: string) => emit.next(data);
      ee.on("delete", fn);
      return () => ee.off("delete", fn);
    });
  }),
  list: workspacedProcedure.query((opts) => {
    return pageService.getAll(opts.ctx.workspace);
  }),
  create: workspacedProcedure
    .input(
      z.object({
        title: z.string().optional(),
      })
    )
    .query(async (opts) => {
      const title = opts.input.title ?? "New page";
      const page = await pageService.create(title);
      ee.emit("add", page);
      return page;
    }),
  delete: workspacedProcedure.input(z.string()).query(async (opts) => {
    await pageService.delete(opts.input);
    ee.emit("delete", opts.input);
  }),
  load: workspacedProcedure.input(z.string()).query((opts) => {
    return pageService.get(opts.ctx.workspace, opts.input);
  }),
  update: workspacedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
        diff: zChange.optional(),
      })
    )
    .mutation(async (opts) => {
      console.log("Updating page");

      const page = await pageService.get(opts.ctx.workspace, opts.input.id);
      if (!page) throw new Error("Page not found");
      if (opts.input.title) page.title = opts.input.title;
      if (opts.input.content) {
        page.content = opts.input.content;
      } else if (opts.input.diff) {
        // Diff
        const newContent = patch(page.content, opts.input.diff);
        page.content = newContent;
      }
      return pageService.update(opts.ctx.workspace, page);
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
    opts.ctx.workspace = {
      id: opts.input,
      name: "TODO Workspace name",
    };
  }),
  workspace: workspaceRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
