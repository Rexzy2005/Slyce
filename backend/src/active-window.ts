/** A published activity is active on the half-open interval [startsAt, endsAt). */
export function isWithinActiveWindow(
  startsAt: Date | null,
  endsAt: Date | null,
  now: Date,
): boolean {
  return (startsAt === null || startsAt <= now) && (endsAt === null || now < endsAt);
}
