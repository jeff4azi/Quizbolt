/**
 * Intelligent Local Theory Grading Engine (QuizBolt)
 * 
 * Provides robust, semantic, typo-tolerant grading of open-ended / theory answers
 * without requiring external paid LLM APIs.
 */

// Common English stop words to filter out during content/model answer comparison
const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "cannot", "could", "couldn't",
  "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
  "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
  "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here",
  "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i",
  "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's",
  "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
  "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought",
  "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she",
  "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
  "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
  "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
  "they've", "this", "those", "through", "to", "too", "under", "until", "up",
  "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
  "weren't", "what", "what's", "when", "when's", "where", "where's", "which",
  "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
  "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
  "yourself", "yourselves"
]);

/**
 * Normalizes text: lowercases, removes extraneous punctuation, collapses whitespace.
 */
export const normalizeText = (text) => {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(/['’]/g, "") // remove apostrophes without adding spaces (e.g. don't -> dont)
    .replace(/[^\w\s-]/g, " ") // replace punctuation with spaces
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Fast rule-based English suffix stemmer.
 * Handles plurals, verb conjugations (-ing, -ed, -es, -s), and common noun derivations (-tion, -ment, -ance).
 */
export const stemWord = (word) => {
  if (!word || word.length <= 3) return word;

  let w = word.toLowerCase();

  // -ies -> -y (e.g., categories -> category, copies -> copy)
  if (w.endsWith("ies") && w.length > 4) {
    return w.slice(0, -3) + "y";
  }

  // -sses -> -ss (e.g., processes -> process)
  if (w.endsWith("sses")) {
    return w.slice(0, -2);
  }

  // -tion / -sion -> -t / -s (e.g., respiration -> respirat, pollution -> pollut)
  if ((w.endsWith("tion") || w.endsWith("sion")) && w.length > 5) {
    return w.slice(0, -3);
  }

  // -ment (e.g., development -> develop)
  if (w.endsWith("ment") && w.length > 6) {
    return w.slice(0, -4);
  }

  // -ing (e.g., dividing -> divid, walking -> walk)
  if (w.endsWith("ing") && w.length > 5) {
    const base = w.slice(0, -3);
    // Double consonant: running -> run, swimming -> swim
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      return base.slice(0, -1);
    }
    return base;
  }

  // -ed (e.g., divided -> divid, walked -> walk)
  if (w.endsWith("ed") && w.length > 4) {
    const base = w.slice(0, -2);
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      return base.slice(0, -1);
    }
    return base;
  }

  // Regular plural -es or -s
  if (w.endsWith("es") && w.length > 4) {
    return w.slice(0, -2);
  }
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) {
    return w.slice(0, -1);
  }

  return w;
};

/**
 * Levenshtein distance between two strings.
 */
export const levenshteinDistance = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], row[j], prev) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }

  return row[b.length];
};

/**
 * Fuzzy token match allowing for minor typos.
 * - For word <= 4 chars: exact match only
 * - For word 5-7 chars: edit distance <= 1 (e.g., "oxigen" -> "oxygen")
 * - For word >= 8 chars: edit distance <= 2 (e.g., "mitocondria" -> "mitochondria")
 */
export const isFuzzyMatch = (target, token) => {
  if (target === token) return true;
  const len = target.length;
  if (len <= 4) return false;

  const maxDist = len >= 8 ? 2 : 1;
  const dist = levenshteinDistance(target, token);
  return dist <= maxDist;
};

/**
 * Normalizes input rawKeywords into a structured array of Concept Groups:
 * Each concept group has:
 * {
 *   primary: string,
 *   terms: string[] // list of alternative phrases or synonyms
 * }
 */
export const parseKeywords = (raw) => {
  if (!raw) return [];

  let parsed = raw;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        // Fallback to comma separation
        parsed = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
      }
    } else {
      parsed = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }

  if (!Array.isArray(parsed)) return [];

  const groups = [];

  for (const item of parsed) {
    if (Array.isArray(item)) {
      // It's a synonym group: ["ATP", "adenosine triphosphate"]
      const cleanTerms = item
        .map((t) => (typeof t === "string" ? t.trim() : String(t || "").trim()))
        .filter(Boolean);
      if (cleanTerms.length > 0) {
        groups.push({
          primary: cleanTerms[0],
          terms: cleanTerms,
        });
      }
    } else if (typeof item === "string" && item.trim()) {
      // Check if it's comma-separated within the string or a single keyword
      const subterms = item.split(",").map((s) => s.trim()).filter(Boolean);
      if (subterms.length > 1) {
        // Multiple comma-separated concepts
        for (const sub of subterms) {
          groups.push({ primary: sub, terms: [sub] });
        }
      } else {
        groups.push({ primary: item.trim(), terms: [item.trim()] });
      }
    } else if (item && typeof item === "object") {
      const label = item.primary || item.keyword || item.label || item.name || "";
      const terms = Array.isArray(item.terms) ? item.terms : [label];
      if (label || terms.length) {
        groups.push({
          primary: label || terms[0],
          terms: terms.filter(Boolean),
        });
      }
    }
  }

  return groups;
};

/**
 * Checks whether a Concept Group is satisfied in the user's written answer.
 */
