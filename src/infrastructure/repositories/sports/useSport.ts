import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/infrastructure/database";

export function useSport(slug?: string) {
  return useLiveQuery(
    () => db.sports.where("slug").equals(slug ?? "").first(),
    [slug],
  );
}
