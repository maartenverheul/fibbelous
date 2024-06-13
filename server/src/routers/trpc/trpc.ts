import createId from "@/utils/uid";
import { initTRPC } from "@trpc/server";
import { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";

type Context = {
  id: string;
};

export const createContext = (opts: CreateWSSContextFnOptions) => {
  const id = createId();

  return {
    id,
  } as Context;
};
type AwaitedContext = Awaited<ReturnType<typeof createContext>>;

export const t = initTRPC.context<AwaitedContext>().create();
