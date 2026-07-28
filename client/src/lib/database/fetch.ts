import type {
  CreateDatabaseResult,
  DatabaseRowsPage,
  DatabaseViewLayout,
  DatabaseViewProperty,
  DatabaseViewSort,
  WorkspaceDatabaseDetail,
  WorkspaceDatabaseMeta,
} from "./types";
import type { WorkspacePageDetail } from "../page/types";

type DatabaseFetcher = (
  id: string,
) => Promise<WorkspaceDatabaseDetail | null>;

type DatabaseRowsFetcher = (
  id: string,
  options: {
    limit: number;
    offset: number;
    sort?: DatabaseViewSort | null;
  },
) => Promise<DatabaseRowsPage | null>;

type DatabaseRowCreator = (
  id: string,
  title?: string,
  templateId?: string,
) => Promise<WorkspacePageDetail>;

type DatabasesLister = () => Promise<WorkspaceDatabaseMeta[]>;

type DatabaseCreator = (options?: {
  title?: string;
  parentId?: string;
}) => Promise<CreateDatabaseResult>;

/** Partial view update. Omitted fields are unchanged; `sort: null` clears sort. */
export type DatabaseViewUpdate = {
  name?: string;
  layout?: DatabaseViewLayout;
  sort?: DatabaseViewSort | null;
  properties?: DatabaseViewProperty[];
};

export type CreateDatabaseViewInput = {
  name?: string;
  layout?: DatabaseViewLayout;
  copyFromViewId?: string;
};

export type CreateDatabaseViewResult = {
  database: WorkspaceDatabaseDetail;
  viewId: string;
};

export type CreateDatabaseTemplateResult = {
  database: WorkspaceDatabaseDetail;
  page: WorkspacePageDetail;
};

export type DuplicateDatabaseTemplateResult = {
  database: WorkspaceDatabaseDetail;
  page: WorkspacePageDetail;
};

export type UpdateDatabaseTemplateInput = {
  title?: string;
  icon?: string;
  body?: string;
  attributes?: Record<string, unknown>;
};

type DatabaseViewUpdater = (
  databaseId: string,
  viewId: string,
  update: DatabaseViewUpdate,
) => Promise<WorkspaceDatabaseDetail>;

type DatabaseViewCreator = (
  databaseId: string,
  input?: CreateDatabaseViewInput,
) => Promise<CreateDatabaseViewResult>;

type DatabaseViewDeleter = (
  databaseId: string,
  viewId: string,
) => Promise<WorkspaceDatabaseDetail>;

type DatabaseTemplateCreator = (
  databaseId: string,
) => Promise<CreateDatabaseTemplateResult>;

type DatabaseTemplateFetcher = (
  databaseId: string,
  templateId: string,
) => Promise<WorkspacePageDetail | null>;

type DatabaseTemplateUpdater = (
  databaseId: string,
  templateId: string,
  update: UpdateDatabaseTemplateInput,
) => Promise<WorkspacePageDetail>;

type DatabaseTemplateDuplicator = (
  databaseId: string,
  templateId: string,
) => Promise<DuplicateDatabaseTemplateResult>;

type DatabaseTemplateDeleter = (
  databaseId: string,
  templateId: string,
) => Promise<WorkspaceDatabaseDetail>;

type DatabaseDefaultTemplateSetter = (
  databaseId: string,
  templateId: string,
) => Promise<WorkspaceDatabaseDetail>;

let detailFetcher: DatabaseFetcher | null = null;
let rowsFetcher: DatabaseRowsFetcher | null = null;
let rowCreator: DatabaseRowCreator | null = null;
let viewUpdater: DatabaseViewUpdater | null = null;
let viewCreator: DatabaseViewCreator | null = null;
let viewDeleter: DatabaseViewDeleter | null = null;
let databasesLister: DatabasesLister | null = null;
let databaseCreator: DatabaseCreator | null = null;
let templateCreator: DatabaseTemplateCreator | null = null;
let templateFetcher: DatabaseTemplateFetcher | null = null;
let templateUpdater: DatabaseTemplateUpdater | null = null;
let templateDuplicator: DatabaseTemplateDuplicator | null = null;
let templateDeleter: DatabaseTemplateDeleter | null = null;
let defaultTemplateSetter: DatabaseDefaultTemplateSetter | null = null;

/** Wired from WorkspaceProvider so BlockNote DOM renders can load databases. */
export function registerDatabaseFetcher(next: DatabaseFetcher | null) {
  detailFetcher = next;
}

export function registerDatabaseRowsFetcher(next: DatabaseRowsFetcher | null) {
  rowsFetcher = next;
}

export function registerDatabaseRowCreator(next: DatabaseRowCreator | null) {
  rowCreator = next;
}

export function registerDatabaseViewUpdater(next: DatabaseViewUpdater | null) {
  viewUpdater = next;
}

export function registerDatabaseViewCreator(next: DatabaseViewCreator | null) {
  viewCreator = next;
}

