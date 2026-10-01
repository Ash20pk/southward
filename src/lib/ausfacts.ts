import type { AusFact } from "./types";
import ausJson from "@/content/ausfacts.json";

/** Australia 101: how the health system works, in short reads. For counts, use ./bank-index instead. */
export const AUS_FACTS = ausJson as AusFact[];
