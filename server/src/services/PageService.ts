import fs from "fs";
import __dirname from "@/dirname";
import { globby } from "globby";
import { Page, PageMeta } from "@/models";
import matter from "gray-matter";
import { storageService } from "./StorageService";
import mitt from "mitt";
import getLogger from "@/logger";
import path from "path";
import slugify from "slugify";
import createId from "@/utils/uid";
import normalizePath from "normalize-path";
import { FileHandle } from "fs/promises";

const logger = getLogger("PageService");

type Events = {
  pagesAdded: PageMeta[];
  pagesUpdated: PageMeta[];
  pagesDeleted: string[];
};

const opLogger = getLogger("OpenPage");
export class OpenPage implements Disposable {
  private static openedPages: Record<string, OpenPage> = {};

  static isInUse(...ids: string[]): boolean {
    if (ids.length == 0) return false;
    if (ids.length == 1) return ids[0] in OpenPage.openedPages;
    return Object.keys(OpenPage.openedPages).some((id) => ids.includes(id));
  }

  [Symbol.dispose](): void {
    delete OpenPage.openedPages[this.page.id];
    this.fileHandle.close();
    opLogger.info(`Closed page. (${Object.keys(OpenPage.openedPages).length})`);
  }

  constructor(public readonly page: Page, private readonly fileHandle: FileHandle) {
    OpenPage.openedPages[this.page.id] = this;
    opLogger.info(`Opened page. (${Object.keys(OpenPage.openedPages).length})`);
  }
}

export default class PageService {
  public readonly events = mitt<Events>();

  private pages: Record<string, Page> = {};

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

  private async loadAll(): Promise<void> {
    logger.info("Reading all pages from fs..");
    const pagesQuery = normalizePath(path.posix.join(storageService.localRepoDir, "/pages/**/*.mdx"));

    const allPageFiles = await globby(pagesQuery, {
      absolute: true,
    });

    // Process each file
    const list = allPageFiles.map((pageFilePath: string) => {
      const strData = fs.readFileSync(pageFilePath, {
        encoding: "utf-8",
      }) as string;

      const matterData = matter(strData);
      return this.parseFrontmatterData(pageFilePath, matterData);
    });

    const dict = Object.fromEntries(list.map((page) => [page.id, page]));

    this.pages = dict;

    logger.info(`Loaded ${list.length} pages.`);
  }

  private static getPageFileName(page: PageMeta) {
    const slug = slugify(page.title, {
      lower: true,
    });
    return `${slug}-${page.id}.mdx`;
  }

  private getAncestors(page: PageMeta): Page[] {
    let output = [];

    let current: PageMeta = page;

    while (current.parent != null) {
      const parent = this.pages[current.parent];
      output.push(parent);
      current = parent;
    }

    return output.toReversed();
  }

  private isChildOf(page: PageMeta, parent: PageMeta): boolean {
    return this.getAncestors(page).some((p) => p.id == parent.id);
  }

  private getChildren(page: PageMeta): Page[] {
    return this.getAll().filter((p) => this.isChildOf(p, page));
  }

  async init() {
    await this.loadAll();
  }

  getAll(): Page[] {
    return Object.values(this.pages);
  }

  getFilePath(page: PageMeta) {
    const ancestors = this.getAncestors(page);
    const folders = ancestors.map((page) => page.id);

    return path.join(storageService.localRepoDir, "/pages/", ...folders, PageService.getPageFileName(page));
  }

  getSubDirPath(page: PageMeta) {
    const ancestors = this.getAncestors(page);
    const folders = ancestors.map((page) => page.id);

    return path.join(storageService.localRepoDir, "/pages/", ...folders, page.id);
  }

  find(id: string): Page | undefined {
    const pages = pageService.getAll();
    return pages.find((page) => page.id == id);
  }

  save(page: Page): void {
    const filePath = this.getFilePath(page);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const data: Record<string, any> = {
      id: page.id,
      title: page.title,
      created: page.created,
    };
    if (page.icon) data.icon = page.icon;

    const content = matter.stringify(page.content, data, {
      language: "yaml",
    });

    fs.writeFileSync(filePath, content, { encoding: "utf-8" });

    this.pages[page.id] = page;
  }

  create(page: Page): Page {
    logger.info("Creating new page");
    page.id = createId();
    this.save(page);

    this.events.emit("pagesAdded", [page]);
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
    this.events.emit("pagesUpdated", [page]);
    return page;
  }

  async delete(id: string): Promise<void> {
    const page = this.find(id);
    if (!page) throw new PageNotFoundError(id);

    // Get required data
    const filePath = this.getFilePath(page);
    const subdirPath = this.getSubDirPath(page);
    const subPages = this.getChildren(page).map((p) => p.id);

    const anyInUse = OpenPage.isInUse(id, ...subPages);
    if (anyInUse) throw new PageLockedError(id);

    logger.info(`Deleting page ${id} and ${subPages.length} sub pages.`);

    // Remove the page itself
    fs.promises.rm(filePath);
    // Remove the sub directory
    fs.promises.rm(subdirPath, { recursive: true, force: true });

    // Update memory
    delete this.pages[id];
    for (const subPageId of subPages) {
      delete this.pages[subPageId];
    }
    // Emit event
    this.events.emit("pagesDeleted", [id, ...subPages]);
  }

  async open(id: string): Promise<OpenPage> {
    const file = this.find(id);
    if (!file) throw new PageNotFoundError(id);
    const filePath = this.getFilePath(file);
    const fileHandle = await fs.promises.open(filePath, "r+");
    const openPage = new OpenPage(file, fileHandle);
    return openPage;
  }
}

export const pageService = new PageService();

export class PageNotFoundError extends Error {
  constructor(id: string) {
    super(`Page "${id}" does not exist`);
  }
}
export class PageLockedError extends Error {
  constructor(id: string) {
    super(`Page "${id}" or any of it's subpages is in use and cannot be modified.`);
  }
}
