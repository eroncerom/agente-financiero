import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  TrendingUp,
  RefreshCw,
  Search,
  X,
  Building2,
  ArrowRight,
  Award,
  Sparkles,
  ChevronDown,
  Check,
  Zap
} from 'lucide-react';
import { MacroRegime, MarketIndex } from '../types';
import { SearchAssetItem } from './AssetSearchModal';

interface HeaderProps {
  macroRegime: MacroRegime | null;
  fxEurUsd: number;
  onRefresh: () => void;
  isRefreshing: boolean;
  onSelectAsset: (asset: SearchAssetItem) => void;
  onAuditInCentralPillar?: (ticker: string) => void;
  onOpenAIChat?: () => void;
  selectedMarket: MarketIndex;
  onSelectMarket: (market: MarketIndex) => void;
  autoRefreshInterval: number;
  onChangeAutoRefreshInterval: (interval: number) => void;
  isLiveSyncing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  macroRegime,
  fxEurUsd,
  onRefresh,
  isRefreshing,
  onSelectAsset,
  onAuditInCentralPillar,
  onOpenAIChat,
  selectedMarket,
  onSelectMarket,
  autoRefreshInterval,
  onChangeAutoRefreshInterval,
  isLiveSyncing
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchAssetItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isLiveMenuOpen, setIsLiveMenuOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const liveMenuRef = useRef<HTMLDivElement>(null);

