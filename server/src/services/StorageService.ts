import fs from "fs";
import __dirname from "@/dirname";
import path from "path";
import { globby } from "globby";
import { Page } from "@/models";
import matter from "gray-matter";

export default class StorageService {
  public static readonly dataPath = path.join(__dirname, "../.data");
  public static readonly pagesPath = path.join(
    StorageService.dataPath,
    "pages/"
  );
  public static readonly databasesPath = path.join(
    StorageService.dataPath,
    "databases/"
  );

  private pages: Page[] = [];

  private parseFrontmatterData(
    pageFilePath: string,
    data: matter.GrayMatterFile<string>
  ): Page {
    return {
      id: pageFilePath.match(/(?:-)[a-z0-9]{8}/g)?.[0] ?? "",
      content: data.content,
      created: new Date(data.data.created).valueOf(),
      title: data.data.title,
      icon: data.data.icon,
      parent: null,
    };
  }

  async init() {
    await fs.promises.mkdir(StorageService.pagesPath, { recursive: true });
    await fs.promises.mkdir(StorageService.databasesPath, { recursive: true });

    await this.getAllPages();
  }

  async getAllPages(): Promise<Page[]> {
    if (this.pages.length) return this.pages;

    console.log("Reading all page files in data folder..");

    // Get list of all pages files in the data folder
    const allPages = await globby("**/*\\.mdx", {
      cwd: StorageService.pagesPath,
      absolute: true,
    });

    // Process each file async
    const allPagesDataPromises = allPages.map((pageFilePath) =>
      fs.promises
        .readFile(pageFilePath, { encoding: "utf-8" })
        .then((data) => matter(data))
        .then((frontmatter) =>
          this.parseFrontmatterData(pageFilePath, frontmatter)
        )
    );

    // Wait until all files are processed
    const allPagesData = await Promise.allSettled(allPagesDataPromises);

    // Map all promises to result list
    const result = allPagesData
      .filter((item) => item.status == "fulfilled")
      .map((pageContentPromise: any) => pageContentPromise.value);

    console.log("Reading all page files in data folder..DONE");

    this.pages = result;

    return result;
  }

  savePage(newPage: Page) {
    throw new Error("Method not implemented.");
  }
}

export const storageService = new StorageService();
