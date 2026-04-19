import { useState, useRef, useEffect, useCallback, type ReactElement } from 'react';
import { IconSparkles, IconX, IconSend, IconPaperclip, IconLoader2, IconCopy, IconCheck, IconFileTypePdf, IconFileSpreadsheet, IconMaximize, IconMinimize } from '@tabler/icons-react';
import { fileToDataUri } from '@/lib/ai';
import { useActions } from '@/context/ActionsContext';

// ---------------------------------------------------------------------------
// Lightweight Markdown renderer (no external deps)
// Supports: code blocks, inline code, bold, italic, headers, lists, links, auto-linked URLs
// ---------------------------------------------------------------------------

const URL_RE = /(https?:\/\/[^\s<>"'`)\]]+)/g;

function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all">{part}</a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function renderInline(text: string) {
  // Bold, italic, inline code, images, links — applied left-to-right
  const tokens: Array<{ type: string; text: string; href?: string }> = [];
  // Regex order: code, bold, italic, md-image, md-link (image must come before link)
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(!\[[^\]]*\]\([^)]+\))|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', text: text.slice(last, m.index) });
    const raw = m[0];
    if (m[1]) tokens.push({ type: 'code', text: raw.slice(1, -1) });
    else if (m[2]) tokens.push({ type: 'bold', text: raw.slice(2, -2) });
    else if (m[3]) tokens.push({ type: 'italic', text: raw.slice(1, -1) });
    else if (m[4]) {
      const im = raw.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      if (im) tokens.push({ type: 'image', text: im[1], href: im[2] });
    }
    else if (m[5]) {
      const lm = raw.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (lm) tokens.push({ type: 'link', text: lm[1], href: lm[2] });
    }
    last = m.index + raw.length;
  }
  if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) });

  return tokens.map((t, i) => {
    switch (t.type) {
      case 'code': return <code key={i} className="bg-black/5 rounded px-1 py-0.5 text-[0.85em] font-mono">{t.text}</code>;
      case 'bold': return <strong key={i}><Linkify text={t.text} /></strong>;
      case 'italic': return <em key={i}><Linkify text={t.text} /></em>;
      case 'image': {
        const safe = t.href && /^(https?:|data:image\/)/i.test(t.href);
        return safe ? (
          <a key={i} href={t.href} target="_blank" rel="noopener noreferrer">
            <img src={t.href} alt={t.text} className="max-w-full max-h-48 rounded-lg my-1.5 inline-block" loading="lazy" />
          </a>
        ) : <span key={i}>{t.text}</span>;
      }
      case 'link': return <a key={i} href={t.href} target="_blank" rel="noopener noreferrer" className="underline">{t.text}</a>;
      default: return <Linkify key={i} text={t.text} />;
    }
  });
}

// ---------------------------------------------------------------------------
// JSON → structured UI renderer
// ---------------------------------------------------------------------------

function tryParseJson(text: string): unknown | undefined {
  const trimmed = text.trim();
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return undefined;
  try { return JSON.parse(trimmed); } catch { return undefined; }
}

function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null) return <span className="text-muted-foreground italic">null</span>;
  if (typeof value === 'boolean') return <span className="text-primary font-medium">{value ? 'true' : 'false'}</span>;
  if (typeof value === 'number') return <span className="font-medium">{value}</span>;
  if (typeof value === 'string') {
    URL_RE.lastIndex = 0;
    if (URL_RE.test(value)) { URL_RE.lastIndex = 0; return <a href={value.match(URL_RE)![0]} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{value}</a>; }
    return <span className="break-words">{value}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground italic">[]</span>;
    // Array of primitives: inline comma-separated
    if (value.every(v => v === null || typeof v !== 'object')) {
      return <span className="flex flex-wrap gap-1">{value.map((v, i) => <span key={i} className="inline-flex items-center bg-black/5 rounded px-1.5 py-0.5 text-[0.9em]"><JsonValue value={v} depth={depth + 1} /></span>)}</span>;
    }
    // Array of objects: render each
    return <div className="space-y-1.5 mt-1">{value.map((v, i) => <div key={i} className="rounded-lg border border-border/40 bg-card p-2"><JsonValue value={v} depth={depth + 1} /></div>)}</div>;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-muted-foreground italic">{'{}'}</span>;
    return (
      <div className={`space-y-1 ${depth > 0 ? '' : ''}`}>
        {entries.map(([k, v]) => {
          const isSimple = v === null || typeof v !== 'object';
          return (
            <div key={k} className={isSimple ? 'flex items-baseline gap-2 min-w-0' : ''}>
              <span className="text-muted-foreground text-[0.85em] font-medium shrink-0">{k}</span>
              {isSimple ? <span className="min-w-0"><JsonValue value={v} depth={depth + 1} /></span> : <div className="mt-0.5 pl-3 border-l-2 border-border/30"><JsonValue value={v} depth={depth + 1} /></div>}
            </div>
          );
        })}
      </div>
    );
  }
  return <span>{String(value)}</span>;
}

