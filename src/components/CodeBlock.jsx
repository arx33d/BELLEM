import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import hljs from 'highlight.js';

export default function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cleanLang = language ? language.replace(/^language-/, '') : '';

  let highlighted = code;
  if (cleanLang && hljs.getLanguage(cleanLang)) {
    try {
      highlighted = hljs.highlight(code, { language: cleanLang, ignoreIllegals: true }).value;
    } catch (e) {
      highlighted = code;
    }
  } else {
    try {
      highlighted = hljs.highlightAuto(code).value;
    } catch (e) {
      highlighted = code;
    }
  }

  return (
    <div className="relative my-3 rounded-xl overflow-hidden border border-gemini-border bg-[#18191a] text-sm">
      {/* Code Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#212225] border-b border-gemini-border text-xs text-gemini-textMuted font-mono">
        <span className="uppercase tracking-wider font-semibold text-gemini-blueLight">
          {cleanLang || 'plaintext'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gemini-hover text-gemini-textMuted hover:text-white transition-colors"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400 font-sans">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="font-sans">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="p-4 overflow-x-auto text-[13px] font-mono leading-relaxed">
        <pre className="m-0 p-0">
          <code
            className="hljs bg-transparent p-0 block"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
      </div>
    </div>
  );
}
