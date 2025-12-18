import React, { useMemo, useState } from 'react';
import { Lock, Plus, X } from 'lucide-react';
import { RoundItem, ShareMode, User } from '@/types';
import { formatMoney } from '@/utils/money';
import { getSharedItemTotalYen, getSharedUnitsRemaining } from '@/utils/split';
import { useI18n } from '@/i18n';
import type { MessageKey } from '@/i18n/messages';

interface SharedJoinBannerProps {
  sharedItems: RoundItem[];
  members: User[];
  currentUserId: string;
  isOwner: boolean;
  onJoin: (itemId: string, options?: { weight?: number; units?: number }) => Promise<void>;
  onAddParticipants: (itemId: string, userIds: string[]) => Promise<void>;
  onLock: (itemId: string) => Promise<void>;
}

const statusClass: Record<NonNullable<RoundItem['status']>, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  active: 'bg-blue-100 text-blue-800 border-blue-200',
  locked: 'bg-gray-200 text-gray-700 border-gray-300',
};

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
    <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-semibold border-2 border-white">
      {initials(user.name)}
    </div>
  );
}

export const SharedJoinBanner: React.FC<SharedJoinBannerProps> = ({
  sharedItems,
  members,
  currentUserId,
  isOwner,
  onJoin,
  onAddParticipants,
  onLock,
}) => {
  const { t } = useI18n();
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const [busy, setBusy] = useState<Record<string, string>>({});

  const [ratioEditor, setRatioEditor] = useState<{ itemId: string; weight: number } | null>(null);
  const [unitsEditor, setUnitsEditor] = useState<{ itemId: string; units: number } | null>(null);
  const [addPeople, setAddPeople] = useState<{ itemId: string; selected: Set<string> } | null>(null);

  if (!sharedItems.length) return null;

  const run = async (itemId: string, key: string, fn: () => Promise<void>) => {
    setBusy((prev) => ({ ...prev, [itemId]: key }));
    try {
      await fn();
    } finally {
      setBusy((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
  };

  const getMyUnits = (item: RoundItem) => {
    const my = item.shares?.find((s) => s.userId === currentUserId);
    return Math.max(0, Math.floor(my?.units ?? 0));
  };

  const getMyWeight = (item: RoundItem) => {
    const my = item.shares?.find((s) => s.userId === currentUserId);
    return Math.max(1, Math.floor(my?.weight ?? 1));
  };

  return (
    <div className="space-y-3">
      {sharedItems.map((item) => {
        const status = (item.status ?? 'pending') as NonNullable<RoundItem['status']>;
        const canManage = isOwner || item.userId === currentUserId;
        const totalYen = getSharedItemTotalYen(item);
        const joinedUserIds = (item.shares ?? []).map((s) => s.userId);
        const joinedMembers = joinedUserIds.map((id) => memberMap.get(id)).filter(Boolean) as User[];

        const remainingUnits = getSharedUnitsRemaining(item);
        const isMineJoined = joinedUserIds.includes(currentUserId);

        const lockDisabled =
          status === 'locked' ||
          joinedUserIds.length === 0 ||
          (item.shareMode === 'units' && (remainingUnits ?? 0) > 0);

        const primaryAction = () => {
          if (!item.shareMode) return null;

          if (item.shareMode === 'equal') {
            return (
              <button
                onClick={() =>
                  run(item.id, 'join', async () => {
                    await onJoin(item.id);
                  }).catch((e) => alert((e as Error).message))
                }
                disabled={status === 'locked' || busy[item.id] !== undefined || (isMineJoined && !canManage)}
                className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isMineJoined ? t('shared.join.joined') : t('shared.join.joinEqual')}
              </button>
            );
          }

          if (item.shareMode === 'ratio') {
            return (
              <button
                onClick={() => setRatioEditor({ itemId: item.id, weight: getMyWeight(item) })}
                disabled={status === 'locked' || busy[item.id] !== undefined}
                className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isMineJoined ? t('shared.join.setWeight') : t('shared.join.joinRatio')}
              </button>
            );
          }

          // units
          return (
            <button
              onClick={() => setUnitsEditor({ itemId: item.id, units: Math.max(1, getMyUnits(item) || 1) })}
              disabled={status === 'locked' || busy[item.id] !== undefined}
              className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMineJoined ? t('shared.join.modifyUnits') : t('shared.join.claimUnits')}
            </button>
          );
        };

        return (
          <div key={item.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">{item.nameDisplay}</h3>
                    {item.shareMode && (
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-white text-gray-700">
                        {t('common.shared')}·{t(modeLabel[item.shareMode])}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusClass[status]}`}>
                      {t(`shared.join.${status}` as MessageKey)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatMoney(item.price)} × {item.qty} = <span className="font-medium text-gray-900">{formatMoney(totalYen)}</span>
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {joinedMembers.slice(0, 8).map((m) => (
                        <Avatar key={m.id} user={m} />
                      ))}
                      {joinedMembers.length > 8 && (
                        <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-semibold border-2 border-white">
                          +{joinedMembers.length - 8}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.shareMode === 'units' ? (
                        <span>{t('shared.join.remainingUnits', { n: remainingUnits ?? 0 })}</span>
                      ) : (
                        <span>{t('shared.join.joinedCount', { n: joinedMembers.length })}</span>
                      )}
                    </div>
                  </div>
                </div>

                {canManage && (
                  <div className="flex flex-col gap-2">
                    {(item.shareMode === 'equal' || item.shareMode === 'ratio') && (
                      <button
                        onClick={() => setAddPeople({ itemId: item.id, selected: new Set<string>() })}
                        disabled={status === 'locked' || busy[item.id] !== undefined}
                        className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <Plus size={16} />
                        {t('shared.join.addPeople')}
                      </button>
                    )}
                    <button
                      onClick={() =>
                        run(item.id, 'lock', async () => {
                          await onLock(item.id);
                        }).catch((e) => alert((e as Error).message))
                      }
                      disabled={lockDisabled || busy[item.id] !== undefined}
                      className="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 justify-center"
                    >
                      <Lock size={16} />
                      {t('common.lock')}
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-3">{primaryAction()}</div>

              <p className="mt-2 text-[11px] text-gray-500">
                {t('shared.join.roundingHint')}
              </p>
            </div>
          </div>
        );
      })}

      {/* 比例：权重 */}
      {ratioEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRatioEditor(null)} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h4 className="font-semibold text-gray-900">{t('shared.weight.title')}</h4>
              <button className="p-2 rounded-lg hover:bg-gray-100" onClick={() => setRatioEditor(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <button
                  className="w-12 h-12 rounded-xl border border-gray-200 text-lg font-semibold"
                  onClick={() => setRatioEditor((prev) => (prev ? { ...prev, weight: Math.max(1, prev.weight - 1) } : prev))}
                >
                  -
                </button>
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">{ratioEditor.weight}</p>
                  <p className="text-sm text-gray-500 mt-1">{t('shared.weight.hint')}</p>
                </div>
                <button
                  className="w-12 h-12 rounded-xl border border-gray-200 text-lg font-semibold"
                  onClick={() => setRatioEditor((prev) => (prev ? { ...prev, weight: Math.min(99, prev.weight + 1) } : prev))}
                >
                  +
                </button>
              </div>
            </div>
            <div className="p-4 border-t">
              <button
                className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-semibold"
                onClick={async () => {
                  const itemId = ratioEditor.itemId;
                  const weight = ratioEditor.weight;
                  setRatioEditor(null);
                  await run(itemId, 'join', async () => onJoin(itemId, { weight })).catch((e) => alert((e as Error).message));
                }}
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 按份数：认领 */}
      {unitsEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setUnitsEditor(null)} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h4 className="font-semibold text-gray-900">{t('shared.units.title')}</h4>
              <button className="p-2 rounded-lg hover:bg-gray-100" onClick={() => setUnitsEditor(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              {(() => {
                const item = sharedItems.find((i) => i.id === unitsEditor.itemId);
                const remaining = item ? getSharedUnitsRemaining(item) ?? 0 : 0;
                const myUnits = item ? getMyUnits(item) : 0;
                const max = item ? myUnits + remaining : unitsEditor.units;
                return (
                  <div className="flex items-center justify-between">
                    <button
                      className="w-12 h-12 rounded-xl border border-gray-200 text-lg font-semibold"
                      onClick={() =>
                        setUnitsEditor((prev) => (prev ? { ...prev, units: Math.max(0, prev.units - 1) } : prev))
                      }
                    >
                      -
                    </button>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-gray-900">{unitsEditor.units}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {t('shared.units.remainingMax', { remaining, max })}
                      </p>
                    </div>
                    <button
                      className="w-12 h-12 rounded-xl border border-gray-200 text-lg font-semibold"
                      onClick={() =>
                        setUnitsEditor((prev) => (prev ? { ...prev, units: Math.min(max, prev.units + 1) } : prev))
                      }
                    >
                      +
                    </button>
                  </div>
                );
              })()}
            </div>
            <div className="p-4 border-t space-y-2">
              <button
                className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-semibold"
                onClick={async () => {
                  const itemId = unitsEditor.itemId;
                  const units = unitsEditor.units;
                  setUnitsEditor(null);
                  await run(itemId, 'join', async () => onJoin(itemId, { units })).catch((e) => alert((e as Error).message));
                }}
              >
                {t('shared.units.save')}
              </button>
              <button
                className="w-full py-3.5 rounded-xl border border-gray-200 bg-white text-gray-800 font-semibold"
                onClick={async () => {
                  const itemId = unitsEditor.itemId;
                  setUnitsEditor(null);
                  await run(itemId, 'join', async () => onJoin(itemId, { units: 0 })).catch((e) => alert((e as Error).message));
                }}
              >
                {t('shared.units.clear')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 管理：加人 */}
      {addPeople && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddPeople(null)} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h4 className="font-semibold text-gray-900">{t('shared.join.addPeople')}</h4>
              <button className="p-2 rounded-lg hover:bg-gray-100" onClick={() => setAddPeople(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {(() => {
                const item = sharedItems.find((i) => i.id === addPeople.itemId);
                const joined = new Set((item?.shares ?? []).map((s) => s.userId));
                return members
                  .filter((m) => !joined.has(m.id))
                  .map((m) => (
                    <label key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                      <span className="text-sm text-gray-800">{m.name}</span>
                      <input
                        type="checkbox"
                        checked={addPeople.selected.has(m.id)}
                        onChange={() => {
                          setAddPeople((prev) => {
                            if (!prev) return prev;
                            const next = new Set(prev.selected);
                            if (next.has(m.id)) next.delete(m.id);
                            else next.add(m.id);
                            return { ...prev, selected: next };
                          });
                        }}
                      />
                    </label>
                  ));
              })()}
            </div>
            <div className="p-4 border-t">
              <button
                className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-semibold disabled:opacity-50"
                disabled={addPeople.selected.size === 0}
                onClick={async () => {
                  const itemId = addPeople.itemId;
                  const ids = Array.from(addPeople.selected);
                  setAddPeople(null);
                  await run(itemId, 'add', async () => onAddParticipants(itemId, ids)).catch((e) => alert((e as Error).message));
                }}
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
