import React, { useState } from 'react';
import { functionsdescription, FUNCTIONS_DOCUMENTATION } from '../data/functionsDescription';
import { X, BookOpen, Copy, Check, Sparkles, Layout, Compass, ShieldCheck } from 'lucide-react';

interface FunctionsDescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FunctionsDescriptionModal: React.FC<FunctionsDescriptionModalProps> = ({
  isOpen,
  onClose
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'formatted' | 'raw'>('formatted');

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(functionsdescription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-[#FFFDF9] w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl border border-[#EADBCE] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="functions-desc-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#EADBCE] bg-[#FAF5EE] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D96B43]/15 text-[#D96B43] flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 id="functions-desc-title" className="text-base sm:text-lg font-bold text-[#2C2623]">
                App Functions & UX/UI Specification
              </h2>
              <p className="text-xs text-[#8C7A6B]">
                Full documentation of UI/UX, transitions, gesture flows, and user experiences
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View switcher tabs */}
            <div className="bg-white rounded-xl p-0.5 border border-[#EADBCE] flex items-center text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('formatted')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  activeTab === 'formatted'
                    ? 'bg-[#D96B43] text-white shadow-2xs'
                    : 'text-[#5C473A] hover:text-[#2C2623]'
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('raw')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  activeTab === 'raw'
                    ? 'bg-[#D96B43] text-white shadow-2xs'
                    : 'text-[#5C473A] hover:text-[#2C2623]'
                }`}
              >
                Raw Text
              </button>
            </div>

            {/* Copy button */}
            <button
              type="button"
              onClick={handleCopy}
              className="px-2.5 py-1.5 rounded-xl border border-[#EADBCE] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#5C473A] flex items-center gap-1.5 transition-all shadow-2xs active:scale-95"
              title="Copy functionsdescription to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#2A9D8F]" />
                  <span className="text-[#2A9D8F]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#D96B43]" />
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center text-[#8C7A6B] hover:text-[#2C2623] transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-[#4A3B32]">
          {activeTab === 'formatted' ? (
            <div className="space-y-6">
              {/* Highlight Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-white border border-[#EADBCE] shadow-2xs">
                  <div className="w-7 h-7 rounded-lg bg-[#D96B43]/10 text-[#D96B43] flex items-center justify-center mb-2">
                    <Layout className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs font-bold text-[#2C2623]">3 Unified Perspectives</h4>
                  <p className="text-[11px] text-[#716458] mt-0.5">
                    Companion Storyline, Map Split View, and Timeline Quick Editor.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-[#EADBCE] shadow-2xs">
                  <div className="w-7 h-7 rounded-lg bg-[#2A9D8F]/10 text-[#2A9D8F] flex items-center justify-center mb-2">
                    <Compass className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs font-bold text-[#2C2623]">Swipe Gesture Engine</h4>
                  <p className="text-[11px] text-[#716458] mt-0.5">
                    Pointer capture, swipe right to complete, left to reveal Archive & Delete.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-[#EADBCE] shadow-2xs">
                  <div className="w-7 h-7 rounded-lg bg-[#E76F51]/10 text-[#E76F51] flex items-center justify-center mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs font-bold text-[#2C2623]">Route Optimization</h4>
                  <p className="text-[11px] text-[#716458] mt-0.5">
                    2-opt Euclidean TSP algorithm eliminating backtracking with 1-click Undo.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-[#EADBCE] shadow-2xs">
                  <div className="w-7 h-7 rounded-lg bg-[#5C473A]/10 text-[#5C473A] flex items-center justify-center mb-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs font-bold text-[#2C2623]">In-Situ Budding</h4>
                  <p className="text-[11px] text-[#716458] mt-0.5">
                    Zero-modal stop insertion directly between points with auto time interpolation.
                  </p>
                </div>
              </div>

              {/* Detailed Breakdown Sections */}
              <div className="space-y-4">
                {FUNCTIONS_DOCUMENTATION.sections.map((section) => (
                  <div
                    key={section.id}
                    className="p-4 rounded-2xl bg-white border border-[#EADBCE] hover:border-[#D96B43]/50 transition-colors shadow-2xs"
                  >
                    <h3 className="text-sm font-bold text-[#2C2623]">{section.title}</h3>
                    <p className="text-xs text-[#5C473A] mt-1 leading-relaxed">
                      {section.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Full Text Preview Accordion / Block */}
              <div className="p-4 rounded-2xl bg-[#FAF5EE] border border-[#EADBCE]">
                <h4 className="text-xs font-bold text-[#2C2623] mb-2 uppercase tracking-wider">
                  Complete Text Export in App Data:
                </h4>
                <pre className="text-[11px] font-mono leading-relaxed text-[#4A3B32] whitespace-pre-wrap max-h-60 overflow-y-auto bg-white p-3.5 rounded-xl border border-[#EADBCE]">
                  {functionsdescription.trim()}
                </pre>
              </div>
            </div>
          ) : (
            <div className="relative">
              <pre className="text-xs font-mono leading-relaxed text-[#2C2623] whitespace-pre-wrap bg-white p-4 rounded-2xl border border-[#EADBCE]">
                {functionsdescription.trim()}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#EADBCE] bg-[#FAF5EE] flex items-center justify-between text-xs text-[#8C7A6B]">
          <span>Identifier in data: <code className="font-mono text-[#D96B43] bg-white px-1.5 py-0.5 rounded border border-[#EADBCE]">functionsdescription</code></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#2C2623] hover:bg-[#4A3B32] text-white rounded-xl font-semibold transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
