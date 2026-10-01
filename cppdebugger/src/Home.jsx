import React, { useState, useEffect, useRef } from "react";
// const API_BASE="https://multi-agent-cppdebugger.onrender.com";

const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://127.0.0.1:8000" 
  : import.meta.env.VITE_API_URL;

function cppHighlight(line) {
  const tokenRegex = /(\/\/.*$|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[A-Za-z_]+|\b(?:alignas|alignof|and|and_eq|asm|auto|bitand|bitor|bool|break|case|catch|char|class|compl|concept|const|consteval|constexpr|constinit|const_cast|continue|co_await|co_return|co_yield|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|false|float|for|friend|goto|if|inline|int|long|mutable|namespace|new|noexcept|not|nullptr|operator|or|private|protected|public|register|reinterpret_cast|requires|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|true|try|typedef|typeid|typename|union|unsigned|using|virtual|void|volatile|wchar_t|while|xor)\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\())/g;
  const parts = [];
  let last = 0;
  let match;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > last) {
      parts.push({ text: line.slice(last, match.index), type: "plain" });
    }
    const value = match[0];
    let type = "plain";
    if (value.startsWith("//") || value.startsWith("/*")) type = "comment";
    else if (value.startsWith('"') || value.startsWith("'")) type = "string";
    else if (value.startsWith("#")) type = "preprocessor";
    else if (/^\d/.test(value)) type = "number";
    else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(value) && tokenRegex.lastIndex <= line.length) {
      const keywords = new Set([
        "alignas","alignof","and","and_eq","asm","auto","bitand","bitor","bool","break","case","catch","char","class","compl","concept","const","consteval","constexpr","constinit","const_cast","continue","co_await","co_return","co_yield","decltype","default","delete","do","double","dynamic_cast","else","enum","explicit","export","extern","false","float","for","friend","goto","if","inline","int","long","mutable","namespace","new","noexcept","not","nullptr","operator","or","private","protected","public","register","reinterpret_cast","requires","return","short","signed","sizeof","static","static_assert","static_cast","struct","switch","template","this","thread_local","throw","true","try","typedef","typeid","typename","union","unsigned","using","virtual","void","volatile","wchar_t","while","xor"
      ]);
      type = keywords.has(value) ? "keyword" : "function";
    }
    parts.push({ text: value, type });
    last = match.index + value.length;
  }

  if (last < line.length) parts.push({ text: line.slice(last), type: "plain" });
  if (!parts.length) parts.push({ text: "", type: "plain" });
  return parts;
}

function HighlightedLine({ line }) {
  return (
    <>
      {cppHighlight(line).map((part, index) => (
        <span key={index} className={`cpp-token cpp-token--${part.type}`}>
          {part.text}
        </span>
      ))}
    </>
  );
}

function buildDiffRows(oldValue, newValue) {
  const oldLines = oldValue.replace(/\r\n/g, "\n").split("\n");
  const newLines = newValue.replace(/\r\n/g, "\n").split("\n");
  const n = oldLines.length;
  const m = newLines.length;

  // Keep the viewer responsive for very large files. For normal source files,
  // this gives a precise line-by-line diff using an LCS table.
  const maxCells = 2500000;
  if (n * m > maxCells) {
    const rows = [];
    const max = Math.max(n, m);
    for (let i = 0; i < max; i += 1) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];
      if (oldLine === newLine) rows.push({ type: "same", oldLine, newLine, oldNo: oldLine === undefined ? null : i + 1, newNo: newLine === undefined ? null : i + 1 });
      else {
        if (oldLine !== undefined) rows.push({ type: "removed", oldLine, newLine: null, oldNo: i + 1, newNo: null });
        if (newLine !== undefined) rows.push({ type: "added", oldLine: null, newLine, oldNo: null, newNo: i + 1 });
      }
    }
    return rows;
  }

  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = oldLines[i] === newLines[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows = [];
  let i = 0;
  let j = 0;
  let oldNo = 1;
  let newNo = 1;

  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      rows.push({ type: "same", oldLine: oldLines[i], newLine: newLines[j], oldNo, newNo });
      i += 1; j += 1; oldNo += 1; newNo += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: "removed", oldLine: oldLines[i], newLine: null, oldNo, newNo: null });
      i += 1; oldNo += 1;
    } else {
      rows.push({ type: "added", oldLine: null, newLine: newLines[j], oldNo: null, newNo });
      j += 1; newNo += 1;
    }
  }
  while (i < n) {
    rows.push({ type: "removed", oldLine: oldLines[i], newLine: null, oldNo, newNo: null });
    i += 1; oldNo += 1;
  }
  while (j < m) {
    rows.push({ type: "added", oldLine: null, newLine: newLines[j], oldNo: null, newNo });
    j += 1; newNo += 1;
  }
  return rows;
}

