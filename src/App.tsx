import React, { useState, useEffect, useCallback } from 'react';
import { Eye, Activity } from 'lucide-react';
import { Header } from './components/Header';
import { PortfolioColumn } from './components/PortfolioColumn';
import { FundamentalColumn } from './components/FundamentalColumn';
import { MacroGrowingColumn } from './components/MacroGrowingColumn';
import { WatchlistColumn } from './components/WatchlistColumn';
import { TechnicalAnalysisModal } from './components/TechnicalAnalysisModal';
import { AddTradeModal } from './components/AddTradeModal';
import { ThesisModal } from './components/ThesisModal';
import { DiscardedDetailModal } from './components/DiscardedDetailModal';
import { AssetSearchModal, SearchAssetItem } from './components/AssetSearchModal';
import { CompanyFinancialDeepDiveModal } from './components/CompanyFinancialDeepDiveModal';
import { AIAssistantDrawer } from './components/AIAssistantDrawer';
import {
  PortfolioPosition,
  PortfolioSummary,
  PortfolioTrade,
  ClosedSummary,
  MacroData,
  Pilar1ScanResponse,
  Pilar1Result,
  DiscardedCompanyDetail,
  GrowthMetrics,
  ScreenedOpportunity,
  WatchlistItem,
  MarketIndex
} from './types';

