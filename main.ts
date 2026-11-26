// The Best Advice I Ever Got — deterministic entry picker.
//
// Competition: u-pangg7-the-best-advice-i-ever-got-358cefb0
// Task: write one sentence, at most 200 characters, about the best advice
// the writer ever received, to /output/entry.txt (or $MAKEFUN_OUTPUT_DIR).
//
// The gate is a sealed scorer that checks the file is UTF-8 text of 1 to
// 200 characters and not only whitespace. The judge is an AI model that
// compares entries pairwise against a published brief, weighing, most
// important first:
//
//   1. It is a single sentence about the best advice the writer ever
//      received (anything off that subject loses to anything on it).
//   2. The advice is worth carrying: specific, earned, and true beyond
//      the moment it came from.
//   3. It sounds like a real voice recalling a real moment, not a slogan
//      or a fortune cookie.
//   4. It is tight: every word earns its place, one breath.
//   5. It lands, leaving the reader with something to keep.
//
// This program hand-writes a slate of candidate lines, scores each one
// deterministically against those five published criteria, picks the best,
// validates it against the gate exactly as the sealed scorer would, writes
// it to entry.txt, reads the file back and verifies the bytes match.
//
// Node 22+, standard library only. No network, no randomness, no secrets:
// the same run always produces the same entry.
//
// Usage:
//   node main.ts
//   MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts
//
// Exit codes:
//   0  entry written and verified
//   1  gate failure or verification mismatch (nothing valid written)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Gate constants (from the published competition rules, verbatim).
// ---------------------------------------------------------------------------

/** Maximum characters the gate allows in entry.txt. */
const GATE_MAX_CHARS = 200;
/** Minimum characters the gate allows in entry.txt. */
const GATE_MIN_CHARS = 1;

// ---------------------------------------------------------------------------
// Candidate lines.
//
// Every candidate is one sentence, hand-written for this entry, about a
// piece of advice someone actually gave the writer. Each carries a named
// giver and a concrete moment, because the judge's brief rewards a real
// voice recalling a real moment and punishes slogans and fortune cookies.
//
// The slate is deliberately varied: family advice, work advice, advice
// from strangers, funny lines and quietly devastating ones. The scorer
// below ranks them; the program never hard-codes which one wins.
// ---------------------------------------------------------------------------

interface Candidate {
  /** The full entry text: exactly one sentence, no trailing newline. */
  text: string;
  /** Who gave the advice, as named in the line. */
  giver: string;
  /** The moment the advice arrived, as named in the line. */
  moment: string;
}

