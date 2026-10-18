import React from 'react';
import {
  Award,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Play,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Eye,
  FileCheck2,
  Filter,
  X,
  Scale,
  BarChart3,
  CandlestickChart,
  GripVertical
} from 'lucide-react';
import { Pilar1Result, Pilar1ScanResponse, DiscardedCompanyDetail } from '../types';
import { DiscardedDetailModal } from './DiscardedDetailModal';
import { ValueFilterModal } from './ValueFilterModal';
import { StockPriceChart } from './StockPriceChart';
import { AssetComparisonModal } from './AssetComparisonModal';

interface FundamentalColumnProps {
  scanData: Pilar1ScanResponse | null;
  selectedCompany: Pilar1Result | null;
  onSelectCompany: (company: Pilar1Result) => void;
  onRunScan: (forceEmpty?: boolean) => void;
  isScanning: boolean;
  onOpenThesis: () => void;
  pivotG: number;
  onPivotChange: (val: number) => void;
  mosDiscount?: number;
  onMosChange?: (val: number) => void;
  onOpenBuyTrade?: (company: DiscardedCompanyDetail | Pilar1Result) => void;
  onAddToWatchlist?: (ticker: string) => void;
  onOpenFinancialDeepDive?: (ticker: string) => void;
  onAuditInCentralPillar?: (ticker: string) => void;
  isAuditingAsset?: boolean;
  onOpenAIChat?: () => void;
}

