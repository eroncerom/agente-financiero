import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  PlusCircle,
  Building2,
  RefreshCw,
  Eye,
  FileCheck2,
  Award
} from 'lucide-react';
import { StockPriceChart } from './StockPriceChart';
import { Currency } from '../types';

export interface SearchAssetItem {
  ticker: string;
  name?: string;
  exchange?: string;
  type?: string;
  currency?: string;
  price?: number | null;
  sector?: string | null;
  hasInstitutionalAudit?: boolean;
}

interface AssetSearchModalProps {
  isOpen: boolean;
  asset: SearchAssetItem | null;
  onClose: () => void;
  onRequestAudit: (ticker: string) => void;
  onAuditInCentralPillar?: (ticker: string) => void;
  onAddTrade: (data: {
    ticker: string;
    companyName?: string;
    buyPrice?: number;
    fairValue?: number;
    currency?: Currency;
  }) => void;
  onAddToWatchlist?: (ticker: string) => void;
  onOpenFinancialDeepDive?: (ticker: string) => void;
  isAuditing?: boolean;
}

interface QuoteDetail {
  ticker: string;
  name: string;
  price: number | null;
  currency: string;
  price_eur?: number | null;
  change_pct?: number | null;
  fifty_two_week_low?: number | null;
  fifty_two_week_high?: number | null;
  fair_value?: number | null;
  mos_buy_ceiling?: number | null;
  arquetipo?: string | null;
  quality_tier?: string | null;
  modelo_valoracion?: string | null;
  formula_valoracion?: string | null;
}