const CANDIDATES: Candidate[] = [
  {
    text: "My father, the night I wanted to quit my first job, said, \u201cSon, the job is not the problem \u2014 the problem is you keep waiting for someone to rescue you.\u201d",
    giver: "father",
    moment: "the night I wanted to quit my first job",
  },
  {
    text: "My grandmother, who raised six kids on a seamstress\u2019s pay, told me, \u201cNever borrow for something that will not outlast the loan.\u201d",
    giver: "grandmother",
    moment: "raising six kids on a seamstress\u2019s pay",
  },
  {
    text: "My old coach told me, \u201cTalent gets you noticed, but showing up every day is what keeps you in the room.\u201d",
    giver: "old coach",
    moment: "on the team",
  },
  {
    text: "My mother told me on my wedding day, \u201cMarry the argument you can stand to lose, because you will have it a thousand times.\u201d",
    giver: "mother",
    moment: "my wedding day",
  },
  {
    text: "A nurse told me the night my son was born, \u201cYou will not feel ready, so stop waiting to feel ready and just start.\u201d",
    giver: "nurse",
    moment: "the night my son was born",
  },
  {
    text: "My first boss, firing me at twenty-two, said, \u201cYou are not lazy, you are just scared, and scared is fixable.\u201d",
    giver: "first boss",
    moment: "being fired at twenty-two",
  },
  {
    text: "My grandfather, handing me his toolbox, said, \u201cBuy it once, cry once \u2014 cheap tools cost you twice.\u201d",
    giver: "grandfather",
    moment: "handing me his toolbox",
  },
  {
    text: "My teacher wrote on my essay, \u201cWrite what you actually think, not what you think I want to read.\u201d",
    giver: "teacher",
    moment: "an essay returned",
  },
  {
    text: "My older sister told me before my first interview, \u201cThey are not hiring your resume, they are hiring the room you leave behind.\u201d",
    giver: "older sister",
    moment: "before my first interview",
  },
  {
    text: "A cab driver in the rain once told me, \u201cYou cannot steer a parked car, so move first and correct as you go.\u201d",
    giver: "cab driver",
    moment: "a rainy cab ride",
  },
  {
    text: "My father said, \u201cIf you cannot explain it to your grandmother, you do not understand it yet \u2014 go back and learn it again.\u201d",
    giver: "father",
    moment: "a lesson at home",
  },
  {
    text: "My aunt told me, \u201cSave the first tenth of everything you earn and never tell anyone you did.\u201d",
    giver: "aunt",
    moment: "a family talk",
  },
  {
    text: "My mentor told me the day I got promoted, \u201cThe higher you climb, the quieter you should speak, because now people are actually listening.\u201d",
    giver: "mentor",
    moment: "the day I got promoted",
  },
  {
    text: "My grandmother said, \u201cDo not marry a man for the life he promises you \u2014 marry him for the life he already lives.\u201d",
    giver: "grandmother",
    moment: "a talk at home",
  },
  {
    text: "A stranger at a bus stop told me, \u201cNobody remembers what you said, they remember how you made them feel, so be careful with both.\u201d",
    giver: "stranger",
    moment: "a bus stop",
  },
  {
    text: "My father, watching me lose my temper at fourteen, said, \u201cAnger is a debt you pay with interest, and nobody ever collects on your behalf.\u201d",
    giver: "father",
    moment: "losing my temper at fourteen",
  },
  {
    text: "My uncle, teaching me to drive stick on a hill, said, \u201cThe clutch is not the hard part \u2014 the hard part is trusting yourself not to roll back.\u201d",
    giver: "uncle",
    moment: "learning to drive stick on a hill",
  },
  {
    text: "My landlady, sliding the eviction notice back across the table, said, \u201cPay the rent first, pride second \u2014 pride never kept the lights on.\u201d",
    giver: "landlady",
    moment: "an eviction notice across the table",
  },
];

// ---------------------------------------------------------------------------
// Scoring.
//
// The scorer mirrors the judge's published brief, in the same order of
// importance, and is fully deterministic: same slate, same winner, every
// run. Scores are out of 100. Each criterion is scored 0..its weight, and
// the weights follow the brief's ordering (criterion 1 first, so it can
// decide a close pair before the later ones are even consulted).
//
// Weights:
//   1. On subject (best advice received) ............ 30
//   2. Worth carrying (specific, earned, true) ...... 25
//   3. Real voice, not a slogan .................... 20
//   4. Tight (every word earns its place) ........... 15
//   5. Lands (something to keep) ................... 10
// ---------------------------------------------------------------------------

const WEIGHTS = {
  onSubject: 30,
  worthCarrying: 25,
  realVoice: 20,
  tight: 15,
  lands: 10,
} as const;

/** Words that mark a line as a generic slogan rather than lived advice. */
const SLOGAN_WORDS = [
  "never give up",
  "believe in yourself",
  "follow your dreams",
  "reach for the stars",
  "anything is possible",
  "just do it",
  "stay positive",
  "dream big",
  "be yourself",
];

/** Words that mark a line as a fortune cookie rather than a memory. */
const FORTUNE_WORDS = [
  "fortune",
  "destiny",
  "the universe",
  "your future",
  "a wise man",
];

/** Concrete nouns that anchor a line in a real, specific moment. */
const CONCRETE_NOUNS = [
  "toolbox",
  "essay",
  "resume",
  "cab",
  "bus stop",
  "wedding",
  "interview",
  "seamstress",
  "loan",
  "tool",
  "room",
  "temper",
  "debt",
  "job",
  "son",
  "clutch",
  "hill",
  "eviction",
  "rent",
  "lights",
];

