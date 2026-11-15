import React, { useMemo, useState } from 'react';
import { Check, KeyRound, Lock, X } from 'lucide-react';
import { COSMETIC_ITEMS } from '../data/catalog';
import type { CosmeticItem, CosmeticSlot, EquippedLoadout } from '../types/game';
import { formatTimeShort } from '../utils/format';

interface WardrobeModalProps {
  open: boolean;
  onClose: () => void;
  bestTimeMs: number;
  admUnlocked: boolean;
  loadout: EquippedLoadout;
  onEquip: (slot: CosmeticSlot, itemId: string | null) => void;
  onRedeemCode: (code: string) => Promise<{ ok: boolean; message: string }>;
}

type FilterTab = 'all' | CosmeticSlot;

const TABS: Array<{ id: FilterTab; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'suit', label: 'Personagens' },
  { id: 'cape', label: 'Capas' },
  { id: 'hair', label: 'Cabelos' },
  { id: 'eyewear', label: 'Óculos' },
  { id: 'headband', label: 'Faixa' },
  { id: 'aura', label: 'Efeitos' },
  { id: 'weapon', label: 'Armas' },
];

export const WardrobeModal: React.FC<WardrobeModalProps> = ({
  open,
  onClose,
  bestTimeMs,
  admUnlocked,
  loadout,
  onEquip,
  onRedeemCode,
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [codeInput, setCodeInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [codeFeedback, setCodeFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const bestTimeSec = Math.floor(bestTimeMs / 1000);

  const isItemUnlocked = (item: CosmeticItem): boolean => {
    if (item.unlockSource === 'default') return true;
    if (item.unlockSource === 'record') {
      return bestTimeSec >= (item.requiredTimeSec ?? 0);
    }
    if (item.unlockSource === 'adm' || item.unlockSource === 'player') return admUnlocked;
    return false;
  };

  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return COSMETIC_ITEMS;
    return COSMETIC_ITEMS.filter((item) => item.slot === activeTab);
  }, [activeTab]);

  if (!open) return null;

  const handleSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await onRedeemCode(codeInput);
      setCodeFeedback(res);
      if (res.ok) setCodeInput('');
    } finally {
      setSubmitting(false);
    }
  };

  const getUnlockText = (item: CosmeticItem): string => {
    if (item.unlockSource === 'default') return 'Inicial';
    if (item.unlockSource === 'record') {
      return `Recorde ${formatTimeShort((item.requiredTimeSec ?? 0) * 1000)}`;
    }
    return 'Exclusivo (Senha Secreta)';
  };

  return (
    <div className="fixed inset-y-0 left-0 z-30 w-full sm:w-[470px] bg-[#0B0F18]/96 border-r border-white/10 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#101624]">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-100">Personagens e Códigos</h2>
          <p className="text-xs text-slate-400">
            Visual apenas — nenhuma skin dá vantagem na corrida
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar Armário"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Password Redemption */}
      <div className="px-5 py-3.5 border-b border-white/10 bg-[#0E1420]">
        <form onSubmit={handleSubmitCode} className="flex items-center gap-2">
          <div className="relative flex-1">
            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              autoComplete="off"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="Digite a senha secreta..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#080B10] border border-white/15 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold bg-cyan-500 text-slate-950 rounded-lg hover:bg-cyan-400 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            {submitting ? 'Validando...' : 'Desbloquear'}
          </button>
        </form>
        {codeFeedback && (
          <p className={`mt-2 text-xs ${codeFeedback.ok ? 'text-emerald-400' : 'text-red-400'}`}>
            {codeFeedback.message}
          </p>
        )}
        <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
          <span>Itens Secretos: {admUnlocked ? 'Desbloqueado' : 'Bloqueado'}</span>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="px-5 py-2.5 border-b border-white/10 flex items-center gap-1.5 overflow-x-auto custom-scroll">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scroll">
        {filteredItems.map((item) => {
          const unlocked = isItemUnlocked(item);
          const isEquipped = loadout[item.slot] === item.id;
          const canUnequip = item.slot !== 'suit';

          return (
            <div
              key={item.id}
              className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors ${
                isEquipped
                  ? 'bg-cyan-500/12 border-cyan-400/50'
                  : 'bg-[#101624] border-white/8 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-lg border border-white/15 shrink-0 flex items-center justify-center"
                  style={{
                    background: item.secondaryColor
                      ? `linear-gradient(135deg, ${item.previewColor} 50%, ${item.secondaryColor} 50%)`
                      : item.previewColor,
                  }}
                >
                  {!unlocked && <Lock className="w-4 h-4 text-white drop-shadow" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-100 truncate">{item.name}</div>
                  <div className="text-xs text-slate-400 line-clamp-1">{item.description}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{getUnlockText(item)}</div>
                </div>
              </div>

              {unlocked ? (
                <button
                  type="button"
                  onClick={() => onEquip(item.slot, isEquipped && canUnequip ? null : item.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    isEquipped
                      ? canUnequip
                        ? 'bg-slate-800 text-cyan-300 border border-cyan-400/40 hover:bg-slate-700'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                      : 'bg-white/10 text-slate-100 hover:bg-cyan-500 hover:text-slate-950'
                  }`}
                >
                  {isEquipped && <Check className="w-3.5 h-3.5" />}
                  {isEquipped ? (canUnequip ? 'Remover' : 'Equipado') : 'Equipar'}
                </button>
              ) : (
                <span className="text-xs text-slate-500 font-medium whitespace-nowrap shrink-0 px-2">
                  Bloqueado
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
