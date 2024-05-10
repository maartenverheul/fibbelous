import EventEmitter from "events";
import z from "zod";
import { t } from "./trpc";
import { Page, PageMeta, pageMetaSchema } from "@/models";
import { observable } from "@trpc/server/observable";
import { TRPCError } from "@trpc/server";
import { pageService } from "@/services/PageService";
import getLogger from "@/logger";

const logger = getLogger("router");

export const appRouter = t.router({
  getPage: t.procedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query<Page>(async ({ input }) => {
      const target = await pageService.find(input.id);
      if (!target)
        throw new TRPCError({
          message: "Requested page does not exists",
          code: "BAD_REQUEST",
        });
      return target;
    }),

  getPages: t.procedure.query<PageMeta[]>(async () => {
    return pageService.getAll();
  }),

  createPage: t.procedure.input(pageMetaSchema).mutation(({ input }) => {
    return pageService.createEmpty(input);
  }),

  onPageAdd: t.procedure.subscription(() => {
    return observable<Page>((emit) => {
      const onAdd = (data: Page) => emit.next(data);

      pageService.events.on("pageAdded", onAdd);
      return () => pageService.events.off("pageAdded", onAdd);
    });
  }),
});

export type AppRouter = typeof appRouter;
