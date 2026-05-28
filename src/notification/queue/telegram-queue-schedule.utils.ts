/** Stagger BullMQ jobs: 0, delayMs, 2*delayMs, … (ms from enqueue time). */
export function staggerDelaysForJobs(
  jobCount: number,
  delayMs: number,
): number[] {
  if (jobCount <= 0) return [];
  const step = Math.max(0, delayMs);
  return Array.from({ length: jobCount }, (_, i) => i * step);
}
