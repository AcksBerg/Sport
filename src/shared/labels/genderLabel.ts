import type { Gender } from "@/domain";

export const genderLabel = (gender: Gender) =>
  gender === "male" ? "Männlich" : "Weiblich";
