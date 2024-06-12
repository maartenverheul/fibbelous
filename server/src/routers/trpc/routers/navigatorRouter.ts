import z from "zod";
import { NavigatorChangeEvent, Page, PageMeta, pageContentSaveChangesSchema, pageMetaSchema } from "@/models";
import { observable } from "@trpc/server/observable";
import { pageService } from "@/services/PageService.js";
import { t } from "../trpc";
import getLogger from "@/logger";

const logger = getLogger("trpc/routers/navigatorRouter");

const navigatorRouter = t.router({
  getList: t.procedure.query<PageMeta[]>(async ({ ctx }) => {
    return pageService.getAll();
  }),

  onChange: t.procedure.subscription(() => {
    return observable<NavigatorChangeEvent>((emit) => {
      const triggerAdded = (pages: PageMeta[]) => emit.next({ added: pages });
      const triggerUpdated = (pages: PageMeta[]) => emit.next({ updated: pages });
      const triggerDeleted = (ids: string[]) => emit.next({ deleted: ids });

      pageService.events.on("pagesAdded", triggerAdded);
      pageService.events.on("pagesUpdated", triggerUpdated);
      pageService.events.on("pagesDeleted", triggerDeleted);
      return () => {
        pageService.events.off("pagesAdded", triggerAdded);
        pageService.events.off("pagesUpdated", triggerUpdated);
        pageService.events.off("pagesDeleted", triggerDeleted);
      };
    });
  }),
});

export default navigatorRouter;
