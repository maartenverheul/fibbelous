import { createContext } from "react";
import { Page, PageMeta } from "@fibbelous/server/models";

export type PageEditorContextType = {
  open(page: PageMeta): Promise<any>;
  openPage: Page | undefined;
};

export const PageEditorContext = createContext<PageEditorContextType>(null!);
