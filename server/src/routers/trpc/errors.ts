import { TRPCError } from "@trpc/server";

export class TRPCPageLockedError extends TRPCError {
  constructor() {
    super({
      message: `EPAGELOCKED`,
      code: "BAD_REQUEST",
    });
  }
}
export class TRPCPageNotFoundError extends TRPCError {
  constructor() {
    super({
      message: `EPAGENOTFOUND`,
      code: "BAD_REQUEST",
    });
  }
}
export class TRPCServerError extends TRPCError {
  constructor() {
    super({
      message: `EERROR`,
      code: "BAD_REQUEST",
    });
  }
}
