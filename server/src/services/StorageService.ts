import git from "isomorphic-git";
import fs from "fs";
import path from "path";

export default class StorageService {
  public readonly root: string;
  public readonly settingsFile: string;
  public readonly pagesFolder: string;

  constructor(location: string) {
    this.root = path.resolve(location);
    console.log(`Using repository at ${this.root}`);

    this.settingsFile = path.join(this.root, "fibbelous.json");
    this.pagesFolder = path.join(this.root, "pages");

    this.ensureInit();
  }

  private repoExisits() {
    return fs.existsSync(path.join(this.root, ".git"));
  }

  private ensureInit() {
    if (!this.repoExisits()) this.initRepository();
    else console.log(`Repository already exists.`);
    return true;
  }

  private initRepository() {
    console.log(`Does not exist yet, initalizing repository..`);
    fs.mkdirSync(this.root, { recursive: true });

    git.init({ fs, dir: this.root });

    fs.writeFileSync(this.settingsFile, "{}", {
      encoding: "utf8",
    });

    fs.mkdirSync(this.pagesFolder, { recursive: true });
  }

  pageExists(id: string) {
    return fs.existsSync(path.join(this.pagesFolder, `${id}.mdx`));
  }

  async createPage(id: string) {
    if (this.pageExists(id)) throw new Error(`Page ${id} already exists`);
    const file = path.join(this.pagesFolder, `${id}.mdx`);
    return fs.promises.writeFile(file, `# ${id}\n\nThis is a new page`, {
      encoding: "utf8",
    });
  }

  async loadPage(id: string) {
    const file = path.join(this.pagesFolder, `${id}.mdx`);
    return fs.promises.readFile(file, { encoding: "utf8" });
  }
  async deletePage(id: string) {
    const file = path.join(this.pagesFolder, `${id}.mdx`);
    return fs.promises.rm(file);
  }

  async listPages() {
    return fs.promises
      .readdir(this.pagesFolder)
      .then((res) => res.map((file) => file.replace(/\.mdx$/, ""))); // Remove extensions
  }
}
