import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/infrastructure/database";

export function useAllAttempts() {
  return useLiveQuery(() => db.attempts.toArray(), []);
}