/**
 * Count how many of `words` appear (case-insensitively) in `text`.
 * Simple substring matching is enough for a fixed, hand-written slate.
 */
function countHits(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const word of words) {
    if (lower.includes(word)) hits += 1;
  }
  return hits;
}

/**
 * Criterion 1 — On subject: is this one sentence about the best advice
 * the writer ever received? Full marks need a giver, a speech verb
 * (said/told/wrote), and quoted advice. A line with no giver and no
 * quoted speech is off subject no matter how wise it sounds.
 */
function scoreOnSubject(candidate: Candidate): number {
  const text = candidate.text;
  let score = 0;

  // A named giver: "my father", "a nurse", "my mentor", ...
  if (candidate.giver.trim().length > 0) score += 10;

  // A speech verb carrying the advice into the sentence.
  if (/\b(said|told|wrote)\b/i.test(text)) score += 10;

  // The advice itself, carried as quoted speech.
  if (text.includes("\u201c") && text.includes("\u201d")) score += 10;

  return Math.min(score, WEIGHTS.onSubject);
}

/**
 * Criterion 2 — Worth carrying: specific, earned, and true beyond the
 * moment. Specificity comes from a concrete moment and concrete nouns;
 * earned-ness from the advice naming a real cost, trade-off or test
 * (borrow, quit, scared, debt, loan, cheap, lose); universality from
 * the advice applying past the one scene it came from.
 */
function scoreWorthCarrying(candidate: Candidate): number {
  const text = candidate.text;
  let score = 0;

  // A concrete moment, not a floating aphorism.
  if (candidate.moment.trim().length > 0) score += 8;

  // Concrete nouns anchor the advice in a real scene.
  const concrete = countHits(text, CONCRETE_NOUNS);
  score += Math.min(concrete * 3, 9);

  // The advice names a cost, a trade-off or a hard truth.
  const costWords = [
    "borrow",
    "quit",
    "scared",
    "debt",
    "loan",
    "cheap",
    "lose",
    "cry",
    "firing",
    "interest",
    "fixable",
    "rescue",
  ];
  const cost = countHits(text, costWords);
  score += Math.min(cost * 2, 8);

  return Math.min(score, WEIGHTS.worthCarrying);
}

/**
 * Criterion 3 — Real voice: sounds like a person recalling a moment,
 * not a slogan or a fortune cookie. Contractions, a named person, a
 * specific scene and a second-person address all read as a real voice;
 * slogan and fortune-cookie phrasing reads as manufactured.
 */
function scoreRealVoice(candidate: Candidate): number {
  const text = candidate.text;
  let score = 10; // start at the middle; voice is earned or lost.

  // Contractions are how people actually talk.
  if (/\b(don\u2019t|can\u2019t|won\u2019t|isn\u2019t|you\u2019re|it\u2019s|that\u2019s)\b/i.test(text)) score += 3;

  // A specific scene (a named place, age, or occasion) is a memory.
  if (/\b(twenty-two|fourteen|wedding|rain|night|day|first)\b/i.test(text)) score += 3;

  // Second-person address: advice spoken to someone, not at the world.
  if (/\b(you|your|son)\b/i.test(text)) score += 2;

  // Slogans and fortune cookies are manufactured, not remembered.
  score -= countHits(text, SLOGAN_WORDS) * 10;
  score -= countHits(text, FORTUNE_WORDS) * 10;

  return Math.max(0, Math.min(score, WEIGHTS.realVoice));
}

/**
 * Criterion 4 — Tight: every word earns its place and the whole thing
 * reads in one breath. The sweet spot is 110..170 characters: long
 * enough to hold a giver, a moment and the advice, short enough to
 * land in one breath. Shorter lines lose room for the scene; longer
 * lines start to ramble.
 */
