import type { Sport } from "@/domain";
import { db } from "@/infrastructure/database";

export function addSport(sport: Sport) {
  return db.sports.add(sport);
}
