import dotenv from "dotenv";
dotenv.config();

import { default as realfs } from "fs";
import __dirname from "@/dirname";
import { Volume, vol } from "memfs";
import * as snapshot from "memfs/lib/snapshot";
import { GitAuth } from "isomorphic-git";
import { EnvironmentSettings } from "@/models/app";
import { GitClient } from "@/modules/GitClient";
import path from "path";
import getLogger from "@/logger";

const dev = process.env.NODE_ENV != "production";
const logger = getLogger("StorageService");

export default class StorageService {
  public volume: typeof vol;
  private settings: EnvironmentSettings;
  private git: GitClient;

  constructor() {
    this.volume = new Volume();

    if (!process.env.GIT_REPOSTORY) throw new Error("GIT_REPO evironment variable is missing.");

    this.settings = {
      repository: process.env.GIT_REPOSTORY,
      username: process.env.GIT_USERNAME,
      password: process.env.GIT_PASSWORD,
    };

    this.git = new GitClient(this.volume as any, "/");
  }

  private onGitAuth(url?: string, auth?: GitAuth) {
    return {
      username: this.settings.username,
      password: this.settings.password,
    };
  }

  async init() {
    const localRepoDir = path.join(__dirname, "../.data");
    if (dev && realfs.existsSync(localRepoDir)) {
      logger.info("Restoring from physical fs...");
      const snap = snapshot.toSnapshotSync({
        fs: realfs as any,
        path: localRepoDir,
      });

      snapshot.fromSnapshotSync(snap, { fs: this.volume, path: "/" });
    } else {
      logger.info("Cloning repository...");
      await this.git.clone({
        url: this.settings.repository,
        onAuth: () => this.onGitAuth(),
      });
    }

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
