import fs from "fs";
import __dirname from "@/dirname";
import { GitAuth } from "isomorphic-git";
import { GitClient } from "@/modules/GitClient";
import path from "path";
import getLogger from "@/logger";
import environment from "@/environment";
import { FileHandle } from "fs/promises";

const logger = getLogger("StorageService");

export default class StorageService {
  public readonly localRepoDir = path.join(__dirname, "../.data");
  private git: GitClient = null!;

  private openFiles: Record<string, FileHandle> = {};

  private async openFile(relativePath: string) {
    const fileHandle = await fs.promises.open(path.join(this.localRepoDir, relativePath), "r+");
    this.openFiles[relativePath] = fileHandle;
  }

  private onGitAuth(url?: string, auth?: GitAuth) {
    return {
      username: environment.username,
      password: environment.password,
    };
  }

  async init() {
    logger.info(`Using data dir: ${this.localRepoDir}`);
    if (!fs.existsSync(this.localRepoDir)) {
      logger.info("Cloning repository...");
      await this.git.clone({
        url: environment.repository,
        onAuth: () => this.onGitAuth(),
      });
    }

    this.git = new GitClient(fs, "/");

    await this.git.setConfig({
      path: "user.name",
      value: `Fibbelous`,
      append: false,
    });

    await this.git
      .checkout({
        ref: "test",
      })
      .catch(() =>
        this.git.branch({
          ref: "test",
          checkout: true,
        })
      );

    // this.volume.writeFileSync(
    //   "/pages/test.mdx",
    //   `Hello ${Math.round(Math.random() * 1000)}`,
    //   {
    //     encoding: "utf-8",
    //   }
    // );

    // await this.git.add({
    //   filepath: "pages/test.mdx",
    // });

    // await this.git.commit({
    //   message: "Test",
    // });

    // await this.git.push({
    //   onAuth: () => this.onGitAuth(),
    // });

    logger.info("Done");
  }
}

export let storageService: StorageService = new StorageService();
