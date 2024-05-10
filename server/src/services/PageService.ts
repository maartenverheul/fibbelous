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
  pageMetaChanged: Page;
  pageRemoved: string;
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

  async getAll(): Promise<Page[]> {
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

  async getAncestors(page: Page): Promise<Page[]> {
    let output = [];
    const pagesDict = this.toRecord(await this.getAll());

    output.push(page);
    let current: Page = page;

    while (current.parent != null) {
      const parent = pagesDict[current.parent];
      output.push(parent);
      current = parent;
    }

    return output.toReversed();
  }

  async find(id: string | null): Promise<Page | undefined> {
    if (id == null) return undefined;
    const pages = await pageService.getAll();
    return pages.find((page) => page.id == id);
  }

  async save(page: Page) {
    const ancestors = await this.getAncestors(page);
    const folders = ancestors.slice(0, -1).map((page) => page.id);

    const fileDir = path.join("/pages/", ...folders);
    const filePath = path.join(fileDir, this.getPageFileName(page));

    await storageService.volume.promises.mkdir(fileDir, { recursive: true });

    const data: Record<string, any> = {
      id: page.id,
      title: page.title,
      created: page.created,
    };
    if (page.icon) data.icon = page.icon;

    const content = matter.stringify(page.content, data, {
      language: "yaml",
    });

    await storageService.volume.promises.writeFile(filePath, content, { encoding: "utf-8" });

    storageService.toPhysical();
  }

  async create(page: Page) {
    logger.info("Creating new page");
    page.id = createId();
    await this.save(page);

    this.events.emit("pageAdded", page);
  }

  async createEmpty(page: PageMeta) {
    const newPage: Page = {
      ...page,
      title: "New Page",
      content: "# New Page",
    };
    return this.create(newPage);
  }

  delete(id: string) {
    this.events.emit("pageRemoved", id);
  }
}

export const pageService = new PageService();
