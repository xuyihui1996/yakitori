import React, { useMemo, useState } from 'react';
import { Lock, X, UserMinus, Plus } from 'lucide-react';
import { RoundItem, ShareMode, User } from '@/types';
import { formatMoney } from '@/utils/money';
import { computeSharedAllocations, getSharedItemTotalYen, getSharedUnitsRemaining, getUserOwedYenForRoundItem } from '@/utils/split';
import { useI18n } from '@/i18n';
import type { MessageKey } from '@/i18n/messages';

interface SharedItemDetailProps {
  isOpen: boolean;
  item: RoundItem | null;
  members: User[];
  currentUserId: string;
  isOwner: boolean;
  onClose: () => void;
  onJoinOrUpdateMyShare: (itemId: string, options?: { weight?: number; units?: number }) => Promise<void>;
  onAddParticipants: (itemId: string, userIds: string[]) => Promise<void>;
  onRemoveParticipant: (itemId: string, userId: string) => Promise<void>;
  onLock: (itemId: string) => Promise<void>;
}

const modeLabel: Record<ShareMode, MessageKey> = {
  equal: 'shared.mode.equal',
  ratio: 'shared.mode.ratio',
  units: 'shared.mode.units',
};

function initials(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  return t.length <= 2 ? t : t.slice(0, 2);
}

function Avatar({ user }: { user: User }) {
  return (
    <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-semibold">
      {initials(user.name)}
    </div>
  );
}