  // Búsqueda con debounce de 250ms
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data: SearchAssetItem[] = await res.json();
          setResults(data);
          setIsOpen(true);
          setSelectedIndex(-1);
        }
      } catch (err) {
        console.error('Error en búsqueda de activos:', err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
      if (liveMenuRef.current && !liveMenuRef.current.contains(e.target as Node)) {
        setIsLiveMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Manejo de teclado (Flecha Arriba, Flecha Abajo, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen && results.length > 0) {
        setIsOpen(true);
        setSelectedIndex(0);
      } else if (results.length > 0) {
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex]);
      } else if (query.trim().length > 0) {
        // Si no hay elemento seleccionado, buscar/abrir directamente el ticker tecleado
        handleSelect({
          ticker: query.trim().toUpperCase(),
          name: query.trim().toUpperCase(),
          exchange: 'Búsqueda Directa'
        });
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelect = (item: SearchAssetItem) => {
    onSelectAsset(item);
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <header className="h-14 border-b border-borderSubtle bg-card rounded-xl px-5 flex items-center justify-between shadow-lg relative z-30">
      {/* Título de la aplicación */}
      <div className="flex items-center space-x-3.5 flex-shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-accentSky animate-pulse" />
        <div>
          <span className="text-sm font-extrabold tracking-wider text-textPrimary uppercase">
            Terminal de Inversiones & Decisiones
          </span>
          <span className="ml-2.5 text-[10px] px-2 py-0.5 rounded bg-cardSecondary text-accentSky border border-accentSky/30 font-mono">
            V1.0 ARQUITECTURA
          </span>
        </div>
      </div>

      {/* SELECTOR DE MERCADOS EN TIEMPO REAL (FASE 2: S&P 500 · NASDAQ 100 · IBEX 35) */}
      <div className="flex items-center bg-cardSecondary/90 p-1 rounded-xl border border-borderSubtle flex-shrink-0 space-x-1 shadow-inner ml-4">
        {[
          { id: 'SP500' as const, label: 'S&P 500', badge: 'US · $' },
          { id: 'NASDAQ' as const, label: 'NASDAQ 100', badge: 'TECH · $' },
          { id: 'IBEX35' as const, label: 'IBEX 35', badge: 'ES · €' }
        ].map((mkt) => {
          const isActive = selectedMarket === mkt.id;
          return (
            <button
              key={mkt.id}
              type="button"
              onClick={() => onSelectMarket(mkt.id)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                isActive
                  ? 'bg-accentSky text-canvas shadow-md scale-[1.02]'
                  : 'text-textSecondary hover:text-textPrimary hover:bg-cardHover/70'
              }`}
              title={`Operar con el mercado ${mkt.label} en tiempo real`}
            >
              <span>{mkt.label}</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold ${
                  isActive
                    ? 'bg-slate-900/40 text-canvas'
                    : 'bg-card text-textSecondary border border-borderSubtle'
                }`}
              >
                {mkt.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* CUADRO DE BÚSQUEDA DE ACCIONES (ZONA DESTACADA SUPERIOR) */}
      <div
        ref={containerRef}
        className="relative flex-1 max-w-md mx-6 hidden md:block"
      >
        <div className="relative flex items-center">
          <div className="absolute left-3 pointer-events-none text-textSecondary">
            <Search className="w-4 h-4 text-accentSky" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar activo (ej. AAPL, NVDA, TSLA, SAN.MC)..."
            className="w-full h-9 pl-9 pr-8 bg-cardSecondary border border-borderSubtle rounded-xl text-xs text-textPrimary placeholder:text-textSecondary/60 focus:outline-none focus:border-accentSky focus:ring-1 focus:ring-accentSky transition font-medium"
          />

          {isLoading ? (
            <div className="absolute right-2.5 text-accentSky animate-spin">
              <RefreshCw className="w-3.5 h-3.5" />
            </div>
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2.5 text-textSecondary hover:text-textPrimary transition p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>

        {/* Desplegable de Resultados de Búsqueda */}
        {isOpen && results.length > 0 && (
          <div className="absolute top-11 left-0 right-0 bg-card border border-borderMedium rounded-xl shadow-2xl py-1.5 z-50 max-h-80 overflow-y-auto animate-fadeIn backdrop-blur-md">
            <div className="px-3 py-1 text-[10px] uppercase font-bold text-textSecondary/70 tracking-wider flex items-center justify-between border-b border-borderSubtle/60 mb-1">
              <span>Resultados ({results.length})</span>
              <span className="font-mono text-[9px]">Enter para abrir</span>
            </div>

            {results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={`${item.ticker}-${idx}`}
                  type="button"
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between transition ${
                    isSelected ? 'bg-accentSky/15 text-textPrimary' : 'hover:bg-cardSecondary text-textSecondary'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div
                      className={`p-1.5 rounded-lg border ${
                        item.hasInstitutionalAudit
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-cardSecondary text-accentSky border-borderSubtle'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono font-bold text-xs text-textPrimary">
                          {item.ticker}
                        </span>
                        {item.exchange && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cardSecondary text-textSecondary border border-borderSubtle font-mono">
                            {item.exchange}
                          </span>
                        )}
                        {item.hasInstitutionalAudit && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30">
                            S&P 500
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-textSecondary truncate max-w-[240px]">
                        {item.name || item.ticker}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                    {item.price != null && item.price > 0 && (
                      <span className="font-mono font-bold text-xs text-textPrimary">
                        ${item.price.toFixed(2)}
                      </span>
                    )}
                    {onAuditInCentralPillar && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsOpen(false);
                          setQuery('');
                          onAuditInCentralPillar(item.ticker);
                        }}
                        className="px-2 py-1 rounded-lg bg-accentSky/15 hover:bg-accentSky/25 text-accentSky border border-accentSky/30 transition text-[10px] font-bold flex items-center space-x-1"
                        title={`Auditar ${item.ticker} directamente en el Pilar Central`}
                      >
                        <Award className="w-3 h-3" />
                        <span className="hidden sm:inline">Pilar Central</span>
                      </button>
                    )}
                    <ArrowRight className="w-3 h-3 text-textSecondary opacity-60" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {isOpen && results.length === 0 && !isLoading && query.trim().length > 0 && (
          <div className="absolute top-11 left-0 right-0 bg-card border border-borderMedium rounded-xl shadow-2xl p-3 z-50 text-center animate-fadeIn">
            <p className="text-xs text-textSecondary">
              Sin coincidencias directas para &quot;<strong className="text-textPrimary">{query}</strong>&quot;.
            </p>
            <div className="mt-2 flex items-center justify-center space-x-3">
              <button
                type="button"
                onClick={() =>
                  handleSelect({
                    ticker: query.trim().toUpperCase(),
                    name: query.trim().toUpperCase(),
                    exchange: 'Búsqueda Directa'
                  })
                }
                className="text-xs text-accentSky hover:underline font-mono inline-flex items-center space-x-1"
              >
                <span>Abrir cotización de {query.trim().toUpperCase()}</span>
                <ArrowRight className="w-3 h-3 inline" />
              </button>
              {onAuditInCentralPillar && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    const t = query.trim().toUpperCase();
                    setQuery('');
                    onAuditInCentralPillar(t);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-accentSky text-canvas hover:bg-accentSky/90 text-xs font-bold inline-flex items-center space-x-1 shadow transition"
                >
                  <Award className="w-3.5 h-3.5 inline" />
                  <span>Auditar en Pilar Central</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controles de la derecha */}
      <div className="flex items-center space-x-6 text-xs text-textSecondary flex-shrink-0">
        {/* Referencia Multidivisa EUR / USD */}
        <div className="flex items-center space-x-1.5 font-mono">
          <span className="text-textSecondary">EUR/USD:</span>
          <span className="text-textPrimary font-semibold">{fxEurUsd.toFixed(4)}</span>
        </div>

        {/* Estado BBDD Local */}
        <div className="flex items-center space-x-1.5">
          <Database className="w-3.5 h-3.5 text-statusGreen" />
          <span>BBDD Local:</span>
          <span className="text-statusGreen font-semibold">SQLite (portfolio.db)</span>
        </div>

        {/* Régimen Macro */}
        {macroRegime && (
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-3.5 h-3.5 text-accentYellow" />
            <span>Ciclo Deuda:</span>
            <span className="text-accentYellow font-bold bg-accentYellow/10 px-2.5 py-0.5 rounded border border-accentYellow/30 glow-yellow">
              {macroRegime.cycle_phase}
            </span>
          </div>
        )}

        {/* Botón de Copiloto Financiero IA */}
        {onOpenAIChat && (
          <button
            type="button"
            onClick={onOpenAIChat}
            className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-accentSky/15 to-purple-500/15 hover:from-accentSky/25 hover:to-purple-500/25 text-accentSky border border-accentSky/30 shadow-sm transition group cursor-pointer"
            title="Abrir Copiloto Financiero IA (Contextual)"
          >
            <Sparkles className="w-3.5 h-3.5 text-accentSky group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold">Copiloto IA</span>
          </button>
        )}

        {/* Selector de Modo En Vivo / Tiempo Real */}
        <div className="relative" ref={liveMenuRef}>
          <button
            type="button"
            onClick={() => setIsLiveMenuOpen((prev) => !prev)}
            className={`flex items-center space-x-2 px-2.5 py-1 rounded-lg border transition cursor-pointer text-xs font-semibold ${
              autoRefreshInterval > 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-cardSecondary border-borderSubtle text-textSecondary hover:text-textPrimary hover:bg-cardHover'
            }`}
            title="Configurar refresco de cotizaciones en tiempo real"
          >
            {autoRefreshInterval > 0 ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-500 inline-block"></span>
            )}
            <span className="font-mono text-[11px]">
              {autoRefreshInterval > 0 ? `En Vivo · ${autoRefreshInterval}s` : 'Manual'}
            </span>
            {isLiveSyncing ? (
              <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin" />
            ) : (
              <ChevronDown className="w-3 h-3 opacity-60" />
            )}
          </button>

          {isLiveMenuOpen && (
            <div className="absolute right-0 top-9 w-56 bg-card border border-borderMedium rounded-xl shadow-2xl py-1.5 z-50 animate-fadeIn backdrop-blur-md">
              <div className="px-3 py-1.5 border-b border-borderSubtle/60 text-[10px] font-bold uppercase tracking-wider text-textSecondary flex items-center justify-between">
                <span>Refresco En Tiempo Real</span>
                <Zap className="w-3 h-3 text-emerald-400" />
              </div>
              {[
                { val: 0, label: 'Manual / Estático', desc: 'Sin refresco automático' },
                { val: 15, label: 'En Vivo · 15 seg', desc: 'Alta frecuencia (Tick-by-tick)' },
                { val: 30, label: 'En Vivo · 30 seg', desc: 'Recomendado (Balance óptimo)' },
                { val: 60, label: 'En Vivo · 60 seg', desc: 'Conservador' }
              ].map((opt) => {
                const isSelected = autoRefreshInterval === opt.val;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => {
                      onChangeAutoRefreshInterval(opt.val);
                      setIsLiveMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-start justify-between transition hover:bg-cardSecondary ${
                      isSelected ? 'bg-emerald-500/10 text-emerald-400' : 'text-textPrimary'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">{opt.label}</div>
                      <div className="text-[10px] text-textSecondary">{opt.desc}</div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Botón de Refresco Rápido */}
        <button
          onClick={onRefresh}
          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-cardSecondary hover:bg-cardHover text-textSecondary hover:text-accentSky border border-borderSubtle transition"
          title="Refrescar datos locales"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-accentSky' : ''}`} />
          <span className="text-[11px]">Sincronizar</span>
        </button>
      </div>
    </header>
  );
};
