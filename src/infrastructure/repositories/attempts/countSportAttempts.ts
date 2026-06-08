import { db } from "@/infrastructure/database";

export function countSportAttempts(sportId: string) {
  return db.attempts.where("sportId").equals(sportId).count();
}
