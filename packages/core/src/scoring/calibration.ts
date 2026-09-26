/**
 * Calibration metrics for questions with well-defined binary outcomes.
 * Never applied to subjective judgements (see product principle 6.4).
 */
export interface ProbabilisticForecast {
  /** Stated probability that the outcome is true, 0..1. */
  probability: number;
  outcome: boolean;
}

export const MIN_FORECASTS_FOR_DISPLAY = 10;

/** Mean squared error between forecast and outcome. 0 = perfect, 0.25 = uninformative at p=0.5. */
export function brierScore(forecasts: ProbabilisticForecast[]): number | null {
  if (forecasts.length === 0) return null;
  const sum = forecasts.reduce((acc, f) => {
    const p = Math.min(1, Math.max(0, f.probability));
    const o = f.outcome ? 1 : 0;
    return acc + (p - o) ** 2;
  }, 0);
  return sum / forecasts.length;
}

/** Whether there is enough data to show a calibration trend to the user. */
export function hasEnoughCalibrationData(forecasts: ProbabilisticForecast[]): boolean {
  return forecasts.length >= MIN_FORECASTS_FOR_DISPLAY;
}

export interface CalibrationBucket {
  lower: number;
  upper: number;
  count: number;
  meanForecast: number;
  observedFrequency: number;
}

/** Bucketed reliability data for a calibration chart. */
export function calibrationBuckets(forecasts: ProbabilisticForecast[], buckets = 5): CalibrationBucket[] {
  const out: CalibrationBucket[] = [];
  for (let i = 0; i < buckets; i++) {
    const lower = i / buckets;
    const upper = (i + 1) / buckets;
    const inBucket = forecasts.filter((f) =>
      i === buckets - 1 ? f.probability >= lower && f.probability <= upper : f.probability >= lower && f.probability < upper,
    );
    const count = inBucket.length;
    out.push({
      lower,
      upper,
      count,
      meanForecast: count ? inBucket.reduce((a, f) => a + f.probability, 0) / count : 0,
      observedFrequency: count ? inBucket.filter((f) => f.outcome).length / count : 0,
    });
  }
  return out;
}
