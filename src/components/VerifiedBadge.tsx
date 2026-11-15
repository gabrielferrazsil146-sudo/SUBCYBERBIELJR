import React from 'react';
import { BadgeCheck, Crown } from 'lucide-react';
import type { VerifiedRole } from '../types/game';

interface VerifiedBadgeProps {
  role?: VerifiedRole;
  variant?: 'pill' | 'compact' | 'corner';
  labelOverride?: string;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  role = 'dono',
  variant = 'compact',
  labelOverride,
}) => {
  const isOwner = role !== 'adm';
  const defaultLabel = isOwner ? 'Dono Verificado' : 'ADM Verificado';
  const text = labelOverride ?? defaultLabel;

  if (variant === 'compact') {
    return (
      <span
        title={defaultLabel}
        className={`verified-shimmer-badge inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide whitespace-nowrap shrink-0 border ${
          isOwner
            ? 'bg-gradient-to-r from-amber-500/25 via-cyan-500/25 to-amber-500/25 border-amber-300/70 text-amber-200'
            : 'bg-gradient-to-r from-cyan-500/25 via-sky-400/25 to-cyan-500/25 border-cyan-300/70 text-cyan-100'
        }`}
      >
        <BadgeCheck
          className={`w-3.5 h-3.5 verified-icon-glow shrink-0 ${
            isOwner ? 'text-amber-300' : 'text-cyan-300'
          }`}
        />
        <span>Verificado</span>
      </span>
    );
  }

  if (variant === 'corner') {
    return (
      <span
        title={defaultLabel}
        className={`verified-shimmer-badge inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide whitespace-nowrap shrink-0 border ${
          isOwner
            ? 'bg-gradient-to-r from-amber-500/25 via-cyan-500/20 to-amber-400/25 border-amber-300/75 text-amber-100'
            : 'bg-gradient-to-r from-cyan-500/25 via-sky-500/20 to-cyan-400/25 border-cyan-300/75 text-cyan-100'
        }`}
      >
        {isOwner ? (
          <Crown className="w-3.5 h-3.5 text-amber-300 verified-icon-glow shrink-0" />
        ) : (
          <BadgeCheck className="w-3.5 h-3.5 text-cyan-300 verified-icon-glow shrink-0" />
        )}
        <span>{text}</span>
      </span>
    );
  }

  return (
    <span
      title={defaultLabel}
      className={`verified-shimmer-badge inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wide whitespace-nowrap shrink-0 border ${
        isOwner
          ? 'bg-gradient-to-r from-amber-500/25 via-cyan-500/25 to-amber-500/25 border-amber-300/80 text-amber-100'
          : 'bg-gradient-to-r from-cyan-500/25 via-sky-500/25 to-cyan-500/25 border-cyan-300/80 text-cyan-100'
      }`}
    >
      <BadgeCheck
        className={`w-3.5 h-3.5 verified-icon-glow shrink-0 ${
          isOwner ? 'text-amber-300' : 'text-cyan-300'
        }`}
      />
      <span>{text}</span>
    </span>
  );
};
