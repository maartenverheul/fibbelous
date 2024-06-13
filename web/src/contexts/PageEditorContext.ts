import { createContext } from "react";
import { Page, PageMeta } from "@fibbelous/server/models";
import { SyncStatus } from "@/types/sync";
import { Change } from "textdiff-create";

export type PageEditorContextType = {
  open(pageId: string): Promise<void>;
  openPage: Page | undefined;
  syncStatus: SyncStatus;
  makeChange(change: Change[]): void;
  changes: Change[][];
  update(page: PageMeta): Promise<void>;
};

export const PageEditorContext = createContext<PageEditorContextType>(null!);
