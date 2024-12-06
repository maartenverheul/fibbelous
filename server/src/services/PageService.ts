import fs from "fs";
import { LoadedPage, Page, Workspace } from "../lib";
import StorageService from "./StorageService";
import { randomUUID } from "crypto";
import frontmatter from "frontmatter";
import path from "path";
import { getLogger } from "../logger";

const logger = getLogger("PageService");

export class PageService {
  private constructor(private readonly storage: StorageService) {}

  private cache: Record<string, Page> = {};

  public static async create(storage: StorageService) {
    const service = new PageService(storage);
    await service.init();
    return service;
  }

  private async init() {
    logger.info("Initializing PageService");

    const files = await fs.promises.readdir(this.storage.pagesFolder);

    const proms = files.map((filename) => {
      const file = path.join(this.storage.pagesFolder, filename);
      return fs.promises
        .readFile(file, { encoding: "utf8" })
        .then((content) => frontmatter(content))
        .then((frontmatterData) => ({ filename, ...frontmatterData.data }))
        .then(
          (data) =>
            ({
              id: data.id,
              title: data.title,
              slug: data.slug,
              createdAt: data.createdAt,
              modifiedAt: data.modifiedAt,
              deletedAt: data.deletedAt,
            } satisfies Page)
        );
    });

    const result = await Promise.all(proms);

    // Set this.cache to mapped result of id -> page
    this.cache = result.reduce<Record<string, Page>>((acc, page) => {
      acc[page.id] = page;
      return acc;
    }, {});
  }

  private getFrontmatterData() {
    return frontmatter(content, { data: data }) + content;
  }
  private setFrontmatterData(content: string, data: Page) {
    return frontmatter(content, { data: data }) + content;
  }

  public getNamedPage(id: string, title: string): string {
    return path.join(
      this.storage.pagesFolder,
      StorageService.getNamedFile(id, title, "mdx")
    );
  }

  async get(workspace: Workspace, id: string): Promise<LoadedPage> {
    logger.debug(`Retrieving page ${id}`);

    const file = this.cache[id];
    const filename = this.getNamedPage(id, file.title);
    const fileContent = await fs.promises.readFile(filename, {
      encoding: "utf8",
    });
    const { data, content } = frontmatter(fileContent);
    const page: LoadedPage = {
      id: data.id,
      slug: data.slug,
      title: data.title,
      createdAt: data.createdAt,
      modifiedAt: data.modifiedAt,
      content,
    };

    return page;
  }

  async getAll(workspace: Workspace): Promise<Page[]> {
    logger.debug("Getting all pages");
    return Object.values(this.cache);
  }

  async create(title: string): Promise<Page> {
    const now = new Date().toISOString();
    const id = randomUUID().split("-")[0];
    const slug = title.toLowerCase().replace(/\s/g, "-");
    const page: LoadedPage = {
      id: id,
      title,
      slug: slug,
      content: `---
id: ${id}
slug: ${slug}
title: ${title}
createdAt: ${now}
modifiedAt: ${now}
---
# ${title}\n\nThis is a new page`,
      createdAt: now,
      modifiedAt: now,
    };
    const filename = StorageService.getNamedFile(id, title, "mdx");
    const file = path.join(this.storage.pagesFolder, filename);
    await fs.promises.writeFile(file, page.content, {
      encoding: "utf8",
    });
    const { content, ...partialPage } = page;
    this.cache[id] = partialPage;

    logger.info(`Created page ${id} with title "${title}"`);

    return page;
  }

  async update(workspace: Workspace, page: LoadedPage): Promise<Page> {
    const oldPage = await this.get(workspace, page.id);

    const oldPageFile = this.getNamedPage(page.id, oldPage.title);
    const newFilename = this.getNamedPage(page.id, page.title);

    if (!oldPage) throw new Error(`Page ${page.id} does not exists`);
    if (oldPageFile !== newFilename) {
      fs.promises.rm(oldPageFile);
    }

    page.modifiedAt = new Date().toISOString();
    logger.info(`Updating page ${page.id} with title ${page.title}`);

    console.log(page.content);

    // await fs.promises.writeFile(newFilename, page.content, {
    //   encoding: "utf8",
    // });

    // Update cache
    const { content, ...partialPage } = page;
    this.cache[page.id] = partialPage;
    return page;
  }
  async delete(id: string): Promise<void> {
    const file = this.cache[id];
    if (!file) throw new Error(`Page ${id} does not exists`);
    const filename = this.getNamedPage(id, file.title);
    await fs.promises.rm(filename);

    logger.info(`Deleted page ${id}`);

    // Update cache
    delete this.cache[id];
  }
}
