import z from "zod";
import { Page, PageMeta, pageContentSaveChangesSchema, pageMetaSchema } from "@/models";
import { observable } from "@trpc/server/observable";
import { PageLockedError, PageNotFoundError, pageService } from "@/services/PageService.js";
import { t } from "../trpc";
import getLogger from "@/logger";
import { TRPCPageLockedError, TRPCPageNotFoundError, TRPCServerError } from "../errors";

const pagesRouter = t.router({
  get: t.procedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query<Page>(({ input }) => {
      const target = pageService.find(input.id);
      if (!target) throw new TRPCPageNotFoundError();
      return target;
    }),

  getAll: t.procedure.query<PageMeta[]>(() => {
    return pageService.getAll();
  }),

  create: t.procedure.input(pageMetaSchema).mutation(({ input }) => {
    return pageService.createEmpty(input);
  }),

  update: t.procedure.input(pageMetaSchema).mutation(({ input }) => {
    return pageService.update(input);
  }),

  delete: t.procedure.input(z.string()).mutation(({ input }) => {
    return pageService.deletePageAndSubtree(input).catch((e) => {
      if (e instanceof PageNotFoundError) throw new TRPCPageNotFoundError();
      if (e instanceof PageLockedError) throw new TRPCPageLockedError();
      throw new TRPCServerError();
    });
  }),

  saveChange: t.procedure.input(pageContentSaveChangesSchema).mutation(({ input }) => {
    console.log(input);
    // TODO
    // - Hash original on the server
    // - Compare hashes to make sure that the changes are applied to the correct original
    // - Apply changes
    // - Save file
    return true;
  }),

  onAdd: t.procedure.subscription(() => {
    return observable<PageMeta[]>((emit) => {
      const onAdd = (data: PageMeta[]) => emit.next(data);

      pageService.events.on("pagesAdded", onAdd);
      return () => pageService.events.off("pagesAdded", onAdd);
    });
  }),
});

export default pagesRouter;
