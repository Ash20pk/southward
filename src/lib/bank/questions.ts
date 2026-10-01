import type { Question } from "../types";
import med from "@/content/questions/adult-medicine.json";
import surg from "@/content/questions/adult-surgery.json";
import wh from "@/content/questions/womens-health.json";
import ch from "@/content/questions/child-health.json";
import mh from "@/content/questions/mental-health.json";
import ph from "@/content/questions/population-health.json";

// The full question bank, about 460 KB. The bank's three parts are separate modules because a bundle takes a module
// whole: a screen that imports one of them gets only that one. For counts, use ../bank-index instead.
export const QUESTIONS = [...med, ...surg, ...wh, ...ch, ...mh, ...ph] as Question[];
