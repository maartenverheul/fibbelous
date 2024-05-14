import __dirname from "@/dirname";
import { globbySync } from "globby";
import type { ReaddirSynchronousMethod } from "@nodelib/fs.scandir";
import { Page, PageMeta } from "@/models";
import matter from "gray-matter";
import { storageService } from "./StorageService";
import mitt from "mitt";
import getLogger from "@/logger";
import path from "path";
import slugify from "slugify";
import createId from "@/utils/uid";

const logger = getLogger("PageService");

type Events = {
  pageAdded: Page;
  pageRemoved: string;
  pageUpdated: PageMeta;
};

export default class PageService {
  public readonly events = mitt<Events>();

  private parseFrontmatterData(pageFilePath: string, data: matter.GrayMatterFile<string>): Page {
    const page: Page = {
      id: data.data.id,
      content: data.content,
      created: new Date(data.data.created).valueOf(),
      title: data.data.title,
      icon: data.data.icon,
      parent: pageFilePath.split("/").at(-2) ?? null,
    };

    if (page.parent == "pages") page.parent = null;

    return page;
  }

  async init() {
    await this.getAll();
  }

  getAll(): Page[] {
    const allPageFiles = globbySync("/pages/**/*\\.mdx", {
      absolute: true,

      fs: {
        readdirSync: ((filepath, options) =>
          storageService.volume.readdirSync(filepath, options)) as ReaddirSynchronousMethod,
      },
    });

    // Process each file
    const result = allPageFiles.map((pageFilePath: string) => {
      const strData = storageService.volume.readFileSync(pageFilePath, {
        encoding: "utf-8",
      }) as string;

      const matterData = matter(strData);
      return this.parseFrontmatterData(pageFilePath, matterData);
    });

    return result;
  }

  toRecord(list: Page[]): Record<string, Page> {
    return list.reduce((a, v) => ({ ...a, [v.id]: v }), {});
  }

  getPageFileName(page: Page) {
    const slug = slugify(page.title, {
      lower: true,
    });
    return `${slug}-${page.id}.mdx`;
  }

  getAncestors(page: Page): Page[] {
    let output = [];
    const pagesDict = this.toRecord(this.getAll());

    output.push(page);
    let current: Page = page;

    while (current.parent != null) {
      const parent = pagesDict[current.parent];
      output.push(parent);
      current = parent;
    }

    return output.toReversed();
  }

  getFilePath(page: Page) {
    const ancestors = this.getAncestors(page);
    const folders = ancestors.slice(0, -1).map((page) => page.id);

    return path.join("/pages/", ...folders, this.getPageFileName(page));
  }

  find(id: string | undefined): Page | undefined {
    if (id == undefined) return undefined;
    const pages = pageService.getAll();
    return pages.find((page) => page.id == id);
  }

  save(page: Page): void {
    const filePath = this.getFilePath(page);

    storageService.volume.mkdirSync(path.dirname(filePath), { recursive: true });

    const data: Record<string, any> = {
      id: page.id,
      title: page.title,
      created: page.created,
    };
    if (page.icon) data.icon = page.icon;

    const content = matter.stringify(page.content, data, {
      language: "yaml",
    });

    storageService.volume.writeFileSync(filePath, content, { encoding: "utf-8" });

    storageService.toPhysical();
  }

  create(page: Page): Page {
    logger.info("Creating new page");
    page.id = createId();
    this.save(page);

    this.events.emit("pageAdded", page);
    return page;
  }

  createEmpty(page: PageMeta): Page {
    const newPage: Page = {
      ...page,
      title: "New Page",
      content: "# New Page",
    };
    return this.create(newPage);
  }

  update(updatedPage: Partial<Page>): Page {
    if (!updatedPage.id) throw new Error("Id is missing in object");
    logger.info(`Updating page ${updatedPage.id}`);

    const page = this.find(updatedPage.id);
    if (!page) throw new PageNotFoundError(updatedPage.id);

    Object.assign(page, updatedPage);

    this.save(page);
    this.events.emit("pageUpdated", page);
    return page;
  }

  delete(id: string): void {
    const page = this.find(id);
    if (!page) throw new PageNotFoundError(id);
    const filePath = this.getFilePath(page);
    storageService.volume.rmSync(filePath), storageService.toPhysical();
    this.events.emit("pageRemoved", id);
  }
}

export const pageService = new PageService();

export class PageNotFoundError extends Error {
  constructor(id: string) {
    super(`Page "${id}" does not exist`);
  }
}