export const matchConceptGroup = (group, normalizedAnswer, answerTokens, answerStems) => {
  for (const term of group.terms) {
    const cleanTerm = normalizeText(term);
    if (!cleanTerm) continue;

    const termTokens = cleanTerm.split(" ").filter(Boolean);

    // 1. Multi-word phrase check (e.g., "cell division", "carbon dioxide")
    if (termTokens.length > 1) {
      // Word-boundary exact phrase match in normalized text
      const phraseRegex = new RegExp(`(^|\\W)${cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\W)`, "i");
      if (phraseRegex.test(normalizedAnswer)) {
        return { matched: true, matchedTerm: term, confidence: 1.0 };
      }

      // Check if all stemmed words of the phrase are present in the answer
      const termStems = termTokens.map(stemWord);
      const allStemsFound = termStems.every((ts) => answerStems.has(ts));
      if (allStemsFound) {
        return { matched: true, matchedTerm: term, confidence: 0.95 };
      }
    } else {
      // 2. Single-word concept check (e.g., "mitochondria", "photosynthesis")
      const singleTarget = termTokens[0];
      const singleStem = stemWord(singleTarget);

      // Exact token check
      if (answerTokens.includes(singleTarget)) {
        return { matched: true, matchedTerm: term, confidence: 1.0 };
      }

      // Stemmed match (e.g. "pollinating" vs "pollination")
      if (answerStems.has(singleStem)) {
        return { matched: true, matchedTerm: term, confidence: 0.95 };
      }

      // Fuzzy typo match
      const fuzzyHit = answerTokens.find((tok) => isFuzzyMatch(singleTarget, tok));
      if (fuzzyHit) {
        return { matched: true, matchedTerm: term, matchedWord: fuzzyHit, confidence: 0.88 };
      }
    }
  }

  return { matched: false };
};

/**
 * Computes semantic content overlap between user answer and model answer (Bag-of-Words / Stems).
 */
export const computeModelAnswerOverlap = (userAnswer, modelAnswer) => {
  if (!userAnswer || !modelAnswer) return 0;

  const normUser = normalizeText(userAnswer);
  const normModel = normalizeText(modelAnswer);

  const userTokens = normUser.split(" ").filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const modelTokens = normModel.split(" ").filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  if (!modelTokens.length) return 0;

  const userStems = new Set(userTokens.map(stemWord));
  const modelStems = new Set(modelTokens.map(stemWord));

  let matched = 0;
  modelStems.forEach((stem) => {
    if (userStems.has(stem)) matched++;
  });

  return matched / modelStems.size; // 0.0 to 1.0
};

/**
 * Detailed grading analysis for an open-ended theory answer.
 * Returns an object with scores, matched concepts, missed concepts, and helpful feedback.
 */
export const gradeTheoryDetailed = (userAnswer, rawKeywords, modelAnswer) => {
  const normAnswer = normalizeText(userAnswer);

  if (!normAnswer) {
    const conceptGroups = parseKeywords(rawKeywords);
    return {
      score: 0,
      matchedCount: 0,
      totalCount: conceptGroups.length,
      matchedConcepts: [],
      missedConcepts: conceptGroups.map((g) => g.primary),
      overlapScore: 0,
      status: "unanswered",
      feedback: "No answer provided.",
    };
  }

  const answerTokens = normAnswer.split(" ").filter(Boolean);
  const answerStems = new Set(answerTokens.map(stemWord));

  const conceptGroups = parseKeywords(rawKeywords);
  const totalConcepts = conceptGroups.length;

  const matchedConcepts = [];
  const missedConcepts = [];

  for (const group of conceptGroups) {
    const match = matchConceptGroup(group, normAnswer, answerTokens, answerStems);
    if (match.matched) {
      matchedConcepts.push(group.primary);
    } else {
      missedConcepts.push(group.primary);
    }
  }

  const overlapScore = computeModelAnswerOverlap(userAnswer, modelAnswer);

  let finalScore = 0;

  if (totalConcepts > 0) {
    const conceptRatio = matchedConcepts.length / totalConcepts;

    if (conceptRatio === 1) {
      finalScore = 1.0;
    } else if (conceptRatio > 0) {
      // Boost slightly with model answer overlap if the student elaborated well
      const elaborationBonus = overlapScore > 0.4 ? Math.min(0.15, overlapScore * 0.2) : 0;
      finalScore = Math.min(1.0, conceptRatio + elaborationBonus);
    } else {
      // 0 keywords explicitly matched, but student might have explained well conceptually
      if (overlapScore >= 0.5) {
        finalScore = Math.min(0.5, overlapScore * 0.6);
      } else {
        finalScore = 0;
      }
    }
  } else if (modelAnswer) {
    // No keywords defined, rely on model answer overlap
    finalScore = Math.min(1.0, overlapScore * 1.25);
  } else {
    // Neither keywords nor model answer defined: give credit if meaningful text exists
    finalScore = answerTokens.length >= 5 ? 1.0 : answerTokens.length / 5;
  }

  // Round to 2 decimal places
  const roundedScore = Math.round(finalScore * 100) / 100;

  let status = "wrong";
  let feedback = "Key concepts were missing. Review the model solution.";

  if (roundedScore >= 0.85) {
    status = "correct";
    feedback = "Excellent! You covered all essential points.";
  } else if (roundedScore >= 0.45) {
    status = "partial";
    feedback = "Good attempt! You captured some key points, but missed a few details.";
  }

  return {
    score: roundedScore,
    matchedCount: matchedConcepts.length,
    totalCount: totalConcepts,
    matchedConcepts,
    missedConcepts,
    overlapScore: Math.round(overlapScore * 100) / 100,
    status,
    feedback,
  };
};

/**
 * Drop-in fractional score evaluator (0.0 to 1.0).
 * Compatible with existing QuizBolt accumulation:
 * `acc + gradeTheoryAnswer(answers[idx], q.keywords, q.model_answer)`
 */
export const gradeTheoryAnswer = (userAnswer, rawKeywords, modelAnswer) => {
  const result = gradeTheoryDetailed(userAnswer, rawKeywords, modelAnswer);
  return result.score;
};

// Aliases for convenience
export const gradeTheoryScore = gradeTheoryAnswer;
export const gradeTheory = gradeTheoryAnswer;