function CodeDiffViewer({ oldValue = "", newValue = "" }) {
  const rows = buildDiffRows(oldValue, newValue);
  return (
    <div className="custom-diff-viewer">
      <div className="custom-diff-header">
        <div>Original Code</div>
        <div>Corrected Code</div>
      </div>
      <div className="custom-diff-body">
        {rows.map((row, index) => {
          const removed = row.type === "removed";
          const added = row.type === "added";
          return (
            <div className={`diff-row diff-row--${row.type}`} key={`${index}-${row.oldNo}-${row.newNo}`}>
              <div className="diff-side">
                <span className="diff-line-number">{row.oldNo ?? ""}</span>
                <code>{row.oldLine !== null && row.oldLine !== undefined ? <HighlightedLine line={row.oldLine} /> : ""}</code>
              </div>
              <div className="diff-side">
                <span className="diff-line-number">{row.newNo ?? ""}</span>
                <code>{row.newLine !== null && row.newLine !== undefined ? <HighlightedLine line={row.newLine} /> : ""}</code>
              </div>
              <span className={`diff-marker ${removed ? "diff-marker--removed" : added ? "diff-marker--added" : ""}`}>
                {removed ? "−" : added ? "+" : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("editor"); // "editor" or "history"
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

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
      const res = await fetch(`${API_BASE}/api/Debug/history/`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
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
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setResult(data);
      fetchHistory();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedExtensions = [".cpp", ".cc", ".cxx"];
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      alert("Please upload a C++ source file (.cpp, .cc, or .cxx).");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      setCode(typeof e.target.result === "string" ? e.target.result : "");
      setResult(null);
    };

    reader.onerror = () => {
      alert("Could not read the selected file.");
    };

    reader.readAsText(file);
    event.target.value = "";
  };

  const handleDownload = (text, filename = "corrected_code.cpp") => {
    if (typeof text !== "string" || !text.trim()) {
      alert("No corrected code is available to download.");
      return;
    }

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Delay revoking the URL so the browser can start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleCopy = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
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

      <div className="glow-orb glow-orb--one" />
      <div className="glow-orb glow-orb--two" />

      {/* Header with Navigation Switcher */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">{"</>"}</span>
          <div className="brand-text">
            <span className="brand-name">cpp<em>::</em>debugger</span>
            <span className="brand-sub">AI-assisted static analysis</span>
          </div>
        </div>

        <div className="nav-tabs">
          <button 
            type="button"
            className={`nav-tab ${activeTab === "editor" ? "active" : ""}`}
            onClick={() => setActiveTab("editor")}
          >
            Editor
          </button>
          <button 
            type="button"
            className={`nav-tab ${activeTab === "history" ? "active" : ""}`}
            onClick={() => { setActiveTab("history"); fetchHistory(); }}
          >
            History <span className="badge">{history.length}</span>
          </button>
        </div>

        <div className="status-pill">
          <span className="status-dot" />
          Engine online
        </div>
      </header>

      {/* ================= EDITOR VIEW ================= */}
      {activeTab === "editor" && (
        <main className="layout">
          <section className="panel editor-panel">
            <div className="panel-glowline" />
            <div className="tabbar">
              <div className="tab tab--active">
                <span className="tab-dot" />
                main.cpp
              </div>
              <div className="tabbar-tools">
                <label className="upload-btn">
                  Upload C++
                  <input
                    type="file"
                    accept=".cpp,.cc,.cxx"
                    onChange={handleUpload}
                  />
                </label>
                <div className="tabbar-meta">C++17</div>
              </div>
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
                placeholder={`#include <iostream>\nusing namespace std;\n\nint main() {\n    // paste or write your C++ code here\n    return 0;\n}`}
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

          <aside className="side-col">
            <section className="panel result-panel">
              {/* --- In your Editor View panel header --- */}
<div className="panel-header">
  <h3>Result</h3>
  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
    
    {/* Copy and download buttons for the corrected result */}
    {result && result.corrected_code && (
      <div className="result-actions">
        <button
          type="button"
          className="copy-btn"
          onClick={() => handleCopy(result.corrected_code, "editor-result")}
        >
          {copiedId === "editor-result" ? "Copied ✓" : "Copy Fix"}
        </button>
        <button
          type="button"
          className="download-btn"
          onClick={() => handleDownload(result.corrected_code, "corrected_code.cpp")}
        >
          Download .cpp
        </button>
      </div>
    )}
  </div>
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
                        <div className="block-label">Code Diff</div>
                        <div className="diff-legend">
                          <span className="diff-legend-item diff-legend-item--removed">− Removed</span>
                          <span className="diff-legend-item diff-legend-item--added">+ Added</span>
                        </div>
                      </div>

                      <div className="diff-viewer-wrap">
                        <CodeDiffViewer oldValue={code || ""} newValue={result.corrected_code} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </aside>
        </main>
      )}

      {/* ================= HISTORY PAGE VIEW ================= */}
      {activeTab === "history" && (
        <div className="history-page">
          <div className="history-page-header">
            <h2>Submission History</h2>
            <p>Review past code inputs, compilation results, and line-by-line corrected fixes.</p>
          </div>

          {history.length === 0 ? (
            <div className="empty-state panel">
              <div className="empty-glyph">{"{ }"}</div>
              <p>No previous submissions found in this session yet.</p>
            </div>
          ) : (
            <div className="history-grid">
              {history.map((item, index) => (
                <div key={item.id || index} className="history-card">
                  <div className="card-header">
                    <span className="history-time">{item.created_at}</span>
                    <span className={"verdict " + (item.compiles ? "verdict--ok" : "verdict--err")}>
                      <span className="verdict-dot" />
                      {item.compiles ? "Compiles" : "Failed"}
                    </span>
                  </div>

                  <div className="history-diff-header">
                    <div className="box-title">Code Diff</div>
                    <div className="history-actions">
                      {item.corrected_code && (
                        <button type="button" className="copy-btn" onClick={() => handleCopy(item.corrected_code, item.id || index)}>
                          {copiedId === (item.id || index) ? "Copied ✓" : "Copy Fix"}
                        </button>
                      )}
                      {item.corrected_code && (
                        <button type="button" className="download-btn" onClick={() => handleDownload(item.corrected_code, `corrected_code_${item.id || index}.cpp`)}>
                          Download .cpp
                        </button>
                      )}
                    </div>
                  </div>

                  {item.corrected_code ? (
                    <div className="diff-viewer-wrap history-diff-viewer">
                      <CodeDiffViewer oldValue={item.code || ""} newValue={item.corrected_code} />
                    </div>
                  ) : (
                    <pre className="code-block highlighted-fix">// No corrections provided</pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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

/* Nav Switcher Tabs */
.nav-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  padding: 4px;
  border-radius: 100px;
}
.nav-tab {
  background: transparent;
  border: none;
  color: var(--text-mid);
  padding: 6px 16px;
  border-radius: 100px;
  cursor: pointer;
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 13px;
  transition: all 0.2s ease;
}
.nav-tab.active {
  background: var(--bg-3);
  color: var(--text-hi);
  border: 1px solid var(--border-strong);
}
.badge {
  background: var(--blush);
  color: var(--bg-0);
  padding: 1px 6px;
  border-radius: 50px;
  font-size: 11px;
  margin-left: 4px;
  font-family: var(--font-mono);
}

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

.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center;
  padding: 40px 24px;
  color: var(--text-low);
}
.empty-glyph {
  font-family: var(--font-mono);
  font-size: 22px;
  color: var(--text-low);
  margin-bottom: 8px;
  opacity: 0.6;
}
.empty-state p { margin: 0; font-size: 13px; max-width: 260px; line-height: 1.5; }

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

/* History Page Styling */
.history-page {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.history-page-header h2 {
  margin: 0 0 4px 0;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  color: var(--text-hi);
}
.history-page-header p {
  margin: 0;
  font-size: 13.5px;
  color: var(--text-low);
}
.history-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.history-card {
  background: linear-gradient(180deg, var(--bg-2), var(--bg-1));
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 20px 50px -20px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.history-time {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-low);
}
.code-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 900px) {
  .code-comparison { grid-template-columns: 1fr; }
}
.code-box {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
}
.box-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-low);
  margin-bottom: 10px;
}
.box-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.box-title-row .box-title { margin-bottom: 0; }
.code-block {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-mid);
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  margin: 0;
  max-height: 280px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.highlighted-fix {
  color: var(--text-hi);
}
.tabbar-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-mid);
  background: var(--bg-3);
  border: 1px solid var(--border-strong);
  padding: 6px 11px;
  border-radius: 7px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.upload-btn:hover {
  color: var(--blush);
  border-color: var(--blush);
  background: var(--bg-2);
}

.upload-btn input {
  display: none;
}

.result-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.download-btn {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-mid);
  background: var(--bg-3);
  border: 1px solid var(--border-strong);
  padding: 4px 10px;
  border-radius: 7px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.download-btn:hover {
  color: var(--mono);
  border-color: var(--mono);
  background: var(--bg-2);
}


.custom-diff-viewer {
  width: 100%;
  max-height: 520px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #100b15;
  color: var(--text-hi);
}
.custom-diff-header {
  position: sticky;
  top: 0;
  z-index: 3;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  padding: 0;
  background: #1c1424;
  border-bottom: 1px solid var(--border-strong);
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-hi);
}
.custom-diff-header > div { padding: 9px 12px; }
.custom-diff-header > div:first-child { border-right: 1px solid var(--border); }
.custom-diff-body { min-width: 760px; }
.diff-row {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  min-height: 23px;
  background: rgba(255,255,255,0.025);
  border-bottom: 1px solid rgba(255,255,255,0.025);
}
.diff-side {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  align-items: stretch;
  min-width: 0;
  background: #120d18;
}
.diff-side code {
  display: block;
  min-width: 0;
  padding: 2px 10px;
  white-space: pre;
  overflow: visible;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  color: #f3e9ee;
}
.diff-line-number {
  display: block;
  padding: 2px 9px 2px 6px;
  text-align: right;
  user-select: none;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.75;
  color: #756a78;
  background: #18111f;
  border-right: 1px solid rgba(255,255,255,0.05);
}
.diff-row--removed .diff-side:first-child { background: rgba(231, 76, 60, 0.28); }
.diff-row--removed .diff-side:first-child .diff-line-number { background: rgba(231, 76, 60, 0.42); color: #ffd6d1; }
.diff-row--added .diff-side:last-child { background: rgba(46, 204, 113, 0.28); }
.diff-row--added .diff-side:last-child .diff-line-number { background: rgba(46, 204, 113, 0.42); color: #d7ffe8; }
.diff-row--removed .diff-side:last-child,
.diff-row--added .diff-side:first-child { background: #120d18; }
.diff-marker {
  position: absolute;
  top: 3px;
  left: calc(50% - 9px);
  z-index: 2;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  pointer-events: none;
}
.diff-marker--removed { color: #ff8f9e; background: #35141c; }
.diff-marker--added { color: #70efb4; background: #123522; }
.cpp-token--keyword { color: #caa9ff; font-weight: 600; }
.cpp-token--string { color: #9fe3b0; }
.cpp-token--comment { color: #7e7483; font-style: italic; }
.cpp-token--preprocessor { color: #f0a6c4; }
.cpp-token--number { color: #f4c67a; }
.cpp-token--function { color: #8ed5ff; }

.diff-viewer-wrap {
  width: 100%;
  max-height: 520px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #120d18;
}

.diff-viewer-wrap table { width: 100%; }
.diff-viewer-wrap code, .diff-viewer-wrap pre { font-family: var(--font-mono) !important; }
.diff-legend { display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 10px; }
.diff-legend-item { padding: 3px 7px; border-radius: 5px; border: 1px solid transparent; }
.diff-legend-item--removed { color: var(--danger); background: rgba(255,107,129,.08); border-color: rgba(255,107,129,.18); }
.diff-legend-item--added { color: var(--mono); background: rgba(87,227,176,.08); border-color: rgba(87,227,176,.18); }
.history-diff-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.history-actions { display: flex; align-items: center; gap: 8px; }
.history-diff-viewer { max-height: 560px; }

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

.editor-body::-webkit-scrollbar,
.fixed-code::-webkit-scrollbar,
.code-block::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.editor-body::-webkit-scrollbar-thumb,
.fixed-code::-webkit-scrollbar-thumb,
.code-block::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: 8px;
}
`;
