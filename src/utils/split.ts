import { RoundItem, RoundItemShare, ShareMode } from '@/types';

function roundToYen(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount);
}

export function getSharedItemTotalYen(item: Pick<RoundItem, 'price' | 'qty'>): number {
  return roundToYen(item.price * item.qty);
}

export function largestRemainderToYen<T extends string | number>(
  totalYen: number,
  parts: Array<{ key: T; exact: number }>
): Array<{ key: T; amountYen: number }> {
  const floors = parts.map((p) => ({
    key: p.key,
    floor: Math.floor(p.exact),
    frac: p.exact - Math.floor(p.exact),
  }));

  const sumFloor = floors.reduce((sum, p) => sum + p.floor, 0);
  let remaining = totalYen - sumFloor;

  const order = [...floors].sort((a, b) => {
    if (b.frac !== a.frac) return b.frac - a.frac;
    return String(a.key).localeCompare(String(b.key), 'en');
  });

  const bonus = new Map<T, number>();
  for (const p of order) {
    if (remaining <= 0) break;
    bonus.set(p.key, (bonus.get(p.key) || 0) + 1);
    remaining -= 1;
  }

  return floors.map((p) => ({
    key: p.key,
    amountYen: p.floor + (bonus.get(p.key) || 0),
  }));
}

function normalizeShares(shares: RoundItemShare[] | undefined): RoundItemShare[] {
  return Array.isArray(shares) ? shares.filter((s) => !!s?.userId) : [];
}

export function computeSharedAllocations(
  item: Pick<RoundItem, 'isShared' | 'shareMode' | 'shares' | 'price' | 'qty' | 'status'>,
  options?: { allowPartialUnits?: boolean }
): Array<{ userId: string; amountYen: number }> {
  if (!item.isShared) return [];
  const shareMode: ShareMode | undefined = item.shareMode;
  if (!shareMode) return [];

  const shares = normalizeShares(item.shares);
  if (shares.length === 0) return [];

  const totalYen = getSharedItemTotalYen(item);

  if (shareMode === 'equal') {
    const perExact = totalYen / shares.length;
    const allocated = largestRemainderToYen(
      totalYen,
      shares.map((s) => ({ key: s.userId, exact: perExact }))
    );
    return allocated.map((a) => ({ userId: String(a.key), amountYen: a.amountYen }));
  }

  if (shareMode === 'ratio') {
    const weights = shares.map((s) => Math.max(0, Math.floor(s.weight ?? 1)));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    if (totalWeight <= 0) return [];

    const allocated = largestRemainderToYen(
      totalYen,
      shares.map((s, idx) => ({
        key: s.userId,
        exact: (totalYen * weights[idx]) / totalWeight,
      }))
    );
    return allocated.map((a) => ({ userId: String(a.key), amountYen: a.amountYen }));
  }

  // units
  const totalUnits = Math.max(0, Math.floor(item.qty));
  if (totalUnits <= 0) return [];

  const units = shares.map((s) => Math.max(0, Math.floor(s.units ?? 0)));
  const usedUnits = units.reduce((sum, u) => sum + u, 0);
  if (usedUnits <= 0) return [];

  if (!options?.allowPartialUnits && usedUnits !== totalUnits) {
    throw new Error('UNITS_NOT_FULLY_CLAIMED');
  }

  // 以“每份”作为权重，把“已认领部分”对应的金额（可能有取整）分配给认领者
  const targetTotal = options?.allowPartialUnits
    ? roundToYen((totalYen * usedUnits) / totalUnits)
    : totalYen;

  const allocated = largestRemainderToYen(
    targetTotal,
    shares.map((s, idx) => ({
      key: s.userId,
      exact: (targetTotal * units[idx]) / usedUnits,
    }))
  );

  return allocated.map((a) => ({ userId: String(a.key), amountYen: a.amountYen }));
}

export function getUserOwedYenForRoundItem(item: RoundItem, userId: string): number {
  if (!item.isShared) {
    if (item.userId !== userId) return 0;
    return getSharedItemTotalYen(item);
  }

  const shares = normalizeShares(item.shares);
  const myShare = shares.find((s) => s.userId === userId);
  if (!myShare) return 0;

  if (item.status === 'locked' && typeof myShare.amountYen === 'number') {
    return roundToYen(myShare.amountYen);
  }

  try {
    const allocations = computeSharedAllocations(item, { allowPartialUnits: true });
    const mine = allocations.find((a) => a.userId === userId);
    return mine ? mine.amountYen : 0;
  } catch {
    return 0;
  }
}

export function getSharedUnitsRemaining(item: RoundItem): number | null {
  if (!item.isShared || item.shareMode !== 'units') return null;
  const shares = normalizeShares(item.shares);
  const used = shares.reduce((sum, s) => sum + Math.max(0, Math.floor(s.units ?? 0)), 0);
  return Math.max(0, Math.floor(item.qty) - used);
}