function scoreTight(candidate: Candidate): number {
  const len = candidate.text.length;
  if (len >= 110 && len <= 170) return WEIGHTS.tight;
  if (len >= 90 && len < 110) return 12;
  if (len > 170 && len <= 190) return 12;
  if (len >= 70 && len < 90) return 9;
  if (len > 190 && len <= GATE_MAX_CHARS) return 8;
  return 5;
}

/**
 * Criterion 5 — Lands: leaves the reader with something to keep after
 * the last word. A strong landing is a closing image or reversal in the
 * final clause: a contrast ("not X, Y"), a rule that echoes ("cost you
 * twice"), or a final word that reframes the whole line.
 */
function scoreLands(candidate: Candidate): number {
  const text = candidate.text;
  let score = 4; // every candidate ends on its advice; that alone lands a little.

  // A contrast or reversal in the closing stretch.
  if (/[,\u2014]\s*(but|not|so|because|and)\b/i.test(text)) score += 2;

  // A closing image that echoes: repetition of a key word near the end.
  const words = text.toLowerCase().replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean);
  const last = words.slice(-8);
  const seen = new Set<string>();
  let repeated = false;
  for (const word of last) {
    if (seen.has(word) && word.length > 3) repeated = true;
    seen.add(word);
  }
  if (repeated) score += 2;

  // A final clause that states a rule to carry ("cost you twice",
  // "scared is fixable", "correct as you go").
  if (/\b(twice|fixable|as you go|on your behalf|a thousand times|kept the lights on|not to roll back)\b/i.test(text)) score += 2;

  return Math.min(score, WEIGHTS.lands);
}

interface ScoredCandidate {
  candidate: Candidate;
  index: number;
  onSubject: number;
  worthCarrying: number;
  realVoice: number;
  tight: number;
  lands: number;
  total: number;
}

/** Score one candidate on all five published criteria. */
function scoreCandidate(candidate: Candidate, index: number): ScoredCandidate {
  const onSubject = scoreOnSubject(candidate);
  const worthCarrying = scoreWorthCarrying(candidate);
  const realVoice = scoreRealVoice(candidate);
  const tight = scoreTight(candidate);
  const lands = scoreLands(candidate);
  return {
    candidate,
    index,
    onSubject,
    worthCarrying,
    realVoice,
    tight,
    lands,
    total: onSubject + worthCarrying + realVoice + tight + lands,
  };
}

/**
 * Deterministic ranking: highest total first; ties break by the
 * brief's own order (criterion 1, then 2, then 3, then 4, then 5),
 * then by shorter text (tighter wins), then by earlier slate order.
 * No randomness anywhere: the same slate always yields the same winner.
 */
function rankCandidates(scored: ScoredCandidate[]): ScoredCandidate[] {
  return [...scored].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.onSubject !== a.onSubject) return b.onSubject - a.onSubject;
    if (b.worthCarrying !== a.worthCarrying) return b.worthCarrying - a.worthCarrying;
    if (b.realVoice !== a.realVoice) return b.realVoice - a.realVoice;
    if (b.tight !== a.tight) return b.tight - a.tight;
    if (b.lands !== a.lands) return b.lands - a.lands;
    if (a.candidate.text.length !== b.candidate.text.length) {
      return a.candidate.text.length - b.candidate.text.length;
    }
    return a.index - b.index;
  });
}

// ---------------------------------------------------------------------------
// Gate validation — mirrors the sealed scorer exactly as published:
// entry.txt must be UTF-8 text of 1 to 200 characters, not only whitespace.
// The task also requires one sentence: exactly one sentence-terminating
// period, at the very end of the line, and no line breaks.
// ---------------------------------------------------------------------------

interface GateResult {
  valid: boolean;
  reasons: string[];
  charCount: number;
  byteCount: number;
}

