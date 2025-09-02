import { Page, PageWithContent, WorkspaceInfo } from "@/models";

export default interface PageService {
  load(id: string): Promise<PageWithContent | null>;
  save(page: Page): Promise<void>;
  delete(id: string): Promise<void>;
}

export class LocalPageService implements PageService {
  load(id: string): Promise<PageWithContent | null> {
    throw new Error("Method not implemented.");
  }
  save(page: Page): Promise<void> {
    throw new Error("Method not implemented.");
  }
  delete(id: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

}

export class RemotePageService implements PageService {

  constructor(
    public readonly baseUrl: string,
    public readonly workspace: WorkspaceInfo
  ) { }

  async load(id: string): Promise<PageWithContent | null> {
    const response = await fetch(`${this.baseUrl}/api/workspace/${this.workspace.id}/pages/${id}`);
    if (!response.ok) return null;
    return response.json();
  }
  save(page: Page): Promise<void> {
    throw new Error("Method not implemented.");
  }
  delete(id: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
}