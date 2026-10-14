import React from 'react';
import {
  X,
  ShieldAlert,
  AlertTriangle,
  TrendingDown,
  Target,
  Lightbulb,
  HelpCircle,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Activity,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Eye,
  FileCheck2,
  ChevronRight,
  Award
} from 'lucide-react';
import { DiscardedCompanyDetail } from '../types';
import { StockPriceChart } from './StockPriceChart';
import { CompanyFinancialDeepDiveModal } from './CompanyFinancialDeepDiveModal';

interface DiscardedDetailModalProps {
  isOpen: boolean;
  company: DiscardedCompanyDetail | null;
  onClose: () => void;
  onApplySuggestedSettings?: (pivotG: number, mos: number) => void;
  onBuyTrade?: (company: DiscardedCompanyDetail) => void;
  onAddToWatchlist?: (ticker: string) => void;
  onOpenFinancialDeepDive?: (ticker: string) => void;
  onAuditInCentralPillar?: (ticker: string) => void;
}

export const DiscardedDetailModal: React.FC<DiscardedDetailModalProps> = ({
  isOpen,
  company,
  onClose,
  onApplySuggestedSettings,
  onBuyTrade,
  onAddToWatchlist,
  onOpenFinancialDeepDive,
  onAuditInCentralPillar
}) => {
  if (!isOpen || !company) return null;

  const [isLocalDeepDiveOpen, setIsLocalDeepDiveOpen] = React.useState(false);
  const initialP0 = company.precio_cierre_P0 || 0;
  const [dynamicLivePrice, setDynamicLivePrice] = React.useState<number>(initialP0);
  React.useEffect(() => {
    setDynamicLivePrice(company.precio_cierre_P0 || 0);
  }, [company?.ticker, company?.precio_cierre_P0]);

  const p0 = dynamicLivePrice > 0 ? dynamicLivePrice : initialP0;
  const r = company.tasa_descuento_r || 0;
  const d1 = company.D1_o_FCFA1 || 0;
  const beta = company.beta || 1.0;
  const pivotG = company.pivot_g || 0.04;
  const mosPct = company.mos_discount_pct ?? 30;

  const isSpanish = company.currency === 'EUR' || company.currency_symbol === '€' || company.ticker?.endsWith('.MC');
  const currSym = isSpanish ? '€' : '$';
  const currencyCode: 'EUR' | 'USD' = isSpanish ? 'EUR' : (company.currency === 'EUR' ? 'EUR' : 'USD');

  // Auditoría Anti-Trampas y Salud Fundamental
  const auditoria = company.auditoria_trampas;
  const healthScore = company.health_score ?? auditoria?.healthScore ?? 75;
  const qualityTier = company.quality_tier ?? auditoria?.qualityTier ?? 'AA';
  const qualityLabel = company.quality_label ?? auditoria?.qualityLabel ?? 'Salud Fundamental Sólida';
  const payoutEps = company.payout_eps_pct ?? auditoria?.payoutEpsPct;
  const payoutFcf = company.payout_fcf_pct ?? auditoria?.payoutFcfPct;
  const fcfConv = company.fcf_conversion_pct ?? auditoria?.fcfConvPct;
  const pos52W = company.posicion_rango_52w ?? auditoria?.posRango52w;
  const alertasTrampas = auditoria?.alertas || [];

  // Estado local para simular márgenes de seguridad en vivo dentro del popup
  const [activeMos, setActiveMos] = React.useState<number>(mosPct);
  React.useEffect(() => {
    setActiveMos(mosPct);
  }, [company?.ticker, mosPct]);

  // Perfil empresarial y métricas macroeconómicas
  const perfil = company.perfil_empresa || (beta < 0.80 ? 'DEFENSIVA_MADURA' : beta > 1.25 ? 'ALTA_VOLATILIDAD_CICLICA' : 'CALIDAD_CRECIMIENTO');
  const nombrePerfil = company.nombre_perfil || (perfil === 'DEFENSIVA_MADURA' ? 'Defensiva Madura (Cash Cow)' : perfil === 'ALTA_VOLATILIDAD_CICLICA' ? 'Alta Volatilidad / Tech' : 'Calidad & Crecimiento');
  const dividendYield = company.dividend_yield_pct ?? (p0 > 0 ? Number(((d1 / p0) * 100).toFixed(2)) : 0);
  const spreadYieldVsRf = company.spread_yield_vs_rf ?? Number((dividendYield - 4.10).toFixed(2));
  const gEfectivo = company.g_efectivo_utilizado ?? (company.escenario_neutro?.g ?? (perfil === 'DEFENSIVA_MADURA' ? 0.035 : pivotG));
  const spreadRG = company.spread_r_g ?? Number(((r - gEfectivo) * 100).toFixed(2));

  // Fair Value Teórico Justo (0% MoS)
  const fairValue = company.fair_value_teorico ?? company.escenario_neutro?.VP_teorico ?? company.escalera_mos?.fair_value ?? Number((d1 / Math.max(0.005, r - gEfectivo)).toFixed(2));

  // Escalera de precios según MoS sobre el Fair Value realista
  const priceMoS10 = Number((fairValue * 0.90).toFixed(2));
  const priceMoS20 = Number((fairValue * 0.80).toFixed(2));
  const priceMoS30 = Number((fairValue * 0.70).toFixed(2));

  // Techo dinámico según el MoS seleccionado activamente en el modal
  const dynamicTecho = Number((fairValue * ((100 - activeMos) / 100)).toFixed(2));
  const dynamicDiscrepancia = p0 > 0 ? Number((((dynamicTecho - p0) / p0) * 100).toFixed(1)) : 0;

  // Estado de compra respecto al techo dinámico
  const isEnZonaCompra = p0 <= dynamicTecho;
  const isEnValorJusto = !isEnZonaCompra && p0 <= fairValue;

  // Rango de mercado 52 semanas
  const low52W = company.rango_52_semanas?.low ?? null;
  const high52W = company.rango_52_semanas?.high ?? null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-card border border-borderMedium w-full max-w-3xl rounded-2xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        {/* 1. Header con Información de la Compañía, Perfil y Estado de Compra */}
        <div className="flex justify-between items-start border-b border-borderSubtle pb-3.5">
          <div className="flex items-start space-x-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isEnZonaCompra
                ? 'bg-statusGreen/15 border border-statusGreen/30 text-statusGreen'
                : isEnValorJusto
                  ? 'bg-accentYellow/15 border border-accentYellow/30 text-accentYellow'
                  : 'bg-statusRed/15 border border-statusRed/30 text-statusRed'
            }`}>
              {isEnZonaCompra ? <ShieldCheck className="w-6 h-6" /> : isEnValorJusto ? <AlertTriangle className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="text-lg font-black text-textPrimary">{company.nombre}</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cardSecondary text-accentSky border border-borderSubtle">
                  {company.ticker}
                </span>
                {/* Badge de Perfil Empresarial */}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accentSky/10 text-accentSky border border-accentSky/30">
                  {nombrePerfil}
                </span>
                {/* Badge de Estado de Compra */}
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                  isEnZonaCompra
                    ? 'bg-statusGreen/10 text-statusGreen border-statusGreen/30'
                    : isEnValorJusto
                      ? 'bg-accentYellow/10 text-accentYellow border-accentYellow/30'
                      : 'bg-statusRed/10 text-statusRed border-statusRed/30'
                }`}>
                  {isEnZonaCompra
                    ? `En Zona de Compra (MoS ${activeMos}%)`
                    : isEnValorJusto
                      ? `Valor Justo (Sin MoS ${activeMos}%)`
                      : `Sobreprecio (${dynamicDiscrepancia}%)`}
                </span>
              </div>
              <p className="text-xs text-textSecondary mt-1">
                Auditoría detallada de valoración intrínseca, perfil de madurez, techos Graham y riesgos.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                if (onOpenFinancialDeepDive) {
                  onOpenFinancialDeepDive(company.ticker);
                } else {
                  setIsLocalDeepDiveOpen(true);
                }
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs shadow-sm transition"
              title={`Ver Radiografía Financiera Institucional (14 Métricas Auditadas SEC EDGAR) de ${company.ticker}`}
            >
              <FileCheck2 className="w-4 h-4 text-emerald-400" />
              <span>Radiografía Financiera (SEC)</span>
            </button>

            {onAddToWatchlist && (
              <button
                type="button"
                onClick={() => onAddToWatchlist(company.ticker)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cardSecondary hover:bg-borderSubtle text-textPrimary border border-borderSubtle font-bold text-xs shadow-sm transition"
                title={`Poner ${company.ticker} en seguimiento continuo`}
              >
                <Eye className="w-4 h-4 text-accentSky" />
                <span>Poner en Seguimiento</span>
              </button>
            )}

            {onBuyTrade && (
              <button
                type="button"
                onClick={() => onBuyTrade(company)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-statusGreen hover:bg-statusGreen/90 text-canvas font-bold text-xs shadow-md transition"
                title={`Registrar compra directa de ${company.ticker} con cotización actual y Fair Value precargados`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Añadir Compra</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="text-textSecondary hover:text-textPrimary p-1.5 rounded-lg hover:bg-cardSecondary transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 1.5. BANNER ESPECIAL: ALERTA DE TRAMPA DE VALOR / CUCHILLO CAYENDO */}
        {company.alerta_trampa_valor && (
          <div className="p-3.5 rounded-xl bg-statusRed/10 border border-statusRed/40 space-y-2">
            <div className="flex items-center space-x-2 text-statusRed font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>ALERTA DE MERCADO: POSIBLE TRAMPA DE VALOR (CAÍDA DEL -{company.caida_desde_maximo_52w_pct ?? 50}% EN 52 SEMANAS)</span>
            </div>
            <p className="text-xs text-textSecondary leading-relaxed">
              <strong>Atención al Inversor:</strong> Aunque el modelo cuantitativo detecta un descuento matemático en base a sus flujos de caja históricos pasados ({currSym}{d1.toFixed(2)}/acción), la acción sufre un desplome severo en bolsa. El mercado está descontando un <strong>deterioro estructural del negocio</strong> (amenaza de disrupción por Inteligencia Artificial en TurboTax/QuickBooks, pérdida de clientes por precios altos y desaceleración de ingresos).
            </p>
            {company.fair_value_estres && (
              <div className="p-2.5 rounded-lg bg-card border border-borderSubtle font-mono text-[11px] grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-textSecondary block">Fair Value en Escenario de Estrés (-30% flujos, g=4%):</span>
                  <strong className="text-textPrimary text-xs">{currSym}{company.fair_value_estres.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-textSecondary block">Techo MoS {activeMos}% en Escenario de Estrés:</span>
                  <strong className="text-statusRed text-xs">{currSym}{(company.techo_mos_estres ?? (company.fair_value_estres * ((100 - activeMos) / 100))).toFixed(2)}</strong>
                </div>
              </div>
            )}
            <p className="text-[11px] text-textSecondary leading-relaxed">
              <strong>Veredicto Prudencial:</strong> Si la disrupción de la IA comprime los márgenes futuros de Intuit, su valor intrínseco real no es {currSym}496, sino que cae a la zona de <strong>{currSym}{company.fair_value_estres?.toFixed(2)}</strong>. Comprar ahora es una apuesta especulativa contracorriente (*Catching a falling knife*), no una compra defensiva segura.
            </p>
          </div>
        )}

        {/* 1.8. ESCUDO INSTITUCIONAL ANTI-TRAMPAS DE MERCADO & CALIDAD */}
        <div className="p-3.5 rounded-xl bg-canvas border border-borderSubtle space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-accentSky" />
              <h4 className="font-bold text-textPrimary text-xs uppercase tracking-wider">
                Escudo Institucional Anti-Trampas & Calidad Fundamental
              </h4>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                qualityTier === 'AAA' ? 'bg-statusGreen/15 text-statusGreen border-statusGreen/30' :
                qualityTier === 'AA' ? 'bg-accentSky/15 text-accentSky border-accentSky/30' :
                qualityTier === 'B' ? 'bg-accentYellow/15 text-accentYellow border-accentYellow/30' :
                'bg-statusRed/15 text-statusRed border-statusRed/30'
              }`}>
                Tier {qualityTier} · {healthScore}/100
              </span>
              <span className="text-[10px] text-textSecondary font-semibold">
                {qualityLabel}
              </span>
            </div>
          </div>

          {/* Semáforos de los 5 Monitores de Trampas Institucionales */}
          <div className="grid grid-cols-5 gap-2 text-[11px] font-mono">
            {/* 1. Cuchillo Cayendo */}
            <div className={`p-2 rounded-lg border ${
              auditoria?.alertaCuchilloCayendo || company.alerta_trampa_valor
                ? 'bg-statusRed/10 border-statusRed/40 text-statusRed'
                : 'bg-card border-borderSubtle text-textSecondary'
            }`}>
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold">1. Caída 52W</span>
                {auditoria?.alertaCuchilloCayendo || company.alerta_trampa_valor ? (
                  <XCircle className="w-3 h-3 text-statusRed" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 text-statusGreen" />
                )}
              </div>
              <span className="text-xs font-bold block mt-0.5">
                {company.caida_desde_maximo_52w_pct ? `-${company.caida_desde_maximo_52w_pct}%` : 'Normal'}
              </span>
              <span className="text-[9px] block text-textSecondary font-sans truncate">
                {auditoria?.alertaCuchilloCayendo || company.alerta_trampa_valor ? 'Alerta Caída >35%' : 'Sin colapso'}
              </span>
            </div>

            {/* 2. Trampa de Dividendo */}
            <div className={`p-2 rounded-lg border ${
              auditoria?.alertaYieldTrap
                ? 'bg-statusRed/10 border-statusRed/40 text-statusRed'
                : 'bg-card border-borderSubtle text-textSecondary'
            }`}>
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold">2. Yield Trap</span>
                {auditoria?.alertaYieldTrap ? (
                  <XCircle className="w-3 h-3 text-statusRed" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 text-statusGreen" />
                )}
              </div>
              <span className="text-xs font-bold block mt-0.5 truncate" title={`Payout EPS: ${payoutEps ?? 'N/A'}% | Payout FCF: ${payoutFcf ?? 'N/A'}%`}>
                {payoutEps ? `${payoutEps}% EPS` : `${dividendYield}% yield`}
              </span>
              <span className="text-[9px] block text-textSecondary font-sans truncate">
                {auditoria?.alertaYieldTrap ? (payoutFcf ? `FCF: ${payoutFcf}%` : 'Payout inviable') : 'Dividendo sano'}
              </span>
            </div>

            {/* 3. Pico de Ciclo */}
            <div className={`p-2 rounded-lg border ${
              auditoria?.alertaPicoCiclo
                ? 'bg-accentYellow/10 border-accentYellow/40 text-accentYellow'
                : 'bg-card border-borderSubtle text-textSecondary'
            }`}>
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold">3. Pico Ciclo</span>
                {auditoria?.alertaPicoCiclo ? (
                  <AlertTriangle className="w-3 h-3 text-accentYellow" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 text-statusGreen" />
                )}
              </div>
              <span className="text-xs font-bold block mt-0.5">
                {pos52W != null ? `${pos52W}% rango` : 'Equilibrado'}
              </span>
              <span className="text-[9px] block text-textSecondary font-sans truncate">
                {auditoria?.alertaPicoCiclo ? 'Máximo cíclico' : 'Ciclo neutral'}
              </span>
            </div>

            {/* 4. Calidad Contable */}
            <div className={`p-2 rounded-lg border ${
              auditoria?.alertaCalidadContable
                ? 'bg-accentYellow/10 border-accentYellow/40 text-accentYellow'
                : 'bg-card border-borderSubtle text-textSecondary'
            }`}>
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold">4. FCF / EPS</span>
                {auditoria?.alertaCalidadContable ? (
                  <AlertTriangle className="w-3 h-3 text-accentYellow" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 text-statusGreen" />
                )}
              </div>
              <span className="text-xs font-bold block mt-0.5">
                {fcfConv != null ? `${fcfConv}% caja` : '100%'}
              </span>
              <span className="text-[9px] block text-textSecondary font-sans truncate">
                {auditoria?.alertaCalidadContable ? 'Baja conversión' : 'Caja real sólida'}
              </span>
            </div>

            {/* 5. Suelo Técnico */}
            <div className={`p-2 rounded-lg border ${
              auditoria?.alertaSinSuelo
                ? 'bg-accentYellow/10 border-accentYellow/40 text-accentYellow'
                : 'bg-card border-borderSubtle text-textSecondary'
            }`}>
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold">5. Suelo 52W</span>
                {auditoria?.alertaSinSuelo ? (
                  <AlertTriangle className="w-3 h-3 text-accentYellow" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 text-statusGreen" />
                )}
              </div>
              <span className="text-xs font-bold block mt-0.5">
                {company.distancia_minimo_52w_pct != null ? `+${company.distancia_minimo_52w_pct}% mín` : 'Consolidado'}
              </span>
              <span className="text-[9px] block text-textSecondary font-sans truncate">
                {auditoria?.alertaSinSuelo ? 'En mínimos 52W' : 'Suelo formado'}
              </span>
            </div>
          </div>

          {/* Alertas Detalladas de Mercado */}
          {alertasTrampas.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-borderSubtle/60">
              {alertasTrampas.map((alerta, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-card border border-borderSubtle text-xs flex items-start space-x-2">
                  <span className="text-base flex-shrink-0 mt-0.5">{alerta.icono}</span>
                  <div>
                    <span className="font-bold text-textPrimary">{alerta.titulo}: </span>
                    <span className="text-textSecondary text-[11px] leading-relaxed">{alerta.detalle}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Alertas de Trampas Fundamentales (Punto 9) */}
          {company.trampas_fundamentales && company.trampas_fundamentales.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-statusRed/30">
              <span className="text-[10px] font-bold text-statusRed uppercase tracking-wider block">
                Alertas de Trampa Fundamental Detectadas (Auditoría Académica)
              </span>
              {company.trampas_fundamentales.map((tf, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-statusRed/10 border border-statusRed/30 text-xs flex items-start space-x-2">
                  <span className="text-statusRed font-bold flex-shrink-0 mt-0.5">⚠️</span>
                  <div>
                    <span className="font-bold text-statusRed">{tf.titulo}: </span>
                    <span className="text-textSecondary text-[11px] leading-relaxed">{tf.detalle}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Desglose Académico de Salud Fundamental (Punto 12) */}
          {company.health_metrics && company.health_metrics.length > 0 && (
            <div className="pt-2 border-t border-borderSubtle/60 space-y-1.5">
              <span className="text-[10px] font-bold text-accentSky uppercase tracking-wider block">
                Desglose Académico de Salud Fundamental (0–100 Puntos)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px] font-mono">
                {company.health_metrics.map((hm, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-card border border-borderSubtle flex flex-col justify-between">
                    <span className="text-[10px] text-textSecondary">{hm.nombre}</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-bold text-textPrimary">{hm.valor}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        hm.puntos >= 15 ? 'bg-statusGreen/15 text-statusGreen' :
                        hm.puntos >= 8 ? 'bg-accentSky/15 text-accentSky' :
                        hm.puntos > 0 ? 'bg-accentYellow/15 text-accentYellow' :
                        'bg-statusRed/15 text-statusRed'
                      }`}>
                        +{hm.puntos} pts
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 1.9. GRÁFICO VECTORIAL DE VELAS Y VALORACIÓN INTRÍNSECA */}
        <StockPriceChart
          ticker={company.ticker}
          currency={currencyCode}
          currentPrice={p0}
          fairValue={fairValue}
          mosCeiling={dynamicTecho}
          initialMode="candles"
          initialTimeframe="1M"
          onPriceLoaded={(realPrice) => {
            if (realPrice > 0 && Math.abs(realPrice - p0) / p0 > 0.05) {
              setDynamicLivePrice(realPrice);
            }
          }}
        />

        {/* 2. Análisis de Valoración: Cotización Real vs Techo Máximo Graham */}
        <div className="p-3.5 rounded-xl bg-canvas border border-borderSubtle space-y-2">
          <div className="flex items-center space-x-2 text-xs">
            <HelpCircle className="w-4 h-4 text-accentSky" />
            <h4 className="font-bold text-textPrimary uppercase tracking-wider">
              {isEnZonaCompra
                ? `¿Por qué está en Zona de Compra (+${dynamicDiscrepancia}% de holgura)?`
                : `¿Por qué está Fuera de Zona de Compra (${dynamicDiscrepancia}%)?`}
            </h4>
          </div>

          {isEnZonaCompra ? (
            <>
              <p className="text-xs text-textSecondary leading-relaxed">
                La cotización actual en bolsa ({currSym}{p0.toFixed(2)}) se encuentra <strong>por debajo del precio techo máximo admisible de compra</strong> ({currSym}{dynamicTecho.toFixed(2)} con MoS del {activeMos}%):
              </p>
              <div className="p-2.5 rounded-lg bg-statusGreen/10 border border-statusGreen/30 font-mono text-[11px] space-y-1">
                <div className="text-textSecondary">
                  Fórmula de Holgura: Δ = [ ( Techo Máx. Compra MoS - Cotización Actual ) / Cotización Actual ] × 100
                </div>
                <div className="text-statusGreen font-bold">
                  Resultado: [ ( {currSym}{dynamicTecho.toFixed(2)} - {currSym}{p0.toFixed(2)} ) / {currSym}{p0.toFixed(2)} ] × 100 = +{dynamicDiscrepancia}%
                </div>
              </div>
              <p className="text-[11px] text-textSecondary leading-relaxed">
                <strong>No tienes que esperar a que suba la acción.</strong> En la teoría de Benjamin Graham, el inversor defensivo compra cuando el precio está <em>por debajo</em> del techo prudente. Cotizar a {currSym}{p0.toFixed(2)} frente a un Fair Value de {currSym}{fairValue.toFixed(2)} te otorga un colchón de seguridad activo del {activeMos}%.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-textSecondary leading-relaxed">
                El precio actual de la bolsa ({currSym}{p0.toFixed(2)}) cotiza <strong>por encima del precio techo máximo de compra</strong> ({currSym}{dynamicTecho.toFixed(2)} con MoS {activeMos}%):
              </p>
              <div className="p-2.5 rounded-lg bg-card border border-borderSubtle font-mono text-[11px] space-y-1">
                <div className="text-textSecondary">
                  Fórmula de Desviación: Δ = [ ( Techo Máx. Compra MoS - Cotización Actual ) / Cotización Actual ] × 100
                </div>
                <div className="text-statusRed font-bold">
                  Resultado: [ ( {currSym}{dynamicTecho.toFixed(2)} - {currSym}{p0.toFixed(2)} ) / {currSym}{p0.toFixed(2)} ] × 100 = {dynamicDiscrepancia}%
                </div>
              </div>
              <p className="text-[11px] text-textSecondary leading-relaxed">
                Para el coste de capital exigido (r = {(r * 100).toFixed(2)}%) y un crecimiento sostenible del {(gEfectivo * 100).toFixed(1)}%, el valor intrínseco justo es de <strong>{currSym}{fairValue.toFixed(2)}</strong>. Para entrar con un colchón de protección del {activeMos}%, el techo admisible es de <strong>{currSym}{dynamicTecho.toFixed(2)}</strong>. Por tanto, cotiza con un <strong>recargo del {Math.abs(dynamicDiscrepancia)}%</strong> sobre el precio de compra prudente.
              </p>
            </>
          )}

          {/* Nota Aclaratoria Expresa sobre la regla del Techo */}
          <div className="p-2 rounded-lg bg-cardSecondary border border-borderSubtle text-[10px] text-textSecondary flex items-start space-x-2">
            <Lightbulb className="w-4 h-4 text-accentYellow flex-shrink-0 mt-0.5" />
            <span>
              <strong>Regla de Oro Graham:</strong> El Margen de Seguridad fija el <u>TECHO MÁXIMO</u> a pagar, jamás un precio objetivo que deba esperarse a que suba. Cuanto más abajo de este techo esté la cotización, mayor es el descuento y la protección a tu favor.
            </span>
          </div>
        </div>

        {/* 2.5. Modelo de Valoración Institucional & Fórmula Matemática */}
        {(company.modelo_valoracion || company.formula_valoracion) && (
          <div className="p-3 rounded-xl bg-cardSecondary/60 border border-borderSubtle space-y-1.5 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-accentSky tracking-wider">
                Modelo Multi-Arquetipo Aplicado
              </span>
              <span className="text-[10px] text-textSecondary">
                Arquetipo: <strong className="text-textPrimary">{company.nombre_arquetipo || nombrePerfil}</strong>
              </span>
            </div>
            <div className="text-textPrimary font-semibold text-[11px]">
              {company.modelo_valoracion}
            </div>
            {company.formula_valoracion && (
              <div className="text-[10px] text-accentYellow bg-canvas/70 p-2 rounded-lg border border-borderSubtle">
                {company.formula_valoracion}
              </div>
            )}
            <div className="flex items-center space-x-4 text-[10px] text-textSecondary pt-1 border-t border-borderSubtle/40 flex-wrap gap-y-1">
              {company.g_fundamental_pct != null && (
                <span>Crecimiento Fundamental (g_fund): <strong className="text-textPrimary">+{company.g_fundamental_pct}%</strong></span>
              )}
              {company.g_implicito_precio_pct != null && (
                <span title="DCF Inverso: Crecimiento implícito en la cotización">DCF Inverso (g_implícito): <strong className="text-accentYellow">+{company.g_implicito_precio_pct}%</strong></span>
              )}
              {company.dispersion_valoracion_pct != null && (
                <span>Dispersión Pes./Opt.: <strong className="text-textPrimary">{company.dispersion_valoracion_pct}%</strong></span>
              )}
              {company.downside_beta != null && (
                <span>Beta: <strong className="text-textPrimary">{beta.toFixed(2)}</strong> (β⁻: <strong className="text-accentYellow">{company.downside_beta.toFixed(2)}</strong>)</span>
              )}
              {company.tbv_per_share != null && company.tbv_per_share > 0 && (
                <span>Tangible Book Value: <strong className="text-textPrimary">{currSym}{company.tbv_per_share.toFixed(2)}</strong></span>
              )}
              {company.sbc_per_share != null && company.sbc_per_share > 0 && (
                <span>SBC/acción deducido: <strong className="text-statusRed">{currSym}{company.sbc_per_share.toFixed(2)}</strong></span>
              )}
            </div>
          </div>
        )}

        {/* BANNER DESTACADO: RADIOGRAFÍA FINANCIERA & RETORNOS (14 MÉTRICAS AUDITADAS SEC) */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  Radiografía Financiera Completa & Retornos Históricos
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  14 Métricas SEC
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Márgenes (Bruto, EBITDA, Operativo, Neto, FCF), Retornos de capital (ROE, ROA, ROIC), CapEx y Conversión de beneficios en caja.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onOpenFinancialDeepDive) {
                onOpenFinancialDeepDive(company.ticker);
              } else {
                setIsLocalDeepDiveOpen(true);
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex-shrink-0"
          >
            <span>Ver Radiografía</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 3. Desglose Numérico y Parámetros Auditados */}
        <div className="grid grid-cols-4 gap-2 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-canvas border border-borderSubtle">
            <span className="text-[10px] text-textSecondary block">Cotización en Bolsa (P₀)</span>
            <span className="text-sm font-bold text-textPrimary">{currSym}{p0.toFixed(2)}</span>
            <span className="text-[9px] text-textSecondary block mt-0.5 font-sans">Precio actual de mercado</span>
          </div>
          <div className="p-2.5 rounded-xl bg-canvas border border-borderSubtle">
            <span className="text-[10px] text-textSecondary block">Dividendo/FCF & Yield</span>
            <span className="text-sm font-bold text-accentSky">{currSym}{d1.toFixed(2)} ({dividendYield}%)</span>
            <span className="text-[9px] text-textSecondary block mt-0.5 font-sans">
              Bono 10Y: 4.10% (Δ {spreadYieldVsRf > 0 ? `+${spreadYieldVsRf}%` : `${spreadYieldVsRf}%`})
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-canvas border border-borderSubtle">
            <span className="text-[10px] text-textSecondary block">Beta / Coste Capital (r)</span>
            <span className="text-sm font-bold text-textPrimary">{beta.toFixed(2)} / {(r * 100).toFixed(2)}%</span>
            <span className="text-[9px] text-accentSky block mt-0.5 font-sans truncate" title={nombrePerfil}>
              {perfil === 'DEFENSIVA_MADURA' ? 'Defensiva Madura' : perfil === 'ALTA_VOLATILIDAD_CICLICA' ? 'Alta Volatilidad' : 'Calidad & Crec.'}
            </span>
          </div>
          <div className={`p-2.5 rounded-xl bg-canvas border ${
            isEnZonaCompra ? 'border-statusGreen/40 glow-green' : isEnValorJusto ? 'border-accentYellow/30 glow-yellow' : 'border-statusRed/30'
          }`}>
            <span className="text-[10px] text-textSecondary block">
              Techo Máx. Compra (MoS {activeMos}%)
            </span>
            <span className={`text-sm font-black ${isEnZonaCompra ? 'text-statusGreen' : isEnValorJusto ? 'text-accentYellow' : 'text-textPrimary'}`}>
              {currSym}{dynamicTecho.toFixed(2)}
            </span>
            <span className={`text-[9px] block font-sans font-bold ${
              dynamicDiscrepancia >= 0 ? 'text-statusGreen' : 'text-statusRed'
            }`}>
              {dynamicDiscrepancia >= 0 ? `+${dynamicDiscrepancia}% (En Zona)` : `${dynamicDiscrepancia}% (Recargo)`}
            </span>
          </div>
        </div>

        {/* 3.5. Escalera de Techos Máximos según Margen de Seguridad vs Mercado Real */}
        <div className="p-3.5 rounded-xl bg-canvas border border-borderSubtle space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-textPrimary">
              <Sparkles className="w-4 h-4 text-accentYellow" />
              <h4 className="font-bold uppercase tracking-wider text-[11px]">
                Escalera de Techos Máximos Admisibles de Compra (Límite Graham)
              </h4>
            </div>
            {low52W && high52W && (
              <span className="text-[10px] font-mono text-textSecondary bg-card px-2 py-0.5 rounded border border-borderSubtle">
                Rango Real 52 Semanas: <strong className="text-statusGreen">{currSym}{low52W}</strong> - <strong className="text-textPrimary">{currSym}{high52W}</strong>
              </span>
            )}
          </div>

          <p className="text-[11px] text-textSecondary leading-relaxed">
            Compara el <strong>precio máximo admisible</strong> que deberías pagar según el nivel de exigencia de protección. Si la cotización actual (<strong>{currSym}{p0.toFixed(2)}</strong>) está por debajo de un nivel, ese nivel te da luz verde de compra:
          </p>

          {/* Grid de los 4 niveles */}
          <div className="grid grid-cols-4 gap-2 font-mono text-center">
            {/* 1. Fair Value */}
            <div className={`p-2 rounded-xl border ${
              p0 <= fairValue ? 'bg-card border-accentSky/40' : 'bg-card border-borderSubtle'
            }`}>
              <span className="text-[9px] uppercase tracking-wider text-textSecondary block">Fair Value (0% MoS)</span>
              <span className="text-sm font-bold text-textPrimary block mt-0.5">{currSym}{fairValue.toFixed(2)}</span>
              <span className="text-[9px] text-textSecondary block mt-0.5 font-sans">Valor Intrínseco Justo</span>
            </div>

            {/* 2. MoS 10% (Buffett Quality / Suelo Real) */}
            <button
              onClick={() => setActiveMos(10)}
              className={`p-2 rounded-xl text-left transition border ${
                activeMos === 10
                  ? 'bg-statusGreen/15 border-statusGreen text-statusGreen shadow'
                  : 'bg-card border-borderSubtle hover:border-statusGreen/50 text-textSecondary'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-wider font-bold block">MoS 10% (Buffett)</span>
                {low52W && Math.abs(priceMoS10 - low52W) < 15 && (
                  <span className="text-[8px] bg-statusGreen/20 px-1 py-0.2 rounded font-sans font-bold text-statusGreen">
                    Suelo 52W
                  </span>
                )}
              </div>
              <span className="text-sm font-black text-statusGreen block mt-0.5 font-mono">{currSym}{priceMoS10}</span>
              <span className="text-[9px] text-textSecondary block mt-0.5 font-sans">
                {p0 <= priceMoS10 ? '✔ Apto para compra' : '✘ Por encima'}
              </span>
            </button>

            {/* 3. MoS 20% (Moderado) */}
            <button
              onClick={() => setActiveMos(20)}
              className={`p-2 rounded-xl text-left transition border ${
                activeMos === 20
                  ? 'bg-accentSky/15 border-accentSky text-accentSky shadow'
                  : 'bg-card border-borderSubtle hover:border-accentSky/50 text-textSecondary'
              }`}
            >
              <span className="text-[9px] uppercase tracking-wider font-bold block">MoS 20% (Estándar)</span>
              <span className="text-sm font-black text-accentSky block mt-0.5 font-mono">{currSym}{priceMoS20}</span>
              <span className="text-[9px] text-textSecondary block mt-0.5 font-sans">
                {p0 <= priceMoS20 ? '✔ Apto para compra' : '✘ Por encima'}
              </span>
            </button>

            {/* 4. MoS 30% (Graham) */}
            <button
              onClick={() => setActiveMos(30)}
              className={`p-2 rounded-xl text-left transition border ${
                activeMos === 30
                  ? 'bg-accentYellow/15 border-accentYellow text-accentYellow shadow'
                  : 'bg-card border-borderSubtle hover:border-accentYellow/50 text-textSecondary'
              }`}
            >
              <span className="text-[9px] uppercase tracking-wider font-bold block">MoS 30% (Graham)</span>
              <span className="text-sm font-black text-accentYellow block mt-0.5 font-mono">{currSym}{priceMoS30}</span>
              <span className="text-[9px] text-textSecondary block mt-0.5 font-sans">
                {p0 <= priceMoS30 ? '✔ Apto para compra' : '✘ Por encima'}
              </span>
            </button>
          </div>

          {/* Diagnóstico pedagógico del por qué */}
          <div className="p-2.5 rounded-lg bg-cardSecondary border border-borderSubtle text-[11px] text-textSecondary space-y-1">
            <div className="flex items-center space-x-1.5 text-accentSky font-semibold">
              <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Diagnóstico de Realismo de Mercado (Restricción Macro de Damodaran):</span>
            </div>
            <p className="leading-relaxed">
              {perfil === 'DEFENSIVA_MADURA' ? (
                <>
                  Al ser <strong>{company.nombre}</strong> un negocio maduro y defensivo ($\beta = {beta.toFixed(2)}$), su crecimiento perpetuo se acota al <strong>techo macroeconómico del PIB (máx. 3.5%)</strong> con un diferencial saludable de rentabilidad ($(r - g) = {spreadRG}\%$). Esto impide que el modelo divida por cero y sitúa su valor intrínseco justo en unos realistas <strong>{currSym}{fairValue.toFixed(2)}</strong>.
                </>
              ) : (
                <>
                  Para <strong>{company.nombre}</strong> (perfil {nombrePerfil}), el modelo exige un spread mínimo de seguridad del 2.0% respecto a su coste de capital ({(r * 100).toFixed(2)}%), estableciendo su valor intrínseco teórico en <strong>{currSym}{fairValue.toFixed(2)}</strong>.
                </>
              )}
            </p>
          </div>
        </div>

        {/* 4. Diagnóstico del Problema / Validación Superada */}
        <div className="p-3.5 rounded-xl bg-card border border-borderSubtle space-y-2 text-xs">
          <div className={`flex items-center space-x-1.5 font-bold uppercase tracking-wider ${
            isEnZonaCompra ? 'text-statusGreen' : 'text-accentYellow'
          }`}>
            {isEnZonaCompra ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>
              {isEnZonaCompra
                ? 'Diagnóstico Favorable: Filtro de Seguridad Aprobado'
                : 'Diagnóstico de Mercado: Cotización por encima del Techo MoS'}
            </span>
          </div>
          <p className="text-textSecondary leading-relaxed">
            {isEnZonaCompra ? (
              <>
                <strong>Oportunidad en Zona de Compra:</strong> {company.nombre} ({company.ticker}) cotiza en bolsa a {currSym}{p0.toFixed(2)}, por debajo de su techo máximo admisible de {currSym}{dynamicTecho.toFixed(2)} con MoS {activeMos}%. El mercado ofrece una ventana favorable con un colchón de protección activo del +{dynamicDiscrepancia}%.
              </>
            ) : isEnValorJusto ? (
              <>
                <strong>Zona de Valor Justo (Sin Colchón Suficiente):</strong> {company.nombre} cotiza a {currSym}{p0.toFixed(2)}, cerca de su Fair Value teórico ({currSym}{fairValue.toFixed(2)}). El negocio no está sobrevalorado en términos absolutos, pero no ofrece el descuento del {activeMos}% que exige la disciplina de Benjamin Graham para protegerse de imprevistos.
              </>
            ) : (
              <>
                <strong>Exigencia de Múltiplos en Bolsa:</strong> La cotización actual ({currSym}{p0.toFixed(2)}) supera el valor intrínseco que justifican sus flujos futuros bajo hipótesis sostenibles ({currSym}{fairValue.toFixed(2)}). Para un inversor defensivo, comprar a estos precios implica asumir un recargo del {Math.abs(dynamicDiscrepancia)}% sobre el techo prudente.
              </>
            )}
          </p>
        </div>

        {/* 5. Riesgos Detectados en el Mercado de Valores */}
        <div className={`p-3.5 rounded-xl bg-canvas border space-y-2 text-xs ${
          isEnZonaCompra ? 'border-accentYellow/30' : 'border-statusRed/30'
        }`}>
          <div className={`flex items-center space-x-1.5 font-bold uppercase tracking-wider ${
            isEnZonaCompra ? 'text-accentYellow' : 'text-statusRed'
          }`}>
            <TrendingDown className="w-4 h-4" />
            <span>Riesgos de Inversión Identificados para {company.ticker}</span>
          </div>
          <ul className="space-y-1.5 text-textSecondary list-disc list-inside leading-relaxed text-[11px]">
            {spreadYieldVsRf < 0 && (
              <li>
                <strong className="text-textPrimary">Competencia de Renta Fija (Coste de Oportunidad):</strong> El dividendo actual ({dividendYield}%) rinde menos que el bono del Tesoro a 10 años sin riesgo (4.10%, diferencial de {spreadYieldVsRf}%). En regímenes de tipos altos, los fondos institucionales prefieren deuda soberana a pagar múltiplos elevados por empresas maduras.
              </li>
            )}
            <li>
              <strong className="text-textPrimary">Presión en Márgenes Operativos por Inflación:</strong> En bienes de consumo masivo o manufactura global, el aumento de costes de insumos o transporte puede comprimir los márgenes si la elasticidad de la demanda dificulta trasladar precios.
            </li>
            <li>
              <strong className="text-textPrimary">Riesgo de Compresión de Múltiplos si el Crecimiento Desacelera:</strong> Si los resultados trimestrales no confirman la tasa esperada, las cotizaciones en máximos suelen corregir de forma abrupta hacia su valor intrínseco justo.
            </li>
          </ul>
        </div>

        {/* 6. Recomendaciones de Inversión y Estrategia Práctica */}
        <div className="p-3.5 rounded-xl bg-cardSecondary border border-borderSubtle space-y-2 text-xs">
          <div className="flex items-center space-x-1.5 text-statusGreen font-bold uppercase tracking-wider">
            <Lightbulb className="w-4 h-4" />
            <span>Recomendaciones Estratégicas para el Inversor</span>
          </div>
          {isEnZonaCompra ? (
            <div className="grid grid-cols-2 gap-3 text-[11px] text-textSecondary">
              <div className="p-2.5 rounded-lg bg-card border border-statusGreen/30 space-y-1">
                <strong className="text-statusGreen block">Estrategia de Acumulación (DCA):</strong>
                <p>
                  Aprovechar la holgura acumulando posiciones periódicas mientras el precio de mercado (${p0.toFixed(2)}) se mantenga por debajo de su techo de seguridad MoS ({activeMos}%): <strong>${dynamicTecho.toFixed(2)}</strong>.
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-borderSubtle space-y-1">
                <strong className="text-textPrimary block">Horizonte Temporal y Rebalanceo:</strong>
                <p>
                  Cobrar dividendos defensivamente mientras la tesis de negocio persista. Evaluar tomas parciales de beneficios si la cotización converge hacia el Fair Value teórico (<strong>${fairValue.toFixed(2)}</strong>).
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-[11px] text-textSecondary">
              <div className="p-2.5 rounded-lg bg-card border border-borderSubtle space-y-1">
                <strong className="text-textPrimary block">Enfoque Value Defensivo (Paciencia / Alarma de Compra):</strong>
                <p>
                  No comprar a la carrera en la cotización actual (${p0.toFixed(2)}). Establecer una alarma de compra o límite condicionado en el entorno de su techo MoS {activeMos}% (<strong>${dynamicTecho.toFixed(2)}</strong>) o esperar correcciones de ciclo.
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-borderSubtle space-y-1">
                <strong className="text-textPrimary block">Enfoque Calidad a Precio Razonable (GARP):</strong>
                <p>
                  Si la convicción en su liderazgo es absoluta, vigilar el suelo de soporte histórico de 52 semanas ({low52W ? `$${low52W}` : 'mínimos anuales'}) y el ratio PEG (PER / Crecimiento real).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer / Acciones Rápidas */}
        <div className="pt-2 flex items-center justify-between border-t border-borderSubtle text-xs">
          <div className="flex items-center space-x-2 text-textSecondary text-[11px]">
            {isEnZonaCompra ? <ShieldCheck className="w-3.5 h-3.5 text-statusGreen flex-shrink-0" /> : <Target className="w-3.5 h-3.5 text-accentYellow flex-shrink-0" />}
            <span>
              Techo Máx. Compra MoS ({activeMos}%):{' '}
              <strong className={`font-mono font-bold text-xs ${isEnZonaCompra ? 'text-statusGreen' : 'text-accentYellow'}`}>
                ${dynamicTecho.toFixed(2)}
              </strong>
            </span>
            <span className="text-[10px] text-textSecondary font-mono">
              (P₀ actual: ${p0.toFixed(2)} | Fair Value: ${fairValue.toFixed(2)})
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {onAuditInCentralPillar && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAuditInCentralPillar(company.ticker);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-accentSky/20 hover:bg-accentSky/30 text-accentSky border border-accentSky/40 font-bold text-xs shadow-sm transition flex items-center space-x-1.5"
                title={`Cargar y auditar ${company.ticker} en el Pilar Central con los 3 escenarios`}
              >
                <Award className="w-3.5 h-3.5 text-accentSky" />
                <span>Auditar en Pilar Central</span>
              </button>
            )}

            {onAddToWatchlist && (
              <button
                type="button"
                onClick={() => onAddToWatchlist(company.ticker)}
                className="px-3.5 py-1.5 rounded-xl bg-cardSecondary hover:bg-borderSubtle text-textPrimary border border-borderSubtle font-bold text-xs shadow-sm transition flex items-center space-x-1.5"
                title={`Poner ${company.ticker} en seguimiento continuo`}
              >
                <Eye className="w-3.5 h-3.5 text-accentSky" />
                <span>Poner en Seguimiento</span>
              </button>
            )}

            {onBuyTrade && (
              <button
                type="button"
                onClick={() => onBuyTrade(company)}
                className="px-3.5 py-1.5 rounded-xl bg-statusGreen hover:bg-statusGreen/90 text-canvas font-bold text-xs shadow-md transition flex items-center space-x-1.5"
                title={`Registrar compra directa de ${company.ticker}`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Añadir Compra</span>
              </button>
            )}
            {onApplySuggestedSettings && activeMos !== mosPct && (
              <button
                onClick={() => onApplySuggestedSettings(pivotG * 100, activeMos)}
                className="px-3 py-1.5 rounded-xl bg-accentSky text-canvas font-bold hover:bg-accentSky/90 shadow transition text-xs flex items-center space-x-1"
                title={`Ajustar el Margen de Seguridad de la aplicación al ${activeMos}%`}
              >
                <span>Aplicar MoS {activeMos}% global</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-cardSecondary hover:bg-cardHover text-textPrimary border border-borderSubtle font-semibold transition text-xs"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>

      {/* Modal Interno de Radiografía Financiera & Retornos */}
      <CompanyFinancialDeepDiveModal
        isOpen={isLocalDeepDiveOpen}
        ticker={company.ticker}
        onClose={() => setIsLocalDeepDiveOpen(false)}
      />
    </div>
  );
};
