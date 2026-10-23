import React, { useState } from 'react';
import { X, Server, Cpu, Check, AlertCircle, RefreshCw, Lock, Zap } from 'lucide-react';
import { AIProviderConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIProviderConfig;
  onSaveConfig: (newConfig: AIProviderConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [provider, setProvider] = useState<'gemini' | 'ollama' | 'openai-compatible'>(config.provider);
  const [endpoint, setEndpoint] = useState(config.endpoint);
  const [model, setModel] = useState(config.model);
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [testStatus, setTestStatus] = useState<{
    loading: boolean;
    success?: boolean;
    latencyMs?: number;
    error?: string;
  }>({ loading: false });

  if (!isOpen) return null;

  const handleProviderChange = (newProvider: 'gemini' | 'ollama' | 'openai-compatible') => {
    setProvider(newProvider);
    if (newProvider === 'gemini') {
      setModel('gemini-3.1-flash-lite');
      setEndpoint('');
    } else if (newProvider === 'ollama') {
      setModel('llama3.2');
      setEndpoint('http://localhost:11434/v1');
    } else {
      setModel('gpt-4o-mini');
      setEndpoint('http://localhost:1234/v1');
    }
    setTestStatus({ loading: false });
  };

  const handleTestConnection = async () => {
    setTestStatus({ loading: true });
    try {
      const res = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerConfig: {
            provider,
            endpoint,
            model,
            apiKey: apiKey.trim() || undefined,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTestStatus({
          loading: false,
          success: true,
          latencyMs: data.latencyMs,
        });
      } else {
        setTestStatus({
          loading: false,
          success: false,
          error: data.error || 'Connection failed',
        });
      }
    } catch (err: any) {
      setTestStatus({
        loading: false,
        success: false,
        error: err.message || 'Network error',
      });
    }
  };

  const handleSave = () => {
    onSaveConfig({
      provider,
      endpoint,
      model,
      apiKey: apiKey.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Server className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">AI Model &amp; Endpoint Settings</h2>
              <p className="text-xs text-slate-500">Run completely local or use built-in Gemini</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5">
          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Model Engine Provider
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleProviderChange('gemini')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  provider === 'gemini'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-semibold ring-1 ring-indigo-500'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <Zap className="h-5 w-5 mb-1.5 text-indigo-600" />
                <span className="text-xs">Built-in Gemini</span>
                <span className="text-[10px] text-slate-500">Zero Setup (Cloud)</span>
              </button>

              <button
                type="button"
                onClick={() => handleProviderChange('ollama')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  provider === 'ollama'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-semibold ring-1 ring-indigo-500'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <Cpu className="h-5 w-5 mb-1.5 text-emerald-600" />
                <span className="text-xs">Local Ollama</span>
                <span className="text-[10px] text-slate-500">100% On-Device</span>
              </button>

              <button
                type="button"
                onClick={() => handleProviderChange('openai-compatible')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  provider === 'openai-compatible'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-semibold ring-1 ring-indigo-500'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <Server className="h-5 w-5 mb-1.5 text-amber-600" />
                <span className="text-xs">LM Studio / Custom</span>
                <span className="text-[10px] text-slate-500">OpenAI API</span>
              </button>
            </div>
          </div>

          {/* Endpoint URL (for local / custom) */}
          {provider !== 'gemini' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                API Endpoint URL
              </label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="http://localhost:11434/v1"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Ollama default: <code>http://localhost:11434/v1</code> · LM Studio default: <code>http://localhost:1234/v1</code>
              </p>
            </div>
          )}

          {/* Model Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Model Identifier
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={provider === 'gemini' ? 'gemini-3.8-flash' : 'llama3.2'}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Optional API Key */}
          {provider === 'openai-compatible' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                API Key (Optional for local servers)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}

          {/* Connection Test Output */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">Test Model Connectivity</span>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus.loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs disabled:opacity-50"
              >
                {testStatus.loading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5 text-indigo-600" />
                )}
                {testStatus.loading ? 'Testing...' : 'Test Ping'}
              </button>
            </div>

            {testStatus.success && (
              <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-800">
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Connected successfully! Latency: <strong className="font-mono">{testStatus.latencyMs}ms</strong></span>
              </div>
            )}

            {testStatus.error && (
              <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-800">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span>Error: {testStatus.error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <div className="text-xs text-slate-500">
            No document leaves your device when using local models.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
