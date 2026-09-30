import React, { useState } from 'react';
import { 
  Sparkles, 
  Maximize2, 
  Download, 
  AlertTriangle, 
  RotateCw, 
  Loader2, 
  X,
  Image as ImageIcon
} from 'lucide-react';
import { VisualContentData } from '../../types.js';

interface ImageArtifactCardProps {
  content: VisualContentData;
  onRetry?: (prompt: string) => void;
}

export const ImageArtifactCard: React.FC<ImageArtifactCardProps> = ({ content, onRetry }) => {
  const [showImageLightbox, setShowImageLightbox] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);

  const status = content.status || (content.imageUrl ? 'completed' : 'failed');
  const title = content.title || 'Generated Artwork';
  const prompt = content.prompt || '';
  const errorMsg = content.error || (imageLoadError ? 'Browser was unable to display the generated image data.' : undefined);

  // 1. Generation In Progress State
  if (status === 'generating') {
    return (
      <div className="w-full my-2.5 rounded-xl overflow-hidden border border-cyan-500/40 bg-slate-950/95 shadow-xl transition-all">
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800/80 text-xs">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            <span className="text-cyan-300 font-medium truncate max-w-[200px] sm:max-w-xs">
              Generating Artwork...
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-950/70 text-cyan-300 border border-cyan-500/30 animate-pulse">
              Gemini Image API
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">1K Resolution</span>
        </div>

        <div className="p-6 flex flex-col items-center justify-center text-center space-y-3 bg-gradient-to-b from-slate-950 to-slate-900/40 min-h-[180px]">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-950/50">
              <Sparkles className="w-7 h-7 animate-pulse text-cyan-300" />
            </div>
            <div className="absolute -inset-1 rounded-2xl bg-cyan-400/20 blur-sm animate-pulse -z-10" />
          </div>

          <div className="space-y-1 max-w-md">
            <p className="text-sm font-medium text-slate-200">
              Synthesizing image with <span className="text-cyan-400 font-mono text-xs">gemini-3.1-flash-image</span>
            </p>
            {prompt && (
              <p className="text-xs text-slate-400 italic line-clamp-2 px-4">
                "{prompt}"
              </p>
            )}
          </div>

          <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
            <div className="w-full h-full bg-gradient-to-r from-cyan-500 via-indigo-400 to-cyan-500 animate-[shimmer_1.5s_infinite] -translate-x-full" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Generation Failed State
  if (status === 'failed' || errorMsg) {
    return (
      <div className="w-full my-2.5 rounded-xl overflow-hidden border border-rose-500/40 bg-slate-950/95 shadow-xl transition-all">
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-rose-950/40 border-b border-rose-500/30 text-xs">
          <div className="flex items-center gap-2 text-rose-300 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Image Generation Notice</span>
          </div>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950/80 text-rose-300 border border-rose-500/30">
            Error
          </span>
        </div>

        <div className="p-4 space-y-3 bg-slate-950">
          <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/20 text-xs text-rose-200 space-y-1">
            <div className="font-semibold text-rose-300 flex items-center gap-1.5">
              <span>Could not generate image</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed break-words font-mono">
              {errorMsg || 'Gemini image generation API request failed.'}
            </p>
          </div>

          {prompt && (
            <div className="text-xs text-slate-400">
              <span className="text-slate-300 font-semibold mr-1.5">Requested Prompt:</span>
              <span className="italic">"{prompt}"</span>
            </div>
          )}

          {onRetry && prompt && (
            <div className="flex items-center justify-end pt-1">
              <button
                onClick={() => onRetry(prompt)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition flex items-center gap-1.5 shadow"
              >
                <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Retry Generation</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. Completed State: Actual Generated Image Display
  return (
    <div className="w-full my-2.5 rounded-xl overflow-hidden border border-cyan-500/30 bg-slate-950/95 shadow-xl transition-all">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800/80 text-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-200 font-medium truncate max-w-[200px] sm:max-w-xs">
            {title}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-950/60 text-cyan-300 border border-cyan-500/20">
            Gemini Render
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImageLightbox(true)}
            className="px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1"
            title="Expand image in lightbox"
          >
            <Maximize2 className="w-3 h-3" />
            <span>View Larger</span>
          </button>
          {content.imageUrl && (
            <a
              href={content.imageUrl}
              download={`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'aura-image'}.png`}
              className="px-2.5 py-1 rounded-md text-xs font-medium text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500/30 transition flex items-center gap-1"
              title="Download image to your device"
            >
              <Download className="w-3 h-3" />
              <span>Save</span>
            </a>
          )}
        </div>
      </div>

      {/* Image Content Container */}
      <div 
        onClick={() => setShowImageLightbox(true)}
        className="relative group cursor-pointer overflow-hidden bg-slate-950 max-h-80 flex items-center justify-center"
      >
        {content.imageUrl ? (
          <img
            src={content.imageUrl}
            alt={title}
            referrerPolicy="no-referrer"
            onError={() => setImageLoadError(true)}
            className="w-full h-auto max-h-80 object-cover object-center group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500 space-y-2">
            <ImageIcon className="w-8 h-8 text-slate-600" />
            <span className="text-xs">No image data available</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <span className="px-3 py-1.5 rounded-xl bg-slate-900/90 text-white text-xs font-medium flex items-center gap-1.5 backdrop-blur-sm shadow-xl border border-cyan-500/30">
            <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
            Click to Enlarge
          </span>
        </div>
      </div>

      {/* Prompt Footer */}
      {prompt && (
        <div className="px-3.5 py-2 border-t border-slate-800/60 bg-slate-900/40 text-[11px] text-slate-400 flex items-start gap-1.5">
          <span className="font-semibold text-slate-300 shrink-0">Prompt:</span>
          <span className="italic truncate">{prompt}</span>
        </div>
      )}

      {/* High-Res Lightbox Modal */}
      {showImageLightbox && content.imageUrl && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 text-white border-b border-slate-800/80 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <h3 className="font-semibold text-sm">{title}</h3>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={content.imageUrl}
                download={`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'aura-image'}.png`}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition flex items-center gap-1.5 shadow"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download High-Res</span>
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
              alt={title}
              referrerPolicy="no-referrer"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            />
          </div>
          {prompt && (
            <div className="pt-2 text-center text-xs text-slate-400 italic">
              "{prompt}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};
