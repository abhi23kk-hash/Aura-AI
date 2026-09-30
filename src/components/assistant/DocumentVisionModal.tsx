import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  Image as ImageIcon, 
  Check, 
  Sparkles,
  HelpCircle,
  Eye
} from 'lucide-react';

interface DocumentVisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitFile: (fileData: { name: string; mimeType: string; data: string; previewUrl: string }, userPrompt: string) => void;
}

export const DocumentVisionModal: React.FC<DocumentVisionModalProps> = ({
  isOpen,
  onClose,
  onSubmitFile,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    mimeType: string;
    data: string; // base64
    previewUrl: string;
    isImage: boolean;
  } | null>(null);
  const [prompt, setPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    const isImage = file.type.startsWith('image/');

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Full = e.target?.result as string;
      const base64Clean = base64Full.split(',')[1];
      setSelectedFile({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        data: base64Clean,
        previewUrl: base64Full,
        isImage,
      });
      if (isImage) {
        setPrompt('AURA, what is this? Explain this diagram or code.');
      } else {
        setPrompt('Explain this document and summarize the key points.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    onSubmitFile(
      {
        name: selectedFile.name,
        mimeType: selectedFile.mimeType,
        data: selectedFile.data,
        previewUrl: selectedFile.previewUrl,
      },
      prompt || (selectedFile.isImage ? 'Explain this image.' : 'Summarize this document.')
    );
    setSelectedFile(null);
    onClose();
  };

  const presetQueries = selectedFile?.isImage
    ? [
        'AURA, what is this?',
        'Explain this diagram.',
        "What's wrong here? (Debug)",
        'Solve this problem step by step.',
      ]
    : [
        'Explain this document.',
        'Summarize this into 3 points.',
        'What are the most important takeaways?',
        'Quiz me from this document.',
      ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel-glow rounded-3xl p-6 max-w-xl w-full space-y-5 border border-slate-700 shadow-2xl relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Vision & Document Studio</h3>
              <p className="text-xs text-slate-400">Share code screenshots, DSA diagrams, or PDFs with AURA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dropzone */}
        {!selectedFile ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
              dragActive
                ? 'border-cyan-400 bg-cyan-500/10'
                : 'border-slate-700 hover:border-slate-500 bg-slate-900/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">
                Drag & drop diagram, screenshot, or document
              </p>
              <p className="text-xs text-slate-500 mt-1">Supports PNG, JPG, WebP, PDF, DOCX</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File Preview */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
              {selectedFile.isImage ? (
                <img
                  src={selectedFile.previewUrl}
                  alt="Upload preview"
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 object-cover rounded-xl border border-slate-700"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-slate-800 flex items-center justify-center text-cyan-400">
                  <FileText className="w-8 h-8" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-100 truncate">{selectedFile.name}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedFile.mimeType}</p>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-xs text-rose-400 hover:underline mt-2 inline-block"
                >
                  Change file
                </button>
              </div>
            </div>

            {/* Quick Action Suggestion Chips */}
            <div>
              <span className="text-xs text-slate-400 block mb-2 font-mono">QUICK SPOKEN COMMANDS:</span>
              <div className="flex flex-wrap gap-2">
                {presetQueries.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPrompt(q)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition ${
                      prompt === q
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Input */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">What would you like AURA to do with this?</label>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask AURA to explain, debug, or solve..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/60"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-white font-medium text-xs shadow-lg shadow-cyan-500/20 flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Submit to AURA</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
