import z from "zod";
import { Page, PageMeta, pageContentSaveChangesSchema, pageMetaSchema } from "@/models";
import { observable } from "@trpc/server/observable";
import { TRPCError } from "@trpc/server";
import { OpenPage, PageLockedError, PageNotFoundError, pageService } from "@/services/PageService.js";
import { t } from "../trpc";
import getLogger from "@/logger";
import { TRPCPageLockedError, TRPCPageNotFoundError, TRPCServerError } from "../errors";

const logger = getLogger("trpc/routers/pagesRouter");

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
    return pageService.delete(input).catch((e) => {
      if (e instanceof PageNotFoundError) throw new TRPCPageNotFoundError();
      if (e instanceof PageLockedError) throw new TRPCPageLockedError();
      throw new TRPCServerError();
    });
  }),

  open: t.procedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation<Page>(async ({ input, ctx }) => {
      if (ctx.openPage) {
        if (input.id === ctx.openPage.page.id) {
          throw new TRPCError({
            message: "Requested page is already open",
            code: "BAD_REQUEST",
          });
        }

        logger.info(`Session ${ctx.id} has closed page ${ctx.openPage.page.id}`);
        ctx.openPage[Symbol.dispose]();
        ctx.openPage = undefined;
      }
      let openPage: OpenPage;

      try {
        openPage = await pageService.open(input.id);
      } catch (e) {
        if (e instanceof PageNotFoundError) throw new TRPCPageNotFoundError();
        else if (e instanceof TRPCPageLockedError) throw new TRPCPageLockedError();
        else throw new TRPCServerError();
      }

      logger.info(`Session ${ctx.id} has opened page ${openPage.page.id}`);
      ctx.openPage = openPage;
      return openPage.page;
    }),

  close: t.procedure.mutation(async ({ ctx }) => {
    if (!ctx.openPage) return;
    ctx.openPage[Symbol.dispose]();
    ctx.openPage = undefined;
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
