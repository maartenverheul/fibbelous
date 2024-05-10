import { default as realfs } from "fs";
import __dirname from "@/dirname";
import { Volume, vol } from "memfs";
import * as snapshot from "memfs/lib/snapshot";
import { GitAuth } from "isomorphic-git";
import { GitClient } from "@/modules/GitClient";
import path from "path";
import getLogger from "@/logger";
import environment from "@/environment";

const logger = getLogger("StorageService");

export default class StorageService {
  public volume: typeof vol;

  private readonly localRepoDir = path.join(__dirname, "../.data");
  private readonly git: GitClient;

  constructor() {
    this.volume = new Volume();

    this.git = new GitClient(this.volume as any, "/");
  }

  private onGitAuth(url?: string, auth?: GitAuth) {
    return {
      username: environment.username,
      password: environment.password,
    };
  }

  async init() {
    if (environment.dev && realfs.existsSync(this.localRepoDir)) {
      logger.info("Restoring from physical fs...");
      this.fromPhysical();
    } else {
      logger.info("Cloning repository...");
      await this.git.clone({
        url: environment.repository,
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

  fromPhysical() {
    const snap = snapshot.toSnapshotSync({
      fs: realfs as any,
      path: this.localRepoDir,
    });

    snapshot.fromSnapshotSync(snap, { fs: this.volume, path: "/" });
  }
  toPhysical() {
    const snap = snapshot.toSnapshotSync({
      fs: this.volume,
      path: "/",
    }) as any;

    // Saving the git folder may not be permitted
    snap[2][".git"] = undefined;

    snapshot.fromSnapshotSync(snap, { fs: realfs as any, path: this.localRepoDir });
  }
}

export let storageService: StorageService = new StorageService();
