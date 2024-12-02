import { Page, Workspace } from "../lib";
import StorageService from "./StorageService";

export class PageService {
  constructor(private readonly storage: StorageService) {}

  async getAll(workspace: Workspace): Promise<Page[]> {
    return [];
  }
}
