import type { TopicContrast } from "./types";
import contrastJson from "@/content/contrasts.json";

/** Where the Indian answer and the Australian one differ, topic by topic. */
export const CONTRASTS = contrastJson as TopicContrast[];

export const contrastFor = (topicId: string) => CONTRASTS.find((c) => c.topic === topicId)?.rows ?? [];
