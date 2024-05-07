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

type t = z.infer<typeof pageMetaSchema>;

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
