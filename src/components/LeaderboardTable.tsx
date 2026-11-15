import React from 'react';
import { Trophy } from 'lucide-react';
import type { LeaderboardEntry } from '../types/game';
import { formatTimeFull } from '../utils/format';
import { VerifiedBadge } from './VerifiedBadge';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  loading: boolean;
  error: string | null;
  highlightId?: string | null;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  entries,
  loading,
  error,
  highlightId,
}) => {
  const top15 = entries.slice(0, 15);

  return (
    <section
      aria-label="Ranking Top Global"
      className="flex flex-col bg-[#0B0F18]/92 border border-white/10 rounded-xl shadow-2xl overflow-hidden w-full"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#101624]">
        <div className="flex items-center gap-2.5">
          <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
          <h2 className="font-display text-sm font-bold tracking-wide text-slate-100 whitespace-nowrap">
            Ranking Top Global
          </h2>
        </div>
        <span className="text-xs text-slate-400 whitespace-nowrap">1º ao 15º lugar</span>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[340px] lg:max-h-[460px] custom-scroll">
        {loading ? (
          <div className="p-6 text-center text-xs text-slate-400">Carregando ranking global...</div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-red-400">{error}</div>
        ) : top15.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 leading-relaxed">
            Nenhum recorde registrado ainda. Complete uma corrida para inaugurar o Top 15.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-[#0E1420] text-[11px] font-semibold text-slate-400">
                <th className="py-2.5 pl-4 pr-2 whitespace-nowrap">Posição</th>
                <th className="py-2.5 px-2 whitespace-nowrap">Jogador</th>
                <th className="py-2.5 px-2 whitespace-nowrap text-right">Tempo</th>
                <th className="py-2.5 pl-2 pr-4 whitespace-nowrap text-right">Mapa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {top15.map((row) => {
                const isHighlighted = highlightId && row.id === highlightId;
                const isVerified = Boolean(row.verified);
                const posColor =
                  row.rank === 1
                    ? 'text-amber-400 font-bold'
                    : row.rank === 2
                      ? 'text-slate-200 font-bold'
                      : row.rank === 3
                        ? 'text-orange-400 font-bold'
                        : 'text-slate-400';

                const rowBg = isHighlighted
                  ? 'bg-cyan-500/18 text-cyan-100'
                  : isVerified
                    ? 'bg-gradient-to-r from-amber-500/[0.08] via-cyan-500/[0.07] to-transparent hover:from-amber-500/[0.14]'
                    : 'hover:bg-white/[0.03] transition-colors';

                return (
                  <tr key={row.id} className={rowBg}>
                    <td className={`py-2.5 pl-4 pr-2 font-mono-tabular whitespace-nowrap ${posColor}`}>
                      {row.rank}º
                    </td>
                    <td className="py-2.5 px-2 font-medium text-slate-100 max-w-[175px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`truncate ${
                            isVerified ? 'text-amber-100 font-semibold' : ''
                          }`}
                        >
                          {row.playerName}
                        </span>
                        {isVerified && (
                          <VerifiedBadge
                            role={row.verifiedRole ?? 'adm'}
                            variant="compact"
                          />
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 font-mono-tabular text-cyan-300 font-semibold text-right whitespace-nowrap">
                      {formatTimeFull(row.timeMs)}
                    </td>
                    <td className="py-2.5 pl-2 pr-4 text-slate-400 text-right max-w-[115px] truncate">
                      {row.mapName}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};
