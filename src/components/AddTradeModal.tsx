import React, { useState, useEffect } from 'react';
import { X, Plus, DollarSign, Calculator, RefreshCw, ArrowRightLeft, Target } from 'lucide-react';
import { Currency } from '../types';

interface AddTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTradeAdded: () => void;
  initialData?: {
    ticker?: string;
    companyName?: string;
    buyPrice?: number;
    fairValue?: number;
    currency?: Currency;
  } | null;
}

export const AddTradeModal: React.FC<AddTradeModalProps> = ({ isOpen, onClose, onTradeAdded, initialData }) => {
  // Modo de introducción: 'AMOUNT' (Por importe €) o 'SHARES' (Por nº de acciones)
  const [inputMode, setInputMode] = useState<'AMOUNT' | 'SHARES'>('AMOUNT');

  // Campos principales (EUR por defecto según requerimiento del usuario)
  const [ticker, setTicker] = useState(initialData?.ticker || '');
  const [companyName, setCompanyName] = useState(initialData?.companyName || '');
  const [currency, setCurrency] = useState<Currency>(initialData?.currency || 'EUR');
  const [amount, setAmount] = useState('50'); // 50€ por defecto
  const [buyPrice, setBuyPrice] = useState(initialData?.buyPrice ? initialData.buyPrice.toString() : '');
  const [shares, setShares] = useState('');
  const [fees, setFees] = useState('0');
  const [executionDate, setExecutionDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [targetExitPrice, setTargetExitPrice] = useState(initialData?.fairValue ? initialData.fairValue.toString() : '');
  const [targetExitNotes, setTargetExitNotes] = useState('');

  // Estados de consulta de mercado y cálculo
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteInfo, setQuoteInfo] = useState<{
    nativePrice?: number;
    nativeCurrency?: string;
    eurRate?: number;
    priceEur?: number;
  } | null>(null);
  const [fundamentalFairValue, setFundamentalFairValue] = useState<number | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Cálculo bidireccional en tiempo real:
  // En modo AMOUNT: acciones = importe / precio
  useEffect(() => {
    if (inputMode === 'AMOUNT') {
      const numAmount = parseFloat(amount);
      const numPrice = parseFloat(buyPrice);
      if (!isNaN(numAmount) && !isNaN(numPrice) && numPrice > 0) {
        const calculatedShares = numAmount / numPrice;
        // Mostramos hasta 4-6 decimales para acciones fraccionarias exactas (ej. 1.0874)
        setShares(parseFloat(calculatedShares.toFixed(6)).toString());
      } else {
        setShares('');
      }
    }
  }, [amount, buyPrice, inputMode]);

  // En modo SHARES: importe = acciones * precio
  useEffect(() => {
    if (inputMode === 'SHARES') {
      const numShares = parseFloat(shares);
      const numPrice = parseFloat(buyPrice);
      if (!isNaN(numShares) && !isNaN(numPrice) && numShares > 0) {
        const calculatedAmount = numShares * numPrice;
        setAmount(calculatedAmount.toFixed(2));
      } else {
        setAmount('');
      }
    }
  }, [shares, buyPrice, inputMode]);

  // Salida sugerida basada en Valor Intrínseco Justo (Fair Value)
  useEffect(() => {
    if (fundamentalFairValue && !targetExitPrice) {
      setTargetExitPrice(fundamentalFairValue.toFixed(2));
    }
  }, [fundamentalFairValue]);

  // Consultar cotización en tiempo real del ticker
  const handleFetchQuote = async (tickerToFetch?: string) => {
    const t = (tickerToFetch || ticker).trim().toUpperCase();
    if (!t) return;

    try {
      setIsLoadingQuote(true);
      setErrorMsg('');
      const res = await fetch(`/api/quote/${encodeURIComponent(t)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.name) {
          setCompanyName(data.name);
        }

        if (data.fair_value) {
          setFundamentalFairValue(data.fair_value);
          if (!targetExitPrice) {
            setTargetExitPrice(data.fair_value.toFixed(2));
          }
        } else {
          setFundamentalFairValue(null);
        }

        if (data.price) {
          setQuoteInfo({
            nativePrice: data.price,
            nativeCurrency: data.currency,
            eurRate: data.fx_eur_usd,
            priceEur: data.price_eur
          });

          // Establecer siempre el precio de cotización real y actual del activo
          setBuyPrice(data.price.toString());
        }

        if (data.currency) {
          setCurrency(data.currency as Currency);
        }
      }
    } catch {
      // No bloquear si no hay conexión externa
    } finally {
      setIsLoadingQuote(false);
    }
  };

  // Sincronizar datos iniciales cuando se abre el modal con una empresa preseleccionada
  useEffect(() => {
    if (isOpen && initialData) {
      const initTicker = (initialData.ticker || '').trim().toUpperCase();
      if (initTicker) setTicker(initTicker);
      if (initialData.companyName) setCompanyName(initialData.companyName);
      if (initialData.currency) setCurrency(initialData.currency);
      if (initialData.fairValue) setTargetExitPrice(initialData.fairValue.toString());

      if (initialData.buyPrice && initialData.buyPrice > 0) {
        setBuyPrice(initialData.buyPrice.toString());
      } else if (initTicker) {
        // Consultar inmediatamente la cotización en vivo si no vino precio predefinido
        handleFetchQuote(initTicker);
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleTickerBlur = () => {
    if (ticker.trim().length >= 1 && !buyPrice) {
      handleFetchQuote();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    let numShares = parseFloat(shares);
    const numPrice = parseFloat(buyPrice);
    const numAmount = parseFloat(amount);

    if (isNaN(numShares) || numShares <= 0) {
      if (!isNaN(numAmount) && numAmount > 0 && !isNaN(numPrice) && numPrice > 0) {
        numShares = parseFloat((numAmount / numPrice).toFixed(6));
      }
    }

    if (!ticker.trim() || isNaN(numShares) || numShares <= 0 || isNaN(numPrice) || numPrice <= 0) {
      setErrorMsg('Por favor introduce un Ticker, un Importe y un Precio válidos para calcular la compra.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: ticker.trim().toUpperCase(),
          company_name: companyName.trim() || ticker.trim().toUpperCase(),
          currency,
          shares: numShares,
          buy_price: numPrice,
          fees: parseFloat(fees || '0'),
          execution_date: executionDate,
          notes: notes.trim(),
          target_exit_price: parseFloat(targetExitPrice) || null,
          target_exit_notes: targetExitNotes.trim()
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar la compra en la base de datos.');
      }

      // Eliminar automáticamente de empresas en seguimiento al haberse efectuado la compra
      try {
        await fetch(`/api/watchlist/${encodeURIComponent(ticker.trim().toUpperCase())}`, {
          method: 'DELETE'
        });
      } catch {}

      // Limpiar formulario y cerrar
      setTicker('');
      setCompanyName('');
      setAmount('50');
      setShares('');
      setBuyPrice('');
      setFees('0');
      setNotes('');
      setTargetExitPrice('');
      setTargetExitNotes('');
      setQuoteInfo(null);
      onTradeAdded();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión con la base de datos local SQLite.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sym = currency === 'EUR' ? '€' : '$';
  const numAmount = parseFloat(amount || '0');
  const numShares = parseFloat(shares || '0');
  const numPrice = parseFloat(buyPrice || '0');

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-card border border-borderMedium w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
        {/* Header con Título y Cerrar */}
        <div className="flex justify-between items-center border-b border-borderSubtle pb-3">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-accentSky" />
            <div>
              <h3 className="text-base font-bold text-textPrimary">Registrar Nueva Compra en Cartera</h3>
              <p className="text-[11px] text-textSecondary">
                Almacenamiento persistente en base de datos local SQLite (`portfolio.db`)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-textSecondary hover:text-textPrimary p-1.5 rounded-lg hover:bg-cardSecondary transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de Modo de Entrada (Importe € por defecto vs Nº de Acciones) */}
        <div className="p-1 rounded-xl bg-canvas border border-borderSubtle grid grid-cols-2 gap-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setInputMode('AMOUNT')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition ${
              inputMode === 'AMOUNT'
                ? 'bg-accentSky text-canvas shadow font-bold'
                : 'text-textSecondary hover:text-textPrimary'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Por Importe Total (€)</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-black/20 uppercase">Por defecto</span>
          </button>

          <button
            type="button"
            onClick={() => setInputMode('SHARES')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition ${
              inputMode === 'SHARES'
                ? 'bg-accentSky text-canvas shadow font-bold'
                : 'text-textSecondary hover:text-textPrimary'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Por Nº de Acciones</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-statusRed/10 border border-statusRed/30 text-statusRed text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Fila 1: Ticker y Divisa */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-textSecondary block mb-1 font-medium">Ticker del Activo *</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ej: VZ, AAPL, ASML"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  onBlur={handleTickerBlur}
                  required
                  className="w-full bg-canvas border border-borderSubtle rounded-lg px-3 py-2 text-textPrimary focus:border-accentSky outline-none uppercase font-mono font-bold"
                />
                {ticker.trim() && (
                  <button
                    type="button"
                    onClick={() => handleFetchQuote()}
                    disabled={isLoadingQuote}
                    className="absolute right-1.5 top-1.5 p-1 rounded hover:bg-cardSecondary text-textSecondary hover:text-accentSky transition"
                    title="Consultar precio y datos de mercado"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQuote ? 'animate-spin text-accentSky' : ''}`} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="text-textSecondary block mb-1 font-medium">Divisa de Inversión *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCurrency('EUR')}
                  className={`py-2 rounded-lg font-bold border transition ${
                    currency === 'EUR'
                      ? 'bg-accentSky/20 border-accentSky text-accentSky shadow-sm'
                      : 'bg-canvas border-borderSubtle text-textSecondary hover:text-textPrimary'
                  }`}
                >
                  EUR (€) [Predet.]
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`py-2 rounded-lg font-bold border transition ${
                    currency === 'USD'
                      ? 'bg-accentSky/20 border-accentSky text-accentSky shadow-sm'
                      : 'bg-canvas border-borderSubtle text-textSecondary hover:text-textPrimary'
                  }`}
                >
                  USD ($)
                </button>
              </div>
            </div>
          </div>

          {/* Nombre de la empresa */}
          <div>
            <label className="text-textSecondary block mb-1 font-medium">Nombre de la Compañía</label>
            <input
              type="text"
              placeholder="Ej: Verizon Communications Inc."
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full bg-canvas border border-borderSubtle rounded-lg px-3 py-2 text-textPrimary focus:border-accentSky outline-none"
            />
          </div>

          {/* Fila 2: Entradas dinámicas según el modo */}
          {inputMode === 'AMOUNT' ? (
            /* MODO 1: INTRODUCIR IMPORTE EN EUROS (EL PRECIO CALCULA LAS ACCIONES) */
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-canvas border border-accentSky/30">
              <div>
                <label className="text-textPrimary block mb-1 font-bold flex items-center justify-between">
                  <span>Importe a Invertir ({sym}) *</span>
                  <span className="text-[10px] text-accentSky font-normal">Cantidad total a pagar</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-accentSky font-mono">{sym}</span>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="50.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="w-full bg-card border border-borderMedium rounded-lg pl-8 pr-3 py-2 text-textPrimary font-mono font-bold text-sm focus:border-accentSky outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-textPrimary block mb-1 font-bold flex items-center justify-between">
                  <span>Precio de la Acción ({sym}) *</span>
                  {quoteInfo?.nativePrice && (
                    <span className="text-[10px] text-textSecondary font-mono font-normal">
                      Mercado: {quoteInfo.nativeCurrency === 'USD' ? `$${quoteInfo.nativePrice}` : `€${quoteInfo.nativePrice}`}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-textSecondary font-mono">{sym}</span>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    placeholder="Ej: 45.98"
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    required
                    className="w-full bg-card border border-borderMedium rounded-lg pl-8 pr-3 py-2 text-textPrimary font-mono font-bold text-sm focus:border-accentSky outline-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* MODO 2: INTRODUCIR ACCIONES (CALCULA EL IMPORTE TOTAL) */
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-canvas border border-borderSubtle">
              <div>
                <label className="text-textPrimary block mb-1 font-bold">Nº de Acciones *</label>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  placeholder="Ej: 1.0874"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  required
                  className="w-full bg-card border border-borderMedium rounded-lg px-3 py-2 text-textPrimary font-mono font-bold text-sm focus:border-accentSky outline-none"
                />
              </div>

              <div>
                <label className="text-textPrimary block mb-1 font-bold">Precio Unitario ({sym}) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-textSecondary font-mono">{sym}</span>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    placeholder="Ej: 45.98"
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    required
                    className="w-full bg-card border border-borderMedium rounded-lg pl-8 pr-3 py-2 text-textPrimary font-mono font-bold text-sm focus:border-accentSky outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tarjeta de Resumen y Desglose Matemático en Tiempo Real */}
          {numAmount > 0 && numPrice > 0 && (
            <div className="p-3 rounded-xl bg-cardSecondary/80 border border-accentSky/30 font-mono text-xs space-y-1.5 shadow-sm">
              <div className="flex items-center justify-between text-textSecondary text-[11px]">
                <span>Fórmula de Adquisición:</span>
                <span className="text-accentSky font-bold">
                  {numAmount.toFixed(2)} {sym} &divide; {numPrice.toFixed(4)} {sym}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-borderSubtle/60">
                <span className="text-textPrimary font-sans font-bold">Acciones Asignadas a tu Cartera:</span>
                <span className="text-base font-black text-statusGreen">
                  {numShares > 0 ? numShares.toFixed(4) : '0.0000'} <span className="text-xs font-sans font-normal text-textSecondary">acciones</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-textSecondary">
                <span>Importe Total Efectivo:</span>
                <span className="text-textPrimary font-bold">{numAmount.toFixed(2)} {sym}</span>
              </div>
            </div>
          )}

          {/* Campo de Salida / Target de Venta (Incentivo de Venta a Tiempo) */}
          <div className="p-3 rounded-xl bg-cardSecondary/70 border border-borderSubtle space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-textPrimary font-bold text-xs flex items-center space-x-1.5">
                <Target className="w-3.5 h-3.5 text-accentSky" />
                <span>Precio Objetivo de Salida ({sym})</span>
              </label>
              {fundamentalFairValue && (
                <button
                  type="button"
                  onClick={() => {
                    setTargetExitPrice(fundamentalFairValue.toFixed(2));
                  }}
                  className="text-[10px] text-accentSky hover:underline font-semibold"
                  title="Fijar precio objetivo en el Valor Intrínseco Justo calculado por el motor fundamental"
                >
                  Cargar Fair Value ({sym}{fundamentalFairValue.toFixed(2)})
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 font-bold text-textSecondary font-mono">{sym}</span>
              <input
                type="number"
                step="any"
                placeholder={fundamentalFairValue ? fundamentalFairValue.toFixed(2) : "Ej: 93.85"}
                value={targetExitPrice}
                onChange={(e) => setTargetExitPrice(e.target.value)}
                className="w-full bg-card border border-borderMedium rounded-lg pl-8 pr-3 py-2 text-textPrimary font-mono font-bold text-sm focus:border-accentSky outline-none"
              />
            </div>
            <p className="text-[10px] text-textSecondary">
              {fundamentalFairValue 
                ? `Salida sugerida por convergencia a Valor Justo (${sym}${fundamentalFairValue.toFixed(2)}). Puedes editarla libremente.`
                : 'Define tu precio objetivo de salida según tu tesis de inversión. La app te avisará para vender cuando se alcance.'}
            </p>
          </div>

          {/* Fila 3: Comisiones, Fecha y Notas */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-textSecondary block mb-1 font-medium">Comisión ({sym})</label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                className="w-full bg-canvas border border-borderSubtle rounded-lg px-3 py-2 text-textPrimary focus:border-accentSky outline-none font-mono"
              />
            </div>
            <div className="col-span-2">
              <label className="text-textSecondary block mb-1 font-medium">Fecha de Ejecución</label>
              <input
                type="date"
                value={executionDate}
                onChange={(e) => setExecutionDate(e.target.value)}
                className="w-full bg-canvas border border-borderSubtle rounded-lg px-3 py-2 text-textPrimary focus:border-accentSky outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-textSecondary block mb-1 font-medium">Notas / Estrategia</label>
            <input
              type="text"
              placeholder="Ej: Aportación periódica mensual de 50€ en Verizon"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-canvas border border-borderSubtle rounded-lg px-3 py-2 text-textPrimary focus:border-accentSky outline-none"
            />
          </div>

          {/* Botones de Acción */}
          <div className="pt-3 border-t border-borderSubtle flex justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-cardSecondary text-textSecondary hover:text-textPrimary transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !numPrice || !numAmount}
              className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-accentSky text-canvas font-bold hover:bg-accentSky/90 shadow-md transition disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Guardando...'
                  : numShares > 0
                  ? `Guardar ${numShares.toFixed(4)} acc. (${numAmount.toFixed(2)} ${sym})`
                  : 'Guardar Compra en BBDD'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
