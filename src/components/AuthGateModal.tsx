import React, { useEffect, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, KeyRound, Lock, ShieldCheck, User } from 'lucide-react';

export interface RememberedAccountHint {
  uniqueKey: string;
  playerName: string;
}

interface AuthGateModalProps {
  open: boolean;
  canClose: boolean;
  onClose?: () => void;
  rememberedAccounts: RememberedAccountHint[];
  onCheckNameAvailability: (
    name: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onRegister: (
    name: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onLogin: (
    name: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
}

export const AuthGateModal: React.FC<AuthGateModalProps> = ({
  open,
  canClose,
  onClose,
  rememberedAccounts,
  onCheckNameAvailability,
  onRegister,
  onLogin,
}) => {
  const [tab, setTab] = useState<'register' | 'login'>(() =>
    rememberedAccounts.length > 0 ? 'login' : 'register'
  );
  const [nameInput, setNameInput] = useState(() =>
    rememberedAccounts.length > 0 ? rememberedAccounts[0].playerName : ''
  );
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [checkingName, setCheckingName] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    setPasswordInput('');
    if (rememberedAccounts.length > 0 && !nameInput.trim()) {
      setTab('login');
      setNameInput(rememberedAccounts[0].playerName);
    }
  }, [open, rememberedAccounts, nameInput]);

  useEffect(() => {
    if (!open || tab !== 'register') {
      setNameError(null);
      setCheckingName(false);
      return;
    }

    const trimmed = nameInput.trim();
    if (!trimmed) {
      setNameError(null);
      setCheckingName(false);
      return;
    }
    if (trimmed.length < 2) {
      setNameError('Digite um nome com pelo menos 2 caracteres.');
      setCheckingName(false);
      return;
    }

    let cancelled = false;
    setCheckingName(true);
    const timer = window.setTimeout(async () => {
      const res = await onCheckNameAvailability(trimmed);
      if (cancelled) return;
      setCheckingName(false);
      setNameError(res.ok ? null : res.error || 'Esse nome já existe! Escolha outro.');
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [nameInput, onCheckNameAvailability, open, tab]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);

    const cleanName = nameInput.trim().replace(/\s+/g, ' ');
    if (cleanName.length < 2) {
      setSubmitError('Digite seu nome (mínimo de 2 caracteres).');
      return;
    }
    if (passwordInput.length < 4) {
      setSubmitError('Sua senha precisa ter pelo menos 4 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      const result =
        tab === 'register'
          ? await onRegister(cleanName, passwordInput)
          : await onLogin(cleanName, passwordInput);

      if (!result.ok) {
        setSubmitError(
          result.error ||
            (tab === 'register'
              ? 'Não foi possível criar a conta.'
              : 'Nome ou senha incorretos.')
        );
      } else {
        setPasswordInput('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#05070D]/82 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-gate-title"
        className="w-full max-w-md bg-[#0B0F18] border border-white/12 rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-5 bg-[#101624] border-b border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2
                id="auth-gate-title"
                className="font-display text-xl font-bold text-white tracking-tight"
              >
                Sua Conta no Cyber Surfers
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Nome único e protegido por senha para manter sua conta salva após atualizações.
              </p>
            </div>
            <ShieldCheck className="w-6 h-6 text-cyan-400 shrink-0" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#070A10] border border-white/8">
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setSubmitError(null);
              }}
              className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === 'register'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Criar Conta
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setSubmitError(null);
                setNameError(null);
              }}
              className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === 'login'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Entrar na Conta
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {rememberedAccounts.length > 0 && (
            <div>
              <div className="text-[11px] font-medium text-slate-400 mb-1.5">
                Contas salvas neste navegador:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {rememberedAccounts.map((acc) => (
                  <button
                    key={acc.uniqueKey}
                    type="button"
                    onClick={() => {
                      setTab('login');
                      setNameInput(acc.playerName);
                      setSubmitError(null);
                    }}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border transition-colors whitespace-nowrap ${
                      nameInput.trim().toLowerCase() === acc.playerName.toLowerCase() &&
                      tab === 'login'
                        ? 'bg-cyan-500/18 border-cyan-400 text-cyan-200'
                        : 'bg-[#12192A] border-white/10 text-slate-200 hover:border-white/25'
                    }`}
                  >
                    {acc.playerName}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="auth-player-name"
              className="block text-xs font-semibold text-slate-200 mb-1.5"
            >
              Seu nome:
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="auth-player-name"
                type="text"
                maxLength={20}
                autoComplete="username"
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setSubmitError(null);
                }}
                placeholder="Ex: Biel.Jr"
                className={`w-full pl-9 pr-3 py-2.5 text-sm bg-[#070A10] border rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none ${
                  nameError
                    ? 'border-red-500/80 focus:border-red-400'
                    : 'border-white/15 focus:border-cyan-400'
                }`}
              />
            </div>
            {tab === 'register' && checkingName && !nameError && (
              <p className="mt-1.5 text-[11px] text-slate-400">
                Verificando se esse nome é único...
              </p>
            )}
            {tab === 'register' && nameError && (
              <div
                role="alert"
                className="mt-1.5 flex items-start gap-1.5 px-2.5 py-1.5 rounded-md bg-red-500/15 border border-red-500/40 text-[11px] text-red-300"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                <span>{nameError}</span>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="auth-player-password"
              className="block text-xs font-semibold text-slate-200 mb-1.5"
            >
              Sua senha:
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="auth-player-password"
                type={showPassword ? 'text' : 'password'}
                maxLength={64}
                autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setSubmitError(null);
                }}
                placeholder="Mínimo 4 caracteres"
                className="w-full pl-9 pr-10 py-2.5 text-sm bg-[#070A10] border border-white/15 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[#0E1524] border border-white/8 text-[11px] text-slate-300 leading-relaxed">
            <Lock className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              {tab === 'register'
                ? 'Depois de criar sua conta, seu nome fica exclusivo só para você e ninguém consegue copiar.'
                : 'Entre com seu nome e sua senha para recuperar seu recorde, skins e progresso salvos.'}
            </span>
          </div>

          {submitError && (
            <div
              role="alert"
              className="flex items-start gap-1.5 px-3 py-2 rounded-md bg-red-500/15 border border-red-500/40 text-xs text-red-300"
            >
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="submit"
              disabled={
                submitting ||
                (tab === 'register' && (checkingName || Boolean(nameError)))
              }
              className="flex-1 py-3 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-display font-bold text-sm transition-colors whitespace-nowrap"
            >
              {submitting
                ? 'Salvando...'
                : tab === 'register'
                  ? 'Criar Conta e Entrar'
                  : 'Entrar na Conta'}
            </button>
            {canClose && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-4 rounded-lg bg-[#141C2B] hover:bg-[#1E2940] text-slate-200 text-xs font-semibold border border-white/12 transition-colors whitespace-nowrap"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
