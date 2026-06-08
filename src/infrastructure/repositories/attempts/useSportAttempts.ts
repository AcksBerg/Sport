import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/infrastructure/database";

export function useSportAttempts(sportId?: string) {
  return useLiveQuery(
    () =>
      sportId
        ? db.attempts.where("sportId").equals(sportId).reverse().sortBy("date")
        : [],
    [sportId],
  );
}
