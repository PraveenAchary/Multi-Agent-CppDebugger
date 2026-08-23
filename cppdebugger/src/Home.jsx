import React, { useState, useEffect, useRef } from "react";

// At the very top of Home.jsx, right below your imports
const API_BASE = import.meta.env.PROD
  ? "https://multi-agent-cppdebugger.onrender.com"
  : "";

export default function Home() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState(false);

  const textareaRef = useRef(null);
  const lineNumsRef = useRef(null);

  useEffect(() => {
    fetchHistory();
    injectFonts();
  }, []);

  const injectFonts = () => {
    if (document.getElementById("cppdbg-fonts")) return;
    const link = document.createElement("link");
    link.id = "cppdbg-fonts";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap";
    document.head.appendChild(link);
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/Debug/history/`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();

      if (Array.isArray(data)) {
        setHistory(data);
      } else {
        console.error("Expected a list from server, but got:", data);
        setHistory([]);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
      setHistory([]);
    }
  };

  const handleCheck = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/Debug/analyze/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server returned status ${res.status}: ${errorText}`);
      }
      const data = await res.json();
      setResult(data);
      fetchHistory();
    } catch (err) {
      console.error("Analyze request failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyFixed = async () => {
    if (!result?.corrected_code) return;
    try {
      await navigator.clipboard.writeText(result.corrected_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  const handleScrollSync = () => {
    if (lineNumsRef.current && textareaRef.current) {
      lineNumsRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const lineCount = Math.max(code.split("\n").length, 1);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className="cppdbg-root">
      <style>{CSS}</style>

      {/* ambient glow orbs */}
      <div className="glow-orb glow-orb--one" />
      <div className="glow-orb glow-orb--two" />

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">{"</>"}</span>
          <div className="brand-text">
            <span className="brand-name">cpp<em>::</em>debugger</span>
            <span className="brand-sub">AI-assisted static analysis</span>
          </div>
        </div>
        <div className="status-pill">
          <span className="status-dot" />
          Engine online
        </div>
      </header>

      <main className="layout">
        {/* ============ EDITOR PANEL ============ */}
        <section className="panel editor-panel">
          <div className="panel-glowline" />
          <div className="tabbar">
            <div className="tab tab--active">
              <span className="tab-dot" />
              main.cpp
            </div>
            <div className="tabbar-meta">C++17</div>
          </div>

          <div className="editor-body">
            <div className="linenums" ref={lineNumsRef}>
              {lineNumbers.map((n) => (
                <div key={n} className="linenum">
                  {n}
                </div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              className="code-input"
              name="code"
              spellCheck={false}
              placeholder={`#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // paste or write your C++ code here\n    return 0;\n}`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onScroll={handleScrollSync}
            />
          </div>

          <div className="editor-footer">
            <div className="footer-meta">
              <span>{lineCount} lines</span>
              <span className="footer-sep">·</span>
              <span>{code.length} chars</span>
            </div>
            <button
              type="button"
              className="run-btn"
              onClick={handleCheck}
              disabled={loading || !code.trim()}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Analyzing
                </>
              ) : (
                <>
                  <span className="run-icon">▶</span>
                  Run Check
                </>
              )}
            </button>
          </div>
        </section>

        {/* ============ RESULTS + HISTORY PANEL ============ */}
        <aside className="side-col">
          <section className="panel result-panel">
            <div className="panel-header">
              <h3>Result</h3>
              {result && (
                <span
                  className={
                    "verdict " + (result.compiles ? "verdict--ok" : "verdict--err")
                  }
                >
                  <span className="verdict-dot" />
                  {result.compiles ? "Compiles" : "Failed"}
                </span>
              )}
            </div>

            {!result && !loading && (
              <div className="empty-state">
                <div className="empty-glyph">{"{ }"}</div>
                <p>Run a check to see compiler diagnostics and fixes here.</p>
              </div>
            )}

            {loading && (
              <div className="empty-state">
                <span className="spinner spinner--lg" />
                <p>Compiling and analyzing your code…</p>
              </div>
            )}

            {result && (
              <div className="result-body">
                {result.compiler_errors && result.compiler_errors.length > 0 && (
                  <div className="errors-block">
                    <div className="block-label">Compiler diagnostics</div>
                    <ul className="error-list">
                      {result.compiler_errors.map((err, i) => (
                        <li key={i} className="error-item">
                          <span className="error-line">L{err.line}</span>
                          <span className="error-msg">{err.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.corrected_code && (
                  <div className="fixed-block">
                    <div className="block-label-row">
                      <div className="block-label">Suggested fix</div>
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={handleCopyFixed}
                      >
                        {copied ? "Copied ✓" : "Copy"}
                      </button>
                    </div>
                    <pre className="fixed-code">{result.corrected_code}</pre>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="panel history-panel">
            <div className="panel-header">
              <h3>Recent submissions</h3>
              <span className="count-badge">{history.length}</span>
            </div>

            {history.length === 0 ? (
              <div className="empty-state empty-state--small">
                <p>No submissions yet.</p>
              </div>
            ) : (
              <ul className="history-list">
                {history.slice(0, 3).map((item, i) => (
                  <li key={i} className="history-item">
                    <div className="history-item-head">
                      <span className="history-index">#{i + 1}</span>
                    </div>
                    <pre className="history-code">{item.code}</pre>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}

const CSS = `
:root {
  --bg-0: #0d0710;
  --bg-1: #150e1c;
  --bg-2: #1c1424;
  --bg-3: #241a2d;
  --border: rgba(240, 200, 220, 0.10);
  --border-strong: rgba(240, 200, 220, 0.20);
  --text-hi: #f3e9ee;
  --text-mid: #c9bcc9;
  --text-low: #8d7f8f;
  --blush: #f0a6c4;
  --blush-strong: #ff8bb5;
  --violet: #b98cf0;
  --mono: #57e3b0;
  --danger: #ff6b81;
  --font-display: 'Space Grotesk', 'Segoe UI', sans-serif;
  --font-body: 'Inter', 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}

* { box-sizing: border-box; }

.cppdbg-root {
  position: relative;
  min-height: 100vh;
  width: 100%;
  background:
    radial-gradient(ellipse 80% 60% at 15% -10%, rgba(240,166,196,0.09), transparent 60%),
    radial-gradient(ellipse 70% 50% at 100% 0%, rgba(185,140,240,0.08), transparent 55%),
    var(--bg-0);
  font-family: var(--font-body);
  color: var(--text-hi);
  padding: 28px clamp(16px, 4vw, 56px) 60px;
  overflow-x: hidden;
}

.glow-orb {
  position: fixed;
  border-radius: 50%;
  filter: blur(90px);
  pointer-events: none;
  z-index: 0;
  opacity: 0.35;
}
.glow-orb--one {
  width: 380px; height: 380px;
  top: -120px; left: -100px;
  background: radial-gradient(circle, var(--blush-strong), transparent 70%);
}
.glow-orb--two {
  width: 420px; height: 420px;
  bottom: -160px; right: -120px;
  background: radial-gradient(circle, var(--violet), transparent 70%);
}

.topbar {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
}

.brand { display: flex; align-items: center; gap: 12px; }
.brand-mark {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 20px;
  color: var(--bg-0);
  background: linear-gradient(135deg, var(--blush), var(--violet));
  padding: 8px 10px;
  border-radius: 10px;
  box-shadow: 0 0 24px rgba(240,166,196,0.35);
}
.brand-text { display: flex; flex-direction: column; line-height: 1.25; }
.brand-name {
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.brand-name em { color: var(--blush); font-style: normal; }
.brand-sub { font-size: 12px; color: var(--text-low); }

.status-pill {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 500; color: var(--text-mid);
  background: var(--bg-2);
  border: 1px solid var(--border);
  padding: 7px 14px;
  border-radius: 100px;
}
.status-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--mono);
  box-shadow: 0 0 8px 2px rgba(87,227,176,0.6);
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(0.85); }
}

.layout {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 22px;
  align-items: start;
}
@media (max-width: 920px) {
  .layout { grid-template-columns: 1fr; }
}

.panel {
  position: relative;
  background: linear-gradient(180deg, var(--bg-2), var(--bg-1));
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 50px -20px rgba(0,0,0,0.6);
}

.editor-panel { display: flex; flex-direction: column; }
.panel-glowline {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--blush), var(--violet), transparent);
  opacity: 0.8;
}

.tabbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: rgba(255,255,255,0.015);
}
.tab {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-mid);
  padding: 6px 12px;
  border-radius: 8px;
}
.tab--active {
  color: var(--text-hi);
  background: var(--bg-3);
  border: 1px solid var(--border-strong);
}
.tab-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--blush);
  box-shadow: 0 0 6px rgba(240,166,196,0.8);
}
.tabbar-meta {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-low);
  border: 1px solid var(--border);
  padding: 3px 9px;
  border-radius: 6px;
}

.editor-body {
  display: flex;
  height: 420px;
}
.linenums {
  width: 48px;
  flex-shrink: 0;
  overflow: hidden;
  padding: 16px 0;
  text-align: right;
  background: rgba(0,0,0,0.15);
  border-right: 1px solid var(--border);
}
.linenum {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-low);
  padding-right: 12px;
}
.code-input {
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-hi);
  font-family: var(--font-mono);
  font-size: 13.5px;
  line-height: 1.6;
  padding: 16px;
  caret-color: var(--blush-strong);
}
.code-input::placeholder { color: var(--text-low); opacity: 0.7; }
.code-input:focus { box-shadow: inset 0 0 0 1px rgba(240,166,196,0.25); }

.editor-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  background: rgba(255,255,255,0.015);
}
.footer-meta {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-low);
  display: flex; gap: 8px;
}
.footer-sep { opacity: 0.5; }

.run-btn {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 13.5px;
  color: #1a0f16;
  background: linear-gradient(135deg, var(--blush-strong), var(--violet));
  border: none;
  padding: 10px 20px;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.08) inset, 0 8px 24px -8px rgba(255,139,181,0.6);
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}
.run-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.1) inset, 0 10px 30px -6px rgba(255,139,181,0.75);
}
.run-btn:active:not(:disabled) { transform: translateY(0); }
.run-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.run-icon { font-size: 11px; }

.spinner {
  width: 13px; height: 13px;
  border-radius: 50%;
  border: 2px solid rgba(26,15,22,0.3);
  border-top-color: #1a0f16;
  animation: spin 0.7s linear infinite;
}
.spinner--lg {
  width: 22px; height: 22px;
  border: 3px solid rgba(240,166,196,0.2);
  border-top-color: var(--blush);
  margin-bottom: 10px;
}
@keyframes spin { to { transform: rotate(360deg); } }

.side-col { display: flex; flex-direction: column; gap: 22px; }

.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
}
.panel-header h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--text-hi);
}

.verdict {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600;
  padding: 5px 11px;
  border-radius: 100px;
}
.verdict--ok { color: var(--mono); background: rgba(87,227,176,0.1); border: 1px solid rgba(87,227,176,0.3); }
.verdict--err { color: var(--danger); background: rgba(255,107,129,0.1); border: 1px solid rgba(255,107,129,0.3); }
.verdict-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; box-shadow: 0 0 6px currentColor; }

.count-badge {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-low);
  background: var(--bg-3);
  border: 1px solid var(--border);
  padding: 2px 8px;
  border-radius: 100px;
}

.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center;
  padding: 40px 24px;
  color: var(--text-low);
}
.empty-state--small { padding: 22px 18px; }
.empty-glyph {
  font-family: var(--font-mono);
  font-size: 22px;
  color: var(--text-low);
  margin-bottom: 8px;
  opacity: 0.6;
}
.empty-state p { margin: 0; font-size: 13px; max-width: 220px; line-height: 1.5; }

.result-body { padding: 16px 18px 20px; display: flex; flex-direction: column; gap: 18px; }

.block-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-low);
  margin-bottom: 10px;
}
.block-label-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.block-label-row .block-label { margin-bottom: 0; }

.error-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.error-item {
  display: flex; gap: 10px; align-items: flex-start;
  background: rgba(255,107,129,0.06);
  border: 1px solid rgba(255,107,129,0.18);
  border-radius: 8px;
  padding: 8px 10px;
}
.error-line {
  font-family: var(--font-mono);
  font-size: 11.5px;
  font-weight: 700;
  color: var(--danger);
  background: rgba(255,107,129,0.15);
  padding: 1px 7px;
  border-radius: 5px;
  flex-shrink: 0;
}
.error-msg { font-size: 12.5px; color: var(--text-mid); line-height: 1.5; }

.copy-btn {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-mid);
  background: var(--bg-3);
  border: 1px solid var(--border-strong);
  padding: 4px 10px;
  border-radius: 7px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.copy-btn:hover { color: var(--blush); border-color: var(--blush); }

.fixed-code {
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--text-hi);
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  margin: 0;
  max-height: 260px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.history-list { list-style: none; margin: 0; padding: 12px 18px 18px; display: flex; flex-direction: column; gap: 10px; }
.history-item {
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  transition: border-color 0.15s ease;
}
.history-item:hover { border-color: var(--border-strong); }
.history-item-head { margin-bottom: 6px; }
.history-index {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 700;
  color: var(--violet);
}
.history-code {
  font-family: var(--font-mono);
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-mid);
  margin: 0;
  max-height: 90px;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
}

.editor-body::-webkit-scrollbar,
.fixed-code::-webkit-scrollbar,
.history-code::-webkit-scrollbar {
  width: 8px;
}
.editor-body ::-webkit-scrollbar-thumb,
.fixed-code::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: 8px;
}
`;
