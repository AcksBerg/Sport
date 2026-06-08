import { db } from "@/infrastructure/database";

export function deleteSportAttempts(sportId: string) {
  return db.attempts.where("sportId").equals(sportId).delete();
}
