const errorMessages: Record<string, string> = {
  EPAGENOTFOUND: "Page not found.",
  EPAGELOCKED: "Page is in use.",
  _: "An unexpected error occurred.",
};

export default function getErrorMessage(code: string): string {
  return errorMessages[code] || errorMessages["_"];
}
