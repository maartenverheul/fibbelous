export type PageTree = PageMeta[];

export type PageMeta = {
  id: string;
  icon?: string;
  created: number;
  title: string;
  parent: string | null;
  children?: PageMeta[];
};

export type Page = PageMeta & {
  content?: string;
};