export const SharedItemDetail: React.FC<SharedItemDetailProps> = ({
  isOpen,
  item,
  members,
  currentUserId,
  isOwner,
  onClose,
  onJoinOrUpdateMyShare,
  onAddParticipants,
  onRemoveParticipant,
  onLock,
}) => {
  const { t } = useI18n();
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());

  if (!isOpen || !item) return null;

  const status = item.status ?? 'pending';
  const canManage = isOwner || item.userId === currentUserId;
  const shares = item.shares ?? [];
  const totalYen = getSharedItemTotalYen(item);

  const allocations = useMemo(() => {
    try {
      return computeSharedAllocations(item, { allowPartialUnits: true });
    } catch {
      return [];
    }
  }, [item]);

  const allocationMap = useMemo(() => new Map(allocations.map((a) => [a.userId, a.amountYen])), [allocations]);

  const remainingUnits = getSharedUnitsRemaining(item);
  const joinedIds = new Set(shares.map((s) => s.userId));

  const myShare = shares.find((s) => s.userId === currentUserId);
  const myWeight = Math.max(1, Math.floor(myShare?.weight ?? 1));
  const myUnits = Math.max(0, Math.floor(myShare?.units ?? 0));

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const titleMode = item.shareMode ? t(modeLabel[item.shareMode]) : '';

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={() => !busy && onClose()} />
      <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-xl max-w-2xl mx-auto">
        <div className="p-4 border-b flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 truncate">{item.nameDisplay}</h3>
              {item.isShared && item.shareMode && (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-white text-gray-700">
                  {t('common.shared')}·{titleMode}
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-100 text-gray-700">
                {t(`shared.join.${status}` as MessageKey)}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {formatMoney(item.price)} × {item.qty} = <span className="font-semibold text-gray-900">{formatMoney(totalYen)}</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">{t('shared.join.roundingHint')}</p>
          </div>
          <button
            onClick={() => !busy && onClose()}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* 我的应付 */}
          <div className="rounded-xl border p-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-900">{t('shared.detail.myOwed')}</p>
              <p className="text-lg font-semibold text-primary-700">{formatMoney(getUserOwedYenForRoundItem(item, currentUserId))}</p>
            </div>

            {item.shareMode === 'ratio' && status !== 'locked' && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-gray-700">{t('shared.detail.myWeight')}</p>
                <div className="flex items-center gap-2">
                  <button
                    className="w-10 h-10 rounded-xl border border-gray-200 bg-white text-lg font-semibold disabled:opacity-50"
                    disabled={busy !== null}
                    onClick={() => run('weight', async () => onJoinOrUpdateMyShare(item.id, { weight: Math.max(1, myWeight - 1) }))}
                  >
                    -
                  </button>
                  <span className="w-10 text-center text-sm font-semibold">{myWeight}</span>
                  <button
                    className="w-10 h-10 rounded-xl border border-gray-200 bg-white text-lg font-semibold disabled:opacity-50"
                    disabled={busy !== null}
                    onClick={() => run('weight', async () => onJoinOrUpdateMyShare(item.id, { weight: Math.min(99, myWeight + 1) }))}
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {item.shareMode === 'units' && status !== 'locked' && (
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-700">{t('shared.detail.myUnits')}</p>
                  <p className="text-xs text-gray-500">{t('shared.detail.remaining', { n: remainingUnits ?? 0 })}</p>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <button
                    className="w-10 h-10 rounded-xl border border-gray-200 bg-white text-lg font-semibold disabled:opacity-50"
                    disabled={busy !== null}
                    onClick={() => run('units', async () => onJoinOrUpdateMyShare(item.id, { units: Math.max(0, myUnits - 1) }))}
                  >
                    -
                  </button>
                  <span className="w-10 text-center text-sm font-semibold">{myUnits}</span>
                  <button
                    className="w-10 h-10 rounded-xl border border-gray-200 bg-white text-lg font-semibold disabled:opacity-50"
                    disabled={busy !== null || (remainingUnits ?? 0) <= 0}
                    onClick={() => run('units', async () => onJoinOrUpdateMyShare(item.id, { units: myUnits + 1 }))}
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 参与者明细 */}
          <div className="rounded-xl border overflow-hidden">
            <div className="px-4 py-3 bg-white border-b flex items-center justify-between">
              <p className="font-medium text-gray-900">{t('shared.detail.breakdown')}</p>
              {canManage && status !== 'locked' && (item.shareMode === 'equal' || item.shareMode === 'ratio') && (
                <button
                  className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 flex items-center gap-1"
                  onClick={() => {
                    setSelectedToAdd(new Set());
                    setAdding(true);
                  }}
                >
                  <Plus size={16} />
                  {t('shared.join.addPeople')}
                </button>
              )}
            </div>
            <div className="divide-y bg-white">
              {shares.length === 0 && (
                <div className="p-4 text-sm text-gray-500">{t('shared.detail.noParticipants')}</div>
              )}
              {shares.map((s) => {
                const m = memberMap.get(s.userId);
                const name = m?.name ?? s.userId;
                const amount = status === 'locked' ? s.amountYen : allocationMap.get(s.userId);
                const canRemove = canManage && status !== 'locked';
                return (
                  <div key={s.userId} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {m ? <Avatar user={m} /> : <div className="w-8 h-8 rounded-full bg-gray-200" />}
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{name}</p>
                        <p className="text-xs text-gray-500">
                          {item.shareMode === 'ratio' && `${t('shared.weight.title')} ${Math.max(1, Math.floor(s.weight ?? 1))}`}
                          {item.shareMode === 'units' && `${t('shared.units.title')} ${Math.max(0, Math.floor(s.units ?? 0))}`}
                          {item.shareMode === 'equal' && t('shared.mode.equal')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-gray-900">{amount !== undefined ? formatMoney(amount) : '-'}</p>
                      {canRemove && (
                        <button
                          className="p-2 rounded-lg hover:bg-red-50 text-red-600 disabled:opacity-50"
                          disabled={busy !== null}
                          onClick={() =>
                            run('remove', async () => {
                              await onRemoveParticipant(item.id, s.userId);
                            }).catch((e) => alert((e as Error).message))
                          }
                          title={t('shared.detail.remove')}
                        >
                          <UserMinus size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="p-4 border-t space-y-2">
          {canManage && (
            <button
              disabled={busy !== null || status === 'locked' || shares.length === 0 || (item.shareMode === 'units' && (remainingUnits ?? 0) > 0)}
              onClick={() => run('lock', async () => onLock(item.id)).catch((e) => alert((e as Error).message))}
              className="w-full py-3.5 rounded-xl bg-gray-900 text-white font-semibold hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Lock size={18} />
              {t('common.lock')}
            </button>
          )}
          <button
            disabled={busy !== null}
            onClick={onClose}
            className="w-full py-3.5 rounded-xl border border-gray-200 bg-white text-gray-800 font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            {t('common.close')}
          </button>
        </div>
      </div>

      {/* 加人（简易多选） */}
      {adding && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAdding(false)} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h4 className="font-semibold text-gray-900">{t('shared.creator.selectMembers')}</h4>
              <button className="p-2 rounded-lg hover:bg-gray-100" onClick={() => setAdding(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {members
                .filter((m) => !joinedIds.has(m.id))
                .map((m) => (
                  <label key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                    <span className="text-sm text-gray-800">{m.name}</span>
                    <input
                      type="checkbox"
                      checked={selectedToAdd.has(m.id)}
                      onChange={() => {
                        setSelectedToAdd((prev) => {
                          const next = new Set(prev);
                          if (next.has(m.id)) next.delete(m.id);
                          else next.add(m.id);
                          return next;
                        });
                      }}
                    />
                  </label>
                ))}
            </div>
            <div className="p-4 border-t">
              <button
                className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-semibold disabled:opacity-50"
                disabled={selectedToAdd.size === 0}
                onClick={() =>
                  run('add', async () => {
                    await onAddParticipants(item.id, Array.from(selectedToAdd));
                    setAdding(false);
                  }).catch((e) => alert((e as Error).message))
                }
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
