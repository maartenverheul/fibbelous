import git from "isomorphic-git";
import fs from "fs";
import path from "path";
import { LoadedPage, Page } from "../lib";
import { randomUUID } from "node:crypto";
import slugify from "slugify";
import frontmatter from "frontmatter";

export default class StorageService {
  public readonly root: string;
  public readonly workspaceFile: string;
  public readonly pagesFolder: string;

  private constructor(location: string) {
    this.root = path.resolve(location);
    console.log(`Using repository at ${this.root}`);

    this.workspaceFile = path.join(this.root, "workspace.json");
    this.pagesFolder = path.join(this.root, "pages");
  }

  static async create(location: string) {
    const service = new StorageService(location);
    await service.init();
    return service;
  }

  public async init() {
    if (!this.repoExisits()) await this.initRepository();
    else console.log(`Repository already exists.`);
    return true;
  }

  private repoExisits() {
    const gitfolder = path.join(this.root, ".git");
    return fs.existsSync(gitfolder);
  }

  private async initRepository(): Promise<void> {
    console.log(`Does not exist yet, initalizing repository..`);
    fs.promises.mkdir(this.root, { recursive: true });

    await git.init({ fs, dir: this.root });
    await git.branch({ fs, dir: this.root, ref: "main", checkout: true });

    fs.promises.writeFile(this.workspaceFile, "{}", {
      encoding: "utf8",
    });

    fs.promises.mkdir(this.pagesFolder, { recursive: true });

    await git.add({
      fs,
      dir: this.root,
      filepath: path.relative(this.root, this.workspaceFile),
    });
    await git.commit({
      fs,
      dir: this.root,
      message: "Created workspace",
      author: { name: "Fibbelous" },
    });
  }

  private pageExists(id: string): boolean {
    return fs.existsSync(path.join(this.pagesFolder, `${id}.mdx`));
  }

  public static getNamedFile(id: string, title: string, extension: string) {
    title = title.toLowerCase().trim();
    const slug = slugify(title, {
      replacement: "-", // replace spaces with replacement character, defaults to `-`
      remove: undefined, // remove characters that match regex, defaults to `undefined`
      lower: false, // convert to lower case, defaults to `false`
      strict: false, // strip special characters except replacement, defaults to `false`
      locale: "vi", // language code of the locale to use
      trim: true, // trim leading and trailing replacement chars, defaults to `true`
    });
    return `${id}-${slug}.${extension}`;
  }

  async createPage(title: string): Promise<Page> {
    const now = new Date().toISOString();
    const id = randomUUID().split("-")[0];
    const page: Page = {
      id: id,
      title,
      content: `---
id: ${id}
title: ${title}
createdAt: ${now}
modifiedAt: ${now}
---
# ${title}\n\nThis is a new page`,
      createdAt: now,
      modifiedAt: now,
    };
    const filename = StorageService.getNamedFile(id, title, "mdx");
    const file = path.join(this.pagesFolder, filename);
    await fs.promises.writeFile(file, page.content, {
      encoding: "utf8",
    });
    return page;
  }

  async loadPage(id: string): Promise<LoadedPage> {
    const file = path.join(this.pagesFolder, `${id}.mdx`);
    const content = await fs.promises.readFile(file, { encoding: "utf8" });
    const { data, meta } = frontmatter(content);
    console.log(meta);
    const page: LoadedPage = {
      id: data.id,
      title: data.title,
      content,
      createdAt: data.createdAt,
      modifiedAt: data.modifiedAt,
    };
    return page;
  }
  async updatePage(page: Page): Promise<Page> {
    if (!this.pageExists(page.id))
      throw new Error(`Page ${page.id} does not exists`);
    const file = path.join(this.pagesFolder, `${page.id}.mdx`);
    await fs.promises.writeFile(file, page.content, { encoding: "utf8" });
    return page;
  }
  async deletePage(id: string): Promise<void> {
    const file = path.join(this.pagesFolder, `${id}.mdx`);
    if (!this.pageExists(id)) throw new Error(`Page ${id} does not exists`);
    return fs.promises.rm(file);
  }

  async listPages(): Promise<Page[]> {
    const files = await fs.promises
      .readdir(this.pagesFolder)
      .then((res) => res.map((file) => file.replace(/\.mdx$/, ""))); // Remove extensions

    return files.map(
      (id) =>
        ({
          id,
          title: "TODO",
          content: "TODO",
          createdAt: "TODO",
          modifiedAt: "TODO",
        } satisfies Page)
    );
  }
}
