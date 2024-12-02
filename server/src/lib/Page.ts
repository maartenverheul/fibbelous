export type Page = {
  id: string;
  icon?: string;
  title: string;
  content: string;
  createdAt: string;
  modifiedAt: string;
  deletedAt?: string;
};

export type LoadedPage = Page & {
  content: string;
};