function JsonView({ text }: { text: string }) {
  const parsed = tryParseJson(text);
  if (parsed === undefined) {
    // Fallback: not valid JSON, render as code
    return (
      <pre className="my-1.5 p-2.5 rounded-lg bg-black/5 overflow-x-auto text-[0.85em] font-mono leading-relaxed whitespace-pre-wrap break-all">
        <code><Linkify text={text} /></code>
      </pre>
    );
  }
  return (
    <div className="my-1.5 p-2.5 rounded-lg bg-black/5 overflow-x-auto text-[0.9em]">
      <JsonValue value={parsed} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lightweight Python syntax highlighter (no external deps)
// ---------------------------------------------------------------------------

function highlightPython(code: string): React.ReactNode[] {
  const tokens: Array<{ type: string; text: string }> = [];
  const re = /(#[^\n]*)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|"""[\s\S]*?"""|'''[\s\S]*?''')|(@\w+)|\b(def|class|return|if|elif|else|for|while|try|except|finally|with|as|import|from|raise|yield|lambda|and|or|not|in|is|True|False|None|break|continue|pass|async|await|global|nonlocal|del|assert)\b|\b(print|len|range|str|int|float|list|dict|set|tuple|isinstance|type|super|self|cls|enumerate|zip|map|filter|sorted|open|Exception|ValueError|TypeError|KeyError|RuntimeError|StopIteration|property|staticmethod|classmethod|__init__|__name__|__main__)\b|\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) tokens.push({ type: 'plain', text: code.slice(last, m.index) });
    if (m[1]) tokens.push({ type: 'comment', text: m[0] });
    else if (m[2]) tokens.push({ type: 'string', text: m[0] });
    else if (m[3]) tokens.push({ type: 'decorator', text: m[0] });
    else if (m[4]) tokens.push({ type: 'keyword', text: m[0] });
    else if (m[5]) tokens.push({ type: 'builtin', text: m[0] });
    else if (m[6]) tokens.push({ type: 'number', text: m[0] });
    else tokens.push({ type: 'plain', text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < code.length) tokens.push({ type: 'plain', text: code.slice(last) });

  const colorMap: Record<string, string> = {
    comment: 'text-emerald-600',
    string: 'text-amber-600',
    keyword: 'text-purple-600 font-medium',
    builtin: 'text-blue-600',
    number: 'text-orange-600',
    decorator: 'text-rose-600',
    plain: '',
  };

  return tokens.map((t, i) => (
    t.type === 'plain'
      ? <span key={i}>{t.text}</span>
      : <span key={i} className={colorMap[t.type]}>{t.text}</span>
  ));
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
      title={copied ? "Kopiert!" : "Code kopieren"}
    >
      {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
      {copied && <span>Kopiert!</span>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Markdown renderer
// ---------------------------------------------------------------------------

function ChatMarkdown({ content }: { content: string }) {
  // Split into code blocks and text segments
  const segments: Array<{ type: 'code' | 'text'; lang?: string; value: string }> = [];
  const codeRe = /(?:```|~~~)(\w*)\n?([\s\S]*?)(?:```|~~~)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = codeRe.exec(content)) !== null) {
    if (m.index > last) segments.push({ type: 'text', value: content.slice(last, m.index) });
    segments.push({ type: 'code', lang: m[1] || '', value: m[2].replace(/\n$/, '') });
    last = m.index + m[0].length;
  }
  if (last < content.length) segments.push({ type: 'text', value: content.slice(last) });

  return (
    <>
      {segments.map((seg, si) => {
        if (seg.type === 'code') {
          // JSON code blocks → structured UI
          if (seg.lang === 'json' || (!seg.lang && tryParseJson(seg.value) !== undefined)) {
            return <JsonView key={si} text={seg.value} />;
          }
          if (seg.lang === 'python') {
            return (
              <div key={si}>
                <pre className="my-1.5 p-2.5 rounded-lg bg-black/5 overflow-x-auto text-[0.85em] font-mono leading-relaxed whitespace-pre-wrap break-all">
                  <code>{highlightPython(seg.value)}</code>
                </pre>
                <CopyButton text={seg.value} />
              </div>
            );
          }
          return (
            <pre key={si} className="my-1.5 p-2.5 rounded-lg bg-black/5 overflow-x-auto text-[0.85em] font-mono leading-relaxed whitespace-pre-wrap break-all">
              <code><Linkify text={seg.value} /></code>
            </pre>
          );
        }
        // Plain text that is entirely JSON → structured UI
        if (tryParseJson(seg.value) !== undefined) {
          return <JsonView key={si} text={seg.value} />;
        }
        // Text block: parse line-by-line for headers, lists, tables, paragraphs
        const lines = seg.value.split('\n');
        const elements: ReactElement[] = [];
        let listItems: Array<{ ordered: boolean; text: string }> = [];

        const flushList = () => {
          if (listItems.length === 0) return;
          const ordered = listItems[0].ordered;
          const Tag = ordered ? 'ol' : 'ul';
          elements.push(
            <Tag key={`list-${elements.length}`} className={`my-1 pl-4 ${ordered ? 'list-decimal' : 'list-disc'}`}>
              {listItems.map((li, j) => <li key={j}>{renderInline(li.text)}</li>)}
            </Tag>
          );
          listItems = [];
        };

        const parseTableRow = (row: string) =>
          row.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

        const isTableSep = (row: string) =>
          /^\|?[\s-:|]+\|[\s-:|]*\|?$/.test(row) && row.includes('---');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Table: detect header row followed by separator row
          if (i + 1 < lines.length && line.includes('|') && isTableSep(lines[i + 1])) {
            flushList();
            const headers = parseTableRow(line);
            const sepCells = parseTableRow(lines[i + 1]);
            const aligns = sepCells.map(c => c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left');
            i += 1; // skip separator
            const bodyRows: string[][] = [];
            while (i + 1 < lines.length && lines[i + 1].includes('|')) {
              i++;
              bodyRows.push(parseTableRow(lines[i]));
            }
            elements.push(
              <div key={`tbl-${i}`} className="my-1.5 overflow-x-auto">
                <table className="w-full text-[0.85em] border-collapse">
                  <thead>
                    <tr>
                      {headers.map((h, ci) => (
                        <th key={ci} className="border border-border/50 px-2 py-1 font-semibold bg-black/5 text-left" style={{ textAlign: (aligns[ci] || 'left') as any }}>
                          {renderInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bodyRows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="border border-border/50 px-2 py-1" style={{ textAlign: (aligns[ci] || 'left') as any }}>
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
            continue;
          }

          // Headers
          const hm = line.match(/^(#{1,3})\s+(.+)$/);
          if (hm) {
            flushList();
            const level = hm[1].length;
            const cls = level === 1 ? 'font-bold text-base mt-2 mb-1' : level === 2 ? 'font-semibold mt-1.5 mb-0.5' : 'font-semibold text-[0.95em] mt-1 mb-0.5';
            elements.push(<div key={`h-${i}`} className={cls}>{renderInline(hm[2])}</div>);
            continue;
          }
          // Unordered list
          const ulm = line.match(/^[\s]*[-*]\s+(.+)$/);
          if (ulm) { listItems.push({ ordered: false, text: ulm[1] }); continue; }
          // Ordered list
          const olm = line.match(/^[\s]*\d+\.\s+(.+)$/);
          if (olm) { listItems.push({ ordered: true, text: olm[1] }); continue; }
          // Regular line
          flushList();
          if (line.trim() === '') {
            if (i > 0 && i < lines.length - 1) elements.push(<div key={`br-${i}`} className="h-1" />);
          } else {
            elements.push(<div key={`p-${i}`}>{renderInline(line)}</div>);
          }
        }
        flushList();
        return <div key={si}>{elements}</div>;
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// ChatWidget component
// ---------------------------------------------------------------------------

// File type display config — add new non-image types here
const FILE_TYPES: Record<string, { Icon: typeof IconFileTypePdf; label: string; color: string }> = {
  'application/pdf': { Icon: IconFileTypePdf, label: 'PDF', color: 'text-red-500' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { Icon: IconFileSpreadsheet, label: 'Excel', color: 'text-green-600' },
};

function getFileTypeInfo(dataUri: string) {
  for (const [mime, info] of Object.entries(FILE_TYPES)) {
    if (dataUri.startsWith(`data:${mime}`)) return info;
  }
  return null;
}

export default function ChatWidget() {
  const { chatOpen, setChatOpen, messages, chatLoading, sendMessage } = useActions();
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatLoading]);

  useEffect(() => {
    if (chatOpen && inputRef.current) {
      // Delay focus to avoid iOS zoom glitch on panel open
      setTimeout(() => inputRef.current?.focus(), 300);
    }
    if (!chatOpen) setIsFullscreen(false);
  }, [chatOpen]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text && !image) return;

    const userContent = text || ('Bild analysieren');
    sendMessage(userContent, image ?? undefined);
    setInput('');
    setImage(null);
    setFileName(null);
    // Dismiss keyboard on mobile after send
    inputRef.current?.blur();
  }, [input, image, sendMessage]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uri = await fileToDataUri(file);
      setImage(uri);
      setFileName(file.name);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className={`
          fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full shadow-lg
          flex items-center justify-center transition-all duration-200
          ${chatOpen
            ? 'bg-muted text-muted-foreground hover:bg-muted/80'
            : 'bg-primary text-primary-foreground hover:scale-105 hover:shadow-xl'
          }
        `}
        aria-label="Assistent"
      >
        {chatOpen ? <IconX size={18} /> : <IconSparkles size={18} />}
      </button>

      {/* Chat panel */}
      {chatOpen && (
        <div className={`fixed z-50 bg-card shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen
            ? 'inset-0 rounded-none'
            : 'left-0 right-0 bottom-0 top-[40%] rounded-t-2xl sm:inset-auto sm:bottom-20 sm:right-5 sm:left-auto sm:top-auto sm:w-[480px] sm:h-[640px] sm:border sm:border-border sm:rounded-2xl'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <IconSparkles size={12} className="text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground truncate">Assistent</span>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={isFullscreen ? 'Verkleinern' : 'Vollbild'}
              >
                {isFullscreen ? <IconMinimize size={14} /> : <IconMaximize size={14} />}
              </button>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <IconX size={14} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2 text-muted-foreground">
                <IconSparkles size={28} stroke={1.5} />
                <p className="text-xs">Frage stellen oder Bild hochladen...</p>
              </div>
            )}
            {messages.map((m) => (
              m.role === 'assistant' && !m.content ? null :
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted text-foreground rounded-bl-md'
                }`}>
                  {m.image && (() => {
                    const ft = getFileTypeInfo(m.image);
                    return ft ? (
                      <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-black/10">
                        <ft.Icon size={20} />
                        <span className="text-xs font-medium">{ft.label}</span>
                      </div>
                    ) : (
                      <img src={m.image} alt="" className="max-w-full max-h-32 rounded-lg mb-2" />
                    );
                  })()}
                  {m.content === 'In Arbeit...' ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <IconLoader2 size={14} className="animate-spin" />
                      In Arbeit...
                    </span>
                  ) : m.role === 'assistant' ? (
                    <ChatMarkdown content={m.content} />
                  ) : (
                    m.content.split('\n').map((line, j) => (
                      <span key={j}>{line}{j < m.content.split('\n').length - 1 && <br />}</span>
                    ))
                  )}
                </div>
              </div>
            ))}
            {chatLoading && messages.length > 0 && messages[messages.length - 1].content !== 'In Arbeit...' && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].content === '' && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
                  <IconLoader2 size={14} className="animate-spin" />
                  Denkt nach...
                </div>
              </div>
            )}
          </div>

          {/* Attachment preview */}
          {image && (
            <div className="px-4 py-2">
              <div className="relative inline-block">
                {(() => {
                  const ft = getFileTypeInfo(image);
                  return ft ? (
                    <div className="h-16 px-4 rounded-lg border border-border bg-muted flex items-center gap-2">
                      <ft.Icon size={24} className={`${ft.color} shrink-0`} />
                      <span className="text-xs font-medium truncate max-w-[200px]">{fileName || ft.label}</span>
                    </div>
                  ) : (
                    <img src={image} alt="" className="h-16 rounded-lg border border-border" />
                  );
                })()}
                <button
                  onClick={() => { setImage(null); setFileName(null); }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center"
                >
                  <IconX size={10} />
                </button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-2.5 py-2 border-t border-border bg-card safe-area-pb">
            <div className="flex items-end gap-1.5">
              <button
                onClick={() => fileRef.current?.click()}
                className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Datei anhängen"
              >
                <IconPaperclip size={16} />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf,application/pdf,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFile}
                className="hidden"
              />
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Frage stellen oder Bild hochladen..."
                rows={1}
                style={{ fieldSizing: 'content', maxHeight: '4.5rem' } as React.CSSProperties}
                className="flex-1 resize-none bg-muted rounded-xl px-3 py-2 text-base sm:text-sm outline-none border-0 placeholder:text-muted-foreground/60 overflow-y-auto"
              />
              <button
                onClick={handleSend}
                disabled={chatLoading || (!input.trim() && !image)}
                className="shrink-0 p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors"
              >
                <IconSend size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
