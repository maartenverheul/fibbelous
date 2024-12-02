import git from "isomorphic-git";
import fs from "fs";
import path from "path";
import slugify from "slugify";

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

  public static getFileSlug(title: string) {
    return slugify(title, {
      replacement: "-", // replace spaces with replacement character, defaults to `-`
      remove: undefined, // remove characters that match regex, defaults to `undefined`
      lower: false, // convert to lower case, defaults to `false`
      strict: false, // strip special characters except replacement, defaults to `false`
      locale: "vi", // language code of the locale to use
      trim: true, // trim leading and trailing replacement chars, defaults to `true`
    });
  }

  public static getNamedFile(id: string, title: string, extension: string) {
    title = title.toLowerCase().trim();
    const slug = this.getFileSlug(title);
    return `${id}-${slug}.${extension}`;
  }
}
