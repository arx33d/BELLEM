import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  Sparkles,
  User,
  Copy,
  Check,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronRight,
  Brain,
  Edit2,
  X,
  FileText,
  Globe,
  ExternalLink,
  Map,
  Terminal,
  Network,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Search,
  Layers,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import CodeBlock from './CodeBlock';
import { runSiteCommand, runFSafeScan } from '../utils/api';

// Helper to separate <think> tags from final content
function parseThinking(content) {
  if (!content) return { thinking: null, response: '', isThinkingOpen: false };

  const thinkOpenRegex = /<think>/i;
  const thinkCloseRegex = /<\/think>/i;

  const hasOpen = thinkOpenRegex.test(content);
  const hasClose = thinkCloseRegex.test(content);

  if (hasOpen && hasClose) {
    const parts = content.split(/<\/think>/i);
    const thinking = parts[0].replace(/<think>/i, '').trim();
    const response = parts.slice(1).join('</think>').trim();
    return { thinking, response, isThinkingOpen: false };
  } else if (hasOpen && !hasClose) {
    const thinking = content.replace(/<think>/i, '').trim();
    return { thinking, response: '', isThinkingOpen: true };
  }

  return { thinking: null, response: content, isThinkingOpen: false };
}

export default function ChatMessage({
  message,
  isStreaming = false,
  onRegenerate,
  onEditMessage,
  isSpeaking,
  onToggleSpeak
}) {
  const [copied, setCopied] = useState(false);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [isWebAnalysisExpanded, setIsWebAnalysisExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'sitemap' | 'recon' | 'fsafe'
  const [routeFilter, setRouteFilter] = useState('');
  const [commandLoading, setCommandLoading] = useState(false);
  const [activeCommandOutput, setActiveCommandOutput] = useState(null);
  const [activeCommandName, setActiveCommandName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [fsafeLoading, setFsafeLoading] = useState(false);
  const [fsafeData, setFsafeData] = useState(message.fsafe || null);

  const handleRunCommand = async (cmd) => {
    const targetUrl = message.webAnalysis?.url || message.siteMap?.startUrl || message.fsafe?.targetUrl;
    if (!targetUrl) return;
    setCommandLoading(true);
    setActiveCommandName(cmd);
    try {
      const res = await runSiteCommand(targetUrl, cmd);
      const output = res.fsafe || res.result || res;
      setActiveCommandOutput(output);
      if (cmd === 'fsafe' && (res.fsafe || res.result)) {
        setFsafeData(res.fsafe || res.result);
      }
    } catch (err) {
      setActiveCommandOutput({ error: err.message });
    } finally {
      setCommandLoading(false);
    }
  };

  const handleRunFSafe = async () => {
    const targetUrl = message.webAnalysis?.url || message.siteMap?.startUrl || message.fsafe?.targetUrl;
    if (!targetUrl) return;
    setFsafeLoading(true);
    try {
      const res = await runFSafeScan(targetUrl);
      if (res.fsafe) {
        setFsafeData(res.fsafe);
      }
    } catch (err) {
      console.error('Failed to run FSafe scan:', err);
    } finally {
      setFsafeLoading(false);
    }
  };

  const isUser = message.role === 'user';
  const { thinking, response, isThinkingOpen } = parseThinking(message.content);

  const handleCopy = () => {
    // If copying assistant, omit thinking tag
    const textToCopy = isUser ? message.content : (response || message.content);
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    if (editText.trim() && onEditMessage) {
      onEditMessage(message.id, editText.trim());
      setIsEditing(false);
    }
  };

  return (
    <div className={`w-full py-4 px-4 md:px-6 transition-colors ${isUser ? '' : 'bg-[#18191a]/40 border-y border-gemini-border/30'}`}>
      <div className="max-w-4xl mx-auto">
        {/* Message Body */}
        <div className="w-full">
          {/* Header info */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs tracking-wider uppercase text-gemini-textMuted font-mono">
                {isUser ? 'You' : (message.model || 'BELLEM')}
              </span>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="p-1 rounded text-gemini-textMuted hover:text-white hover:bg-gemini-hover transition-colors"
                title="Copy text"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {!isUser && onToggleSpeak && (
                <button
                  onClick={onToggleSpeak}
                  className={`p-1 rounded transition-colors ${
                    isSpeaking
                      ? 'text-gemini-blueLight bg-gemini-hover'
                      : 'text-gemini-textMuted hover:text-white hover:bg-gemini-hover'
                  }`}
                  title={isSpeaking ? 'Stop reading' : 'Read aloud'}
                >
                  {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
              )}

              {isUser && !isEditing && onEditMessage && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 rounded text-gemini-textMuted hover:text-white hover:bg-gemini-hover transition-colors"
                  title="Edit prompt"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* User Attachments (if any) */}
          {isUser && message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {message.attachments.map((att, idx) => (
                <div key={idx} className="relative group">
                  {att.type === 'image' ? (
                    <div className="rounded-lg overflow-hidden border border-gemini-border max-w-[200px] max-h-[160px] bg-black/40">
                      <img
                        src={att.previewUrl || `data:image/jpeg;base64,${att.base64}`}
                        alt={att.name || 'Attachment'}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gemini-surface border border-gemini-border text-xs text-gemini-text">
                      <FileText className="w-4 h-4 text-gemini-blueLight" />
                      <span className="truncate max-w-[150px]">{att.name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* User Message Edit Mode */}
          {isUser && isEditing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full p-3 rounded-xl bg-gemini-surface border border-gemini-border focus:border-gemini-blue focus:outline-none text-gemini-text text-sm resize-y min-h-[90px]"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditText(message.content);
                  }}
                  className="px-3 py-1 text-xs rounded-lg bg-gemini-surface border border-gemini-border text-gemini-textMuted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1 text-xs rounded-lg bg-gemini-blue hover:bg-gemini-blueHover text-white font-medium"
                >
                  Save & Regenerate
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Collapsible Thinking Process (for models that output <think>) */}
              {thinking && (
                <div className="my-2 rounded-xl border border-gemini-border bg-[#18191a] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsThinkingExpanded(prev => !prev)}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-gemini-textMuted hover:text-gemini-text hover:bg-gemini-hover transition-colors font-mono select-none"
                  >
                    <span className="font-sans font-medium text-gemini-textDim">
                      {isThinkingOpen && isStreaming ? 'Thinking...' : 'Thought process'}
                    </span>
                    {isThinkingExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {isThinkingExpanded && (
                    <div className="px-4 py-3 border-t border-gemini-border/40 text-xs text-gemini-textMuted font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                      {thinking}
                    </div>
                  )}
                </div>
              )}

              {/* Website Deep Inspection, Crawler & Reconnaissance Super-Card */}
              {!isUser && (message.webAnalysis || message.siteMap || message.siteCommands || message.fsafe || fsafeData) && (
                <div className="my-2.5 rounded-xl border border-gemini-border bg-[#18191a] overflow-hidden text-xs">
                  {/* Header summary banner */}
                  <div
                    onClick={() => setIsWebAnalysisExpanded(prev => !prev)}
                    className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer hover:bg-gemini-hover/60 transition-colors select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <Globe className="w-4 h-4 text-gemini-blueLight shrink-0" />
                      <span className="font-mono text-white font-medium truncate">
                        {message.webAnalysis?.domain || message.siteMap?.hostname || (fsafeData || message.fsafe)?.domain || 'Website'}
                      </span>
                      {message.webAnalysis?.statusCode && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                          message.webAnalysis.statusCode < 400
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                            : 'bg-rose-950/60 text-rose-400 border border-rose-800/50'
                        }`}>
                          {message.webAnalysis.statusCode} {message.webAnalysis.statusText || ''}
                        </span>
                      )}
                      {message.webAnalysis?.latencyMs && (
                        <span className="text-[10px] font-mono text-gemini-textDim hidden sm:inline">
                          {message.webAnalysis.latencyMs}ms
                        </span>
                      )}
                      {message.webAnalysis?.securityScore && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                          message.webAnalysis.securityScore === 'A'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : message.webAnalysis.securityScore === 'B'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            : message.webAnalysis.securityScore === 'C'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}>
                          Sec: {message.webAnalysis.securityScore}
                        </span>
                      )}
                      {(fsafeData || message.fsafe) && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                          (fsafeData || message.fsafe).score >= 80
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : (fsafeData || message.fsafe).score >= 60
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}>
                          FSafe: {(fsafeData || message.fsafe).score}/100 ({(fsafeData || message.fsafe).grade})
                        </span>
                      )}
                      {message.siteMap?.totalCrawled > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gemini-blue/15 text-gemini-blueLight border border-gemini-blue/30 hidden sm:inline">
                          {message.siteMap.totalCrawled} routes mapped
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-[11px] text-gemini-textDim font-sans">
                        {isWebAnalysisExpanded ? 'Hide Teardown' : 'Behind the Scenes & Map'}
                      </span>
                      {isWebAnalysisExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-gemini-textDim" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-gemini-textDim" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Technical Inspector */}
                  {isWebAnalysisExpanded && (
                    <div className="border-t border-gemini-border/40 bg-[#141516]/90">
                      {/* Sub-Tab Navigation Bar */}
                      <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-b border-gemini-border/30 bg-black/20 text-[11px] font-mono overflow-x-auto">
                        <button
                          type="button"
                          onClick={() => setActiveTab('overview')}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors shrink-0 ${
                            activeTab === 'overview'
                              ? 'bg-gemini-surface text-white font-medium border border-gemini-borderLight'
                              : 'text-gemini-textDim hover:text-white hover:bg-gemini-hover'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Overview & Tech</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveTab('sitemap')}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors shrink-0 ${
                            activeTab === 'sitemap'
                              ? 'bg-gemini-surface text-white font-medium border border-gemini-borderLight'
                              : 'text-gemini-textDim hover:text-white hover:bg-gemini-hover'
                          }`}
                        >
                          <Map className="w-3.5 h-3.5 text-gemini-blueLight" />
                          <span>Site Map</span>
                          {message.siteMap?.totalCrawled > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-gemini-blue/20 text-gemini-blueLight text-[10px]">
                              {message.siteMap.totalCrawled}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveTab('recon')}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors shrink-0 ${
                            activeTab === 'recon'
                              ? 'bg-gemini-surface text-white font-medium border border-gemini-borderLight'
                              : 'text-gemini-textDim hover:text-white hover:bg-gemini-hover'
                          }`}
                        >
                          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Commands & Recon</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveTab('fsafe')}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors shrink-0 ${
                            activeTab === 'fsafe'
                              ? 'bg-gemini-surface text-white font-medium border border-gemini-borderLight'
                              : 'text-gemini-textDim hover:text-white hover:bg-gemini-hover'
                          }`}
                        >
                          <Shield className="w-3.5 h-3.5 text-rose-400" />
                          <span>FSafe Security</span>
                          {(fsafeData || message.fsafe) && (
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                              (fsafeData || message.fsafe).score >= 80 ? 'bg-emerald-500/20 text-emerald-300' :
                              (fsafeData || message.fsafe).score >= 60 ? 'bg-amber-500/20 text-amber-300' :
                              'bg-rose-500/20 text-rose-300'
                            }`}>
                              {(fsafeData || message.fsafe).grade}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Tab 1: Overview & Tech */}
                      {activeTab === 'overview' && (
                        <div className="p-3.5 space-y-3 font-mono text-[11px]">
                          {/* Title & Description */}
                          {message.webAnalysis?.title && (
                            <div>
                              <span className="text-gemini-textDim block text-[10px] uppercase">Page Title</span>
                              <span className="text-white font-sans text-xs">{message.webAnalysis.title}</span>
                            </div>
                          )}

                          {/* Tech Stack Pills */}
                          {message.webAnalysis?.techStack && message.webAnalysis.techStack.length > 0 && (
                            <div>
                              <span className="text-gemini-textDim block text-[10px] uppercase mb-1">Detected Frameworks & Infrastructure</span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {message.webAnalysis.techStack.map((tech, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded bg-gemini-surface-variant border border-gemini-border text-[11px] text-gemini-text"
                                  >
                                    {tech}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Technical Stats Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                            <div className="p-2 rounded-lg bg-gemini-surface border border-gemini-border">
                              <span className="text-gemini-textDim text-[10px] block">Scripts</span>
                              <span className="text-white font-bold">{message.webAnalysis?.scriptsCount ?? 0}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-gemini-surface border border-gemini-border">
                              <span className="text-gemini-textDim text-[10px] block">Stylesheets</span>
                              <span className="text-white font-bold">{message.webAnalysis?.stylesheetsCount ?? 0}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-gemini-surface border border-gemini-border">
                              <span className="text-gemini-textDim text-[10px] block">Internal Links</span>
                              <span className="text-white font-bold">{message.webAnalysis?.internalLinksCount ?? 0}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-gemini-surface border border-gemini-border">
                              <span className="text-gemini-textDim text-[10px] block">External Links</span>
                              <span className="text-white font-bold">{message.webAnalysis?.externalLinksCount ?? 0}</span>
                            </div>
                          </div>

                          {/* Security Audit Details */}
                          {(message.webAnalysis?.securityIssues?.length > 0 || message.webAnalysis?.securityHeadersPresent?.length > 0) && (
                            <div className="pt-2 border-t border-gemini-border/30">
                              <span className="text-gemini-textDim block text-[10px] uppercase mb-1">Security Headers</span>
                              {message.webAnalysis.securityHeadersPresent?.length > 0 && (
                                <div className="text-emerald-400/90 text-[11px] mb-1">
                                  ✓ Present: {message.webAnalysis.securityHeadersPresent.join(', ')}
                                </div>
                              )}
                              {message.webAnalysis.securityIssues?.length > 0 && (
                                <div className="text-amber-400/90 text-[11px]">
                                  ⚠ Missing: {message.webAnalysis.securityIssues.join(', ')}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Target URL Link */}
                          {message.webAnalysis?.url && (
                            <div className="pt-2 border-t border-gemini-border/30 flex items-center justify-between">
                              <span className="text-gemini-textDim text-[10px]">Target URL:</span>
                              <a
                                href={message.webAnalysis.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gemini-blueLight hover:underline inline-flex items-center gap-1 font-mono text-[11px]"
                              >
                                {message.webAnalysis.url}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tab 2: Site Map & Crawled Route Topology */}
                      {activeTab === 'sitemap' && (
                        <div className="p-3.5 space-y-3 font-mono text-[11px]">
                          {/* Search and Summary */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gemini-border/30">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">Crawled Hierarchy</span>
                              <span className="px-2 py-0.5 rounded-full bg-gemini-surface-variant text-[10px] text-gemini-textDim">
                                {message.siteMap?.totalCrawled || 0} pages crawled • {message.siteMap?.totalDiscoveredUrls || 0} URLs discovered
                              </span>
                            </div>

                            {/* Search Filter */}
                            <div className="relative">
                              <Search className="w-3 h-3 absolute left-2.5 top-2 text-gemini-textDim" />
                              <input
                                type="text"
                                value={routeFilter}
                                onChange={(e) => setRouteFilter(e.target.value)}
                                placeholder="Filter routes..."
                                className="pl-7 pr-2 py-1 rounded-lg bg-gemini-surface border border-gemini-border text-[11px] text-white focus:outline-none focus:border-gemini-blue w-40"
                              />
                            </div>
                          </div>

                          {/* Crawled Route List */}
                          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                            {message.siteMap?.routes && message.siteMap.routes.length > 0 ? (
                              message.siteMap.routes
                                .filter(r => !routeFilter || r.path.toLowerCase().includes(routeFilter.toLowerCase()) || (r.title && r.title.toLowerCase().includes(routeFilter.toLowerCase())))
                                .map((r, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between p-2 rounded-lg bg-gemini-surface/60 hover:bg-gemini-surface border border-gemini-border/40 text-[11px] transition-colors"
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                        r.status < 400 ? 'bg-emerald-950/60 text-emerald-400' : 'bg-rose-950/60 text-rose-400'
                                      }`}>
                                        {r.status}
                                      </span>
                                      <span className="text-white font-medium truncate" title={r.path}>
                                        {r.path}
                                      </span>
                                      <span className="px-1.5 py-0.5 rounded bg-gemini-surface-variant text-[10px] text-gemini-textMuted shrink-0">
                                        {r.type}
                                      </span>
                                      {r.title && r.title !== r.path && (
                                        <span className="text-gemini-textDim text-[10px] truncate hidden md:inline">
                                          — {r.title}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {r.linksCount > 0 && (
                                        <span className="text-[10px] text-gemini-textDim hidden sm:inline">
                                          {r.linksCount} links
                                        </span>
                                      )}
                                      <a
                                        href={r.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1 rounded text-gemini-textMuted hover:text-white hover:bg-gemini-hover"
                                        title={`Open ${r.url}`}
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </div>
                                  </div>
                                ))
                            ) : (
                              <div className="text-center py-6 text-gemini-textDim text-xs">
                                No crawled routes available.
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tab 3: Reconnaissance & Site Commands */}
                      {activeTab === 'recon' && (
                        <div className="p-3.5 space-y-3 font-mono text-[11px]">
                          {/* Quick Interactive Command Bar */}
                          <div className="flex flex-wrap items-center gap-1.5 pb-2.5 border-b border-gemini-border/30">
                            <span className="text-[10px] text-gemini-textDim uppercase tracking-wider mr-1 flex items-center gap-1">
                              <Terminal className="w-3 h-3 text-emerald-400" />
                              Run Command:
                            </span>
                            {['dns', 'ssl', 'robots', 'sitemap', 'api', 'fsafe'].map((cmd) => (
                              <button
                                key={cmd}
                                type="button"
                                onClick={() => handleRunCommand(cmd)}
                                disabled={commandLoading}
                                className="px-2 py-0.5 rounded bg-gemini-surface hover:bg-gemini-hover border border-gemini-border text-[11px] text-gemini-text hover:text-white transition-colors uppercase disabled:opacity-40"
                              >
                                {commandLoading && activeCommandName === cmd ? 'Running...' : cmd}
                              </button>
                            ))}
                          </div>

                          {/* Live Command Execution Output */}
                          {activeCommandOutput && (
                            <div className="p-2.5 rounded-lg bg-black/70 border border-gemini-blue/40 text-[11px] space-y-1">
                              <div className="flex items-center justify-between text-gemini-blueLight font-semibold text-[10px] uppercase">
                                <span>Output: {activeCommandName}</span>
                                <button
                                  type="button"
                                  onClick={() => setActiveCommandOutput(null)}
                                  className="text-gemini-textDim hover:text-white px-1"
                                >
                                  ✕
                                </button>
                              </div>
                              <pre className="text-gemini-text text-[11px] whitespace-pre-wrap max-h-48 overflow-y-auto">
                                {JSON.stringify(activeCommandOutput, null, 2)}
                              </pre>
                            </div>
                          )}

                          {/* Recon Cards */}
                          <div className="space-y-2.5">
                            {/* DNS Records */}
                            {message.siteCommands?.dns && (
                              <div className="p-2.5 rounded-lg bg-gemini-surface/50 border border-gemini-border/50 space-y-1">
                                <div className="text-gemini-blueLight font-semibold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                                  <Network className="w-3 h-3" />
                                  <span>DNS Records</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                                  {message.siteCommands.dns.a?.length > 0 && (
                                    <div>
                                      <span className="text-gemini-textDim">A Records: </span>
                                      <span className="text-white">{message.siteCommands.dns.a.join(', ')}</span>
                                    </div>
                                  )}
                                  {message.siteCommands.dns.mx?.length > 0 && (
                                    <div>
                                      <span className="text-gemini-textDim">MX Servers: </span>
                                      <span className="text-white">{message.siteCommands.dns.mx.map(m => m.exchange).slice(0, 2).join(', ')}</span>
                                    </div>
                                  )}
                                  {message.siteCommands.dns.ns?.length > 0 && (
                                    <div className="col-span-full">
                                      <span className="text-gemini-textDim">Name Servers (NS): </span>
                                      <span className="text-white">{message.siteCommands.dns.ns.slice(0, 4).join(', ')}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* SSL / TLS Certificate */}
                            {message.siteCommands?.ssl && (
                              <div className="p-2.5 rounded-lg bg-gemini-surface/50 border border-gemini-border/50 space-y-1">
                                <div className="text-emerald-400 font-semibold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                                  <Lock className="w-3 h-3" />
                                  <span>SSL / TLS Handshake</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                                  <div>
                                    <span className="text-gemini-textDim">Issuer: </span>
                                    <span className="text-white">{message.siteCommands.ssl.issuer}</span>
                                  </div>
                                  <div>
                                    <span className="text-gemini-textDim">Protocol / Cipher: </span>
                                    <span className="text-white">{message.siteCommands.ssl.protocol} ({message.siteCommands.ssl.cipher})</span>
                                  </div>
                                  <div>
                                    <span className="text-gemini-textDim">Valid To: </span>
                                    <span className="text-white">{message.siteCommands.ssl.validTo} ({message.siteCommands.ssl.daysRemaining} days left)</span>
                                  </div>
                                  {message.siteCommands.ssl.sans?.length > 0 && (
                                    <div>
                                      <span className="text-gemini-textDim">SANs: </span>
                                      <span className="text-white">{message.siteCommands.ssl.sans.slice(0, 3).join(', ')}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Robots & Sitemaps */}
                            {message.siteCommands?.robots && (
                              <div className="p-2.5 rounded-lg bg-gemini-surface/50 border border-gemini-border/50 space-y-1">
                                <div className="text-amber-400 font-semibold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                                  <Shield className="w-3 h-3" />
                                  <span>Robots Rules & Sitemaps</span>
                                </div>
                                <div className="text-[11px] space-y-0.5">
                                  <div>
                                    <span className="text-gemini-textDim">Disallowed Routes: </span>
                                    <span className="text-white">
                                      {message.siteCommands.robots.disallowed?.length > 0
                                        ? message.siteCommands.robots.disallowed.slice(0, 6).join(', ')
                                        : 'None declared'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gemini-textDim">Sitemaps Declared: </span>
                                    <span className="text-white">
                                      {message.siteCommands.robots.sitemaps?.length > 0
                                        ? message.siteCommands.robots.sitemaps.slice(0, 3).join(', ')
                                        : 'None in robots.txt'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* API Endpoints */}
                            {message.siteCommands?.apiEndpoints?.length > 0 && (
                              <div className="p-2.5 rounded-lg bg-gemini-surface/50 border border-gemini-border/50 space-y-1">
                                <div className="text-purple-400 font-semibold text-[11px] uppercase tracking-wider">
                                  API Endpoints Detected
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {message.siteCommands.apiEndpoints.map((ep, i) => (
                                    <span key={i} className="px-2 py-0.5 rounded bg-gemini-surface border border-gemini-border text-[11px] text-white">
                                      {ep.path} [{ep.type}] ({ep.status})
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tab 4: FSafe Security Suite */}
                      {activeTab === 'fsafe' && (
                        <div className="p-3.5 space-y-3.5 font-mono text-[11px]">
                          {/* FSafe Score & Header */}
                          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-gemini-surface/60 border border-gemini-border">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                                (fsafeData?.score ?? message.fsafe?.score ?? 0) >= 80
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : (fsafeData?.score ?? message.fsafe?.score ?? 0) >= 60
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              }`}>
                                {fsafeData?.grade || message.fsafe?.grade || 'B'}
                              </div>
                              <div>
                                <div className="text-white font-semibold text-xs flex items-center gap-2">
                                  <span>FSafe Score: {fsafeData?.score ?? message.fsafe?.score ?? '--'}/100</span>
                                  <span className="text-[10px] text-gemini-textDim font-normal font-sans">
                                    • {fsafeData?.verdict || message.fsafe?.verdict || 'Automated Vulnerability Scan'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-gemini-textDim">
                                  Target: {fsafeData?.domain || message.fsafe?.domain || message.webAnalysis?.domain || 'Target'}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={handleRunFSafe}
                              disabled={fsafeLoading}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gemini-surface hover:bg-gemini-hover border border-gemini-border text-white text-[11px] transition-colors disabled:opacity-40"
                            >
                              <RefreshCw className={`w-3 h-3 ${fsafeLoading ? 'animate-spin' : ''}`} />
                              <span>{fsafeLoading ? 'Scanning...' : 'Re-scan with FSafe'}</span>
                            </button>
                          </div>

                          {/* 8 Core Vulnerability Cards matching user's checklist */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {(fsafeData?.categories || message.fsafe?.categories || []).map((cat, idx) => {
                              const isPassed = cat.status === 'PASSED' || cat.status === 'SECURE';
                              const isWarning = cat.status === 'WARNING';
                              const isCritical = cat.status === 'CRITICAL';
                              const isDefense = cat.status === 'DEFENSE ACTIVE' || cat.status === 'HARDENED';

                              const badgeColor = isCritical
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : isWarning
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : isDefense
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

                              return (
                                <div key={cat.id || idx} className="p-3 rounded-lg bg-gemini-surface/40 border border-gemini-border/60 space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-white font-medium text-xs truncate">
                                      {idx + 1}. {cat.name}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase border shrink-0 ${badgeColor}`}>
                                      {cat.status}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-gemini-text leading-relaxed">
                                    {cat.details}
                                  </p>

                                  {/* Category-specific extra details */}
                                  {cat.id === 'traversal' && cat.exposedFiles?.length > 0 && (
                                    <div className="mt-1 pt-1 border-t border-rose-800/40 text-[10px] text-rose-300">
                                      Exposed paths: {cat.exposedFiles.join(', ')}
                                    </div>
                                  )}
                                  {cat.id === 'ddos' && cat.waf && (
                                    <div className="mt-1 pt-1 border-t border-gemini-border/30 text-[10px] text-gemini-blueLight">
                                      Active Shield: {cat.waf}
                                    </div>
                                  )}
                                  {cat.id === 'headers' && cat.softwareLeaks?.length > 0 && (
                                    <div className="mt-1 pt-1 border-t border-gemini-border/30 text-[10px] text-amber-300">
                                      Version Disclosures: {cat.softwareLeaks.join(', ')}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Sensitive File & Directory Exposure Probes List */}
                          {(fsafeData?.probedFiles || message.fsafe?.probedFiles)?.length > 0 && (
                            <div className="p-3 rounded-lg bg-gemini-surface/30 border border-gemini-border/40 space-y-2">
                              <span className="text-gemini-textDim text-[10px] uppercase tracking-wider block">
                                Probed Sensitive Endpoints & Traversal Targets:
                              </span>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                {(fsafeData?.probedFiles || message.fsafe?.probedFiles).map((file, i) => (
                                  <div
                                    key={i}
                                    className={`px-2 py-1 rounded border text-[10px] flex items-center justify-between ${
                                      file.exposed
                                        ? 'bg-rose-950/50 text-rose-300 border-rose-800'
                                        : 'bg-gemini-surface text-gemini-textDim border-gemini-border/40'
                                    }`}
                                  >
                                    <span className="truncate">{file.path}</span>
                                    <span className={`font-mono text-[9px] ${file.status < 400 ? 'text-emerald-400' : 'text-gemini-textDim'}`}>
                                      {file.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Main Markdown Content */}
              <div className={`prose-gemini break-words ${isStreaming && !response && !thinking ? 'streaming-cursor' : ''}`}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeString = String(children).replace(/\n$/, '');
                      if (!inline) {
                        return (
                          <CodeBlock
                            language={match ? match[1] : ''}
                            code={codeString}
                          />
                        );
                      }
                      return (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    }
                  }}
                >
                  {response || (thinking && !isThinkingOpen ? '' : message.content)}
                </ReactMarkdown>

                {isStreaming && response && (
                  <span className="streaming-cursor"></span>
                )}
              </div>

              {/* Grounded Resource Sources & Web Citations */}
              {!isUser && message.sources && message.sources.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-gemini-border/40 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-gemini-textDim font-mono text-[10px] uppercase tracking-wider mr-1">Sources:</span>
                  {message.sources.map((src, idx) => {
                    if (src.type === 'web' || src.url) {
                      return (
                        <a
                          key={idx}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={src.title || src.url}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-gemini-surface hover:bg-gemini-hover border border-gemini-border text-gemini-blueLight hover:text-white text-[11px] font-mono transition-colors"
                        >
                          <Globe className="w-3 h-3" />
                          <span className="truncate max-w-[170px]">{src.title || src.url}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </a>
                      );
                    }
                    return (
                      <span
                        key={idx}
                        title={src.path}
                        className="px-2 py-0.5 rounded bg-gemini-surface border border-gemini-border text-gemini-text text-[11px] font-mono select-all"
                      >
                        {src.file}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Stats Footer & Actions for Assistant */}
              {!isUser && (
                <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-2 text-xs text-gemini-textMuted">
                  {/* Generation metrics */}
                  {message.stats ? (
                    <div className="flex items-center gap-2 font-mono text-[11px] text-gemini-textDim">
                      {message.stats.tokensPerSecond > 0 && (
                        <span className="text-gemini-blueLight">
                          {message.stats.tokensPerSecond} t/s
                        </span>
                      )}
                      {message.stats.evalCount > 0 && (
                        <span>• {message.stats.evalCount} tokens</span>
                      )}
                      {message.stats.totalDuration && (
                        <span>• {message.stats.totalDuration}s</span>
                      )}
                    </div>
                  ) : <div />}

                  {/* Regenerate button */}
                  {onRegenerate && !isStreaming && (
                    <button
                      onClick={onRegenerate}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-gemini-hover text-gemini-textMuted hover:text-white transition-colors"
                      title="Regenerate this response"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Regenerate</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
