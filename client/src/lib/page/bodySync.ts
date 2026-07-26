import { diffChars } from "diff";
import type { BodyPatch, BodyPatchOp } from "./types";

const textEncoder = new TextEncoder();
const BODY_HASH_LEN = 10;

function utf8ByteLength(text: string): number {
  return textEncoder.encode(text).byteLength;
}

/** First 10 hex chars of SHA-256(body UTF-8) — matches server `hash_body`. */
export async function hashBody(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(body));
  const full = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return full.slice(0, BODY_HASH_LEN);
}

/**
 * Build sequential UTF-8 byte-indexed ops from `base` → `next`.
 * Wire form: `[0, index, length]` delete, `[1, index, text]` insert.
 */
export function buildBodyOps(base: string, next: string): BodyPatchOp[] {
  const parts = diffChars(base, next);
  const ops: BodyPatchOp[] = [];
  let cursor = 0;

  for (const part of parts) {
    if (part.added) {
      ops.push([1, cursor, part.value]);
      cursor += utf8ByteLength(part.value);
    } else if (part.removed) {
      ops.push([0, cursor, utf8ByteLength(part.value)]);
    } else {
      cursor += utf8ByteLength(part.value);
    }
  }

  return ops;
}

export async function buildBodyPatch(
  base: string,
  next: string,
): Promise<BodyPatch> {
  const [baseHash, resultHash] = await Promise.all([
    hashBody(base),
    hashBody(next),
  ]);
  return { baseHash, resultHash, ops: buildBodyOps(base, next) };
}

/** Prefer a patch when the ops payload is smaller than the full body. */
export function shouldSendBodyPatch(patch: BodyPatch, fullBody: string): boolean {
  if (patch.ops.length === 0) return false;
  return JSON.stringify(patch.ops).length < fullBody.length;
}

export function isBodyHashMismatchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("body hash mismatch") ||
    message.includes("body patch result hash mismatch")
  );
}
