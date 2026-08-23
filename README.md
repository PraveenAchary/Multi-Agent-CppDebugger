"# Multi-Agent-CppDebugger" 

### 👥 The Agents

* **Agent A (The Diagnostician):** Runs the code through a sandboxed binary compilation check using `g++` and structural code linting with `cppcheck`. It parses standard error (`stderr`) streams into highly accurate diagnostic JSON vectors (line, column, severity, message).
* **Agent B (The Software Engineer):** Consumes the current code along with Agent A's structural JSON diagnostics. It calls LLM inference models (Groq) to surgically repair syntax blunders, pointer mismatches, and memory leaks.
* **Agent C (The Gatekeeper):** Runs an isolated binary compile check via `g++` on Agent B's generated code. If compilation fails, it increments the execution loop step counter and routes back to Agent A for re-evaluation.

---

## 🚀 Technical Stack Layout

### Backend Core (`/backend`)

* **Django & DRF:** High-performance RESTful API endpoints handling state verification, response packaging, and routing.
* **LangGraph:** Manages the cyclic execution graph, handles operational node processing, and handles state mutations across the pipeline.
* **Subprocess Sandbox:** Executes isolated local compiler instructions natively and safely.

### Frontend Dashboard (`/cppdebugger`)

* **React (Vite):** A premium, IDE-inspired dashboard with a dark, blush-accented theme — a real code-editor pane with tabs and synced line numbers, a live "engine online" status indicator, syntax-styled diagnostics with per-line error tags, a one-click copy on suggested fixes, and a running log of recent submissions.
* **React Router DOM:** Client-side view/layout navigation.

---

## 🛠️ Local Development & Setup

### Prerequisites

1. **Python 3.10+**
2. **Node.js & npm**
3. **GCC/G++ Compiler** — on Windows, install via MSYS2 and add `C:\msys64\ucrt64\bin` to your system **Path** environment variable (place it at the very top of the list).

### 1. Setting up the Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file inside the `backend/` directory:

```env
SECRET_KEY=your_django_production_secret_key_here
GROQ_API_KEY=your_private_groq_api_token_here
```

Run database migrations and boot the server:

```bash
python manage.py migrate
python manage.py runserver
```

The server will start listening at `http://127.0.0.1:8000`.

### 2. Setting up the Frontend

```bash
cd ../cppdebugger
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 🌐 Production Deployments

* **Frontend Interface:** Compiled static production chunks are deployed to **Vercel** (`https://vercel.app`).
* **Orchestration Backend:** Live Python WSGI pipelines run within a **Render** Web Service environment container (`https://onrender.com`).

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