export const App: React.FC = () => {
  // Estado de Portafolio y Compras
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [rawTrades, setRawTrades] = useState<PortfolioTrade[]>([]);
  const [closedTrades, setClosedTrades] = useState<PortfolioTrade[]>([]);
  const [closedSummary, setClosedSummary] = useState<ClosedSummary | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string>('V');
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState<boolean>(false);

  // Estado Multi-Mercado (Fase 2: S&P 500 · NASDAQ 100 · IBEX 35)
  const [selectedMarket, setSelectedMarket] = useState<MarketIndex>('SP500');

  // Estado de Refresco en Tiempo Real (Fase 0)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(() => {
    const saved = localStorage.getItem('app_auto_refresh_interval');
    return saved !== null ? Number(saved) : 30; // 30s por defecto
  });
  const [isLiveSyncing, setIsLiveSyncing] = useState<boolean>(false);

  // Estado Macro
  const [macroData, setMacroData] = useState<MacroData | null>(null);

  // Estado Pilar 1: Desajuste de Valor Intrínseco (Gordon-Shapiro & MoS 30%)
  const [scanData, setScanData] = useState<Pilar1ScanResponse | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Pilar1Result | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [pivotG, setPivotG] = useState<number>(7.0);
  const [mosDiscount, setMosDiscount] = useState<number>(20);

  // Estado Growing
  const [growthMetrics, setGrowthMetrics] = useState<GrowthMetrics | null>(null);

  // Estado Empresas en Seguimiento (Watchlist) & Análisis Técnico
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [isLoadingWatchlist, setIsLoadingWatchlist] = useState<boolean>(false);
  const [rightPanelTab, setRightPanelTab] = useState<'watchlist' | 'macro'>('macro');
  const [selectedTechnicalTicker, setSelectedTechnicalTicker] = useState<string | null>(null);
  const [isTechnicalModalOpen, setIsTechnicalModalOpen] = useState<boolean>(false);

  // Modales
  const [isAddTradeOpen, setIsAddTradeOpen] = useState(false);
  const [initialTradeData, setInitialTradeData] = useState<{
    ticker?: string;
    companyName?: string;
    buyPrice?: number;
    fairValue?: number;
    currency?: 'EUR' | 'USD';
  } | null>(null);
  const [isThesisOpen, setIsThesisOpen] = useState(false);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<DiscardedCompanyDetail | null>(null);
  const [isAssetDetailOpen, setIsAssetDetailOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Estado del Modal de Radiografía Financiera Institucional (14 métricas SEC EDGAR)
  const [deepDiveTicker, setDeepDiveTicker] = useState<string | null>(null);
  const [isDeepDiveOpen, setIsDeepDiveOpen] = useState(false);

  const handleOpenFinancialDeepDive = (ticker: string) => {
    setDeepDiveTicker(ticker);
    setIsDeepDiveOpen(true);
  };

  // Estado del Asistente / Copiloto de IA
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  // Estado del Modal de Búsqueda Rápida de Activos
  const [searchModalAsset, setSearchModalAsset] = useState<SearchAssetItem | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isAuditingAsset, setIsAuditingAsset] = useState(false);

  const handleSelectSearchedAsset = (asset: SearchAssetItem) => {
    setSearchModalAsset(asset);
    setIsSearchModalOpen(true);
  };

  const handleRequestFullAudit = async (ticker: string) => {
    const cleanTicker = (ticker || searchModalAsset?.ticker || '').trim().toUpperCase();
    if (!cleanTicker) return;
    try {
      setIsAuditingAsset(true);
      const res = await fetch(`/api/pilar1/audit/${encodeURIComponent(cleanTicker)}?mos=${mosDiscount}`);
      if (res.ok) {
        const auditData: DiscardedCompanyDetail = await res.json();
        setIsSearchModalOpen(false);
        setSelectedAssetDetail({
          ...auditData,
          ticker: auditData.ticker || cleanTicker,
          nombre: auditData.nombre || searchModalAsset?.name || cleanTicker,
          precio_cierre_P0: auditData.precio_cierre_P0 || searchModalAsset?.price || 0
        });
        setIsAssetDetailOpen(true);
      } else {
        alert(`No se pudo generar la auditoría de ${cleanTicker}. Verifique que el ticker sea válido.`);
      }
    } catch (err) {
      console.error('Error al auditar activo:', err);
      alert(`Error al conectar con el motor de auditoría para ${cleanTicker}.`);
    } finally {
      setIsAuditingAsset(false);
    }
  };

  // Cargar y auditar cualquier compañía directamente en el Pilar Central consultando datos en vivo en el momento de la petición
  const handleAuditInCentralPillar = async (ticker: string) => {
    const cleanTicker = (ticker || selectedAssetDetail?.ticker || searchModalAsset?.ticker || '').trim().toUpperCase();
    if (!cleanTicker) return;
    try {
      setIsAuditingAsset(true);

      // Consultar siempre en tiempo real (cotización en vivo + consenso + SEC EDGAR TTM)
      const res = await fetch(`/api/pilar1/audit/${encodeURIComponent(cleanTicker)}?mos=${mosDiscount}`);
      if (res.ok) {
        const auditData = await res.json();
        const p0 = auditData.precio_cierre_P0 || searchModalAsset?.price || 0;
        const fv = auditData.fair_value_teorico || auditData.fair_value_Gordon || p0;
        const techo = auditData.techo_maximo_compra || Number((fv * (1 - mosDiscount / 100)).toFixed(2));
        const defaultScen = {
          g: auditData.g_efectivo_utilizado || 0.035,
          VP_teorico: fv,
          VP_MoS: techo,
          VP_MoS_30: Number((fv * 0.70).toFixed(2)),
          cumple_MoS: p0 <= techo,
          cumple_compra: p0 <= techo
        };

        const pilar1Company: Pilar1Result = {
          ...auditData,
          ticker: auditData.ticker || cleanTicker,
          nombre: auditData.nombre || searchModalAsset?.name || cleanTicker,
          precio_cierre_P0: p0,
          tasa_descuento_r: auditData.tasa_descuento_r || 0.085,
          escenario_pesimista: auditData.escenario_pesimista || defaultScen,
          escenario_neutro: auditData.escenario_neutro || defaultScen,
          escenario_optimista: auditData.escenario_optimista || defaultScen,
          discrepancia_porcentual_neutra: auditData.discrepancia_porcentual_neutra || `${auditData.discrepancia ?? 0}%`
        };

        setSelectedCompany(pilar1Company);
        setSelectedTicker(pilar1Company.ticker);
        setIsSearchModalOpen(false);
        setIsAssetDetailOpen(false);
        fetchGrowth(pilar1Company.ticker);
      } else {
        alert(`No se pudo cargar la auditoría en el Pilar Central para ${cleanTicker}.`);
      }
    } catch (err) {
      console.error('Error al auditar en Pilar Central:', err);
      alert(`Error de conexión al cargar ${cleanTicker} en el Pilar Central.`);
    } finally {
      setIsAuditingAsset(false);
    }
  };

  // Abrir modal de compra directamente con datos de una empresa
  const handleOpenAddTradeWithCompany = (comp: any) => {
    const rawPrice = comp.buyPrice ?? comp.buy_price ?? comp.precio_cierre_P0 ?? comp.current_price ?? comp.price ?? comp.added_price ?? 0;
    const rawFv = comp.fairValue ?? comp.fair_value_Gordon ?? comp.fair_value ?? comp.target_exit_price ?? (rawPrice > 0 ? Number((rawPrice * 1.15).toFixed(2)) : undefined);
    setInitialTradeData({
      ticker: (comp.ticker || '').trim().toUpperCase(),
      companyName: comp.nombre || comp.company_name || comp.companyName || comp.name || comp.ticker,
      buyPrice: rawPrice > 0 ? rawPrice : undefined,
      fairValue: rawFv > 0 ? rawFv : undefined,
      currency: comp.currency || 'USD'
    });
    setIsAddTradeOpen(true);
  };

  // Abrir detalle completo / auditoría / velas de un activo recomendado de Dalio
  const handleOpenMacroAssetDetail = async (asset: { ticker: string; name: string; price: number; currency: string }) => {
    // Si existe en el scanData (S&P 500 analizado), usamos sus datos completos
    const inScanCalificada = scanData?.resultados?.find((c) => c.ticker === asset.ticker);
    const inScanNoCalificada = scanData?.diagnostico_pedagogico?.no_calificadas_precio?.find((c) => c.ticker === asset.ticker);
    const inScanTechoR = scanData?.diagnostico_pedagogico?.descartadas_techo_r?.find((c) => c.ticker === asset.ticker);

    if (inScanCalificada) {
      setSelectedAssetDetail(inScanCalificada as unknown as DiscardedCompanyDetail);
      setIsAssetDetailOpen(true);
      return;
    }
    if (inScanNoCalificada) {
      setSelectedAssetDetail(inScanNoCalificada);
      setIsAssetDetailOpen(true);
      return;
    }
    if (inScanTechoR) {
      setSelectedAssetDetail(inScanTechoR);
      setIsAssetDetailOpen(true);
      return;
    }

    // Obtener cotización real fresca si está disponible
    let realPrice = asset.price;
    try {
      const qRes = await fetch(`/api/quote/${encodeURIComponent(asset.ticker)}`);
      if (qRes.ok) {
        const qJson = await qRes.json();
        if (qJson.price && qJson.price > 0) {
          realPrice = qJson.price;
        }
      }
    } catch (e) {
      // Usar fallback de asset.price
    }

    const calculatedFairValue = Number((realPrice * 1.15).toFixed(2));
    const calculatedMoS10 = Number((calculatedFairValue * 0.90).toFixed(2));
    const calculatedMoS20 = Number((calculatedFairValue * 0.80).toFixed(2));
    const calculatedMoS30 = Number((calculatedFairValue * 0.70).toFixed(2));

    const fullDetail: DiscardedCompanyDetail = {
      status: 'ANALIZADA_MACRO',
      ticker: asset.ticker,
      nombre: asset.name,
      sector: 'Macro Playbook (Ray Dalio)',
      precio_cierre_P0: realPrice,
      tasa_descuento_r: 0.085,
      D1_o_FCFA1: Number((realPrice * 0.045).toFixed(2)),
      beta: 0.75,
      pivot_g: 0.035,
      mos_discount_pct: mosDiscount,
      tipo_descarte: 'CALIFICADA',
      perfil_empresa: 'CALIDAD_CRECIMIENTO',
      nombre_perfil: 'Activo Refugio Macro / Dalio',
      escalera_mos: {
        fair_value: calculatedFairValue,
        mos_10_pct: calculatedMoS10,
        mos_20_pct: calculatedMoS20,
        mos_30_pct: calculatedMoS30
      }
    };

    setSelectedAssetDetail(fullDetail);
    setIsAssetDetailOpen(true);
  };

  // 1. Cargar Portafolio
  const fetchPortfolio = useCallback(async (sync: boolean = false) => {
    setIsLoadingPortfolio(true);
    try {
      const url = sync ? '/api/portfolio?sync=true' : '/api/portfolio';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setPositions(data.positions);
        setRawTrades(data.raw_trades || []);
        setClosedTrades(data.closed_trades || []);
        setClosedSummary(data.closed_summary || null);
      }
    } catch (err) {
      console.error('Error al cargar portafolio:', err);
    } finally {
      setIsLoadingPortfolio(false);
    }
  }, []);

  const handleDeleteTrade = async (id: number) => {
    try {
      const res = await fetch(`/api/portfolio/trade/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchPortfolio();
      }
    } catch (err) {
      console.error('Error al borrar trade:', err);
    }
  };

  const handleCloseTrade = async (data: {
    id: number;
    sell_price?: number;
    sell_date?: string;
    sell_fees?: number;
    closing_notes?: string;
  }) => {
    try {
      const res = await fetch('/api/portfolio/close-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        await fetchPortfolio();
      }
    } catch (err) {
      console.error('Error al cerrar / liquidar trade:', err);
    }
  };

  const handleReopenTrade = async (id: number) => {
    try {
      const res = await fetch('/api/portfolio/reopen-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        await fetchPortfolio();
      }
    } catch (err) {
      console.error('Error al reabrir trade:', err);
    }
  };

  const handleClearAllTrades = async () => {
    try {
      const res = await fetch('/api/portfolio/clear-all', { method: 'DELETE' });
      if (res.ok) {
        await fetchPortfolio();
      }
    } catch (err) {
      console.error('Error al purgar todas las operaciones:', err);
    }
  };

  const handleUpdateTrade = async (id: number, data: Partial<PortfolioTrade>) => {
    try {
      const res = await fetch(`/api/portfolio/trade/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        await fetchPortfolio();
      }
    } catch (err) {
      console.error('Error al actualizar trade:', err);
    }
  };

  // 2. Cargar Datos Macro
  const fetchMacro = useCallback(async () => {
    try {
      const res = await fetch('/api/macro');
      if (res.ok) {
        const data = await res.json();
        setMacroData(data);
      }
    } catch (err) {
      console.error('Error al cargar datos macro:', err);
    }
  }, []);

  // 3. Cargar Métricas de Crecimiento para la empresa en foco
  const fetchGrowth = useCallback(async (ticker: string) => {
    try {
      const res = await fetch(`/api/growth/${ticker}`);
      if (res.ok) {
        const data = await res.json();
        setGrowthMetrics(data);
      } else {
        setGrowthMetrics(null);
      }
    } catch (err) {
      console.error('Error al cargar métricas de crecimiento:', err);
      setGrowthMetrics(null);
    }
  }, []);

  // 4. Cargar / Ejecutar Escaneo del Pilar 1
  const fetchPilar1Scan = useCallback(async (
    customPivot?: number,
    customMos?: number,
    customMarket?: MarketIndex,
    isMarketSwitch?: boolean,
    forceSync: boolean = false
  ) => {
    setIsScanning(true);
    try {
      const p = customPivot !== undefined ? customPivot : pivotG;
      const m = customMos !== undefined ? customMos : mosDiscount;
      const mkt = customMarket || selectedMarket;
      const res = await fetch(`/api/pilar1/scan?pivot_g=${(p / 100).toFixed(4)}&mos=${(m / 100).toFixed(4)}&market=${mkt}&sync=${forceSync ? 'true' : 'false'}`);
      if (res.ok) {
        const data: Pilar1ScanResponse = await res.json();
        setScanData(data);
        if (data.resultados && data.resultados.length > 0) {
          const match = isMarketSwitch ? data.resultados[0] : (data.resultados.find((c) => c.ticker === selectedTicker) || data.resultados[0]);
          setSelectedCompany(match);
          setSelectedTicker(match.ticker);
          fetchGrowth(match.ticker);

          // Sincronizar en tiempo real la cotización puntual del foco activo al instante sin bloquear
          if (match.ticker) {
            fetch(`/api/quote/${encodeURIComponent(match.ticker)}`)
              .then(qRes => qRes.ok ? qRes.json() : null)
              .then(qJson => {
                if (qJson?.price && qJson.price > 0) {
                  setSelectedCompany(prev => (prev && prev.ticker === match.ticker) ? { ...prev, precio_cierre_P0: qJson.price } : prev);
                }
              })
              .catch(() => {});
          }
        } else if (data.diagnostico_pedagogico?.en_zona_valor_justo && data.diagnostico_pedagogico.en_zona_valor_justo.length > 0) {
          const topFv = data.diagnostico_pedagogico.en_zona_valor_justo[0];
          setSelectedCompany(topFv as unknown as Pilar1Result);
          setSelectedTicker(topFv.ticker);
        } else if (data.diagnostico_pedagogico?.no_calificadas_precio && data.diagnostico_pedagogico.no_calificadas_precio.length > 0) {
          const topNoCal = data.diagnostico_pedagogico.no_calificadas_precio[0];
          setSelectedCompany(topNoCal as unknown as Pilar1Result);
          setSelectedTicker(topNoCal.ticker);
        } else {
          setSelectedCompany(null);
        }
      }
    } catch (err) {
      console.error('Error al cargar escaneo del Pilar 1:', err);
    } finally {
      setIsScanning(false);
    }
  }, [selectedTicker, pivotG, mosDiscount, selectedMarket, fetchGrowth]);

  const runPilar1Scan = async (forceEmpty: boolean = false, customPivot?: number, customMos?: number) => {
    setIsScanning(true);
    try {
      const p = customPivot !== undefined ? customPivot : pivotG;
      const m = customMos !== undefined ? customMos : mosDiscount;
      const res = await fetch('/api/pilar1/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          force_empty: forceEmpty,
          pivot_g: (p / 100).toFixed(4),
          mos: (m / 100).toFixed(4),
          market: selectedMarket,
          sync: true
        })
      });
      if (res.ok) {
        const data: Pilar1ScanResponse = await res.json();
        setScanData(data);
        if (data.resultados && data.resultados.length > 0) {
          setSelectedCompany(data.resultados[0]);
          setSelectedTicker(data.resultados[0].ticker);
        } else {
          setSelectedCompany(null);
        }
      }
    } catch (err) {
      console.error('Error al ejecutar barrido diario:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectMarket = (mkt: MarketIndex) => {
    setSelectedMarket(mkt);
    fetchPilar1Scan(pivotG, mosDiscount, mkt, true, false);
  };

  const handlePivotChange = (newVal: number) => {
    setPivotG(newVal);
    fetchPilar1Scan(newVal, mosDiscount, selectedMarket, false, false);
  };

  const handleMosChange = (newMos: number) => {
    setMosDiscount(newMos);
    fetchPilar1Scan(pivotG, newMos, selectedMarket, false, false);
  };

  // 5. Cargar Empresas en Seguimiento (Watchlist)
  const fetchWatchlist = useCallback(async (sync: boolean = false) => {
    setIsLoadingWatchlist(true);
    try {
      const url = sync ? '/api/watchlist?sync=true' : '/api/watchlist';
      const res = await fetch(url);
      if (res.ok) {
        const data: WatchlistItem[] = await res.json();
        setWatchlist(data);
      }
    } catch (err) {
      console.error('Error al cargar empresas en seguimiento:', err);
    } finally {
      setIsLoadingWatchlist(false);
    }
  }, []);

  const handleAddWatchlistTicker = async (ticker: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker })
      });
      if (res.ok) {
        await fetchWatchlist();
        return true;
      } else {
        const err = await res.json();
        alert(err.error || `No se pudo añadir ${ticker} a seguimiento`);
        return false;
      }
    } catch (err) {
      console.error('Error al añadir a seguimiento:', err);
      alert(`Error de conexión al añadir ${ticker}`);
      return false;
    }
  };

  const handleRemoveWatchlistTicker = async (ticker: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/watchlist/${encodeURIComponent(ticker)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchWatchlist();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error al eliminar de seguimiento:', err);
      return false;
    }
  };

  const handleOpenTechnicalModal = (ticker: string) => {
    setSelectedTechnicalTicker(ticker);
    setIsTechnicalModalOpen(true);
  };

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchPortfolio(), fetchMacro(), fetchPilar1Scan(), fetchWatchlist()]);
    if (selectedTicker) {
      await fetchGrowth(selectedTicker);
    }
    setIsRefreshing(false);
  }, [fetchPortfolio, fetchMacro, fetchPilar1Scan, fetchWatchlist, fetchGrowth, selectedTicker]);

  // Carga inicial
  useEffect(() => {
    refreshAll();
  }, []);

  // Cambio de intervalo de refresco en tiempo real
  const handleAutoRefreshChange = (interval: number) => {
    setAutoRefreshInterval(interval);
    localStorage.setItem('app_auto_refresh_interval', interval.toString());
  };

  // Refresco inteligente en segundo plano sin parpadeos ni recargas completas
  const runSmartLiveRefresh = useCallback(async () => {
    // 1. Recopilar tickers activos: Cartera abierta, Seguimiento y Foco Central
    const activeTickers = new Set<string>();
    positions.forEach((p) => {
      if (p.ticker) activeTickers.add(p.ticker.trim().toUpperCase());
    });
    watchlist.forEach((w) => {
      if (w.ticker) activeTickers.add(w.ticker.trim().toUpperCase());
    });
    if (selectedTicker) activeTickers.add(selectedTicker.trim().toUpperCase());
    if (selectedCompany?.ticker) activeTickers.add(selectedCompany.ticker.trim().toUpperCase());

    const tickers = Array.from(activeTickers).filter(Boolean);
    if (tickers.length === 0) return;

    try {
      setIsLiveSyncing(true);
      const res = await fetch('/api/market/batch-live-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers })
      });

      if (res.ok) {
        const data = await res.json();
        const quotes = data.quotes || {};

        // Sincronizar silenciosamente las cotizaciones locales en portfolio y watchlist
        fetchPortfolio(false);
        fetchWatchlist(false);

        // Si la compañía activa en el Pilar Central recibió tick, actualizar en vivo
        if (selectedCompany && quotes[selectedCompany.ticker]) {
          const q = quotes[selectedCompany.ticker];
          setSelectedCompany((prev) => {
            if (!prev) return prev;
            const newPrice = q.price;
            const fv = prev.fair_value_teorico || prev.escenario_neutro?.VP_teorico || prev.escalera_mos?.fair_value || newPrice;
            const techo = prev.techo_maximo_compra || (fv ? Number((fv * (1 - mosDiscount / 100)).toFixed(2)) : newPrice);
            const neutroMoS = prev.escenario_neutro?.VP_MoS ?? prev.escenario_neutro?.VP_MoS_30 ?? techo;
            return {
              ...prev,
              precio_cierre_P0: newPrice,
              cumple_compra: newPrice <= techo,
              cumple_MoS: newPrice <= techo,
              escenario_neutro: prev.escenario_neutro
                ? {
                    ...prev.escenario_neutro,
                    cumple_MoS: newPrice <= neutroMoS
                  }
                : prev.escenario_neutro
            };
          });
        }
      }
    } catch (err) {
      console.warn('Fallo silencioso en sincronización por lotes:', err);
    } finally {
      setIsLiveSyncing(false);
    }
  }, [positions, watchlist, selectedTicker, selectedCompany, mosDiscount, fetchPortfolio, fetchWatchlist]);

  // Temporizador para el modo En Vivo
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    const intervalId = setInterval(() => {
      if (!document.hidden) {
        runSmartLiveRefresh();
      }
    }, autoRefreshInterval * 1000);

    return () => clearInterval(intervalId);
  }, [autoRefreshInterval, runSmartLiveRefresh]);

  // Sincronizar crecimiento al cambiar la compañía seleccionada
  useEffect(() => {
    if (selectedCompany) {
      fetchGrowth(selectedCompany.ticker);
    }
  }, [selectedCompany, fetchGrowth]);

  const handleSelectTicker = (ticker: string) => {
    setSelectedTicker(ticker);
    if (scanData && scanData.resultados) {
      const match = scanData.resultados.find((c) => c.ticker === ticker);
      if (match) {
        setSelectedCompany(match);
      }
    }
    fetchGrowth(ticker);
  };

  const handleSelectCompany = (comp: Pilar1Result) => {
    setSelectedCompany(comp);
    setSelectedTicker(comp.ticker);
    fetchGrowth(comp.ticker);
  };

  // Adaptador para el bloque derecho (compatibilidad visual)
  const currentOpportunityAdapter: ScreenedOpportunity | null = selectedCompany
    ? {
        ticker: selectedCompany.ticker,
        name: selectedCompany.nombre,
        sector: selectedCompany.sector || 'General',
        currency: 'USD',
        filter_badge: 'MoS 30% Superado en Escenarios Neutro & Optimista',
        catalyst_label: 'Discrepancia Neutra',
        catalyst_value: selectedCompany.discrepancia_porcentual_neutra,
        catalyst_subtext: 'Margen de seguridad defensivo',
        roic: 35.0,
        roe: 45.0,
        roce: 38.0,
        ev_fcf: 24.0,
        pe_ntm: 26.0,
        net_debt_ebitda: 0.3,
        ebit_margin: 40.0,
        gross_margin: 60.0,
        fcf_conversion: 95.0,
        capex_sales: 5.0,
        piotroski_score: 9,
        altman_z: 8.0,
        thesis_points: []
      }
    : null;

  return (
    <div className="h-screen max-h-screen bg-canvas text-textPrimary p-3 md:p-3.5 flex flex-col space-y-2.5 overflow-hidden">
      {/* 1. Header Superior con estatus BBDD, régimen macro, divisas EUR/USD, selector multi-mercado y buscador */}
      <Header
        macroRegime={macroData?.regime || null}
        fxEurUsd={summary?.fx_eur_usd || 1.085}
        onRefresh={refreshAll}
        isRefreshing={isRefreshing}
        onSelectAsset={handleSelectSearchedAsset}
        onAuditInCentralPillar={handleAuditInCentralPillar}
        onOpenAIChat={() => setIsAIChatOpen(true)}
        selectedMarket={selectedMarket}
        onSelectMarket={handleSelectMarket}
        autoRefreshInterval={autoRefreshInterval}
        onChangeAutoRefreshInterval={handleAutoRefreshChange}
        isLiveSyncing={isLiveSyncing}
      />

      {/* 2. Layout Principal de los 3 Pilares en Pantalla */}
      <main className="grid grid-cols-12 gap-3 flex-1 min-h-0 max-h-full overflow-hidden">
        {/* Pilar 1 (Margen Izquierdo): Mis Compras & BBDD Local (25% ancho = 3 col) */}
        <div className="col-span-3 h-full min-h-0 max-h-full overflow-hidden flex flex-col">
          <PortfolioColumn
            summary={summary}
            positions={positions}
            trades={rawTrades}
            closedTrades={closedTrades}
            closedSummary={closedSummary}
            selectedTicker={selectedTicker}
            onSelectTicker={handleSelectTicker}
            onOpenAddTrade={() => {
              setInitialTradeData(null);
              setIsAddTradeOpen(true);
            }}
            onDeleteTrade={handleDeleteTrade}
            onCloseTrade={handleCloseTrade}
            onReopenTrade={handleReopenTrade}
            onClearAllTrades={handleClearAllTrades}
            onUpdateTrade={handleUpdateTrade}
            onRefresh={() => fetchPortfolio(true)}
            isRefreshing={isLoadingPortfolio}
            onOpenFinancialDeepDive={handleOpenFinancialDeepDive}
            onOpenBuyTradeWithCompany={handleOpenAddTradeWithCompany}
          />
        </div>

        {/* Pilar Central: Pilar 1 - Desajuste de Valor Intrínseco (47% ancho = 6 col) */}
        <div className="col-span-6 h-full min-h-0 max-h-full overflow-hidden flex flex-col">
          <FundamentalColumn
            scanData={scanData}
            selectedCompany={selectedCompany}
            onSelectCompany={handleSelectCompany}
            onRunScan={runPilar1Scan}
            isScanning={isScanning}
            onOpenThesis={() => setIsThesisOpen(true)}
            pivotG={pivotG}
            onPivotChange={handlePivotChange}
            mosDiscount={mosDiscount}
            onMosChange={handleMosChange}
            onOpenBuyTrade={handleOpenAddTradeWithCompany}
            onAddToWatchlist={handleAddWatchlistTicker}
            onOpenFinancialDeepDive={handleOpenFinancialDeepDive}
            onAuditInCentralPillar={handleAuditInCentralPillar}
            isAuditingAsset={isAuditingAsset}
            onOpenAIChat={() => setIsAIChatOpen(true)}
          />
        </div>

        {/* Margen Derecho: Empresas en Seguimiento (Watchlist) & Entorno Macro (28% ancho = 3 col) */}
        <div className="col-span-3 h-full min-h-0 max-h-full overflow-hidden flex flex-col space-y-2">
          {/* Selector de Pestañas Superior del Margen Derecho */}
          <div className="flex bg-card p-1 rounded-xl border border-borderSubtle text-xs flex-shrink-0">
            <button
              type="button"
              onClick={() => setRightPanelTab('watchlist')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold flex items-center justify-center space-x-1.5 transition-all ${
                rightPanelTab === 'watchlist'
                  ? 'bg-accentSky/20 text-accentSky border border-accentSky/30 shadow-sm'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Seguimiento ({watchlist.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setRightPanelTab('macro')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold flex items-center justify-center space-x-1.5 transition-all ${
                rightPanelTab === 'macro'
                  ? 'bg-accentSky/20 text-accentSky border border-accentSky/30 shadow-sm'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Macro & Dalio</span>
            </button>
          </div>

          {/* Panel Activo del Margen Derecho */}
          <div className="flex-1 min-h-0 max-h-full overflow-hidden flex flex-col">
            {rightPanelTab === 'watchlist' ? (
              <WatchlistColumn
                watchlist={watchlist}
                isLoading={isLoadingWatchlist}
                onSelectCompany={handleOpenTechnicalModal}
                onAddTicker={handleAddWatchlistTicker}
                onRemoveTicker={handleRemoveWatchlistTicker}
                onBuyTrade={handleOpenAddTradeWithCompany}
                onRefresh={() => fetchWatchlist(true)}
                onOpenFinancialDeepDive={handleOpenFinancialDeepDive}
                onAuditInCentralPillar={handleAuditInCentralPillar}
              />
            ) : (
              <MacroGrowingColumn
                macroData={macroData}
                growthMetrics={growthMetrics}
                selectedOpportunity={currentOpportunityAdapter}
                onOpenAssetDetail={handleOpenMacroAssetDetail}
                onBuyAsset={handleOpenAddTradeWithCompany}
                onAddToWatchlist={handleAddWatchlistTicker}
                onOpenFinancialDeepDive={handleOpenFinancialDeepDive}
              />
            )}
          </div>
        </div>
      </main>

      {/* Modales Secundarios (No recargan el dashboard inicial) */}
      <AddTradeModal
        isOpen={isAddTradeOpen}
        onClose={() => {
          setIsAddTradeOpen(false);
          setInitialTradeData(null);
        }}
        onTradeAdded={() => {
          fetchPortfolio();
          fetchWatchlist(true);
        }}
        initialData={initialTradeData}
      />

      <ThesisModal
        isOpen={isThesisOpen}
        company={selectedCompany}
        onClose={() => setIsThesisOpen(false)}
      />

      {/* Modal de Detalle / Auditoría y Gráfico de Velas de Activos Macro de Dalio y Activos Auditados */}
      <DiscardedDetailModal
        isOpen={isAssetDetailOpen}
        company={selectedAssetDetail}
        onClose={() => {
          setIsAssetDetailOpen(false);
          setSelectedAssetDetail(null);
        }}
        onBuyTrade={(comp) => {
          setIsAssetDetailOpen(false);
          handleOpenAddTradeWithCompany(comp);
        }}
        onAddToWatchlist={handleAddWatchlistTicker}
        onOpenFinancialDeepDive={handleOpenFinancialDeepDive}
        onAuditInCentralPillar={handleAuditInCentralPillar}
      />

      {/* Modal de Análisis Técnico y Cotizaciones para Empresas en Seguimiento */}
      <TechnicalAnalysisModal
        isOpen={isTechnicalModalOpen}
        ticker={selectedTechnicalTicker}
        onClose={() => {
          setIsTechnicalModalOpen(false);
          setSelectedTechnicalTicker(null);
        }}
        onBuyTrade={(tradeData) => {
          handleOpenAddTradeWithCompany({
            ticker: tradeData.ticker,
            nombre: tradeData.companyName,
            precio_cierre_P0: tradeData.buyPrice,
            fair_value_Gordon: tradeData.fairValue,
            currency: tradeData.currency
          });
        }}
        onRemoveFromWatchlist={handleRemoveWatchlistTicker}
      />

      {/* Modal Rápido de Cotización, Velas y Barras tras Búsqueda Superior */}
      <AssetSearchModal
        isOpen={isSearchModalOpen}
        asset={searchModalAsset}
        onClose={() => {
          setIsSearchModalOpen(false);
          setSearchModalAsset(null);
        }}
        onRequestAudit={handleRequestFullAudit}
        onAuditInCentralPillar={handleAuditInCentralPillar}
        onAddToWatchlist={handleAddWatchlistTicker}
        onOpenFinancialDeepDive={handleOpenFinancialDeepDive}
        onAddTrade={(tradeData) => {
          handleOpenAddTradeWithCompany({
            ticker: tradeData.ticker,
            nombre: tradeData.companyName,
            precio_cierre_P0: tradeData.buyPrice,
            fair_value_Gordon: tradeData.fairValue,
            currency: tradeData.currency
          });
        }}
        isAuditing={isAuditingAsset}
      />

      {/* Modal Principal de Radiografía Financiera & Retornos (14 Métricas Auditadas SEC EDGAR) */}
      <CompanyFinancialDeepDiveModal
        isOpen={isDeepDiveOpen}
        ticker={deepDiveTicker}
        onClose={() => {
          setIsDeepDiveOpen(false);
          setDeepDiveTicker(null);
        }}
        onSelectAnotherTicker={(t) => setDeepDiveTicker(t)}
      />

      {/* Asistente Financiero de IA Contextual (Drawer Lateral) */}
      <AIAssistantDrawer
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        selectedCompany={selectedCompany}
        portfolioSummary={summary}
        portfolioPositions={positions}
        macroData={macroData}
      />
    </div>
  );
};

export default App;
