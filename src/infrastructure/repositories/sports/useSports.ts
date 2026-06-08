import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/infrastructure/database";

export function useSports() {
  return useLiveQuery(() => db.sports.toArray(), []);
}
