import { createContext } from "react";
import { Page, PageMeta } from "@fibbelous/server/models";
import { SyncStatus } from "@/types/sync";
import { Change } from "textdiff-create";

export type PageEditorContextType = {
  open(page: PageMeta): Promise<void>;
  openPage: Page | undefined;
  syncStatus: SyncStatus;
  makeChange(change: Change[]): void;
  changes: Change[][];
};

export const PageEditorContext = createContext<PageEditorContextType>(null!);