function validateGate(text: string): GateResult {
  const reasons: string[] = [];
  const charCount = [...text].length; // code points, as the gate counts characters
  const byteCount = Buffer.byteLength(text, "utf8");

  if (charCount < GATE_MIN_CHARS) reasons.push(`too short: ${charCount} chars (min ${GATE_MIN_CHARS})`);
  if (charCount > GATE_MAX_CHARS) reasons.push(`too long: ${charCount} chars (max ${GATE_MAX_CHARS})`);
  if (text.trim().length === 0) reasons.push("only whitespace");
  if (text.includes("\n") || text.includes("\r")) reasons.push("contains a line break: entry must be one line");

  // One sentence: exactly one sentence-terminating period, and it must
  // be the final character — or the final character before a closing
  // quote, since quoted advice ends "...behalf." with the period inside
  // the closing curly quote. (Question marks and exclamation marks would
  // also end a sentence, so none may appear mid-line either.)
  const terminators = (text.match(/[.!?]/g) ?? []).length;
  if (terminators !== 1) reasons.push(`expected exactly 1 sentence terminator, found ${terminators}`);
  const stripped = text.replace(/[\u201d"')\]]+$/, "");
  if (!stripped.endsWith(".")) reasons.push("entry must end with a period (allowing a closing quote after it)");

  return { valid: reasons.length === 0, reasons, charCount, byteCount };
}

// ---------------------------------------------------------------------------
// Output.
// ---------------------------------------------------------------------------

/** Resolve the output directory: $MAKEFUN_OUTPUT_DIR, else /output/entry.txt. */
function outputDir(): string {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv;
  return "/output";
}

/** Print the full ranking table, so a human can audit the pick. */
function printRanking(ranked: ScoredCandidate[]): void {
  console.log("Ranking (total / on-subject / worth / voice / tight / lands / chars):");
  for (const entry of ranked) {
    const c = entry.candidate;
    console.log(
      `  #${String(entry.index + 1).padStart(2, "0")} ${String(entry.total).padStart(3, " ")} ` +
        `${entry.onSubject}/${entry.worthCarrying}/${entry.realVoice}/${entry.tight}/${entry.lands} ` +
        `${String(c.text.length).padStart(3, " ")}ch  ${c.text}`,
    );
  }
}

function main(): number {
  console.log("The Best Advice I Ever Got — deterministic entry picker");
  console.log(`Candidates: ${CANDIDATES.length}`);

  const scored = CANDIDATES.map((candidate, index) => scoreCandidate(candidate, index));
  const ranked = rankCandidates(scored);
  printRanking(ranked);

  const winner = ranked[0];
  const text = winner.candidate.text;
  console.log(`\nWinner: candidate #${winner.index + 1} (score ${winner.total}/100)`);

  // Validate before writing anything.
  const gate = validateGate(text);
  console.log(`Gate: ${gate.charCount} chars, ${gate.byteCount} bytes, valid=${gate.valid}`);
  if (!gate.valid) {
    for (const reason of gate.reasons) console.error(`  FAIL: ${reason}`);
    console.error("No entry written: the winner fails the gate.");
    return 1;
  }

  // Write the entry (no trailing newline: the gate counts characters,
  // and a newline would add one and break the one-line requirement).
  const dir = outputDir();
  mkdirSync(dir, { recursive: true });
  const outPath = join(dir, "entry.txt");
  writeFileSync(outPath, text, "utf8");
  console.log(`Wrote ${outPath}`);

  // Read it back and verify the bytes match exactly what was chosen.
  const readBack = readFileSync(outPath, "utf8");
  if (readBack !== text) {
    console.error("Verification FAILED: file contents differ from the chosen entry.");
    console.error(`  expected (${text.length} chars): ${JSON.stringify(text)}`);
    console.error(`  actual   (${readBack.length} chars): ${JSON.stringify(readBack)}`);
    return 1;
  }

  // Re-validate the file as read back, so the gate is checked on the
  // artifact itself, not just on the in-memory string.
  const reGate = validateGate(readBack);
  if (!reGate.valid) {
    for (const reason of reGate.reasons) console.error(`  FAIL on read-back: ${reason}`);
    return 1;
  }

  console.log("Verified: entry.txt matches the winner byte for byte and passes the gate.");
  console.log(`\nEntry (${gate.charCount} chars):`);
  console.log(text);
  return 0;
}

process.exit(main());
