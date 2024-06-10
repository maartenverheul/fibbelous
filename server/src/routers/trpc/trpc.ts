import { initTRPC } from "@trpc/server";

const createContext = () => ({}); // no context
type Context = Awaited<ReturnType<typeof createContext>>;

export const t = initTRPC.context<Context>().create();
