import { FileHandle } from "fs/promises";
import { Change } from "textdiff-patch";
import z from "zod";

export type PageMeta = {
  id: string;
  icon?: string;
  created: number;
  title: string;
  parent: string | null;
  children?: PageMeta[];
};

export const pageMetaSchema: z.ZodType<PageMeta> = z.object({
  id: z.string(),
  icon: z.string().optional(),
  created: z.number(),
  title: z.string(),
  parent: z.string().nullable(),
  children: z.array(z.lazy(() => pageMetaSchema)).optional(),
});

export type PageTree = PageMeta[];

export const pageTreeSchema: z.ZodType<PageTree> = z.array(pageMetaSchema);

export type Page = PageMeta & {
  content: string;
};

export const pageSchema: z.ZodType<Page> = pageMetaSchema.and(
  z.object({
    content: z.string(),
  })
);

export const pageContentChangeSchema: z.ZodType<Change> = z.union([
  z.tuple([z.literal(-1), z.number()]),
  z.tuple([z.literal(0), z.number()]),
  z.tuple([z.literal(1), z.string()]),
]);

export const pageContentChangesSchema: z.ZodType<Change[]> = z.array(pageContentChangeSchema);

export const pageContentSaveChangesSchema = z.object({
  pageId: z.string(),
  change: pageContentChangesSchema,
  originalHash: z.string(),
});
