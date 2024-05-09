// import fs from "fs";
import __dirname from "@/dirname";
import { globbySync } from "globby";
import type { ReaddirSynchronousMethod } from "@nodelib/fs.scandir";
import { Page } from "@/models";
import matter from "gray-matter";
import { storageService } from "./StorageService";

export default class PageService {
  private parseFrontmatterData(
    pageFilePath: string,
    data: matter.GrayMatterFile<string>
  ): Page {
    return {
      id: pageFilePath.match(/(?:-)[a-z0-9]{8}/g)?.[0].substring(1) ?? "",
      content: data.content,
      created: new Date(data.data.created).valueOf(),
      title: data.data.title,
      icon: data.data.icon,
      parent:
        pageFilePath
          .match(/(?:\/)[a-z0-9]{8}/g)
          ?.at(-1)
          ?.substring(1) ?? null,
    };
  }

  async init() {
    await this.getAll();
  }

  async getAll(): Promise<Page[]> {
    const allPageFiles = globbySync("/pages/**/*\\.mdx", {
      absolute: true,

      fs: {
        readdirSync: ((filepath, options) =>
          storageService.volume.readdirSync(
            filepath,
            options
          )) as ReaddirSynchronousMethod,
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

  async find(id: string) {
    const pages = await pageService.getAll();
    return pages.find((page) => page.id == id);
  }

  save(newPage: Page) {
    throw new Error("Method not implemented.");
  }
}

export const pageService = new PageService();