export const AssetSearchModal: React.FC<AssetSearchModalProps> = ({
  isOpen,
  asset,
  onClose,
  onRequestAudit,
  onAuditInCentralPillar,
  onAddTrade,
  onAddToWatchlist,
  onOpenFinancialDeepDive,
  isAuditing = false
}) => {
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  useEffect(() => {
    if (!isOpen || !asset?.ticker) {
      setQuote(null);
      return;
    }

    let isMounted = true;
    const fetchQuote = async () => {
      try {
        setIsLoadingQuote(true);
        const res = await fetch(`/api/quote/${encodeURIComponent(asset.ticker)}`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            setQuote(json);
          }
        }
      } catch (err) {
        console.error('Error al obtener cotización:', err);
      } finally {
        if (isMounted) {
          setIsLoadingQuote(false);
        }
      }
    };

    fetchQuote();
    return () => {
      isMounted = false;
    };
  }, [isOpen, asset?.ticker]);

  // Manejar tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !asset) return null;

  const currentPrice = quote?.price ?? asset.price ?? 0;
  const currency = (quote?.currency || asset.currency || 'USD') as Currency;
  const sym = currency === 'EUR' ? '€' : '$';
  const companyName = quote?.name || asset.name || asset.ticker;
  const low52 = quote?.fifty_two_week_low;
  const high52 = quote?.fifty_two_week_high;

  // Cálculo de posición en el rango de 52 semanas
  const rangePct =
    low52 && high52 && high52 > low52 && currentPrice > 0
      ? Math.max(0, Math.min(100, ((currentPrice - low52) / (high52 - low52)) * 100))
      : 50;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
      <div className="bg-canvas border border-borderMedium w-full max-w-4xl rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col space-y-4 max-h-[95vh] overflow-y-auto">
        {/* Cabecera del Modal */}
        <div className="flex items-start justify-between border-b border-borderSubtle pb-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-xl bg-accentSky/15 text-accentSky border border-accentSky/30 shadow-sm">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-black text-textPrimary tracking-tight">
                  {asset.ticker}
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-md bg-cardSecondary text-textSecondary font-mono border border-borderSubtle">
                  {asset.exchange || 'Mercado'}
                </span>
                {asset.hasInstitutionalAudit && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30">
                    S&P 500 Auditado
                  </span>
                )}
                {quote?.arquetipo && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-accentSky/10 text-accentSky font-medium border border-accentSky/30 hidden sm:inline-block">
                    {quote.arquetipo}
                  </span>
                )}
              </div>
              <p className="text-xs text-textSecondary mt-0.5 font-medium">
                {companyName} {asset.sector ? `· ${asset.sector}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-cardSecondary border border-transparent hover:border-borderSubtle transition"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ficha de Cotización en Tiempo Real */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-card border border-borderSubtle">
          <div>
            <span className="text-[10px] text-textSecondary uppercase flex items-center space-x-1 font-semibold">
              <span>Cotización en Vivo</span>
              {isLoadingQuote && <RefreshCw className="w-2.5 h-2.5 animate-spin text-accentSky" />}
            </span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-2xl font-black text-textPrimary font-mono">
                {sym}{currentPrice.toFixed(2)}
              </span>
              {quote?.price_eur && currency === 'USD' && (
                <span className="text-xs text-textSecondary font-mono">
                  (€{quote.price_eur.toFixed(2)})
                </span>
              )}
            </div>
          </div>

          <div>
            <span className="text-[10px] text-textSecondary uppercase block font-semibold">
              Rango 52 Semanas
            </span>
            <div className="text-xs font-mono font-bold text-textPrimary mt-1">
              {low52 ? `${sym}${low52.toFixed(2)}` : '-'} — {high52 ? `${sym}${high52.toFixed(2)}` : '-'}
            </div>
            {low52 && high52 && (
              <div className="w-full bg-cardSecondary h-1.5 rounded-full mt-1.5 overflow-hidden border border-borderSubtle">
                <div
                  className="bg-accentSky h-full rounded-full transition-all"
                  style={{ width: `${rangePct}%` }}
                  title={`Posición actual: ${rangePct.toFixed(0)}% del rango anual`}
                />
              </div>
            )}
          </div>

          <div>
            <span className="text-[10px] text-textSecondary uppercase block font-semibold">
              Valor Intrínseco Justo
            </span>
            <span className="text-base font-bold font-mono text-emerald-400 mt-0.5 block">
              {quote?.fair_value ? `${sym}${quote.fair_value.toFixed(2)}` : 'Auditoría requerida'}
            </span>
            <span 
              className="text-[10px] text-textSecondary font-mono truncate block max-w-[140px]"
              title={quote?.modelo_valoracion || 'Fair Value Teórico Fundamental'}
            >
              {quote?.modelo_valoracion 
                ? quote.modelo_valoracion.split('(')[0].trim() 
                : 'Fair Value Teórico'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-textSecondary uppercase block font-semibold">
              Techo Máx. Compra (MoS)
            </span>
            <span className="text-base font-bold font-mono text-accentYellow mt-0.5 block">
              {quote?.mos_buy_ceiling ? `${sym}${quote.mos_buy_ceiling.toFixed(2)}` : 'Auditoría requerida'}
            </span>
            <span className="text-[10px] text-textSecondary font-mono">
              Precio Admisible (P₀ ≤ VP_MoS)
            </span>
          </div>
        </div>

        {/* Gráfico de Precios con Velas Japonesas y Barras OHLC */}
        <div className="w-full">
          <StockPriceChart
            ticker={asset.ticker}
            currency={currency}
            currentPrice={currentPrice}
            fairValue={quote?.fair_value}
            mosCeiling={quote?.mos_buy_ceiling}
            initialTimeframe="1M"
            initialMode="candles"
            onPriceLoaded={(p) => {
              if (p && !quote?.price) {
                setQuote((prev: QuoteDetail | null) => (prev ? { ...prev, price: p } : { ticker: asset.ticker, name: companyName, price: p, currency }));
              }
            }}
          />
        </div>

        {/* Barra de Acciones Principales */}
        <div className="pt-2 border-t border-borderSubtle flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-textSecondary flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-accentSky animate-pulse" />
            <span>Datos en tiempo real integrados con el motor financiero Pilar 1</span>
          </div>

          <div className="flex items-center space-x-3">
            {/* Botón: Añadir a Seguimiento */}
            {onAddToWatchlist && (
              <button
                type="button"
                onClick={() => {
                  onAddToWatchlist(asset.ticker);
                  onClose();
                }}
                className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-cardSecondary hover:bg-borderSubtle border border-borderSubtle text-textPrimary text-xs font-bold transition shadow-sm"
                title="Poner esta compañía en seguimiento continuo"
              >
                <Eye className="w-4 h-4 text-accentSky" />
                <span>Seguir</span>
              </button>
            )}

            {/* Botón: Ver Radiografía Financiera */}
            {onOpenFinancialDeepDive && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFinancialDeepDive(asset.ticker);
                }}
                className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition shadow-sm"
                title="Ver Radiografía Financiera Institucional (14 métricas auditadas SEC EDGAR)"
              >
                <FileCheck2 className="w-4 h-4 text-emerald-400" />
                <span>Radiografía Financiera (SEC)</span>
              </button>
            )}

            {/* Botón: Auditar en Pilar Central */}
            {onAuditInCentralPillar && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAuditInCentralPillar(asset.ticker);
                }}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-accentSky hover:bg-accentSky/90 text-canvas text-xs font-black transition shadow-md"
                title="Cargar y auditar esta compañía en el Pilar Central con los 3 escenarios"
              >
                <Award className="w-4 h-4" />
                <span>Auditar en Pilar Central</span>
              </button>
            )}

            {/* Botón: Solicitar Auditoría Completa */}
            <button
              type="button"
              disabled={isAuditing}
              onClick={() => onRequestAudit(asset.ticker)}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-accentSky/15 hover:bg-accentSky/25 border border-accentSky/40 text-accentSky text-xs font-bold transition shadow-sm disabled:opacity-50"
              title="Ejecutar análisis metodológico completo Pilar 1 (Gordon-Shapiro, Flujos, MoS y Filtro Anti-Trampas)"
            >
              {isAuditing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Auditando {asset.ticker}...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Solicitar Auditoría Completa</span>
                </>
              )}
            </button>

            {/* Botón: Añadir Compra / Registrar Operación */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onAddTrade({
                  ticker: asset.ticker,
                  companyName,
                  buyPrice: currentPrice > 0 ? currentPrice : undefined,
                  fairValue: quote?.fair_value ?? undefined,
                  currency
                });
              }}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-statusGreen hover:bg-statusGreen/90 text-canvas text-xs font-bold transition shadow-md"
              title="Registrar una nueva compra en la cartera local de SQLite"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Añadir Compra</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
