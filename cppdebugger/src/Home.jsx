import React, { useState, useEffect } from "react";
// At the very top of Home.jsx, right below your imports
const API_BASE = import.meta.env.PROD 
    ? 'https://multi-agent-cppdebugger.onrender.com'  
    : '';                                             

export default function Home() {
    
    const [code, setCode] = useState("");
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
    try {
        const res = await fetch(`${API_BASE}/api/Debug/history/`, {
            credentials: "include",
        });

        // 💡 1. Stop if the server sends a 401 or any other error
        if (!res.ok) {
            throw new Error(`Server returned status ${res.status}`);
        }

        const data = await res.json();
        
        // 💡 2. Only save the data if it is actually a valid list/array
        if (Array.isArray(data)) {
            setHistory(data);
        } else {
            console.error("Expected a list from server, but got:", data);
            setHistory([]); // Keep it safe as an empty list
        }
    } catch (err) {
        console.error("Failed to fetch history:", err);
        setHistory([]); // Prevent app crash by resetting to an empty list on failure
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
                    const errorText = await res.text(); // Read the error as plain text/HTML
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

    return (
        <>
            <h1>Welcome to Cpp Debugger</h1>
            <h2>Write/Paste ur code</h2>
            <textarea
                name="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={15}
                cols={60}
            />
            <br />
            <button type="button" onClick={handleCheck} disabled={loading}>
                {loading ? "Checking..." : "Check"}
            </button>

            {result && (
                <div>
                    <h3>Result</h3>
                    <p>Compiles: {result.compiles ? "Yes" : "No"}</p>
                    {result.compiler_errors && result.compiler_errors.length > 0 && (
                        <ul>
                            {result.compiler_errors.map((err, i) => (
                                <li key={i}>Line {err.line}: {err.message}</li>
                            ))}
                        </ul>
                    )}
                    {result.corrected_code && (
                        <pre>{result.corrected_code}</pre>
                    )}
                </div>
            )}

            <h3>Last 3 submissions</h3>
            <ul>
                {history.map((item, i) => (
                    <li key={i}>
                        <pre>{item.code}</pre>
                    </li>
                ))}
            </ul>
        </>
    );
}
