import { createId as cuid2 } from "@paralleldrive/cuid2";

export default function createId() {
  return cuid2().substring(0, 8);
}
