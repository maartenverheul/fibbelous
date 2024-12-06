import fs from "fs";
import { LoadedPage, Page, Workspace } from "../lib";
import StorageService from "./StorageService";
import { randomUUID } from "crypto";
import frontmatter from "frontmatter";
import path from "path";

export class PageService {
  private constructor(private readonly storage: StorageService) {}

  private cache: Record<string, Page> = {};

  public static async create(storage: StorageService) {
    const service = new PageService(storage);
    await service.init();
    return service;
  }

  private async init() {
    console.log("Initializing PageService");

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

    console.log(this.cache);
  }

  public getNamedPage(id: string, title: string): string {
    return path.join(
      this.storage.pagesFolder,
      StorageService.getNamedFile(id, title, "mdx")
    );
  }

  async getAll(workspace: Workspace): Promise<Page[]> {
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
    return page;
  }

  async get(workspace: Workspace, id: string): Promise<LoadedPage> {
    const file = this.cache[id];
    const filename = this.getNamedPage(id, file.title);
    const content = await fs.promises.readFile(filename, { encoding: "utf8" });
    const { data } = frontmatter(content);
    const page: LoadedPage = {
      id: data.id,
      slug: data.slug,
      title: data.title,
      content,
      createdAt: data.createdAt,
      modifiedAt: data.modifiedAt,
    };
    return page;
  }

  async update(workspace: Workspace, page: LoadedPage): Promise<Page> {
    const oldFile = await this.get(workspace, page.id);
    if (!oldFile) throw new Error(`Page ${page.id} does not exists`);

    const newFilename = this.getNamedPage(page.id, page.title);
    await fs.promises.writeFile(newFilename, page.content, {
      encoding: "utf8",
    });

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

    // Update cache
    delete this.cache[id];
  }
}
