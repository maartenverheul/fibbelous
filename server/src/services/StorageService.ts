import __dirname from "@/dirname";
import { DirectoryJSON, Volume, vol } from "memfs";

export default class StorageService {
  public volume: typeof vol;

  constructor() {
    const json: DirectoryJSON = {
      "./pages": null,
      "./databases": null,
      "./pages/page-1-849274a8.mdx": `---
id: 849274a8
title: Page 1
created: 2024-05-07T17:28:18.005Z
icon: 👍
---
# Page 1

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`,
      "./pages/849274a8/page-1-1-583a7667.mdx": `---
id: 583a7667
title: Page 1.1
created: 2024-05-07T17:28:33.015Z
icon: 😁
---
# Page 1.1

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`,
    };
    this.volume = Volume.fromJSON(json, "/");
  }

  async init() {}
}

export const storageService = new StorageService();
