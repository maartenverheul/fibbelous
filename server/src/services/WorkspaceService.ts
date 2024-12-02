import { Workspace } from "../lib";
import StorageService from "./StorageService";

export class WorkspaceService {
  constructor(private readonly storage: StorageService) {}

  async getAll(): Promise<Workspace[]> {
    return [
      {
        id: "workspace-1",
        name: "Workspace 1",
      },
    ];
  }
}
