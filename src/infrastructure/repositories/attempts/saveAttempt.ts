import type { Attempt } from "@/domain";
import { db } from "@/infrastructure/database";

export function saveAttempt(attempt: Attempt) {
  return db.attempts.put(attempt);
}
