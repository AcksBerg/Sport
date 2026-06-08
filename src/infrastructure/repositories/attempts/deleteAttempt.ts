import { db } from "@/infrastructure/database";

export function deleteAttempt(id: string) {
  return db.attempts.delete(id);
}
