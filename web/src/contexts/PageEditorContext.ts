import { createContext } from "react";
import { Page, PageMeta } from "@fibbelous/server/models";
import { SyncStatus } from "@/types/sync";

export type PageEditorContextType = {
  open(page: PageMeta): Promise<any>;
  openPage: Page | undefined;
  syncStatus: SyncStatus;
};

export const PageEditorContext = createContext<PageEditorContextType>(null!);
