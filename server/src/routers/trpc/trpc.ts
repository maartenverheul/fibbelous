import { OpenPage } from "@/services/PageService";
import createId from "@/utils/uid";
import { initTRPC } from "@trpc/server";
import { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";

type Context = {
  openPage: OpenPage | undefined;
  id: string;
};

export const createContext = (opts: CreateWSSContextFnOptions) => {
  const id = createId();

  return {
    id,
    openPage: undefined,
  } as Context;
};
type AwaitedContext = Awaited<ReturnType<typeof createContext>>;

export const t = initTRPC.context<AwaitedContext>().create();
