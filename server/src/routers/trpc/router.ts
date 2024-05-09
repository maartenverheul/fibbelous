import EventEmitter from "events";
import z from "zod";
import { t } from "./trpc";
import { Page, PageMeta, pageMetaSchema } from "@/models";
import { observable } from "@trpc/server/observable";
import { TRPCError } from "@trpc/server";
import { pageService } from "@/services/PageService";

const ee = new EventEmitter();

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
    const newPage: Page = {
      ...input,
      id: Math.round(Math.random() * 1000000).toString(16),
      title: "New Page",
      content: "# New Page",
    };
    pageService.save(newPage);

    console.log("Created new page");

    // Notify subscriptions
    ee.emit("addPage", newPage);
    return newPage;
  }),
  onPageAdd: t.procedure.subscription(() => {
    return observable<Page>((emit) => {
      const onAdd = (data: Page) => {
        emit.next(data);
      };
      ee.on("addPage", onAdd);
      return () => ee.off("addPage", onAdd);
    });
  }),
});

export type AppRouter = typeof appRouter;
