import React, { useMemo, useState } from 'react';
import { X, Plus, Users } from 'lucide-react';
import { RoundItemShare, ShareMode, User } from '@/types';
import { useI18n } from '@/i18n';
import type { MessageKey } from '@/i18n/messages';

interface SharedItemCreatorProps {
  isOpen: boolean;
  members: User[];
  onClose: () => void;
  onCreate: (item: {
    nameDisplay: string;
    price: number;
    qty: number;
    note?: string;
    isShared: boolean;
    shareMode?: ShareMode;
    shares?: RoundItemShare[];
    allowSelfJoin?: boolean;
    allowClaimUnits?: boolean;
  }) => Promise<void>;
  initialValues?: {
    nameDisplay?: string;
    price?: number;
    qty?: number;
    note?: string;
  };
}

const modeLabel: Record<ShareMode, MessageKey> = {
  equal: 'shared.mode.equal',
  ratio: 'shared.mode.ratio',
  units: 'shared.mode.units',
};

export const SharedItemCreator: React.FC<SharedItemCreatorProps> = ({
  isOpen,
  members,
  onClose,
  onCreate,
  initialValues,
}) => {
  const { t } = useI18n();
  const [nameDisplay, setNameDisplay] = useState(initialValues?.nameDisplay || '');
  const [price, setPrice] = useState(initialValues?.price ? String(initialValues.price) : '');
  const [qty, setQty] = useState(initialValues?.qty || 1);
  const [note, setNote] = useState(initialValues?.note || '');

  const [isShared, setIsShared] = useState(true);
  const [shareMode, setShareMode] = useState<ShareMode>('equal');
  const [allowSelfJoin, setAllowSelfJoin] = useState(true);
  const [allowClaimUnits, setAllowClaimUnits] = useState(true);

  const [selectingMembers, setSelectingMembers] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});

  const [submitting, setSubmitting] = useState(false);

  const selectedMembers = useMemo(() => {
    const map = new Map(members.map((m) => [m.id, m]));
    return selectedUserIds.map((id) => map.get(id)).filter(Boolean) as User[];
  }, [members, selectedUserIds]);

  if (!isOpen) return null;

  const reset = () => {
    setNameDisplay(initialValues?.nameDisplay || '');
    setPrice(initialValues?.price ? String(initialValues.price) : '');
    setQty(initialValues?.qty || 1);
    setNote(initialValues?.note || '');
    setIsShared(true);
    setShareMode('equal');
    setAllowSelfJoin(true);
    setAllowClaimUnits(true);
    setSelectedUserIds([]);
    setWeights({});
  };

  const handleCreate = async () => {
    if (!nameDisplay.trim() || !price) {
      alert(t('itemInput.needNamePrice'));
      return;
    }

    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      alert(t('itemInput.invalidPrice'));
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      alert(t('itemInput.invalidQty'));
      return;
    }

    const base = {
      nameDisplay: nameDisplay.trim(),
      price: Math.round(priceNum),
      qty: Math.floor(qty),
      note: note.trim() || undefined,
    };

    setSubmitting(true);
    try {
      if (!isShared) {
        await onCreate({ ...base, isShared: false });
      } else {
        const shares: RoundItemShare[] =
          shareMode === 'units'
            ? []
            : selectedUserIds.map((uid) => ({
              userId: uid,
              weight: shareMode === 'ratio' ? Math.max(1, Math.floor(weights[uid] ?? 1)) : undefined,
            }));

        await onCreate({
          ...base,
          isShared: true,
          shareMode,
          shares,
          allowSelfJoin,
          allowClaimUnits,
        });
      }

      reset();
      onClose();
    } catch (e) {
      alert((e as Error).message || t('common.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelected = (userId: string) => {
    setSelectedUserIds((prev) => {
      const set = new Set(prev);
      if (set.has(userId)) set.delete(userId);
      else set.add(userId);
      return Array.from(set);
    });
    setWeights((prev) => ({ ...prev, [userId]: Math.max(1, Math.floor(prev[userId] ?? 1)) }));
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={() => !submitting && onClose()} />
      <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-xl max-w-2xl mx-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{t('shared.creator.title')}</h3>
          <button
            onClick={() => !submitting && onClose()}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* 基本信息 */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('shared.creator.name')}</label>
              <input
                value={nameDisplay}
                onChange={(e) => setNameDisplay(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="例：かしわ"
                disabled={submitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('shared.creator.price')}</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="165"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {shareMode === 'units' && isShared ? t('shared.creator.totalUnits') : t('shared.creator.qty')}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQty((v) => Math.max(1, v - 1))}
                    className="w-10 h-10 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                    disabled={submitting}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                    className="w-16 h-10 text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setQty((v) => v + 1)}
                    className="w-10 h-10 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                    disabled={submitting}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('shared.creator.note')}</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="例：鸡肉串"
                disabled={submitting}
              />
            </div>
          </div>

          {/* 共享设置 */}
          <div className="rounded-xl border bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{t('shared.creator.toggle')}</p>
                <p className="text-xs text-gray-500">{t('shared.creator.desc')}</p>
              </div>
              <button
                type="button"
                className={`w-12 h-7 rounded-full p-1 transition-colors ${isShared ? 'bg-primary-600' : 'bg-gray-300'}`}
                onClick={() => setIsShared((v) => !v)}
                disabled={submitting}
                aria-label="toggle-shared"
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${isShared ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            {isShared && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(modeLabel) as ShareMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setShareMode(mode)}
                      className={`py-2.5 rounded-lg text-sm font-medium border ${shareMode === mode ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-200'
                        }`}
                      disabled={submitting}
                    >
                      {t(modeLabel[mode])}
                    </button>
                  ))}
                </div>

                {(shareMode === 'equal' || shareMode === 'ratio') && (
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t('shared.creator.allowSelfJoin')}</p>
                      <p className="text-xs text-gray-500">{t('shared.creator.allowSelfJoinHint')}</p>
                    </div>
                    <button
                      type="button"
                      className={`w-12 h-7 rounded-full p-1 transition-colors ${allowSelfJoin ? 'bg-primary-600' : 'bg-gray-300'}`}
                      onClick={() => setAllowSelfJoin((v) => !v)}
                      disabled={submitting}
                      aria-label="toggle-self-join"
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${allowSelfJoin ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                )}

                {shareMode === 'units' && (
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t('shared.creator.allowClaimUnits')}</p>
                      <p className="text-xs text-gray-500">{t('shared.creator.allowClaimUnitsHint')}</p>
                    </div>
                    <button
                      type="button"
                      className={`w-12 h-7 rounded-full p-1 transition-colors ${allowClaimUnits ? 'bg-primary-600' : 'bg-gray-300'}`}
                      onClick={() => setAllowClaimUnits((v) => !v)}
                      disabled={submitting}
                      aria-label="toggle-claim-units"
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${allowClaimUnits ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                )}

                {(shareMode === 'equal' || shareMode === 'ratio') && (
                  <div className="pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-gray-500" />
                        <p className="text-sm font-medium text-gray-900">{t('shared.creator.presetParticipants')}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectingMembers(true)}
                        className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                        disabled={submitting}
                      >
                        {t('shared.creator.selectMembers')}
                      </button>
                    </div>

                    <div className="mt-2 space-y-2">
                      {selectedMembers.map((m) => (
                        <div key={m.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-2">
                          <span className="text-sm text-gray-800">{m.name}</span>
                          {shareMode === 'ratio' ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                onClick={() => setWeights((prev) => ({ ...prev, [m.id]: Math.max(1, (prev[m.id] ?? 1) - 1) }))}
                                disabled={submitting}
                              >
                                -
                              </button>
                              <span className="w-10 text-center text-sm font-medium">{Math.max(1, weights[m.id] ?? 1)}</span>
                              <button
                                type="button"
                                className="w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                onClick={() => setWeights((prev) => ({ ...prev, [m.id]: Math.max(1, (prev[m.id] ?? 1) + 1) }))}
                                disabled={submitting}
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">{t('shared.mode.equal')}</span>
                          )}
                        </div>
                      ))}
                      <p className="text-xs text-gray-500">{t('shared.creator.roundingHint')}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="p-4 border-t">
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="w-full py-3.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
          >
            <Plus size={18} />
            <span>{submitting ? t('shared.creator.creating') : isShared ? t('shared.creator.createShared') : t('shared.creator.createNormal')}</span>
          </button>
        </div>
      </div>

      {/* 选择成员（简易多选） */}
      {selectingMembers && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectingMembers(false)} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h4 className="font-semibold text-gray-900">{t('shared.creator.selectParticipants')}</h4>
              <button className="p-2 rounded-lg hover:bg-gray-100" onClick={() => setSelectingMembers(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {members.map((m) => (
                <label key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                  <span className="text-sm text-gray-800">{m.name}</span>
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(m.id)}
                    onChange={() => toggleSelected(m.id)}
                  />
                </label>
              ))}
            </div>
            <div className="p-4 border-t">
              <button
                className="w-full py-3 rounded-lg bg-primary-600 text-white font-medium"
                onClick={() => setSelectingMembers(false)}
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
