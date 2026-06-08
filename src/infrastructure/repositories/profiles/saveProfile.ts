import type { UserProfile } from "@/domain";
import { db } from "@/infrastructure/database";

export function saveProfile(profile: UserProfile) {
  return db.profile.put(profile);
}
