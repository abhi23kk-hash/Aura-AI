import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  ExternalLink, 
  Terminal, 
  Code2, 
  Link2, 
  Table as TableIcon, 
  ListOrdered,
  Sparkles,
  Play,
  RotateCw,
  Maximize2,
  Minimize2,
  Download,
  AlertTriangle,
  Eye,
  Loader2,
  X
} from 'lucide-react';
import { VisualContentData } from '../../types.js';

interface VisualResponseCardProps {
  content: VisualContentData;
  onOpenWebsite?: (url: string, title?: string) => void;
}

export const VisualResponseCard: React.FC<VisualResponseCardProps> = ({ content, onOpenWebsite }) => {
  const [copied, setCopied] = useState(false);
  
  // Code runner state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionOutput, setExecutionOutput] = useState<{ stdout: string; stderr: string; exitCode: number | null; timeMs: number } | null>(null);
  
  // Code vs Live Preview toggle
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
  const [previewKey, setPreviewKey] = useState(0);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);

  // External Website Confirmation Modal
  const [showWebsiteConfirmModal, setShowWebsiteConfirmModal] = useState(false);

  // Image Lightbox Modal
  const [showImageLightbox, setShowImageLightbox] = useState(false);

  const handleCopy = (textToCopy: string) => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunCode = async () => {
    if (!content.code || isExecuting) return;
    setIsExecuting(true);
    setExecutionOutput(null);

    try {
      const res = await fetch('/api/execute-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: content.code,
          language: content.language || 'python',
        }),
      });
      const data = await res.json();
      setExecutionOutput({
        stdout: data.stdout || '',
        stderr: data.stderr || '',
        exitCode: data.exitCode,
        timeMs: data.executionTimeMs || 0,
      });
    } catch (err: any) {
      setExecutionOutput({
        stdout: '',
        stderr: `Execution request error: ${err.message}`,
        exitCode: 1,
        timeMs: 0,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleConfirmOpenWebsite = () => {
    if (content.url) {
      if (onOpenWebsite) {
        onOpenWebsite(content.url, content.title);
      } else {
        window.open(content.url, '_blank', 'noopener,noreferrer');
      }
    }
    setShowWebsiteConfirmModal(false);
  };

  const isWebCode = 
    content.language === 'html' || 
    content.language === 'javascript' || 
    content.language === 'js' || 
    content.language === 'jsx' || 
    content.language === 'react' ||
    content.language === 'tsx';

  // Build sandboxed HTML iframe document
  const generatePreviewSrcDoc = () => {
    if (!content.code) return '';
    const raw = content.code.trim();

    if (raw.startsWith('<!DOCTYPE') || raw.startsWith('<html') || raw.includes('<html>')) {
      return raw;
    }

    // Wrap React or standard JS / HTML
    const isReact = raw.includes('export default') || raw.includes('function ') || raw.includes('const ') && raw.includes('return');
    if (isReact) {
      return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>body { background: #0f172a; color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; padding: 1.5rem; }</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="text/babel">
      ${raw.replace(/export\s+default\s+/g, 'const __Component = ')}
      const ComponentToRender = typeof __Component !== 'undefined' ? __Component : () => <div>Component Loaded</div>;
      ReactDOM.createRoot(document.getElementById('root')).render(<ComponentToRender />);
    </script>
  </body>
</html>`;
    }

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { background: #0f172a; color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; padding: 1rem; }</style>
  </head>
  <body>
    ${raw}
  </body>
</html>`;
  };

  // 1. Code Block Visual Display with Execution & Live Preview
  if (content.type === 'code' && content.code) {
    const language = (content.language || 'code').toLowerCase();
    const canRun = language === 'python' || language === 'py' || language === 'javascript' || language === 'js';

    return (
      <div className="w-full my-2.5 rounded-xl overflow-hidden border border-slate-800 bg-slate-950/95 shadow-xl transition-all">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800/80 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Code2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-300 font-medium truncate max-w-[200px] sm:max-w-xs">
              {content.title || `${language.toUpperCase()} Snippet`}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-950/60 text-cyan-300 border border-cyan-500/20 uppercase">
              {language}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Preview Toggle for Web/React Code */}
            {isWebCode && (
              <div className="flex items-center rounded-lg bg-slate-800/90 p-0.5 border border-slate-700/60">
                <button
                  onClick={() => setActiveTab('code')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition ${
                    activeTab === 'code' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Code
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition ${
                    activeTab === 'preview' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  Preview
                </button>
              </div>
            )}

            {/* Run Code Button */}
            {canRun && (
              <button
                onClick={handleRunCode}
                disabled={isExecuting}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/30 transition disabled:opacity-50"
                title="Execute code in safe isolated sandbox"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                    <span>Run Code</span>
                  </>
                )}
              </button>
            )}

            {/* Copy Button */}
            <button
              onClick={() => handleCopy(content.code || '')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 transition"
              title="Copy code to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tab 1: Code View */}
        {activeTab === 'code' && (
          <div className="p-3.5 overflow-x-auto max-h-80 overflow-y-auto font-mono text-xs sm:text-sm text-cyan-100/90 leading-relaxed scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            <pre className="whitespace-pre">{content.code}</pre>
          </div>
        )}

        {/* Tab 2: Live Sandboxed Preview */}
        {activeTab === 'preview' && (
          <div className="relative bg-slate-900/95 border-b border-slate-800/80">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950/70 border-b border-slate-800/50 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Isolated Live Sandbox
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewKey((k) => k + 1)}
                  className="p-1 hover:text-slate-200 transition"
                  title="Reload preview"
                >
                  <RotateCw className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setIsFullscreenPreview(true)}
                  className="p-1 hover:text-slate-200 transition"
                  title="Fullscreen preview"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            <iframe
              key={previewKey}
              sandbox="allow-scripts"
              srcDoc={generatePreviewSrcDoc()}
              title="Live Component Preview"
              className="w-full h-64 border-none bg-slate-950"
            />
          </div>
        )}

        {/* Output Panel for Code Execution */}
        {executionOutput && (
          <div className="border-t border-slate-800/90 bg-slate-950/90 p-3 font-mono text-xs">
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold text-slate-200">Execution Output</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                  executionOutput.exitCode === 0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' : 'bg-rose-950 text-rose-400 border border-rose-500/20'
                }`}>
                  {executionOutput.exitCode === 0 ? 'Exit 0 (Success)' : `Exit ${executionOutput.exitCode ?? 'Err'}`}
                </span>
                <span className="text-slate-500 text-[10px]">{executionOutput.timeMs}ms</span>
              </div>
              <button
                onClick={() => setExecutionOutput(null)}
                className="text-slate-500 hover:text-slate-300 text-[10px]"
              >
                Clear
              </button>
            </div>

            {executionOutput.stdout && (
              <div className="text-emerald-300/90 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {executionOutput.stdout}
              </div>
            )}
            {executionOutput.stderr && (
              <div className="text-rose-400/90 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto mt-1">
                {executionOutput.stderr}
              </div>
            )}
            {!executionOutput.stdout && !executionOutput.stderr && (
              <div className="text-slate-500 italic">Code finished with no output.</div>
            )}
          </div>
        )}

        {content.summary && (
          <div className="px-3.5 py-2 border-t border-slate-800/60 bg-slate-900/40 text-[11px] text-slate-400">
            {content.summary}
          </div>
        )}

        {/* Fullscreen Preview Modal */}
        {isFullscreenPreview && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 text-white">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <h3 className="font-semibold text-sm">{content.title || 'Live Preview'}</h3>
              </div>
              <button
                onClick={() => setIsFullscreenPreview(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
              <iframe
                sandbox="allow-scripts"
                srcDoc={generatePreviewSrcDoc()}
                title="Fullscreen Preview"
                className="w-full h-full border-none"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. Link / Official Portal Visual Card with Explicit Confirmation Modal
  if (content.type === 'link' && content.url) {
    return (
      <div className="w-full my-2.5 p-3.5 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-cyan-950/30 shadow-lg backdrop-blur-sm transition-all hover:border-cyan-500/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0 mt-0.5 sm:mt-0">
              <Link2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="text-sm font-semibold text-slate-100 truncate">
                  {content.title || 'Official Portal'}
                </h4>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  Verified URL
                </span>
              </div>
              <p className="text-xs font-mono text-cyan-300/80 truncate mt-0.5">
                {content.url}
              </p>
              {content.summary && (
                <p className="text-xs text-slate-400 mt-1">
                  {content.summary}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleCopy(content.url || '')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1.5"
              title="Copy link"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* User Confirmation Guard: Triggers explicit confirmation modal */}
            <button
              onClick={() => setShowWebsiteConfirmModal(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 transition shadow-md shadow-cyan-950 flex items-center gap-1.5"
            >
              <span>{content.urlLabel || 'Open Link'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Explicit Confirmation Dialog before Opening External Website */}
        {showWebsiteConfirmModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
            <div className="max-w-md w-full bg-slate-900 border border-cyan-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0">
                  <ExternalLink className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-white">
                    Open External Website?
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    You are about to navigate outside the application to:
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="text-xs font-semibold text-slate-200">
                  {content.title || 'Official Website'}
                </div>
                <div className="text-xs font-mono text-cyan-400 break-all">
                  {content.url}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setShowWebsiteConfirmModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmOpenWebsite}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 transition shadow-lg shadow-cyan-950 flex items-center gap-1.5"
                >
                  <span>OK, Open Website</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. Image Generation Result Card
  if (content.type === 'image' && content.imageUrl) {
    return (
      <div className="w-full my-2.5 rounded-xl overflow-hidden border border-cyan-500/30 bg-slate-950/95 shadow-xl transition-all">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800/80 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-200 font-medium truncate max-w-[200px] sm:max-w-xs">
              {content.title || 'Generated Artwork'}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-950/60 text-cyan-300 border border-cyan-500/20">
              AI Render
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImageLightbox(true)}
              className="px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1"
            >
              <Maximize2 className="w-3 h-3" />
              <span>View Larger</span>
            </button>
            <a
              href={content.imageUrl}
              download={content.title || 'generated-image.jpg'}
              className="px-2.5 py-1 rounded-md text-xs font-medium text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500/30 transition flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>Save</span>
            </a>
          </div>
        </div>

        {/* Image Content */}
        <div 
          onClick={() => setShowImageLightbox(true)}
          className="relative group cursor-pointer overflow-hidden bg-slate-950 max-h-80 flex items-center justify-center"
        >
          <img
            src={content.imageUrl}
            alt={content.title || 'Generated Visual Artwork'}
            referrerPolicy="no-referrer"
            className="w-full h-auto max-h-80 object-cover object-center group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="px-3 py-1.5 rounded-xl bg-slate-900/80 text-white text-xs font-medium flex items-center gap-1.5 backdrop-blur-sm">
              <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
              Click to Enlarge
            </span>
          </div>
        </div>

        {content.prompt && (
          <div className="px-3.5 py-2 border-t border-slate-800/60 bg-slate-900/40 text-[11px] text-slate-400 flex items-start gap-1.5">
            <span className="font-semibold text-slate-300 shrink-0">Prompt:</span>
            <span className="italic truncate">{content.prompt}</span>
          </div>
        )}

        {/* High-Res Lightbox Modal */}
        {showImageLightbox && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 text-white">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="font-semibold text-sm">{content.title || 'Generated Visual Result'}</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={content.imageUrl}
                  download={content.title || 'generated-image.jpg'}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setShowImageLightbox(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-2">
              <img
                src={content.imageUrl}
                alt={content.title || 'Full Resolution Visual Artwork'}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              />
            </div>
            {content.prompt && (
              <div className="pt-2 text-center text-xs text-slate-400 italic">
                "{content.prompt}"
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // 4. Command Visual Block
  if (content.type === 'command' && content.command) {
    return (
      <div className="w-full my-2.5 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-lg">
        <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900 border-b border-slate-800/80 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-300 font-medium">
              {content.title || 'Terminal Command'}
            </span>
          </div>
          <button
            onClick={() => handleCopy(content.command || '')}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slate-400" />
                <span>Copy Command</span>
              </>
            )}
          </button>
        </div>
        <div className="p-3 font-mono text-xs sm:text-sm text-emerald-400 bg-slate-950/80 flex items-center gap-2 overflow-x-auto">
          <span className="text-slate-500 select-none">$</span>
          <span className="whitespace-pre">{content.command}</span>
        </div>
        {content.summary && (
          <div className="px-3.5 py-1.5 border-t border-slate-800/60 bg-slate-900/30 text-[11px] text-slate-400">
            {content.summary}
          </div>
        )}
      </div>
    );
  }

  // 5. Comparison Table Visual Display
  if (content.type === 'table' && content.tableHeaders && content.tableRows) {
    return (
      <div className="w-full my-2.5 rounded-xl overflow-hidden border border-slate-800 bg-slate-950/90 shadow-xl">
        {content.title && (
          <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-900/90 border-b border-slate-800 text-xs font-semibold text-slate-200">
            <TableIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span>{content.title}</span>
          </div>
        )}
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-300 border-b border-slate-800 font-mono text-[11px]">
              <tr>
                {content.tableHeaders.map((header, idx) => (
                  <th key={idx} className="px-3 py-2 font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {content.tableRows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-slate-900/40 transition">
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="px-3 py-2 text-slate-300">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 6. Steps / Structured List Visual Display
  if ((content.type === 'steps' || content.type === 'list') && content.items && content.items.length > 0) {
    return (
      <div className="w-full my-2.5 rounded-xl p-3.5 border border-slate-800 bg-slate-950/80 shadow-lg space-y-2">
        <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800 text-xs font-semibold text-slate-200">
          {content.type === 'steps' ? (
            <ListOrdered className="w-3.5 h-3.5 text-cyan-400" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          )}
          <span>{content.title || (content.type === 'steps' ? 'Step-by-Step Guide' : 'Key Items')}</span>
        </div>
        <div className="space-y-1.5 pt-1">
          {content.items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
              <span className="flex items-center justify-center w-5 h-5 rounded-md bg-cyan-950 border border-cyan-500/20 text-cyan-300 font-mono text-[11px] shrink-0 font-semibold mt-0.5">
                {idx + 1}
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
};
