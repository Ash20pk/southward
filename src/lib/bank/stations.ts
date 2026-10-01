import type { OsceStation } from "../types";
import stationsJson from "@/content/generated/stations.json";

// Every clinical station in full, about 340 KB: for the server. Screens list stations from ../bank-index and load the
// one they show with useStation.
export const STATIONS = stationsJson as OsceStation[];

export const stationById = (id: string) => STATIONS.find((s) => s.id === id);
