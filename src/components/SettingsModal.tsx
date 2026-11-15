import React from 'react';
import { Sliders, Volume2, VolumeX, X } from 'lucide-react';
import type { GraphicsSettings, QualityLevel } from '../types/game';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: GraphicsSettings;
  onChange: (next: GraphicsSettings) => void;
}

const QUALITIES: Array<{ id: QualityLevel; label: string; hint: string }> = [
  { id: 'baixa', label: 'Baixa', hint: 'Máximo FPS em celulares e PCs fracos' },
  { id: 'media', label: 'Média', hint: 'Equilíbrio entre sombras e fluidez' },
  { id: 'alta', label: 'Alta', hint: 'Resolução máxima, sombras e detalhes' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  settings,
  onChange,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md bg-[#0C111C] border border-white/12 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#101624]">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h2 className="font-display text-base font-bold text-slate-100">
              Otimização e Gráficos
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configurações"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Graphics Quality */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Qualidade Gráfica
            </label>
            <div className="grid grid-cols-3 gap-2">
              {QUALITIES.map((q) => {
                const active = settings.quality === q.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => onChange({ ...settings, quality: q.id })}
                    className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                      active
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                        : 'bg-[#111827] text-slate-300 border-white/10 hover:border-white/25'
                    }`}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              {QUALITIES.find((q) => q.id === settings.quality)?.hint}
            </p>
          </div>

          {/* Sem Texturas Toggle */}
          <div className="flex items-center justify-between gap-4 p-3.5 rounded-lg bg-[#111827] border border-white/10">
            <div>
              <div className="text-sm font-semibold text-slate-100">Sem Texturas</div>
              <div className="text-xs text-slate-400">
                Visual simplificado em cinza, preto e branco para máxima leveza
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.noTextures}
              onClick={() => onChange({ ...settings, noTextures: !settings.noTextures })}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                settings.noTextures
                  ? 'bg-slate-100 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {settings.noTextures ? 'Ativado' : 'Desativado'}
            </button>
          </div>

          {/* Sound Toggle */}
          <div className="flex items-center justify-between gap-4 p-3.5 rounded-lg bg-[#111827] border border-white/10">
            <div className="flex items-center gap-2.5">
              {settings.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-cyan-400 shrink-0" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              <div>
                <div className="text-sm font-semibold text-slate-100">Efeitos Sonoros</div>
                <div className="text-xs text-slate-400">Áudio procedural de movimento e impacto</div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.soundEnabled}
              onClick={() => onChange({ ...settings, soundEnabled: !settings.soundEnabled })}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                settings.soundEnabled
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {settings.soundEnabled ? 'Ligado' : 'Mudo'}
            </button>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-white/10 bg-[#101624] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold bg-white text-slate-950 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
