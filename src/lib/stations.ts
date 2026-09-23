import type { StationArea, StationDifficulty } from "./types";

export const AREA_LABEL: Record<StationArea, string> = {
  history: "History",
  examination: "Examination",
  diagnosis: "Diagnosis",
  management: "Management",
};

export const LEVEL: Record<StationDifficulty, { label: string; cls: string }> = {
  easy: { label: "Easy", cls: "bg-ok-soft text-ok" },
  medium: { label: "Medium", cls: "bg-brand-soft text-brand" },
  hard: { label: "Hard", cls: "bg-bad-soft text-bad" },
};

export const READ_SECS = 120;
export const STATION_SECS = 480;
