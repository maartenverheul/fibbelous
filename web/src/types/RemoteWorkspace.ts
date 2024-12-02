import type { Workspace } from "@fibbelous/server/lib";

export type RemoteWorkspace = Workspace & {
  url: string;
};
