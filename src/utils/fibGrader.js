/**
 * Intelligent Fill-in-the-Blank (FIB) Grading Engine (QuizBolt)
 * 
 * Provides robust, typo-tolerant, flexible grading for FIB questions
 * supporting number equivalence, UK/US spelling, plurals/singulars, and typos.
 */

import { levenshteinDistance, stemWord } from "./theoryGrader.js";

// Common number-word equivalences
const NUMBER_WORDS = {
  "0": "zero",
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  "6": "six",
  "7": "seven",
  "8": "eight",
  "9": "nine",
  "10": "ten",
  "11": "eleven",
  "12": "twelve",
  "13": "thirteen",
  "14": "fourteen",
  "15": "fifteen",
  "16": "sixteen",
  "17": "seventeen",
  "18": "eighteen",
  "19": "nineteen",
  "20": "twenty",
  "1st": "first",
  "2nd": "second",
  "3rd": "third",
  "4th": "fourth",
  "5th": "fifth",
  "6th": "sixth",
  "7th": "seventh",
  "8th": "eighth",
  "9th": "ninth",
  "10th": "tenth",
};

// Inverted lookup map (e.g. "one" -> "1", "third" -> "3rd")
const WORD_TO_NUMBER = Object.entries(NUMBER_WORDS).reduce((acc, [num, word]) => {
  acc[word] = num;
  return acc;
}, {});

// Common UK to US spelling equivalences
const SPELLING_VARIANTS = {
  "colour": "color",
  "colours": "colors",
  "behaviour": "behavior",
  "flavour": "flavor",
  "neighbour": "neighbor",
  "favour": "favor",
  "honour": "honor",
  "humour": "humor",
  "rumour": "rumor",
  "labour": "labor",
  "centre": "center",
  "centres": "centers",
  "theatre": "theater",
  "metre": "meter",
  "metres": "meters",
  "litre": "liter",
  "litres": "liters",
  "fibre": "fiber",
  "defence": "defense",
  "licence": "license",
  "practice": "practise",
  "catalyse": "catalyze",
  "catalyses": "catalyzes",
  "organise": "organize",
  "organises": "organizes",
  "realise": "realize",
  "realises": "realizes",
  "analyse": "analyze",
  "analyses": "analyzes",
};

// Inverted spelling map
const US_TO_UK = Object.entries(SPELLING_VARIANTS).reduce((acc, [uk, us]) => {
  acc[us] = uk;
  return acc;
}, {});

/**
 * Normalizes user typed text or accepted answer string:
 * - Trims and lowercases
 * - Removes enclosing quotes, trailing periods, punctuation
 * - Normalizes hyphens to spaces
 */