export const FundamentalColumn: React.FC<FundamentalColumnProps> = ({
  scanData,
  selectedCompany,
  onSelectCompany,
  onRunScan,
  isScanning,
  onOpenThesis,
  pivotG,
  onPivotChange,
  mosDiscount = 20,
  onMosChange = () => {},
  onOpenBuyTrade,
  onAddToWatchlist,
  onOpenFinancialDeepDive,
  onAuditInCentralPillar,
  isAuditingAsset = false,
  onOpenAIChat
}) => {
  const [selectedDiscarded, setSelectedDiscarded] = React.useState<DiscardedCompanyDetail | null>(null);
  const [isDiscardedModalOpen, setIsDiscardedModalOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'company' | 'pedagogic'>('company');
  const [valueFilterMode, setValueFilterMode] = React.useState<'ALL' | 'APTO_5_5' | 'MIN_4_5'>('ALL');
  const [isValueFilterModalOpen, setIsValueFilterModalOpen] = React.useState(false);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = React.useState(false);
  const [showChart, setShowChart] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const dragCounterRef = React.useRef(0);
  const detailScrollRef = React.useRef<HTMLDivElement>(null);

  // Estado local desacoplado con debounce para sliders de alto rendimiento sin saturar la red
  const [localPivotG, setLocalPivotG] = React.useState(pivotG);
  const [localMos, setLocalMos] = React.useState(mosDiscount);

  React.useEffect(() => {
    setLocalPivotG(pivotG);
  }, [pivotG]);

  React.useEffect(() => {
    setLocalMos(mosDiscount);
  }, [mosDiscount]);

  React.useEffect(() => {
    if (localPivotG === pivotG) return;
    const timer = setTimeout(() => {
      onPivotChange(localPivotG);
    }, 250);
    return () => clearTimeout(timer);
  }, [localPivotG, onPivotChange, pivotG]);

  React.useEffect(() => {
    if (localMos === mosDiscount) return;
    const timer = setTimeout(() => {
      onMosChange(localMos);
    }, 250);
    return () => clearTimeout(timer);
  }, [localMos, onMosChange, mosDiscount]);

  const handlePresetPivot = (val: number) => {
    setLocalPivotG(val);
    onPivotChange(val);
  };

  const handlePresetMos = (val: number) => {
    setLocalMos(val);
    onMosChange(val);
  };

  const currSym = scanData?.currency_symbol || selectedCompany?.currency_symbol || (selectedCompany?.currency === 'EUR' ? '€' : '$');
  const marketName = scanData?.market_name || (scanData?.market === 'IBEX35' ? 'IBEX 35' : (scanData?.market === 'NASDAQ' ? 'NASDAQ-100' : 'S&P 500'));

  const filteredResults = React.useMemo(() => {
    const list = scanData?.resultados || [];
    if (valueFilterMode === 'APTO_5_5') {
      return list.filter((c) => c.filtro_value?.apto);
    }
    if (valueFilterMode === 'MIN_4_5') {
      return list.filter((c) => c.filtro_value?.apto || c.filtro_value?.casi_apto);
    }
    return list;
  }, [scanData?.resultados, valueFilterMode]);

  const handleChangeValueFilterMode = (mode: 'ALL' | 'APTO_5_5' | 'MIN_4_5') => {
    setValueFilterMode(mode);
    const list = scanData?.resultados || [];
    const nextList =
      mode === 'APTO_5_5'
        ? list.filter((c) => c.filtro_value?.apto)
        : mode === 'MIN_4_5'
        ? list.filter((c) => c.filtro_value?.apto || c.filtro_value?.casi_apto)
        : list;
    if (nextList.length > 0 && (!selectedCompany || !nextList.some((c) => c.ticker === selectedCompany.ticker))) {
      onSelectCompany(nextList[0]);
      setViewMode('company');
    }
  };

  React.useEffect(() => {
    if (selectedCompany) {
      setViewMode('company');
      detailScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedCompany?.ticker]);

  const handleDragEnter = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types.includes('text/plain') || e.dataTransfer.types.includes('application/x-ticker')) {
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const rawTicker =
      e.dataTransfer.getData('application/x-ticker') ||
      e.dataTransfer.getData('text/plain') ||
      '';
    const cleanTicker = rawTicker.trim().toUpperCase();
    if (cleanTicker && /^[A-Z0-9.-]{1,10}$/.test(cleanTicker) && onAuditInCentralPillar) {
      onAuditInCentralPillar(cleanTicker);
    }
  };

  const handleCompanyDragStart = (
    e: React.DragEvent<HTMLElement>,
    comp: {
      ticker: string;
      nombre?: string;
      company_name?: string;
      precio_cierre_P0?: number;
      price?: number;
      current_price?: number;
      currency?: string;
      fair_value_teorico?: number;
      fairValue?: number;
      escalera_mos?: any;
      escenario_neutro?: any;
    }
  ) => {
    const cleanTicker = (comp.ticker || '').trim().toUpperCase();
    if (!cleanTicker) return;
    const name = comp.nombre || comp.company_name || cleanTicker;
    const price = comp.precio_cierre_P0 || comp.price || comp.current_price || 0;
    const currency = comp.currency || 'USD';
    const fairValue = comp.fair_value_teorico || comp.fairValue || comp.escenario_neutro?.VP_teorico || comp.escalera_mos?.fair_value || 0;

    e.dataTransfer.setData('text/plain', cleanTicker);
    e.dataTransfer.setData('application/x-ticker', cleanTicker);
    e.dataTransfer.setData('application/x-company-name', name);
    e.dataTransfer.setData('application/x-current-price', String(price));
    e.dataTransfer.setData('application/x-currency', currency);
    if (fairValue > 0) {
      e.dataTransfer.setData('application/x-fair-value', String(fairValue));
    }
    e.dataTransfer.setData('application/x-item-json', JSON.stringify({
      ticker: cleanTicker,
      company_name: name,
      current_price: price,
      currency,
      fair_value: fairValue
    }));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleOpenDiscardedDetail = (item: DiscardedCompanyDetail) => {
    setSelectedDiscarded(item);
    setIsDiscardedModalOpen(true);
  };
  return (
    <section
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-card border rounded-2xl flex flex-col p-4 overflow-hidden h-full min-h-0 shadow-md relative transition-all ${
        isDragOver
          ? 'border-accentSky ring-2 ring-accentSky/50 shadow-[0_0_25px_rgba(56,189,248,0.25)]'
          : 'border-borderSubtle'
      }`}
    >
      {/* Overlay de Soltar (Drop Zone) cuando el usuario arrastra una empresa desde Seguimiento o Cartera */}
      {isDragOver && (
        <div className="absolute inset-2 z-50 rounded-2xl bg-slate-950/90 backdrop-blur-sm border-2 border-dashed border-accentSky flex flex-col items-center justify-center p-6 text-center pointer-events-none animate-in fade-in duration-150">
          <div className="w-14 h-14 rounded-2xl bg-accentSky/20 border border-accentSky/40 flex items-center justify-center text-accentSky mb-3 shadow-lg">
            <Award className="w-8 h-8 animate-bounce" />
          </div>
          <p className="text-base font-extrabold text-textPrimary tracking-tight">
            Suelta aquí la compañía para auditarla en el Pilar Central
          </p>
          <p className="text-xs text-accentSky font-medium mt-1 max-w-md">
            Se calcularán al instante sus 3 escenarios (Pesimista, Neutro, Optimista), Escalera de Margen de Seguridad y los 5 criterios del Filtro Value.
          </p>
        </div>
      )}

      {/* Indicador de carga cuando se está auditando una empresa arrastrada o buscada */}
      {isAuditingAsset && (
        <div className="mb-2 px-3 py-1.5 rounded-xl bg-accentSky/15 border border-accentSky/40 text-accentSky text-xs font-bold flex items-center justify-center space-x-2 animate-pulse">
          <Sparkles className="w-3.5 h-3.5 animate-spin" />
          <span>Calculando auditoría fundamental, 3 escenarios y Filtro Value en el Pilar Central...</span>
        </div>
      )}

      {/* Indicador de carga sutil cuando se cambia de mercado o se ejecuta barrido */}
      {isScanning && !isAuditingAsset && (
        <div className="mb-2 px-3 py-1.5 rounded-xl bg-accentSky/10 border border-accentSky/30 text-accentSky text-xs font-bold flex items-center justify-center space-x-2 animate-pulse">
          <Sparkles className="w-3.5 h-3.5 animate-spin" />
          <span>Calculando desajuste de valor intrínseco y escenarios ({marketName})...</span>
        </div>
      )}

      {/* 1. Header con Información de Auditoría y Barrido Multi-Mercado */}
      <div className="flex items-center justify-between pb-3.5 border-b border-borderSubtle">
        <div className="flex items-center space-x-2.5">
          <Award className="w-5 h-5 text-accentSky" />
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-textSecondary">Pilar Central</h2>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-accentSky/10 text-accentSky border border-accentSky/30 font-mono">
                Gordon-Shapiro & MoS {mosDiscount}% · {marketName}
              </span>
            </div>
            <p className="text-base font-bold text-textPrimary">Pilar 1: Desajuste de Valor Intrínseco ({marketName})</p>
          </div>
        </div>

        {/* Botones de Ejecución de Barrido */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onRunScan(false)}
            disabled={isScanning}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-accentSky text-canvas hover:bg-accentSky/90 shadow transition disabled:opacity-50"
            title={`Ejecutar barrido diario en tiempo real sobre ${marketName}`}
          >
            <Play className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Barriendo...' : 'Barrido Diario'}</span>
          </button>

          <button
            onClick={() => onRunScan(true)}
            className="px-2 py-1.5 text-[10px] font-semibold rounded-lg bg-cardSecondary hover:bg-cardHover text-textSecondary hover:text-textPrimary border border-borderSubtle transition"
            title="Simular régimen de mercado sin margen de seguridad suficiente (Resultado Vacío)"
          >
            <RotateCcw className="w-3 h-3 inline mr-1" />
            <span>Simular Vacío</span>
          </button>
        </div>
      </div>

      {/* 2. Barra de Métricas de Auditoría (Cero Invención / Universo Activo) */}
      {scanData && (
        <div className="grid grid-cols-8 gap-1.5 my-2.5 p-2 rounded-xl bg-canvas border border-borderSubtle text-center text-xs">
          <div>
            <span className="text-[10px] text-textSecondary block">Fecha</span>
            <span className="font-mono font-semibold text-textPrimary">{scanData.ejecucion_fecha}</span>
          </div>
          <div>
            <span className="text-[10px] text-textSecondary block truncate font-bold">{marketName}</span>
            <span className="font-mono font-bold text-textPrimary">{scanData.universo_analizado}</span>
          </div>
          <div>
            <span className="text-[10px] text-textSecondary block flex items-center justify-center">
              <AlertCircle className="w-3 h-3 text-statusRed mr-0.5 inline" />
              Faltan Datos
            </span>
            <span className="font-mono font-bold text-statusRed" title="Empresas con métricas faltantes descartadas automáticamente">
              {scanData.empresas_descartadas_datos_insuficientes}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-textSecondary block flex items-center justify-center" title="Empresas con riesgo fundamental / Altman Z / sobreendeudamiento">
              <AlertTriangle className="w-3 h-3 text-statusRed mr-0.5 inline" />
              Trampas
            </span>
            <span
              className={`font-mono font-bold ${
                (scanData.empresas_descartadas_trampa_valor ?? 0) > 0 ? 'text-statusRed' : 'text-textSecondary'
              }`}
            >
              {scanData.empresas_descartadas_trampa_valor ?? 0}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-textSecondary block flex items-center justify-center">
              <ShieldAlert className="w-3 h-3 text-accentYellow mr-0.5 inline" />
              r &le; g
            </span>
            <span
              className={`font-mono font-bold ${
                (scanData.empresas_descartadas_techo_r ?? 0) > 0 ? 'text-accentYellow' : 'text-textSecondary'
              }`}
            >
              {scanData.empresas_descartadas_techo_r ?? 0}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-textSecondary block" title="Empresas cotizando con descuento sobre Fair Value neutro (P0 <= FV)">Valor Justo</span>
            <span className="font-mono font-bold text-accentSky">
              {scanData.empresas_en_zona_valor_justo ?? 0}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-textSecondary block">Calificadas MoS</span>
            <span
              className={`font-mono font-bold ${
                scanData.empresas_calificadas_pilar1 > 0 ? 'text-statusGreen' : 'text-textSecondary'
              }`}
            >
              {scanData.empresas_calificadas_pilar1}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-textSecondary block flex items-center justify-center" title="Compañías que superan los 5 criterios del Filtro Value">
              <Filter className="w-3 h-3 text-statusGreen mr-0.5 inline" />
              Filtro Value
            </span>
            <span className="font-mono font-bold text-statusGreen">
              {scanData.empresas_aptas_filtro_value ?? scanData.resultados.filter(r => r.filtro_value?.apto).length}
            </span>
          </div>
        </div>
      )}

      {/* 2.5. Calibrador Dual + Filtro Value (Cribado de 5 Criterios) */}
      <div className="mb-3 p-3 rounded-xl bg-canvas border border-borderSubtle space-y-2.5">
        {/* Fila 1: Tasa de Crecimiento Anual (g Base) con Anclajes de Mercado */}
        <div className="flex items-center justify-between text-xs space-x-2">
          <div className="flex items-center space-x-1.5 min-w-[170px]">
            <TrendingUp className="w-3.5 h-3.5 text-accentSky" />
            <div>
              <span className="text-[10px] font-bold text-textPrimary uppercase tracking-wider block">
                Crecimiento Anual (<span className="font-mono text-accentSky">g</span>)
              </span>
              <span className="text-[9px] text-textSecondary">
                Hipótesis Gordon-Shapiro
              </span>
            </div>
          </div>

          {/* Slider g */}
          <div className="flex-1 max-w-[170px] flex items-center space-x-2">
            <input
              type="range"
              min="1.5"
              max="12.0"
              step="0.5"
              value={localPivotG}
              onChange={(e) => setLocalPivotG(parseFloat(e.target.value))}
              className="w-full accent-accentSky cursor-pointer bg-cardSecondary h-1.5 rounded-lg"
            />
            <span className="text-xs font-black text-accentYellow font-mono min-w-[44px] text-right bg-accentYellow/10 px-1.5 py-0.5 rounded border border-accentYellow/30 glow-yellow">
              {localPivotG.toFixed(1)}%
            </span>
          </div>

          {/* Presets Macro de Mercado */}
          <div className="flex items-center space-x-1 font-mono text-[9px]">
            {[
              { label: 'S&P 500 (6.0%)', val: 6.0, tip: 'Media histórica de crecimiento de beneficios del S&P 500' },
              { label: 'PIB USA (4.0%)', val: 4.0, tip: 'Crecimiento nominal a largo plazo PIB USA (Defensivo Damodaran)' },
              { label: 'Inflación (2.5%)', val: 2.5, tip: 'Escenario de estrés / Mínimo a perpetuidad' },
              { label: 'Buffett (7.0%)', val: 7.0, tip: 'Base estándar Gordon-Shapiro' }
            ].map((preset) => (
              <button
                key={preset.val}
                onClick={() => handlePresetPivot(preset.val)}
                className={`px-1.5 py-0.5 rounded transition border text-[9px] ${
                  Math.abs(localPivotG - preset.val) < 0.1
                    ? 'bg-accentSky text-canvas font-bold border-accentSky shadow'
                    : 'bg-card text-textSecondary border-borderSubtle hover:text-textPrimary hover:border-borderMedium'
                }`}
                title={preset.tip}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fila 2: Margen de Seguridad Exigido (MoS %) */}
        <div className="flex items-center justify-between text-xs space-x-2 pt-2 border-t border-borderSubtle/50">
          <div className="flex items-center space-x-1.5 min-w-[170px]">
            <ShieldCheck className="w-3.5 h-3.5 text-statusGreen" />
            <div>
              <span className="text-[10px] font-bold text-textPrimary uppercase tracking-wider block">
                Margen Seguridad (<span className="font-mono text-statusGreen">MoS</span>)
              </span>
              <span className="text-[9px] text-textSecondary">
                Colchón de descuento exigido
              </span>
            </div>
          </div>

          {/* Slider MoS */}
          <div className="flex-1 max-w-[170px] flex items-center space-x-2">
            <input
              type="range"
              min="0"
              max="45"
              step="5"
              value={localMos}
              onChange={(e) => setLocalMos(parseInt(e.target.value, 10))}
              className="w-full accent-statusGreen cursor-pointer bg-cardSecondary h-1.5 rounded-lg"
            />
            <span className="text-xs font-black text-statusGreen font-mono min-w-[44px] text-right bg-statusGreen/10 px-1.5 py-0.5 rounded border border-statusGreen/30">
              {localMos}%
            </span>
          </div>

          {/* Presets de Margen de Seguridad */}
          <div className="flex items-center space-x-1 font-mono text-[9px]">
            {[
              { label: 'Buffett (30%)', val: 30, tip: 'Máxima protección de capital (30% descuento Graham/Marks)' },
              { label: 'Estándar (20%)', val: 20, tip: 'Colchón moderado para negocios de alta calidad' },
              { label: 'Flexible (10%)', val: 10, tip: 'Colchón para empresas con ventajas competitivas (Wide Moat)' },
              { label: 'Precio Justo (0%)', val: 0, tip: 'Sin descuento adicional: cotizando a Valor Intrínseco teórico' }
            ].map((preset) => (
              <button
                key={preset.val}
                onClick={() => handlePresetMos(preset.val)}
                className={`px-1.5 py-0.5 rounded transition border text-[9px] ${
                  localMos === preset.val
                    ? 'bg-statusGreen text-canvas font-bold border-statusGreen shadow'
                    : 'bg-card text-textSecondary border-borderSubtle hover:text-textPrimary hover:border-borderMedium'
                }`}
                title={preset.tip}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fila 3: Filtro Value (Cribado de 5 Criterios Fundamentales: Moat, ROIC >12%, Deuda <3x, FCF 5A, PER vs Hist) */}
        {scanData && scanData.resultados.length > 0 && (
          <div className="flex items-center justify-between text-xs space-x-2 pt-2 border-t border-borderSubtle/50">
            <div className="flex items-center space-x-1.5 min-w-[170px]">
              <Filter className="w-3.5 h-3.5 text-accentSky" />
              <div>
                <span className="text-[10px] font-bold text-textPrimary uppercase tracking-wider block">
                  Filtro Value (<span className="font-mono text-accentSky">5 Criterios</span>)
                </span>
                <span className="text-[9px] text-textSecondary">
                  Moat · ROIC &gt;12% · Deuda &lt;3x · FCF 5A · PER
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 font-mono text-[10px]">
              <button
                type="button"
                onClick={() => handleChangeValueFilterMode('ALL')}
                className={`px-2.5 py-1 rounded-lg transition border ${
                  valueFilterMode === 'ALL'
                    ? 'bg-accentSky text-canvas font-bold border-accentSky shadow'
                    : 'bg-card text-textSecondary border-borderSubtle hover:text-textPrimary hover:border-borderMedium'
                }`}
                title="Mostrar todas las empresas calificadas por Margen de Seguridad del Pilar 1"
              >
                Todas MoS ({scanData.resultados.length})
              </button>
              <button
                type="button"
                onClick={() => handleChangeValueFilterMode('APTO_5_5')}
                className={`px-2.5 py-1 rounded-lg transition border ${
                  valueFilterMode === 'APTO_5_5'
                    ? 'bg-statusGreen text-canvas font-bold border-statusGreen shadow'
                    : 'bg-card text-textSecondary border-borderSubtle hover:text-textPrimary hover:border-borderMedium'
                }`}
                title="Filtrar solo empresas con Veredicto: APTO PARA ANÁLISIS PROFUNDO (5 de 5 criterios superados)"
              >
                Solo APTO 5/5 ({scanData.resultados.filter(r => r.filtro_value?.apto).length})
              </button>
              <button
                type="button"
                onClick={() => handleChangeValueFilterMode('MIN_4_5')}
                className={`px-2.5 py-1 rounded-lg transition border ${
                  valueFilterMode === 'MIN_4_5'
                    ? 'bg-accentYellow text-canvas font-bold border-accentYellow shadow'
                    : 'bg-card text-textSecondary border-borderSubtle hover:text-textPrimary hover:border-borderMedium'
                }`}
                title="Mostrar empresas APTO (5/5) + Casos Frontera Casi Aptos (4/5 criterios)"
              >
                APTO + Casi Apto &ge;4/5 ({scanData.resultados.filter(r => r.filtro_value?.apto || r.filtro_value?.casi_apto).length})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Selector de Pestañas de Compañías Calificadas o Auditadas */}
      {scanData && (scanData.empresas_calificadas_pilar1 > 0 || selectedCompany) && (
        <div className="flex items-center space-x-1.5 bg-canvas p-1 rounded-xl border border-borderSubtle mb-3 overflow-x-auto flex-shrink-0">
          {scanData.empresas_calificadas_pilar1 > 0 && (
            <span className="text-[10px] text-textSecondary font-bold uppercase px-2">
              {valueFilterMode === 'APTO_5_5' ? 'Filtro Value (5/5):' : valueFilterMode === 'MIN_4_5' ? 'Value ≥4/5:' : 'Top MoS:'}
            </span>
          )}
          {scanData.empresas_calificadas_pilar1 > 0 && filteredResults.map((comp) => {
            const isActive = selectedCompany?.ticker === comp.ticker && viewMode === 'company';
            const fv = comp.filtro_value;
            return (
              <button
                key={comp.ticker}
                draggable={true}
                onDragStart={(e) => handleCompanyDragStart(e, comp)}
                onClick={() => {
                  if (isActive) {
                    handleOpenDiscardedDetail(comp as unknown as DiscardedCompanyDetail);
                  } else {
                    onSelectCompany(comp);
                    setViewMode('company');
                  }
                }}
                className={`flex items-center space-x-1.5 px-3 py-1 text-xs font-bold rounded-lg transition font-mono cursor-grab active:cursor-grabbing ${
                  isActive
                    ? 'bg-accentSky text-canvas shadow-md'
                    : 'text-textSecondary hover:text-textPrimary hover:bg-cardSecondary'
                }`}
                title={isActive ? `Arrastra a Seguimiento · Clic para abrir auditoría de ${comp.ticker}` : `Arrastra a Seguimiento · Clic para seleccionar ${comp.ticker}`}
              >
                <span>{comp.ticker}</span>
                {fv && (
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                      fv.apto
                        ? isActive
                          ? 'bg-canvas text-statusGreen'
                          : 'bg-statusGreen/20 text-statusGreen'
                        : fv.casi_apto
                        ? isActive
                          ? 'bg-canvas text-accentYellow'
                          : 'bg-accentYellow/20 text-accentYellow'
                        : isActive
                        ? 'bg-canvas/80 text-statusRed'
                        : 'bg-statusRed/15 text-statusRed'
                    }`}
                    title={`Filtro Value: ${fv.etiqueta_estado} — ${fv.veredicto}`}
                  >
                    {fv.puntuacion}/5
                  </span>
                )}
                {comp.quality_tier && (
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                      comp.quality_tier === 'AAA' ? 'bg-statusGreen/20 text-statusGreen' :
                      comp.quality_tier === 'AA' ? 'bg-accentSky/20 text-accentSky' :
                      comp.quality_tier === 'B' ? 'bg-accentYellow/20 text-accentYellow' :
                      'bg-statusRed/20 text-statusRed'
                    }`}
                    title={`Salud Fundamental: Tier ${comp.quality_tier} (${comp.health_score ?? 80}/100)`}
                  >
                    {comp.quality_tier}
                  </span>
                )}
                {comp.alerta_trampa_valor && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-statusRed/20 text-statusRed font-bold flex items-center" title="Alerta: Desplome >35% en 52W (Posible trampa de valor)">
                    ⚠️ -{comp.caida_desde_maximo_52w_pct}%
                  </span>
                )}
                {comp.auditoria_trampas?.alertas && comp.auditoria_trampas.alertas.length > 0 && !comp.alerta_trampa_valor && (
                  <span
                    className="text-[9px] px-1 py-0.2 rounded bg-accentYellow/20 text-accentYellow font-bold flex items-center"
                    title={comp.auditoria_trampas.alertas.map(a => a.titulo).join(' | ')}
                  >
                    {comp.auditoria_trampas.alertas[0].icono}
                  </span>
                )}
                <span
                  className={`text-[10px] px-1 rounded ${
                    isActive ? 'bg-canvas text-accentSky' : 'bg-statusGreen/10 text-statusGreen'
                  }`}
                >
                  {comp.discrepancia_porcentual_neutra}
                </span>
              </button>
            );
          })}

          {/* Pestaña especial para empresa auditada bajo demanda (ej. GOOGL o búsqueda directa) */}
          {selectedCompany && !scanData.resultados?.some((c) => c.ticker === selectedCompany.ticker) && (
            <div className="flex items-center space-x-1 pl-2 border-l border-borderSubtle">
              <span className="text-[10px] text-accentSky font-bold flex items-center">
                <Award className="w-3.5 h-3.5 mr-0.5 text-accentSky" />
                Auditada:
              </span>
              <div className="flex items-center space-x-1 bg-accentSky/15 text-accentSky border border-accentSky/30 px-2 py-0.5 rounded-lg text-xs font-mono font-bold">
                <button
                  type="button"
                  draggable={true}
                  onDragStart={(e) => handleCompanyDragStart(e, selectedCompany)}
                  onClick={() => setViewMode('company')}
                  className="hover:underline flex items-center space-x-1 cursor-grab active:cursor-grabbing"
                  title={`Arrastra a Seguimiento · Clic para ver auditoría de ${selectedCompany.nombre}`}
                >
                  <span>{selectedCompany.ticker}</span>
                  {selectedCompany.quality_tier && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-cardSecondary text-textPrimary">
                      {selectedCompany.quality_tier}
                    </span>
                  )}
                  <span className="text-[10px] px-1 rounded bg-canvas text-accentSky">
                    {selectedCompany.discrepancia_porcentual_neutra || `${selectedCompany.discrepancia ?? 0}%`}
                  </span>
                </button>
                {scanData.resultados && scanData.resultados.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCompany(scanData.resultados[0]);
                      setViewMode('company');
                    }}
                    className="ml-1 text-textSecondary hover:text-textPrimary p-0.5 rounded hover:bg-card"
                    title="Volver a empresas calificadas del escaneo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {scanData.diagnostico_pedagogico?.descartadas_trampa_valor && scanData.diagnostico_pedagogico.descartadas_trampa_valor.length > 0 && (
            <div className="flex items-center space-x-1 pl-2 border-l border-borderSubtle">
              <span className="text-[10px] text-statusRed font-bold flex items-center">
                <AlertTriangle className="w-3 h-3 mr-0.5" />
                Bloqueadas:
              </span>
              {scanData.diagnostico_pedagogico.descartadas_trampa_valor.map((tItem) => (
                <button
                  key={tItem.ticker}
                  draggable={true}
                  onDragStart={(e) => handleCompanyDragStart(e, tItem)}
                  onClick={() => {
                    if (onAuditInCentralPillar) {
                      onAuditInCentralPillar(tItem.ticker);
                    } else {
                      handleOpenDiscardedDetail(tItem);
                    }
                  }}
                  className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-statusRed/10 text-statusRed hover:bg-statusRed/20 border border-statusRed/30 transition flex items-center space-x-1 cursor-grab active:cursor-grabbing"
                  title={`Arrastra a Seguimiento · Clic para cargar ${tItem.ticker} en Pilar Central`}
                >
                  <span>{tItem.ticker}</span>
                  <span className="text-[9px]">(-{tItem.caida_desde_maximo_52w_pct}%)</span>
                </button>
              ))}
            </div>
          )}

          {/* Si scanData no tiene calificadas, ofrecer botón para conmutar con el diagnóstico */}
          {scanData.empresas_calificadas_pilar1 === 0 && (
            <div className="ml-auto flex items-center pl-2">
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'company' ? 'pedagogic' : 'company')}
                className="text-[10px] font-medium px-2 py-0.5 rounded bg-cardSecondary hover:bg-cardHover text-textSecondary hover:text-textPrimary border border-borderSubtle transition"
              >
                {viewMode === 'company' ? 'Ver Diagnóstico de Escaneo' : `Volver a ${selectedCompany?.ticker || 'Auditoría'}`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. CASO DE RESULTADO VACÍO CON DIAGNÓSTICO PEDAGÓGICO */}
      {scanData && (!selectedCompany || viewMode === 'pedagogic') ? (
        <div className="flex-1 flex flex-col justify-start p-4 bg-canvas rounded-2xl border border-borderSubtle my-2 overflow-y-auto space-y-3">
          {selectedCompany && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-accentSky/10 border border-accentSky/30">
              <span className="text-xs text-accentSky font-bold flex items-center">
                <Award className="w-4 h-4 mr-1.5" />
                Auditoría cargada en el Pilar Central: {selectedCompany.nombre} ({selectedCompany.ticker})
              </span>
              <button
                type="button"
                onClick={() => setViewMode('company')}
                className="px-3 py-1 bg-accentSky text-canvas rounded-lg text-xs font-bold hover:bg-accentSky/90 shadow transition"
              >
                Volver a {selectedCompany.ticker} →
              </button>
            </div>
          )}
          <div className="flex items-center space-x-3 p-3 rounded-xl bg-card border border-accentYellow/30">
            <div className="w-10 h-10 rounded-xl bg-cardSecondary border border-accentYellow/30 flex items-center justify-center flex-shrink-0 glow-yellow">
              <ShieldAlert className="w-5 h-5 text-accentYellow" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-textPrimary">
                Cero Coincidencias al {pivotG.toFixed(1)}% de crecimiento con MoS {mosDiscount}%
              </h3>
              <p className="text-[10px] text-textSecondary mt-0.5">
                <strong>Principio de Aceptación de Resultado Vacío:</strong> El modelo protege el capital descartando valoraciones ficticias o sobreprecios.
              </p>
            </div>
          </div>

          {/* Diagnóstico 0: Descarte Preventivo por Riesgo de Trampa de Valor (Cuchillo Cayendo) */}
          {scanData.diagnostico_pedagogico?.descartadas_trampa_valor && scanData.diagnostico_pedagogico.descartadas_trampa_valor.length > 0 && (
            <div className="p-3 rounded-xl bg-card border border-statusRed/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-statusRed">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Protección Institucional: Descarte por Riesgo de Trampa de Valor (Cuchillo Cayendo)
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-statusRed/10 text-statusRed border border-statusRed/30">
                  {scanData.diagnostico_pedagogico.descartadas_trampa_valor.length} compañía(s) bloqueada(s)
                </span>
              </div>
              <p className="text-[11px] text-textSecondary leading-relaxed">
                <strong>¿Por qué se descartan aunque parezcan baratas?</strong> Compañías con caídas superiores al 35% en 52 semanas cuyos precios actuales <strong>no superan el Escenario de Estrés</strong> ante riesgo de disrupción por IA o pérdida de poder de precios. Se bloquean para no atrapar un cuchillo cayendo:
              </p>
              <div className="space-y-1.5 mt-1 font-mono text-xs">
                {scanData.diagnostico_pedagogico.descartadas_trampa_valor.map((item) => (
                  <div
                    key={item.ticker}
                    draggable={true}
                    onDragStart={(e) => handleCompanyDragStart(e, item)}
                    onClick={() => handleOpenDiscardedDetail(item)}
                    className="p-2.5 rounded-lg bg-canvas border border-statusRed/30 hover:border-statusRed hover:bg-cardSecondary flex items-center justify-between cursor-grab active:cursor-grabbing transition group shadow-sm"
                    title="Arrastra a Seguimiento · Clic para auditar el Escenario de Estrés y riesgos"
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-textPrimary group-hover:text-statusRed transition">{item.ticker}</span>
                        <span className="text-textSecondary text-[11px]">({item.nombre})</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-statusRed/20 text-statusRed font-bold">
                          ⚠️ Caída: -{item.caida_desde_maximo_52w_pct}%
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-[10px] text-textSecondary mt-0.5">
                        <span>P₀: {currSym}{item.precio_cierre_P0}</span>
                        <span className="text-textPrimary font-bold">Fair Value Estrés: {currSym}{item.fair_value_estres}</span>
                        <span className="text-statusRed font-bold">Techo MoS Estrés: {currSym}{item.techo_mos_estres}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-statusRed text-[10px] block font-sans font-bold">Bloqueada por Riesgo IA</span>
                      <span className="text-[9px] text-accentSky group-hover:underline block font-sans font-semibold">
                        Auditar Estrés →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Diagnóstico 1: Descarte por Techo de Coste de Capital (r <= g) */}
          {scanData.diagnostico_pedagogico?.descartadas_techo_r && scanData.diagnostico_pedagogico.descartadas_techo_r.length > 0 && (
            <div className="p-3 rounded-xl bg-card border border-accentYellow/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-accentYellow">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Protección de Modelo: Descarte por Techo de Coste de Capital (r &le; g)
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-accentYellow/10 text-accentYellow border border-accentYellow/30">
                  {scanData.diagnostico_pedagogico.descartadas_techo_r.length} compañía(s)
                </span>
              </div>
              <p className="text-[11px] text-textSecondary leading-relaxed">
                <strong>¿Por qué ocurre esto?</strong> La ley matemática de Gordon-Shapiro exige que el crecimiento perpetuo sea estrictamente inferior al coste de capital (<span className="text-textPrimary font-mono font-bold">r &gt; g</span>). En negocios maduros y defensivos de muy baja volatilidad (beta baja), asumir un crecimiento perpetuo del <strong>{pivotG.toFixed(1)}% o superior</strong> supera el crecimiento de la propia economía mundial y generaría valoraciones ficticias.
              </p>
              <div className="space-y-1.5 mt-1">
                {scanData.diagnostico_pedagogico.descartadas_techo_r.map((item) => (
                  <div
                    key={item.ticker}
                    draggable={true}
                    onDragStart={(e) => handleCompanyDragStart(e, item)}
                    onClick={() => handleOpenDiscardedDetail(item)}
                    className="p-2 rounded-lg bg-canvas border border-borderSubtle hover:border-accentYellow/70 hover:bg-cardSecondary text-xs flex items-center justify-between font-mono cursor-grab active:cursor-grabbing transition group shadow-sm"
                    title="Arrastra a Seguimiento · Clic para ver desglose completo de cálculo y riesgos"
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-textPrimary group-hover:text-accentYellow transition">{item.ticker}</span>
                        <span className="text-textSecondary text-[11px]">({item.nombre})</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-accentYellow/10 text-accentYellow border border-accentYellow/20">
                          Auditoría r &le; g
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-[10px] text-textSecondary mt-0.5">
                        <span className="text-accentSky">r: {(item.tasa_descuento_r * 100).toFixed(2)}%</span>
                        <span>• P₀: {currSym}{item.precio_cierre_P0}</span>
                        {(item.precio_entrada_prudente || item.vpMoSNeu) && (
                          <span className="text-accentYellow font-bold">
                            • MoS: {currSym}{item.precio_entrada_prudente || item.vpMoSNeu}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right max-w-sm">
                      {item.discrepancia != null && (
                        <span className="text-statusRed font-bold text-xs block font-mono">
                          {item.discrepancia}%
                        </span>
                      )}
                      <span className="text-[10px] text-accentYellow font-sans block leading-tight">{item.motivo_pedagogico}</span>
                      <span className="text-[9px] text-accentSky group-hover:underline block mt-0.5 font-sans font-semibold">
                        Ver cálculo, problemas y riesgos →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-1.5 flex items-center justify-between text-xs border-t border-borderSubtle/50">
                <span className="text-[10px] text-textSecondary">Rango natural de análisis para este perfil defensivo:</span>
                <button
                  onClick={() => onPivotChange(6.0)}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-accentSky text-canvas hover:bg-accentSky/90 shadow transition font-mono"
                >
                  Alinear al S&P 500 (6.0%) →
                </button>
              </div>
            </div>
          )}

          {/* Diagnóstico 1.5: En Zona de Valor Justo (P0 <= Fair Value Neutro) */}
          {scanData.diagnostico_pedagogico?.en_zona_valor_justo && scanData.diagnostico_pedagogico.en_zona_valor_justo.length > 0 && (
            <div className="p-3 rounded-xl bg-card border border-accentSky/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-accentSky">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    En Zona de Valor Justo (Cotizan con Descuento Fundamental)
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-accentSky/10 text-accentSky border border-accentSky/30">
                  {scanData.diagnostico_pedagogico.en_zona_valor_justo.length} compañía(s)
                </span>
              </div>
              <p className="text-[11px] text-textSecondary leading-relaxed">
                Empresas cuyo precio cotiza <strong>por debajo de su Fair Value fundamental</strong>, con descuento moderado pero sin alcanzar el colchón completo de compra agresiva con MoS:
              </p>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                {scanData.diagnostico_pedagogico.en_zona_valor_justo.slice(0, 8).map((item) => (
                  <div
                    key={item.ticker}
                    draggable={true}
                    onDragStart={(e) => handleCompanyDragStart(e, item)}
                    onClick={() => {
                      if (onAuditInCentralPillar) {
                        onAuditInCentralPillar(item.ticker);
                      } else {
                        handleOpenDiscardedDetail(item);
                      }
                    }}
                    className="p-2 rounded-lg bg-canvas border border-accentSky/30 hover:border-accentSky hover:bg-cardSecondary flex items-center justify-between cursor-grab active:cursor-grabbing transition group shadow-sm"
                    title="Arrastra a Seguimiento · Clic para auditar en el Pilar Central"
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-textPrimary group-hover:text-accentSky transition">{item.ticker}</span>
                        <span className="text-[10px] text-textSecondary truncate max-w-[110px]">{item.nombre}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-0.5 text-[10px] text-textSecondary">
                        <span>P₀: {currSym}{item.precio_cierre_P0}</span>
                        <span className="text-statusGreen font-semibold">FV: {currSym}{item.fair_value_teorico}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-accentSky font-bold text-xs block font-mono">
                        {item.fair_value_teorico && item.precio_cierre_P0 ? `-${(((item.fair_value_teorico - item.precio_cierre_P0)/item.fair_value_teorico)*100).toFixed(0)}%` : ''}
                      </span>
                      <span className="text-[9px] text-accentSky group-hover:underline block font-sans font-semibold">
                        Auditar en Pilar Central →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Diagnóstico 2: No Calificadas por Precio Excesivo */}
          {scanData.diagnostico_pedagogico?.no_calificadas_precio && scanData.diagnostico_pedagogico.no_calificadas_precio.length > 0 && (
            <div className="p-3 rounded-xl bg-card border border-borderSubtle space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-textPrimary">
                  <ShieldCheck className="w-4 h-4 text-statusGreen flex-shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Disciplina de Precio: Sobrevaloración frente a MoS ({mosDiscount}%)
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cardSecondary text-textSecondary">
                  {scanData.diagnostico_pedagogico.no_calificadas_precio.length} analizadas (clic para ver detalle)
                </span>
              </div>
              <p className="text-[11px] text-textSecondary leading-relaxed">
                Empresas con datos auditados válidos cuyo precio de mercado cotiza por encima del precio máximo prudente con margen de seguridad del {mosDiscount}%. Haz clic en cualquiera para auditar su cálculo:
              </p>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                {scanData.diagnostico_pedagogico.no_calificadas_precio.slice(0, 6).map((item) => (
                  <div
                    key={item.ticker}
                    draggable={true}
                    onDragStart={(e) => handleCompanyDragStart(e, item)}
                    onClick={() => {
                      if (onAuditInCentralPillar) {
                        onAuditInCentralPillar(item.ticker);
                      } else {
                        handleOpenDiscardedDetail(item);
                      }
                    }}
                    className="p-2 rounded-lg bg-canvas border border-borderSubtle hover:border-statusRed/70 hover:bg-cardSecondary flex items-center justify-between cursor-grab active:cursor-grabbing transition group shadow-sm"
                    title="Arrastra a Seguimiento · Clic para auditar en el Pilar Central"
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-textPrimary group-hover:text-accentSky transition">{item.ticker}</span>
                        <span className="text-[10px] text-textSecondary truncate max-w-[120px]">{item.nombre}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-0.5 text-[10px] text-textSecondary">
                        <span>P₀: {currSym}{item.precio_cierre_P0}</span>
                        {item.vpMoSNeu && <span className="text-accentYellow">MoS: {currSym}{item.vpMoSNeu}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-statusRed font-bold text-xs block font-mono">{item.discrepancia}%</span>
                      <span className="text-[9px] text-accentSky group-hover:underline block font-sans font-semibold">
                        Auditar en Pilar Central →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {mosDiscount > 15 && (
                <div className="pt-1.5 flex items-center justify-between text-xs border-t border-borderSubtle/50">
                  <span className="text-[10px] text-textSecondary">¿Deseas evaluar con menor exigencia de descuento?</span>
                  <button
                    onClick={() => onMosChange(20)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-statusGreen/10 text-statusGreen hover:bg-statusGreen/20 border border-statusGreen/30 transition font-mono"
                  >
                    Flexibilizar MoS al 20% →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : selectedCompany ? (
        /* 5. VISTA DE LA COMPAÑÍA SELECCIONADA CON LOS 3 ESCENARIOS */
        <div ref={detailScrollRef} className="flex-1 flex flex-col justify-start overflow-y-auto space-y-2.5 min-h-0 pr-0.5">
          {/* Tarjeta Ejecutiva Principal */}
          <div
            draggable={true}
            onDragStart={(e) => handleCompanyDragStart(e, selectedCompany)}
            onClick={() => handleOpenDiscardedDetail(selectedCompany as unknown as DiscardedCompanyDetail)}
            className="p-3.5 rounded-2xl bg-gradient-to-r from-cardSecondary to-card border border-borderMedium flex items-center justify-between shadow-sm cursor-grab active:cursor-grabbing hover:border-accentSky/60 hover:shadow-lg transition group"
            title="Arrastra para poner en seguimiento (margen derecho) o a Mis Compras · Clic para ver auditoría completa"
          >
            <div>
              <div className="flex items-center space-x-2.5">
                <GripVertical className="w-4 h-4 text-textSecondary/40 group-hover:text-accentSky/80 transition-colors shrink-0 -ml-1" />
                <span className="text-xl font-black text-textPrimary group-hover:text-accentSky transition">
                  {selectedCompany.nombre}
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-accentSky/10 text-accentSky border border-accentSky/30">
                  {selectedCompany.ticker}
                </span>
                {selectedCompany.sector && (
                  <span className="text-[11px] text-textSecondary font-medium">({selectedCompany.sector})</span>
                )}
                <span className="text-[10px] font-bold text-accentSky/80 group-hover:text-accentSky group-hover:underline flex items-center space-x-0.5 ml-2">
                  <span>Ver Auditoría Completa</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
                </span>
              </div>
              <div className="flex items-center space-x-3 mt-1.5 text-xs text-textSecondary font-mono flex-wrap gap-y-1">
                <span>
                  Precio Cierre (P₀): <strong className="text-textPrimary">{currSym}{selectedCompany.precio_cierre_P0.toFixed(2)}</strong>
                </span>
                <span>
                  r: <strong className="text-accentSky">{(selectedCompany.tasa_descuento_r * 100).toFixed(2)}%</strong>
                </span>
                {selectedCompany.g_fundamental_pct != null && (
                  <span title="Crecimiento ligada a fundamentales (reinv × ROIC)">
                    g_fund: <strong className="text-textPrimary">+{selectedCompany.g_fundamental_pct}%</strong>
                  </span>
                )}
                {selectedCompany.g_implicito_precio_pct != null && (
                  <span title="DCF Inverso: Crecimiento implícito en la cotización actual">
                    g_implícito: <strong className="text-accentYellow">+{selectedCompany.g_implicito_precio_pct}%</strong>
                  </span>
                )}
                {selectedCompany.downside_beta != null && (
                  <span title="Beta Bajista (Downside Beta de Ang-Chen-Xing) vs Beta Estándar">
                    β: <strong className="text-textPrimary">{selectedCompany.beta?.toFixed(2)}</strong> (β⁻: <strong className="text-accentYellow">{selectedCompany.downside_beta.toFixed(2)}</strong>)
                  </span>
                )}
                {selectedCompany.mvar_monthly_95 != null && (
                  <span title="Modified VaR al 95% mensual (Cornish-Fisher)">
                    mVaR: <strong className="text-textPrimary">{selectedCompany.mvar_monthly_95.toFixed(1)}%</strong>
                  </span>
                )}
                {(selectedCompany.nombre_arquetipo || selectedCompany.nombre_perfil) && (
                  <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-accentSky/15 text-accentSky border border-accentSky/30">
                    {selectedCompany.nombre_arquetipo || selectedCompany.nombre_perfil}
                  </span>
                )}
                {selectedCompany.modelo_valoracion && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-cardSecondary text-textSecondary border border-borderSubtle">
                    {selectedCompany.modelo_valoracion}
                  </span>
                )}
                {selectedCompany.quality_tier && (
                  <span className={`px-2 py-0.5 rounded font-bold border text-[10px] ${
                    selectedCompany.quality_tier === 'AAA' ? 'bg-statusGreen/15 text-statusGreen border-statusGreen/30' :
                    selectedCompany.quality_tier === 'AA' ? 'bg-accentSky/15 text-accentSky border-accentSky/30' :
                    selectedCompany.quality_tier === 'BBB' || selectedCompany.quality_tier === 'B' ? 'bg-accentYellow/15 text-accentYellow border-accentYellow/30' :
                    'bg-statusRed/15 text-statusRed border-statusRed/30'
                  }`}>
                    Salud: Tier {selectedCompany.quality_tier} ({selectedCompany.health_score ?? 80}/100)
                  </span>
                )}
                {selectedCompany.trampas_fundamentales && selectedCompany.trampas_fundamentales.length > 0 && (
                  selectedCompany.trampas_fundamentales.map((tf, i) => (
                    <span key={i} className="px-2 py-0.5 rounded font-bold text-[10px] bg-statusRed/15 text-statusRed border border-statusRed/30 flex items-center space-x-1" title={tf.detalle}>
                      <span>⚠️</span>
                      <span>{tf.titulo}</span>
                    </span>
                  ))
                )}
                {selectedCompany.auditoria_trampas?.alertas?.map((al, i) => (
                  <span key={i} className="px-2 py-0.5 rounded font-bold text-[10px] bg-accentYellow/15 text-accentYellow border border-accentYellow/30 flex items-center space-x-1">
                    <span>{al.icono}</span>
                    <span>{al.titulo}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Métrica Destacada en Amarillo o Rojo si es Trampa de Valor */}
            {selectedCompany.alerta_trampa_valor ? (
              <div className="text-right bg-statusRed/10 px-4 py-2.5 rounded-xl border border-statusRed/40 glow-red">
                <div className="flex items-center justify-end space-x-1 text-statusRed">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">Cuchillo Cayendo</span>
                </div>
                <span className="text-2xl font-black text-statusRed block font-mono">
                  -{selectedCompany.caida_desde_maximo_52w_pct}%
                </span>
                <span className="text-[10px] text-statusRed/90 block font-semibold">Alerta: Riesgo Trampa de Valor</span>
              </div>
            ) : (
              <div className="text-right bg-canvas/90 px-4 py-2.5 rounded-xl border border-accentYellow/40 glow-yellow">
                <div className="flex items-center justify-end space-x-1 text-accentYellow">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">Discrepancia Neutra (Δ_neu)</span>
                </div>
                <span className="text-2xl font-black text-accentYellow block font-mono">
                  {selectedCompany.discrepancia_porcentual_neutra}
                </span>
                <span className="text-[10px] text-textSecondary block">Descuento MoS a favor del inversor</span>
              </div>
            )}
          </div>

          {/* BARRA DE HERRAMIENTAS: GRÁFICO INTERACTIVO (VELAS/FAIR VALUE) Y COMPARADOR */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-canvas border border-borderSubtle flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowChart(!showChart)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                  showChart
                    ? 'bg-accentSky text-canvas border-accentSky shadow-sm'
                    : 'bg-cardSecondary hover:bg-cardHover text-textSecondary hover:text-textPrimary border-borderSubtle'
                }`}
              >
                <CandlestickChart className="w-3.5 h-3.5" />
                <span>{showChart ? 'Ocultar Gráfico' : 'Gráfico Interactivo (Velas & Fair Value)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsComparisonModalOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cardSecondary hover:bg-cardHover text-textSecondary hover:text-textPrimary border border-borderSubtle transition"
              >
                <Scale className="w-3.5 h-3.5 text-accentSky" />
                <span>Comparar con Competidor</span>
              </button>
            </div>

            <div className="text-[10px] text-textSecondary font-mono hidden sm:flex items-center space-x-2">
              <span>FV: <strong className="text-textPrimary">{currSym}{(selectedCompany.fair_value_teorico ?? selectedCompany.precio_cierre_P0).toFixed(2)}</strong></span>
              <span>·</span>
              <span>MoS: <strong className="text-statusGreen">{currSym}{(selectedCompany.escenario_neutro.VP_MoS ?? selectedCompany.escenario_neutro.VP_MoS_30).toFixed(2)}</strong></span>
            </div>
          </div>

          {/* GRÁFICO EXPANDIBLE DE VELAS & LÍNEAS DE VALORACIÓN */}
          {showChart && (
            <div className="p-3 rounded-2xl bg-canvas border border-borderMedium space-y-2 animate-fadeIn shadow-inner">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-textPrimary flex items-center space-x-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-accentSky" />
                  <span>Evolución Histórica & Líneas de Valor Justo (FV) y Techo MoS</span>
                </span>
                <span className="text-[10px] text-textSecondary">
                  Velas japonesas OHLC · Zoom & Pan interactivo
                </span>
              </div>
              <StockPriceChart
                ticker={selectedCompany.ticker}
                currency={(selectedCompany.currency === 'EUR' ? 'EUR' : 'USD')}
                fairValue={selectedCompany.fair_value_teorico ?? selectedCompany.precio_cierre_P0}
                mosCeiling={selectedCompany.escenario_neutro.VP_MoS ?? selectedCompany.escenario_neutro.VP_MoS_30}
                currentPrice={selectedCompany.precio_cierre_P0}
                initialMode="candles"
                initialTimeframe="1M"
              />
            </div>
          )}

          {/* Tarjeta Resumen del Filtro Value (5 Criterios: Invertir o Descartar) */}
          {selectedCompany.filtro_value && (
            <div
              onClick={() => setIsValueFilterModalOpen(true)}
              className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                selectedCompany.filtro_value.apto
                  ? 'bg-statusGreen/10 border-statusGreen/40 hover:border-statusGreen'
                  : selectedCompany.filtro_value.casi_apto
                  ? 'bg-accentYellow/10 border-accentYellow/40 hover:border-accentYellow'
                  : 'bg-cardSecondary/70 border-borderSubtle hover:border-statusRed/50'
              }`}
              title="Haz clic para abrir la tabla resumen completa del Filtro Value y su veredicto"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accentSky flex items-center space-x-1">
                    <Filter className="w-3 h-3" />
                    <span>Filtro Value (5 Años):</span>
                  </span>
                  <span
                    className={`text-[11px] font-mono font-black px-2 py-0.2 rounded border ${
                      selectedCompany.filtro_value.apto
                        ? 'bg-statusGreen/20 text-statusGreen border-statusGreen/40'
                        : selectedCompany.filtro_value.casi_apto
                        ? 'bg-accentYellow/20 text-accentYellow border-accentYellow/40'
                        : 'bg-statusRed/20 text-statusRed border-statusRed/40'
                    }`}
                  >
                    {selectedCompany.filtro_value.veredicto} ({selectedCompany.filtro_value.puntuacion}/5)
                  </span>
                </div>

                <div className="flex items-center flex-wrap gap-1.5 text-[10px] font-mono">
                  {[
                    { idx: 0, short: '1. Moat' },
                    { idx: 1, short: '2. ROIC >12%' },
                    { idx: 2, short: '3. Deuda <3x' },
                    { idx: 3, short: '4. FCF 5A' },
                    { idx: 4, short: '5. PER vs Hist' }
                  ].map(({ idx, short }) => {
                    const c = selectedCompany.filtro_value?.criterios?.[idx];
                    if (!c) return null;
                    return (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 rounded border inline-flex items-center space-x-1 ${
                          c.cumple
                            ? 'bg-statusGreen/15 text-statusGreen border-statusGreen/30 font-semibold'
                            : 'bg-statusRed/15 text-statusRed border-statusRed/30 font-semibold'
                        }`}
                        title={`${c.metrica}: ${c.dato_actual}`}
                      >
                        {c.cumple ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        <span>{short}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsValueFilterModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-canvas hover:bg-cardHover text-accentSky border border-accentSky/40 font-bold text-xs flex items-center space-x-1 flex-shrink-0 shadow-sm transition"
              >
                <span>Ver Tabla Filtro Value</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Alerta de Cuchillo Cayendo / Trampa de Valor si aplica */}
          {selectedCompany.alerta_trampa_valor ? (
            <div className="p-3 rounded-xl bg-statusRed/10 border border-statusRed/30 space-y-1.5 text-xs">
              <div className="flex items-center space-x-2 text-statusRed font-bold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="uppercase tracking-wider text-[11px]">
                  Advertencia de Riesgo: Desplome del -{selectedCompany.caida_desde_maximo_52w_pct}% en el último año
                </span>
              </div>
              <p className="text-[11px] text-textSecondary leading-relaxed">
                <strong>¿Por qué parece barata pero cae en picado?</strong> La empresa cotiza con holgura frente a sus flujos históricos pasados, pero el mercado está castigando severamente su cotización por <strong>riesgo de disrupción tecnológica por Inteligencia Artificial y pérdida de poder de fijación de precios</strong>.
              </p>
              {selectedCompany.fair_value_estres && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-card border border-borderSubtle text-[11px] font-mono">
                  <span className="text-textSecondary">
                    Valor Justo en Escenario de Estrés (Márgenes -30%, g=4%):
                  </span>
                  <strong className="text-textPrimary font-bold">{currSym}{selectedCompany.fair_value_estres.toFixed(2)}</strong>
                </div>
              )}
            </div>
          ) : (
            /* Alerta Pedagógica de Límite Teórico Estándar */
            <div className="p-2.5 rounded-xl bg-canvas border border-borderSubtle flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-3.5 h-3.5 text-accentYellow flex-shrink-0" />
                <span className="text-[11px] text-textSecondary">
                  <strong className="text-textPrimary">Diagnóstico Pedagógico de Sensibilidad:</strong> Con un coste de capital r de <strong className="text-accentSky">{(selectedCompany.tasa_descuento_r * 100).toFixed(2)}%</strong>, {selectedCompany.ticker} se encuentra próxima a su techo de crecimiento analítico (máx. {((selectedCompany.tasa_descuento_r - 0.01) * 100).toFixed(2)}%).
                </span>
              </div>
            </div>
          )}

          {/* Comparador de los 3 Escenarios de Crecimiento (Pesimista, Neutro, Optimista) */}
          <div className="grid grid-cols-3 gap-3">
            
            {/* ESCENARIO 1: PESIMISTA (CRITERIO ESTRICTO DE COMPRA - PUNTO 10) */}
            <div className="p-3.5 rounded-xl bg-canvas border border-accentSky/50 flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-accentSky/20 text-accentSky text-[9px] font-bold px-2 py-0.5 rounded-bl">
                CRITERIO DE COMPRA (P₀ ≤ VP_MoS)
              </div>
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-borderSubtle/60">
                  <span className="text-xs font-bold text-accentSky">1. Escenario Pesimista</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-card text-accentSky font-bold mr-36">
                    g_pess: {(selectedCompany.escenario_pesimista.g * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-textSecondary">Crecimiento (g):</span>
                    <span className="text-textPrimary font-semibold">
                      {(selectedCompany.escenario_pesimista.g * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-textSecondary">VP Teórico:</span>
                    <span className="text-textPrimary font-semibold">
                      {currSym}{selectedCompany.escenario_pesimista.VP_teorico.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-borderSubtle/40">
                    <span className="text-textSecondary">VP MoS ({selectedCompany.mos_discount_pct ?? mosDiscount}%):</span>
                    <span className="text-accentSky font-bold">
                      {currSym}{(selectedCompany.escenario_pesimista.VP_MoS ?? selectedCompany.escenario_pesimista.VP_MoS_30).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-borderSubtle/60 flex items-center justify-between">
                <span className="text-[11px] text-textSecondary">Filtro Compra:</span>
                {selectedCompany.escenario_pesimista.cumple_MoS ? (
                  <span className="text-[11px] font-bold text-statusGreen flex items-center bg-statusGreen/10 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> CUMPLE (P₀ ≤ VP_MoS)
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-textSecondary flex items-center bg-cardSecondary px-2 py-0.5 rounded">
                    <XCircle className="w-3.5 h-3.5 mr-1 text-textSecondary" /> NO CUMPLE
                  </span>
                )}
              </div>
            </div>

            {/* ESCENARIO 2: NEUTRO (VALORACIÓN BASE CENTRAL) */}
            <div className="p-3.5 rounded-xl bg-canvas border border-borderSubtle flex flex-col justify-between hover:border-borderMedium transition relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-cardSecondary text-textSecondary text-[9px] font-bold px-2 py-0.5 rounded-bl">
                VALOR JUSTO CENTRAL
              </div>
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-borderSubtle/60">
                  <span className="text-xs font-bold text-textPrimary">2. Escenario Neutro</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-card text-textSecondary font-bold mr-28">
                    g_neu: {(selectedCompany.escenario_neutro.g * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-textSecondary">Crecimiento (g):</span>
                    <span className="text-textPrimary font-bold">
                      {(selectedCompany.escenario_neutro.g * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-textSecondary">VP Teórico:</span>
                    <span className="text-textPrimary font-semibold">
                      {currSym}{selectedCompany.escenario_neutro.VP_teorico.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-borderSubtle/40">
                    <span className="text-textSecondary">VP MoS ({selectedCompany.mos_discount_pct ?? mosDiscount}%):</span>
                    <span className="text-textPrimary font-bold">
                      {currSym}{(selectedCompany.escenario_neutro.VP_MoS ?? selectedCompany.escenario_neutro.VP_MoS_30).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-borderSubtle/60 flex items-center justify-between">
                <span className="text-[11px] text-textSecondary">Filtro MoS Neutro:</span>
                {selectedCompany.escenario_neutro.cumple_MoS ? (
                  <span className="text-[11px] font-bold text-statusGreen flex items-center bg-statusGreen/10 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> CUMPLE (P₀ ≤ VP_MoS)
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-textSecondary flex items-center bg-cardSecondary px-2 py-0.5 rounded">
                    <XCircle className="w-3.5 h-3.5 mr-1 text-textSecondary" /> NO CUMPLE
                  </span>
                )}
              </div>
            </div>

            {/* ESCENARIO 3: OPTIMISTA (POTENCIAL ALCISTA) */}
            <div className="p-3.5 rounded-xl bg-canvas border border-borderSubtle flex flex-col justify-between hover:border-borderMedium transition relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-statusGreen/15 text-statusGreen text-[9px] font-bold px-2 py-0.5 rounded-bl">
                ESCENARIO ALCISTA
              </div>
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-borderSubtle/60">
                  <span className="text-xs font-bold text-textPrimary">3. Escenario Optimista</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-card text-statusGreen font-bold mr-24">
                    g_opt: {(selectedCompany.escenario_optimista.g * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-textSecondary">Crecimiento (g):</span>
                    <span className="text-textPrimary font-semibold">
                      {(selectedCompany.escenario_optimista.g * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-textSecondary">VP Teórico:</span>
                    <span className="text-textPrimary font-semibold">
                      {currSym}{selectedCompany.escenario_optimista.VP_teorico.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-borderSubtle/40">
                    <span className="text-textSecondary">VP MoS ({selectedCompany.mos_discount_pct ?? mosDiscount}%):</span>
                    <span className="text-statusGreen font-bold">
                      {currSym}{(selectedCompany.escenario_optimista.VP_MoS ?? selectedCompany.escenario_optimista.VP_MoS_30).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-borderSubtle/60 flex items-center justify-between">
                <span className="text-[11px] text-textSecondary">Filtro MoS Optimista:</span>
                {selectedCompany.escenario_optimista.cumple_MoS ? (
                  <span className="text-[11px] font-bold text-statusGreen flex items-center bg-statusGreen/10 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> CUMPLE (P₀ ≤ VP_MoS)
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-textSecondary flex items-center bg-cardSecondary px-2 py-0.5 rounded">
                    <XCircle className="w-3.5 h-3.5 mr-1 text-textSecondary" /> NO CUMPLE
                  </span>
                )}
              </div>
            </div>

          </div>

          {/* Barra Visual de Margen de Seguridad */}
          <div className="p-3 rounded-xl bg-canvas border border-borderSubtle text-xs">
            <div className="flex justify-between text-textSecondary mb-1.5">
              <span>Posición del Precio Actual respecto al Margen de Seguridad (MoS {mosDiscount}%):</span>
              <span className="font-mono text-statusGreen font-bold">
                P₀ ({currSym}{selectedCompany.precio_cierre_P0}) ≤ MoS Neutro ({currSym}{(selectedCompany.escenario_neutro.VP_MoS ?? selectedCompany.escenario_neutro.VP_MoS_30).toFixed(2)})
              </span>
            </div>
            <div className="w-full bg-cardSecondary h-2 rounded-full overflow-hidden flex">
              <div
                className="bg-accentSky h-2 rounded-full"
                style={{
                  width: `${Math.min(
                    (selectedCompany.precio_cierre_P0 / selectedCompany.escenario_neutro.VP_teorico) * 100,
                    100
                  )}%`
                }}
                title={`Precio Actual: ${currSym}${selectedCompany.precio_cierre_P0}`}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] text-textSecondary mt-1 font-mono">
              <span>0</span>
              <span className="text-accentSky font-bold">▲ Precio Actual P₀ ({currSym}{selectedCompany.precio_cierre_P0})</span>
              <span className="text-statusGreen">MoS {mosDiscount}% ({currSym}{(selectedCompany.escenario_neutro.VP_MoS ?? selectedCompany.escenario_neutro.VP_MoS_30).toFixed(2)})</span>
              <span className="text-textSecondary">VP Teórico ({currSym}{selectedCompany.escenario_neutro.VP_teorico})</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-textSecondary text-xs">
          Cargando datos del motor de valoración...
        </div>
      )}

      {/* 6. Barra de Navegación a Explicaciones (Drill-Down / Sin Redundancia) */}
      <div className="pt-3.5 border-t border-borderSubtle flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-xs text-textSecondary">
          <ShieldCheck className="w-3.5 h-3.5 text-statusGreen" />
          <span>Filtro conjunto verificado: P₀ ≤ VP_MoS (Neutro y Optimista).</span>
        </div>
        <div className="flex items-center space-x-2">
          {selectedCompany && onAddToWatchlist && (
            <button
              draggable={true}
              onDragStart={(e) => handleCompanyDragStart(e, selectedCompany)}
              onClick={() => onAddToWatchlist(selectedCompany.ticker)}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-cardSecondary hover:bg-cardHover text-textPrimary border border-borderSubtle font-bold text-xs shadow-sm transition cursor-grab active:cursor-grabbing"
              title={`Clic o arrastra al margen derecho para poner ${selectedCompany.ticker} en seguimiento continuo`}
            >
              <Eye className="w-4 h-4 text-accentSky" />
              <span>Seguir {selectedCompany.ticker}</span>
            </button>
          )}
          {selectedCompany && selectedCompany.filtro_value && (
            <button
              onClick={() => setIsValueFilterModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-accentSky/10 hover:bg-accentSky/20 text-accentSky border border-accentSky/30 font-bold text-xs shadow-sm transition"
              title={`Abrir Tabla Resumen del Filtro Value para ${selectedCompany.ticker}`}
            >
              <Filter className="w-4 h-4 text-accentSky" />
              <span>Filtro Value ({selectedCompany.filtro_value.puntuacion}/5)</span>
            </button>
          )}
          {selectedCompany && (
            <button
              onClick={() => handleOpenDiscardedDetail(selectedCompany as unknown as DiscardedCompanyDetail)}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-cardSecondary hover:bg-cardHover text-textPrimary border border-borderSubtle font-bold text-xs shadow-sm transition"
              title={`Ver auditoría completa, riesgos y recomendaciones de ${selectedCompany.ticker}`}
            >
              <ShieldCheck className="w-4 h-4 text-statusGreen" />
              <span>Auditoría {selectedCompany.ticker}</span>
            </button>
          )}
          {selectedCompany && (
            <button
              onClick={() => setIsComparisonModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-cardSecondary hover:bg-cardHover text-textPrimary border border-borderSubtle font-bold text-xs shadow-sm transition"
              title={`Comparar ${selectedCompany.ticker} frente a competidores directos`}
            >
              <Scale className="w-4 h-4 text-accentSky" />
              <span>Comparar {selectedCompany.ticker}</span>
            </button>
          )}
          {selectedCompany && onOpenFinancialDeepDive && (
            <button
              onClick={() => onOpenFinancialDeepDive(selectedCompany.ticker)}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs shadow-sm transition"
              title={`Ver Radiografía Financiera Institucional (14 métricas auditadas SEC EDGAR) de ${selectedCompany.ticker}`}
            >
              <FileCheck2 className="w-4 h-4 text-emerald-400" />
              <span>Radiografía {selectedCompany.ticker}</span>
            </button>
          )}
          {selectedCompany && onOpenAIChat && (
            <button
              type="button"
              onClick={onOpenAIChat}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-accentSky/15 to-purple-500/15 hover:from-accentSky/25 hover:to-purple-500/25 text-accentSky border border-accentSky/30 font-bold text-xs shadow-sm transition group"
              title={`Consultar con el Copiloto IA sobre ${selectedCompany.nombre}`}
            >
              <Sparkles className="w-4 h-4 text-accentSky group-hover:scale-110 transition-transform" />
              <span>Consultar con IA</span>
            </button>
          )}
          <button
            onClick={onOpenThesis}
            disabled={!selectedCompany}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-accentSky text-canvas hover:bg-accentSky/90 font-bold text-xs shadow-md transition disabled:opacity-50"
          >
            <span>Ver Fórmulas y Metodología MoS</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal de Tabla Resumen y Veredicto del Filtro Value */}
      <ValueFilterModal
        isOpen={isValueFilterModalOpen}
        company={selectedCompany}
        onClose={() => setIsValueFilterModalOpen(false)}
        onOpenFinancialDeepDive={onOpenFinancialDeepDive}
      />

      {/* Modal de Auditoría y Diagnóstico de Empresas Descartadas */}
      <DiscardedDetailModal
        isOpen={isDiscardedModalOpen}
        company={selectedDiscarded}
        onClose={() => {
          setIsDiscardedModalOpen(false);
          setSelectedDiscarded(null);
        }}
        onApplySuggestedSettings={(newG, newMos) => {
          onPivotChange(newG);
          onMosChange(newMos);
          setIsDiscardedModalOpen(false);
          setSelectedDiscarded(null);
        }}
        onBuyTrade={(comp) => {
          if (onOpenBuyTrade) {
            onOpenBuyTrade(comp);
          }
        }}
        onAddToWatchlist={onAddToWatchlist}
        onOpenFinancialDeepDive={onOpenFinancialDeepDive}
        onAuditInCentralPillar={onAuditInCentralPillar}
      />

      {/* Modal de Comparador de Activos Frente a Frente */}
      <AssetComparisonModal
        isOpen={isComparisonModalOpen}
        onClose={() => setIsComparisonModalOpen(false)}
        baseTicker={selectedCompany?.ticker || 'AMS.MC'}
        onSelectCompanyForCentralPillar={(t) => {
          if (onAuditInCentralPillar) onAuditInCentralPillar(t);
        }}
        onBuyTrade={onOpenBuyTrade}
        onAddToWatchlist={onAddToWatchlist}
      />
    </section>
  );
};
