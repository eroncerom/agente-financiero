import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Send,
  Settings,
  Bot,
  User,
  Building2,
  Trash2,
  Key,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Shield
} from 'lucide-react';
import { Pilar1Result } from '../types';

export interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCompany: Pilar1Result | null;
  portfolioSummary: any;
  portfolioPositions: any[];
  macroData: any;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  provider?: 'gemini' | 'local';
  model?: string;
}

interface AIConfig {
  has_api_key: boolean;
  masked_key: string | null;
  model: string;
  provider: 'gemini' | 'local';
}

/**
 * Renderizador de Markdown ligero sin dependencias externas
 */
const SimpleMarkdown: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');

  // Procesador básico de formato
  const formatText = (text: string): React.ReactNode => {
    // Reemplazar negrita **texto**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-textPrimary font-bold">{part.slice(2, -2)}</strong>;
      }
      // Reemplazar código `código`
      const codeParts = part.split(/(`.*?`)/g);
      return codeParts.map((sub, j) => {
        if (sub.startsWith('`') && sub.endsWith('`')) {
          return (
            <code key={`${i}-${j}`} className="px-1.5 py-0.5 rounded bg-cardSecondary border border-borderSubtle font-mono text-[11px] text-accentSky">
              {sub.slice(1, -1)}
            </code>
          );
        }
        return sub;
      });
    });
  };

  const renderBlocks = () => {
    const blocks: React.ReactNode[] = [];
    let tableRows: string[][] = [];
    let inTable = false;

    const flushTable = (keyIdx: number) => {
      if (tableRows.length > 0) {
        const headers = tableRows[0];
        const bodyRows = tableRows.slice(1).filter(r => !r.every(c => c.match(/^:?-+:?$/)));
        blocks.push(
          <div key={`table-${keyIdx}`} className="my-2.5 overflow-x-auto rounded-lg border border-borderSubtle bg-cardSecondary/40 text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-borderSubtle bg-cardSecondary">
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} className="px-3 py-2 font-bold text-textPrimary">
                      {formatText(h.trim())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="border-b border-borderSubtle/50 hover:bg-cardSecondary/60 transition">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3 py-1.5 text-textSecondary font-mono text-[11px]">
                        {formatText(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        inTable = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detección de tablas markdown
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        inTable = true;
        const cells = line.trim().slice(1, -1).split('|');
        tableRows.push(cells);
        continue;
      } else if (inTable) {
        flushTable(i);
      }

      // Encabezados
      if (line.startsWith('##### ')) {
        blocks.push(
          <h5 key={i} className="text-[11px] font-bold text-textPrimary uppercase tracking-wider mt-2.5 mb-1 flex items-center space-x-1.5">
            <span>{formatText(line.slice(6))}</span>
          </h5>
        );
      } else if (line.startsWith('#### ')) {
        blocks.push(
          <h4 key={i} className="text-xs font-bold text-accentSky uppercase tracking-wider mt-3 mb-1.5 flex items-center space-x-1.5">
            <span>{formatText(line.slice(5))}</span>
          </h4>
        );
      } else if (line.startsWith('### ')) {
        blocks.push(
          <h4 key={i} className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider mt-3.5 mb-1.5 flex items-center space-x-1.5">
            <span>{formatText(line.slice(4))}</span>
          </h4>
        );
      } else if (line.startsWith('## ')) {
        blocks.push(
          <h3 key={i} className="text-sm font-extrabold text-textPrimary mt-4 mb-2">
            {formatText(line.slice(3))}
          </h3>
        );
      } else if (line.startsWith('# ')) {
        blocks.push(
          <h2 key={i} className="text-base font-extrabold text-textPrimary mt-4.5 mb-2.5">
            {formatText(line.slice(2))}
          </h2>
        );
      }
      // Separadores horizontales
      else if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
        blocks.push(
          <hr key={i} className="my-3 border-borderSubtle" />
        );
      }
      // Alertas estilo GitHub
      else if (line.startsWith('> [!NOTE]') || line.startsWith('> [!TIP]')) {
        const isTip = line.includes('[!TIP]');
        const nextLines: string[] = [];
        let j = i + 1;
        while (j < lines.length && lines[j].startsWith('>')) {
          nextLines.push(lines[j].replace(/^>\s?/, ''));
          j++;
        }
        i = j - 1;
        blocks.push(
          <div key={i} className={`my-2 p-2.5 rounded-lg border text-xs ${isTip ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-accentSky/10 border-accentSky/30 text-accentSky'}`}>
            {nextLines.map((nl, nlIdx) => (
              <p key={nlIdx} className="leading-relaxed">{formatText(nl)}</p>
            ))}
          </div>
        );
      } else if (line.startsWith('> [!WARNING]') || line.startsWith('> [!CAUTION]')) {
        const nextLines: string[] = [];
        let j = i + 1;
        while (j < lines.length && lines[j].startsWith('>')) {
          nextLines.push(lines[j].replace(/^>\s?/, ''));
          j++;
        }
        i = j - 1;
        blocks.push(
          <div key={i} className="my-2 p-2.5 rounded-lg border text-xs bg-amber-500/10 border-amber-500/30 text-amber-300">
            {nextLines.map((nl, nlIdx) => (
              <p key={nlIdx} className="leading-relaxed">{formatText(nl)}</p>
            ))}
          </div>
        );
      }
      // Listas numeradas (1. 2. etc.)
      else if (/^\d+\.\s+/.test(line.trim())) {
        const match = line.trim().match(/^(\d+)\.\s+(.*)$/);
        const num = match ? match[1] : '•';
        const rest = match ? match[2] : line.trim();
        blocks.push(
          <div key={i} className="flex items-start space-x-2 my-1 text-xs text-textSecondary">
            <span className="font-bold text-accentSky font-mono text-[11px] min-w-[16px]">{num}.</span>
            <span className="flex-1 leading-relaxed">{formatText(rest)}</span>
          </div>
        );
      }
      // Viñetas
      else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const isIndented = line.startsWith('  ') || line.startsWith('\t');
        blocks.push(
          <div key={i} className={`flex items-start space-x-2 my-1 text-xs text-textSecondary ${isIndented ? 'ml-4' : ''}`}>
            <span className="text-accentSky mt-1">•</span>
            <span className="flex-1 leading-relaxed">{formatText(line.trim().slice(2))}</span>
          </div>
        );
      }
      // Línea vacía
      else if (!line.trim()) {
        blocks.push(<div key={i} className="h-1.5" />);
      }
      // Párrafo normal
      else {
        blocks.push(
          <p key={i} className="text-xs text-textSecondary leading-relaxed my-1">
            {formatText(line)}
          </p>
        );
      }
    }

    if (inTable) {
      flushTable(lines.length);
    }

    return blocks;
  };

  return <div className="space-y-1">{renderBlocks()}</div>;
};

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  isOpen,
  onClose,
  selectedCompany,
  portfolioSummary,
  portfolioPositions,
  macroData
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<AIConfig>({
    has_api_key: false,
    masked_key: null,
    model: 'gemini-2.5-flash',
    provider: 'local'
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [testStatus, setTestStatus] = useState<{ testing: boolean; result?: string; ok?: boolean } | null>(null);
  const [includePortfolioContext, setIncludePortfolioContext] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Cargar configuración de IA al montar
  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/ai/config');
      if (res.ok) {
        const data: AIConfig = await res.json();
        setConfig(data);
        setSelectedModel(data.model || 'gemini-2.5-flash');
      }
    } catch (err) {
      console.error('Error al cargar config de IA:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      if (inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 150);
      }
    }
  }, [isOpen]);

  // Mensaje de bienvenida inicial si la conversación está vacía
  useEffect(() => {
    if (messages.length === 0 && selectedCompany) {
      const welcome: ChatMessage = {
        id: 'welcome-msg',
        role: 'assistant',
        content: `### 🤖 Copiloto Financiero Activado

Estoy sincronizado en tiempo real con **${selectedCompany.nombre} (${selectedCompany.ticker})**.
- **Precio Actual ($P_0$)**: $${selectedCompany.precio_cierre_P0?.toFixed(2) || 'N/D'}
- **Fair Value Central**: $${(selectedCompany.fair_value_teorico || (selectedCompany as any).fair_value_Gordon || selectedCompany.escenario_neutro?.VP_teorico || 0).toFixed(2)}
- **Techo Máximo MoS**: $${selectedCompany.techo_maximo_compra?.toFixed(2) || 'N/D'} (${selectedCompany.estado_compra || 'ANALIZADA'})
- **Filtro Value**: ${selectedCompany.filtro_value?.veredicto || 'Auditado'} (${selectedCompany.filtro_value?.puntuacion ?? 0}/5 puntos)

¿En qué puedo ayudarte a evaluar hoy sobre este activo o tu cartera?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: config.provider,
        model: config.model
      };
      setMessages([welcome]);
    }
  }, [selectedCompany]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Enviar mensaje
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputMessage('');
    setIsLoading(true);

    try {
      const context = {
        company: selectedCompany,
        portfolio: includePortfolioContext
          ? {
              summary: portfolioSummary,
              positions: portfolioPositions
            }
          : null,
        macro: macroData
      };

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: newHistory.map(m => ({ role: m.role, content: m.content })),
          context
        })
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          provider: data.provider,
          model: data.model
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        const err = await res.json();
        const errMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Error al procesar consulta: ${err.error || 'Problema de conexión con el motor de IA'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          provider: 'local'
        };
        setMessages(prev => [...prev, errMsg]);
      }
    } catch (err: any) {
      console.error('Error en chat de IA:', err);
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Error de red al comunicar con el asistente: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'local'
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Guardar configuración de Gemini
  const handleSaveConfig = async () => {
    setTestStatus({ testing: true });
    try {
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKeyInput,
          model: selectedModel
        })
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setApiKeyInput('');
        setTestStatus({ testing: false, ok: true, result: 'Conexión verificada y guardada correctamente.' });
        setTimeout(() => setIsSettingsOpen(false), 1200);
      } else {
        setTestStatus({ testing: false, ok: false, result: data.error || 'La clave no pudo ser verificada.' });
      }
    } catch (err: any) {
      setTestStatus({ testing: false, ok: false, result: `Error al guardar: ${err.message}` });
    }
  };

  // Eliminar clave y volver a modo local
  const handleRemoveKey = async () => {
    try {
      const res = await fetch('/api/ai/config', { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setApiKeyInput('');
        setTestStatus({ testing: false, ok: true, result: 'Clave eliminada. Modo Local activado.' });
      }
    } catch (err) {
      console.error('Error al eliminar clave:', err);
    }
  };

  // Chips de preguntas sugeridas y comandos de auditoría
  const ticker = selectedCompany?.ticker;
  const isEnZona =
    selectedCompany?.estado_compra === 'ZONA_COMPRA_ACTIVA' ||
    (selectedCompany?.precio_cierre_P0 != null &&
      selectedCompany?.techo_maximo_compra != null &&
      selectedCompany.precio_cierre_P0 <= selectedCompany.techo_maximo_compra);
  const estadoLabel = isEnZona ? 'en Zona de Compra' : 'en Zona de Valor Justo';

  const quickChips = [
    {
      label: '🛡️ Auditar mi Cartera',
      query: '/auditar-cartera',
      isPrimary: true
    },
    ...(selectedCompany
      ? [
          {
            label: `¿Por qué ${ticker} está ${estadoLabel}?`,
            query: `¿Por qué ${ticker} está ${estadoLabel}? Detalla su margen de seguridad y valoración.`
          },
          {
            label: `¿Qué riesgos detecta el modelo en ${ticker}?`,
            query: `¿Qué riesgos de deuda, balance o solvencia detecta el modelo en ${ticker}?`
          },
          {
            label: `¿A qué precio entrar en ${ticker}?`,
            query: `¿A qué precio exacto debería entrar en ${ticker} según el Techo Máximo de Margen de Seguridad?`
          },
          {
            label: `Filtro Value de ${ticker}`,
            query: `Explícame los 5 criterios del Filtro Value para ${ticker}.`
          }
        ]
      : [
          {
            label: '🌍 Diagnóstico Macro Ray Dalio',
            query: 'Explica el régimen macroeconómico actual de Ray Dalio y su impacto en renta variable.'
          },
          {
            label: '🛡️ Regla de Techo MoS de Graham',
            query: 'Explica cómo funciona la regla de Techo Máximo de Entrada de Benjamin Graham.'
          }
        ])
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside className="relative w-full max-w-lg md:max-w-xl h-full bg-card border-l border-borderMedium shadow-2xl flex flex-col z-10 animate-slideLeft">
        {/* 1. Header del Asistente */}
        <div className="p-3.5 border-b border-borderSubtle bg-cardSecondary/60 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-accentSky/20 to-purple-500/20 text-accentSky border border-accentSky/30">
              <Sparkles className="w-4 h-4 text-accentSky" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-extrabold text-textPrimary uppercase tracking-wider truncate">
                  Copiloto Financiero IA
                </h3>
                {config.has_api_key ? (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Gemini ({config.model.replace('gemini-', '')})</span>
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-accentSky/15 text-accentSky border border-accentSky/30 flex items-center space-x-1">
                    <span>Motor Local</span>
                  </span>
                )}
              </div>
              <p className="text-[10px] text-textSecondary truncate">
                Rigor Value Investing · Auditoría en Tiempo Real
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => handleSendMessage('/auditar-cartera')}
              disabled={isLoading}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer disabled:opacity-50"
              title="Ejecutar auditoría cuantitativa integral de tu cartera"
            >
              <Shield className="w-3 h-3" />
              <span className="hidden sm:inline">Auditar Cartera</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`p-1.5 rounded-lg border transition ${
                isSettingsOpen
                  ? 'bg-accentSky/20 text-accentSky border-accentSky/40'
                  : 'hover:bg-cardSecondary text-textSecondary hover:text-textPrimary border-borderSubtle'
              }`}
              title="Configuración de IA (Gemini API Key)"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setMessages([])}
              className="p-1.5 rounded-lg border border-borderSubtle hover:bg-cardSecondary text-textSecondary hover:text-textPrimary transition"
              title="Limpiar conversación"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-borderSubtle hover:bg-cardSecondary text-textSecondary hover:text-textPrimary transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Panel Desplegable de Ajustes de Gemini API */}
        {isSettingsOpen && (
          <div className="p-3.5 bg-cardSecondary border-b border-borderMedium text-xs animate-fadeIn space-y-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 font-bold text-textPrimary">
                <Key className="w-3.5 h-3.5 text-accentSky" />
                <span>Gestión de Google Gemini API</span>
              </div>
              <span className="text-[10px] text-textSecondary">
                Estado: {config.has_api_key ? '✅ Conectado' : '⚡ Motor Local'}
              </span>
            </div>

            <p className="text-[11px] text-textSecondary leading-relaxed">
              Puedes conectar tu propia clave gratuita de <strong>Google AI Studio</strong> para activar razonamiento conversacional completo. Si no tienes clave, el asistente opera al 100% mediante el <strong>Motor Cuantitativo Local</strong>.
            </p>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider block">
                API Key de Gemini {config.masked_key && `(Actual: ${config.masked_key})`}
              </label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={config.has_api_key ? 'Introduce nueva clave para reemplazar...' : 'Pega tu clave AIzaSy...'}
                className="w-full h-8 px-3 rounded-lg bg-canvas border border-borderSubtle text-xs text-textPrimary placeholder:text-textSecondary/50 font-mono focus:outline-none focus:border-accentSky"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-textSecondary uppercase tracking-wider block mb-1">
                  Modelo Gemini
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg bg-canvas border border-borderSubtle text-xs text-textPrimary font-mono focus:outline-none focus:border-accentSky"
                >
                  <option value="gemini-2.5-flash">gemini-2.5-flash (Por defecto)</option>
                  <option value="gemini-3.8-flash">Gemini 3.8 Flash (Low)</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                  <option value="gemini-1.5-flash">gemini-1.5-flash (Estable)</option>
                </select>
              </div>

              <div className="flex items-end space-x-1.5">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={testStatus?.testing}
                  className="flex-1 h-8 rounded-lg bg-accentSky hover:bg-accentSky/90 text-canvas font-bold text-xs flex items-center justify-center space-x-1 transition disabled:opacity-50"
                >
                  {testStatus?.testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Guardar</span>}
                </button>
                {config.has_api_key && (
                  <button
                    type="button"
                    onClick={handleRemoveKey}
                    className="h-8 px-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition text-[11px]"
                    title="Eliminar clave y volver al motor local"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>

            {testStatus && (
              <div className={`p-2 rounded-lg text-[11px] flex items-center space-x-1.5 ${testStatus.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                {testStatus.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                <span className="truncate">{testStatus.result}</span>
              </div>
            )}

            <div className="pt-1 flex items-center justify-between text-[10px] text-textSecondary border-t border-borderSubtle/60">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-accentSky hover:underline flex items-center space-x-1"
              >
                <span>Obtener API Key gratis en Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="hover:text-textPrimary"
              >
                Ocultar
              </button>
            </div>
          </div>
        )}

        {/* 3. Barra de Contexto Activo (Empresa en foco) */}
        {selectedCompany && (
          <div className="px-3.5 py-2 bg-card border-b border-borderSubtle flex items-center justify-between text-xs flex-shrink-0">
            <div className="flex items-center space-x-2 min-w-0">
              <Building2 className="w-3.5 h-3.5 text-accentSky flex-shrink-0" />
              <div className="min-w-0 truncate">
                <span className="font-bold font-mono text-textPrimary mr-1.5">
                  {selectedCompany.ticker}
                </span>
                <span className="text-textSecondary truncate">
                  ${selectedCompany.precio_cierre_P0?.toFixed(2)} | FV: ${(selectedCompany.fair_value_teorico || (selectedCompany as any).fair_value_Gordon || selectedCompany.escenario_neutro?.VP_teorico || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <label className="text-[10px] text-textSecondary flex items-center space-x-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includePortfolioContext}
                  onChange={(e) => setIncludePortfolioContext(e.target.checked)}
                  className="rounded border-borderSubtle text-accentSky focus:ring-0 text-[10px]"
                />
                <span>Contexto Cartera</span>
              </label>
            </div>
          </div>
        )}

        {/* 4. Contenedor de Mensajes (Scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3.5">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start space-x-2.5 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-xs ${
                    isUser
                      ? 'bg-accentSky text-canvas font-bold'
                      : 'bg-gradient-to-tr from-accentSky/20 to-purple-500/20 text-accentSky border border-accentSky/30'
                  }`}
                >
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                {/* Burbuja de Texto */}
                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-xs shadow-md leading-relaxed ${
                    isUser
                      ? 'bg-accentSky text-canvas font-medium rounded-tr-sm'
                      : 'bg-cardSecondary border border-borderSubtle text-textSecondary rounded-tl-sm'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <>
                      <SimpleMarkdown content={msg.content} />
                      <div className="mt-2 pt-1.5 border-t border-borderSubtle/50 flex items-center justify-between text-[10px] text-textSecondary/70 font-mono">
                        <span>{msg.provider === 'gemini' ? `Gemini (${msg.model || '2.5-flash'})` : 'Motor Local Cuantitativo'}</span>
                        <span>{msg.timestamp}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Indicador de Pensando */}
          {isLoading && (
            <div className="flex items-start space-x-2.5">
              <div className="w-7 h-7 rounded-xl bg-accentSky/20 border border-accentSky/30 text-accentSky flex items-center justify-center animate-pulse">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="bg-cardSecondary border border-borderSubtle rounded-2xl rounded-tl-sm p-3 text-xs text-textSecondary flex items-center space-x-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-accentSky" />
                <span className="font-mono text-[11px]">Analizando fundamentales y métricas en tiempo real...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 5. Chips de Preguntas Rápidas */}
        <div className="px-3.5 py-1.5 border-t border-borderSubtle/60 bg-cardSecondary/40 flex items-center space-x-1.5 overflow-x-auto no-scrollbar flex-shrink-0">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(chip.query)}
              disabled={isLoading}
              className={`px-2.5 py-1 rounded-lg border transition text-[11px] whitespace-nowrap flex-shrink-0 cursor-pointer disabled:opacity-50 font-medium ${
                chip.isPrimary
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25 font-bold shadow-sm'
                  : 'bg-card border-borderSubtle hover:border-accentSky/50 text-textSecondary hover:text-textPrimary hover:bg-cardSecondary'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* 6. Barra de Input */}
        <div className="p-3 border-t border-borderSubtle bg-card flex items-center space-x-2 flex-shrink-0">
          <textarea
            ref={inputRef}
            rows={1}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={
              selectedCompany
                ? `Pregunta sobre ${selectedCompany.ticker} (ej. riesgos, MoS, Filtro Value)...`
                : 'Escribe tu consulta financiera o macro...'
            }
            className="flex-1 max-h-24 p-2.5 rounded-xl bg-cardSecondary border border-borderSubtle text-xs text-textPrimary placeholder:text-textSecondary/60 focus:outline-none focus:border-accentSky resize-none"
          />

          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            className="w-9 h-9 rounded-xl bg-accentSky hover:bg-accentSky/90 disabled:opacity-40 text-canvas font-bold flex items-center justify-center transition flex-shrink-0 shadow-md"
            title="Enviar mensaje (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </div>
  );
};
