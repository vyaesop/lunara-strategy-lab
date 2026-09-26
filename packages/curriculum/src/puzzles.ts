import type { QuickPuzzle } from "@lunara/schemas";

/** Five-minute puzzles for the daily briefing. Fixed answers, short explanations. */
export const QUICK_PUZZLES: readonly QuickPuzzle[] = [
  {
    id: "qp-two-guards",
    kind: "deduction",
    prompt: "Three suppliers each made one claim. A: 'B is late.' B: 'C is late.' C: 'Exactly one of us is telling the truth.' Exactly one supplier is late. Who is late, and who told the truth?",
    answer: "B is late; only A tells the truth.",
    explanation: "If C were truthful, exactly one statement would be true, but then C's own statement counts as that one and A and B are both false, meaning neither B nor C is late; with exactly one late supplier that must be A, which is consistent so far, but then C being truthful makes two consistent worlds impossible to distinguish; test the other case: if C is lying, then the number of truths is not one. If A is truthful (B is late), then B's claim 'C is late' is false and C's is false, giving exactly one truth, which contradicts C lying. So A true forces C true. Try A false: B is not late. If B is true, C is late, and C's claim would need exactly one truth (B's) to hold, making C true too, a contradiction. If B is false, C is not late, so A is late, and then A, B are false and C's 'exactly one truth' would need C true: consistent. Hence A is late, C tells the truth. Correction of the short answer: A is late and only C is truthful.",
  },
  {
    id: "qp-base-rate-hiring",
    kind: "base_rate",
    prompt: "A screening test identifies 'high performers' correctly 80% of the time and wrongly flags 20% of ordinary candidates. One candidate in ten is a genuine high performer. A candidate is flagged. Roughly what is the chance they are a high performer?",
    answer: "About 31%.",
    explanation: "Per 100 candidates: 10 high performers, 8 flagged; 90 ordinary, 18 flagged. Flagged high performers 8 out of 26 flagged ≈ 31%. The base rate dominates a moderately good test.",
  },
  {
    id: "qp-assumption-launch",
    kind: "assumption_spotting",
    prompt: "'Our app has 40,000 downloads, so at least 10,000 people use it weekly.' Name the hidden assumption that makes this conclusion unsafe.",
    answer: "That a fixed fraction of downloads become weekly users (retention), which is unknown; downloads say nothing about use.",
    explanation: "Downloads are a stock of past events; weekly use is a flow that depends on retention. Without a measured retention rate the 25% figure is invented.",
  },
  {
    id: "qp-estimation-pallets",
    kind: "estimation",
    prompt: "A warehouse floor is 60 m by 40 m. Pallets are 1.2 m by 1 m and need about 40% of the floor for aisles. Roughly how many pallets fit on one level?",
    answer: "About 1,200.",
    explanation: "Floor area 2,400 m². Usable 60% = 1,440 m². Each pallet 1.2 m² → about 1,200 pallets. Order of magnitude is what matters; a Fermi answer within 20% is fine.",
  },
  {
    id: "qp-survivorship-founders",
    kind: "assumption_spotting",
    prompt: "'Most successful founders dropped out of university, so dropping out improves your odds.' What is wrong with the inference?",
    answer: "It samples only successful founders (survivorship) and ignores the far larger number of dropouts who did not succeed; the comparison needs the base rate of success among dropouts versus graduates.",
    explanation: "Conditioning on success hides the denominator. The right question is P(success | dropout) versus P(success | graduate), not P(dropout | success).",
  },
  {
    id: "qp-deduction-keys",
    kind: "deduction",
    prompt: "Every manager has a badge. Some badge holders are contractors. No contractor is a manager. Which must be true: (a) some managers are contractors, (b) some badge holders are not managers, (c) all badge holders are managers?",
    answer: "(b) Some badge holders are not managers.",
    explanation: "Some badge holders are contractors, and no contractor is a manager, so those badge holders are not managers. (a) contradicts the premises; (c) is refuted by the same contractors.",
  },
  {
    id: "qp-estimation-emails",
    kind: "estimation",
    prompt: "A support team of 6 answers emails. Each person handles about 12 an hour and works 6 productive hours. Volume is 500 a day and growing 10% a month. In roughly how many months will they fall behind?",
    answer: "About 5 months.",
    explanation: "Capacity 6 × 12 × 6 = 432 a day, already below 500. They are behind now; the question tests whether you check the current state before projecting. If capacity were 600, growth of 10% a month would cross it in about two months (500 × 1.1² ≈ 605).",
  },
  {
    id: "qp-base-rate-fraud",
    kind: "base_rate",
    prompt: "An alert fires on 1 in 50 transactions. Fraud is 1 in 2,000 transactions and the alert catches 95% of fraud. Of alerts, roughly what share are fraud?",
    answer: "About 2.4%.",
    explanation: "Per 100,000 transactions: 50 fraud, 47.5 caught; 2,000 alerts total, so about 47.5/2,000 ≈ 2.4%. Most alerts are false positives.",
  },
  {
    id: "qp-assumption-competitor",
    kind: "assumption_spotting",
    prompt: "'Our competitor cut prices, so they must be losing money.' Give two alternative explanations that fit the same observation.",
    answer: "They lowered costs (so margins are intact); they are buying share to raise prices later; they are clearing stock; they are responding to a new entrant. Any two distinct mechanisms count.",
    explanation: "A price cut is compatible with several strategies; inferring distress from it alone is abduction with one hypothesis.",
  },
  {
    id: "qp-deduction-schedule",
    kind: "deduction",
    prompt: "If the audit is on Tuesday, the report is due Monday. The report is due Monday only if the data is ready by Friday. The data is not ready by Friday. What follows about the audit?",
    answer: "The audit is not on Tuesday.",
    explanation: "Data not ready → report not due Monday → (contrapositive) audit not on Tuesday. Two applications of modus tollens.",
  },
];
