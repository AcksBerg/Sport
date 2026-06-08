import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/infrastructure/database";

export function useProfile() {
  return useLiveQuery(() => db.profile.get("local"));
}