export const normalizeFibString = (str) => {
  if (!str || typeof str !== "string") return "";
  return str
    .toLowerCase()
    .trim()
    .replace(/^["']|["']$/g, "") // remove surrounding quotes
    .replace(/[.,;:?!]+$/g, "") // remove trailing punctuation
    .replace(/[-_]+/g, " ") // convert hyphens/underscores to spaces
    .replace(/\s+/g, " ") // collapse multiple spaces
    .trim();
};

/**
 * Resilient parser for FIB answer groups:
 * Accepts:
 * - Array of arrays: [["Paris", "City of Light"], ["France"]]
 * - Flat array: ["Paris", "France"]
 * - JSON string representation
 * - Comma-separated strings
 * 
 * Returns Array<string[]>: array of accepted synonym strings per blank
 */
export const parseFibAnswers = (raw) => {
  if (!raw) return [];

  let parsed = raw;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        parsed = [trimmed];
      }
    } else {
      parsed = [trimmed];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.map((item) => {
    if (Array.isArray(item)) {
      return item.map((s) => String(s || "").trim()).filter(Boolean);
    }
    if (typeof item === "string" && item.trim()) {
      // Check if item contains comma-separated synonyms
      const parts = item.split(",").map((s) => s.trim()).filter(Boolean);
      return parts.length ? parts : [item.trim()];
    }
    if (item !== null && item !== undefined) {
      return [String(item).trim()];
    }
    return [];
  }).filter((group) => group.length > 0);
};

/**
 * Checks if a typed value matches an accepted answer candidate.
 * Returns { matched: boolean, matchType: string }
 */
export const isFibMatch = (typedRaw, acceptedRaw) => {
  const typed = normalizeFibString(typedRaw);
  const accepted = normalizeFibString(acceptedRaw);

  if (!typed || !accepted) return { matched: false };

  // 1. Exact match after normalization
  if (typed === accepted) {
    return { matched: true, matchType: "exact" };
  }

  // 2. Number / word equivalence (e.g. "3" vs "three", "3rd" vs "third")
  if (
    NUMBER_WORDS[typed] === accepted ||
    WORD_TO_NUMBER[typed] === accepted ||
    NUMBER_WORDS[accepted] === typed ||
    WORD_TO_NUMBER[accepted] === typed
  ) {
    return { matched: true, matchType: "equivalent" };
  }

  // 3. UK vs US spelling equivalence
  if (
    SPELLING_VARIANTS[typed] === accepted ||
    US_TO_UK[typed] === accepted
  ) {
    return { matched: true, matchType: "equivalent" };
  }

  // 4. Stem / Plural / Singular match (e.g., "electron" vs "electrons")
  const stemTyped = stemWord(typed);
  const stemAccepted = stemWord(accepted);
  if (stemTyped === stemAccepted && stemTyped.length >= 3) {
    return { matched: true, matchType: "equivalent" };
  }

  // 5. Irregular biological plural pairs
  const irregularPlurals = [
    ["mitochondrion", "mitochondria"],
    ["nucleus", "nuclei"],
    ["bacterium", "bacteria"],
    ["fungus", "fungi"],
    ["protozoon", "protozoa"],
    ["flagellum", "flagella"],
    ["datum", "data"],
  ];
  for (const [sing, plur] of irregularPlurals) {
    if (
      (typed === sing && accepted === plur) ||
      (typed === plur && accepted === sing)
    ) {
      return { matched: true, matchType: "equivalent" };
    }
  }

  // 6. Fuzzy typo tolerance (Levenshtein distance)
  // - Word length 5-8: allow 1 edit distance (e.g., "ribisome" -> "ribosome")
  // - Word length 9+: allow 2 edit distance (e.g., "mitocondria" -> "mitochondria")
  const maxLen = Math.max(typed.length, accepted.length);

  // If the target word has at least 5 letters, allow minor 1-2 edit distance
  if (maxLen >= 5 && Math.abs(typed.length - accepted.length) <= 2) {
    const maxAllowedDist = maxLen >= 9 ? 2 : 1;
    const dist = levenshteinDistance(typed, accepted);
    if (dist <= maxAllowedDist) {
      return { matched: true, matchType: "typo" };
    }
  }

  return { matched: false };
};

/**
 * Detailed grading for FIB questions with blank-by-blank feedback.
 */
export const gradeFibDetailed = (userBlanks, rawAnswerGroups) => {
  const answerGroups = parseFibAnswers(rawAnswerGroups);
  const blanksInput = Array.isArray(userBlanks)
    ? userBlanks
    : typeof userBlanks === "string"
    ? [userBlanks]
    : [];

  if (!answerGroups.length) {
    return {
      score: 0,
      correctCount: 0,
      totalCount: 0,
      blanks: [],
    };
  }

  let correctCount = 0;
  const blankResults = [];

  for (let i = 0; i < answerGroups.length; i++) {
    const group = answerGroups[i]; // array of accepted synonyms
    const typed = (blanksInput[i] || "").trim();

    let matched = false;
    let matchType = typed ? "wrong" : "empty";
    let matchedWith = null;

    if (typed) {
      for (const candidate of group) {
        const check = isFibMatch(typed, candidate);
        if (check.matched) {
          matched = true;
          matchType = check.matchType;
          matchedWith = candidate;
          break;
        }
      }
    }

    if (matched) {
      correctCount++;
    }

    blankResults.push({
      index: i,
      typed,
      isCorrect: matched,
      acceptedAnswers: group,
      matchType,
      matchedWith,
    });
  }

  const score = Math.round((correctCount / answerGroups.length) * 100) / 100;

  return {
    score, // 0.0 to 1.0
    correctCount,
    totalCount: answerGroups.length,
    blanks: blankResults,
  };
};

/**
 * Drop-in score calculator (0.0 to 1.0).
 * Matches existing QuizBolt accumulation signature:
 * `gradeFibAnswer(answers[idx], q.answers)`
 */
export const gradeFibAnswer = (userBlanks, rawAnswerGroups) => {
  const detailed = gradeFibDetailed(userBlanks, rawAnswerGroups);
  return detailed.score;
};

// Aliases
export const gradeFib = gradeFibAnswer;
export const gradeFibScore = gradeFibAnswer;