export function registerDatabaseViewDeleter(next: DatabaseViewDeleter | null) {
  viewDeleter = next;
}

export function registerDatabasesLister(next: DatabasesLister | null) {
  databasesLister = next;
}

export function registerDatabaseCreator(next: DatabaseCreator | null) {
  databaseCreator = next;
}

export function registerDatabaseTemplateCreator(
  next: DatabaseTemplateCreator | null,
) {
  templateCreator = next;
}

export function registerDatabaseTemplateFetcher(
  next: DatabaseTemplateFetcher | null,
) {
  templateFetcher = next;
}

export function registerDatabaseTemplateUpdater(
  next: DatabaseTemplateUpdater | null,
) {
  templateUpdater = next;
}

export function registerDatabaseTemplateDuplicator(
  next: DatabaseTemplateDuplicator | null,
) {
  templateDuplicator = next;
}

export function registerDatabaseTemplateDeleter(
  next: DatabaseTemplateDeleter | null,
) {
  templateDeleter = next;
}

export function registerDatabaseDefaultTemplateSetter(
  next: DatabaseDefaultTemplateSetter | null,
) {
  defaultTemplateSetter = next;
}

export async function fetchDatabaseDetail(
  id: string,
): Promise<WorkspaceDatabaseDetail | null> {
  if (!detailFetcher) {
    throw new Error("No workspace connection");
  }
  return detailFetcher(id);
}

export async function fetchDatabaseRows(
  id: string,
  options: {
    limit: number;
    offset: number;
    sort?: DatabaseViewSort | null;
  },
): Promise<DatabaseRowsPage | null> {
  if (!rowsFetcher) {
    throw new Error("No workspace connection");
  }
  return rowsFetcher(id, options);
}

export async function createDatabaseRow(
  id: string,
  title?: string,
  templateId?: string,
): Promise<WorkspacePageDetail> {
  if (!rowCreator) {
    throw new Error("No workspace connection");
  }
  return rowCreator(id, title, templateId);
}

export async function updateDatabaseView(
  databaseId: string,
  viewId: string,
  update: DatabaseViewUpdate,
): Promise<WorkspaceDatabaseDetail> {
  if (!viewUpdater) {
    throw new Error("No workspace connection");
  }
  return viewUpdater(databaseId, viewId, update);
}

export async function createDatabaseView(
  databaseId: string,
  input?: CreateDatabaseViewInput,
): Promise<CreateDatabaseViewResult> {
  if (!viewCreator) {
    throw new Error("No workspace connection");
  }
  return viewCreator(databaseId, input);
}

export async function deleteDatabaseView(
  databaseId: string,
  viewId: string,
): Promise<WorkspaceDatabaseDetail> {
  if (!viewDeleter) {
    throw new Error("No workspace connection");
  }
  return viewDeleter(databaseId, viewId);
}

export async function listDatabases(): Promise<WorkspaceDatabaseMeta[]> {
  if (!databasesLister) {
    throw new Error("No workspace connection");
  }
  return databasesLister();
}

export async function createDatabase(options?: {
  title?: string;
  parentId?: string;
}): Promise<CreateDatabaseResult> {
  if (!databaseCreator) {
    throw new Error("No workspace connection");
  }
  return databaseCreator(options);
}

export async function createDatabaseTemplate(
  databaseId: string,
): Promise<CreateDatabaseTemplateResult> {
  if (!templateCreator) {
    throw new Error("No workspace connection");
  }
  return templateCreator(databaseId);
}

export async function fetchDatabaseTemplate(
  databaseId: string,
  templateId: string,
): Promise<WorkspacePageDetail | null> {
  if (!templateFetcher) {
    throw new Error("No workspace connection");
  }
  return templateFetcher(databaseId, templateId);
}

export async function updateDatabaseTemplate(
  databaseId: string,
  templateId: string,
  update: UpdateDatabaseTemplateInput,
): Promise<WorkspacePageDetail> {
  if (!templateUpdater) {
    throw new Error("No workspace connection");
  }
  return templateUpdater(databaseId, templateId, update);
}

export async function duplicateDatabaseTemplate(
  databaseId: string,
  templateId: string,
): Promise<DuplicateDatabaseTemplateResult> {
  if (!templateDuplicator) {
    throw new Error("No workspace connection");
  }
  return templateDuplicator(databaseId, templateId);
}

export async function deleteDatabaseTemplate(
  databaseId: string,
  templateId: string,
): Promise<WorkspaceDatabaseDetail> {
  if (!templateDeleter) {
    throw new Error("No workspace connection");
  }
  return templateDeleter(databaseId, templateId);
}

export async function setDefaultDatabaseTemplate(
  databaseId: string,
  templateId: string,
): Promise<WorkspaceDatabaseDetail> {
  if (!defaultTemplateSetter) {
    throw new Error("No workspace connection");
  }
  return defaultTemplateSetter(databaseId, templateId);
}
