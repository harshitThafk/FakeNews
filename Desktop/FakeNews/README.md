# VeritAI — Fake News Detector
### MERN + MLOps | RAG | Agentic AI | Real-time Pipeline

```
User Input (Text / URL)
        ↓
Frontend (React + Recharts)
        ↓
Backend (Node/Express API)
        ↓
─────────────────────────────────────────────────
│ 1. Input Processor  (text | URL scraper)      │
│ 2. ML Classifier    (TF-IDF + LogReg)         │
│ 3. Live Search      (SerpAPI / NewsAPI)        │
│ 4. RAG Pipeline     (SentenceTransformers      │
│                      + FAISS vector store)     │
│ 5. Agentic Reasoner (multi-step synthesis      │
│                      + optional GPT-3.5)       │
─────────────────────────────────────────────────
        ↓
Verdict + Confidence + Sources + Explanation
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | React 18, React Router, Recharts, Framer Motion |
| **Backend** | Node.js, Express, MongoDB + Mongoose |
| **ML Service** | Python 3.11, FastAPI, Uvicorn |
| **ML Model** | TF-IDF + Logistic Regression (scikit-learn) |
| **RAG** | SentenceTransformers (`all-MiniLM-L6-v2`) + FAISS |
| **Agent** | Rule-based multi-step + optional OpenAI GPT-3.5 |
| **Search** | SerpAPI (Google News) / NewsAPI |
| **DevOps** | Docker, Docker Compose |

---

## Project Structure

```
fakenews/
├── backend/                  # Node/Express API
│   ├── server.js
│   ├── controllers/
│   │   └── checkController.js   ← orchestrates pipeline
│   ├── models/
│   │   └── Check.js             ← MongoDB schema
│   ├── routes/
│   │   ├── check.js
│   │   ├── history.js
│   │   └── stats.js
│   └── services/
│       ├── scraper.js           ← URL → text
│       └── search.js            ← SerpAPI / NewsAPI
│
├── frontend/                 # React app
│   └── src/
│       ├── App.js
│       ├── pages/
│       │   ├── HomePage.js      ← main input + results
│       │   ├── HistoryPage.js
│       │   └── DashboardPage.js ← charts + architecture
│       ├── components/
│       │   ├── Layout.js
│       │   ├── VerdictCard.js   ← result display
│       │   └── PipelineProgress.js
│       └── utils/api.js
│
├── ml_service/               # Python FastAPI
│   ├── main.py               ← FastAPI app
│   ├── models/
│   │   └── classifier.py     ← TF-IDF + LogReg
│   ├── rag/
│   │   └── pipeline.py       ← embedding + FAISS
│   ├── agent/
│   │   └── reasoner.py       ← agentic reasoning
│   └── train_model.py        ← training script
│
└── docker-compose.yml
```

---

## Quick Start

### Option A — Docker (Recommended)

```bash
# 1. Clone and configure
cp backend/.env.example backend/.env
# Fill in API keys in .env

# 2. Start all services
docker-compose up --build

# App runs at:
# Frontend:   http://localhost:3000
# Backend:    http://localhost:5000
# ML Service: http://localhost:8000
```

### Option B — Manual (Development)

**MongoDB**
```bash
# Install and start MongoDB locally
mongod --dbpath ./data/db
```

**ML Service (Python)**
```bash
cd ml_service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Backend (Node)**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your values
npm run dev
```

**Frontend (React)**
```bash
cd frontend
npm install
cp .env.example .env
npm start
```

---

## Environment Variables

### `backend/.env`
```env
PORT=5000
FRONTEND_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/fakenews
ML_SERVICE_URL=http://localhost:8000

# Get free key at serpapi.com (100 searches/month free)
SERPAPI_KEY=your_key

# Get free key at newsapi.org (1000 req/day free)
NEWSAPI_KEY=your_key

# Optional: enables GPT-3.5 enhanced agent reasoning
OPENAI_API_KEY=your_key
```

---

## Training with Real Data

### FakeNewsAMT Dataset (Recommended)
```bash
# 1. Download from Kaggle:
# https://www.kaggle.com/datasets/pietzhuber/fake-news-amt
# Place fake.csv and real.csv in ml_service/data/

cd ml_service
python train_model.py --dataset fakenewsamt
```

### Custom Dataset
```bash
python train_model.py \
  --dataset custom \
  --file your_data.csv \
  --text-col article_text \
  --label-col is_fake
```

The trained model is auto-saved to `ml_service/models/saved_model.pkl`
and loaded on next startup — no code changes needed (MLOps pattern).

---

## API Reference

### `POST /api/check`
Submit text or URL for analysis.

**Request:**
```json
{ "text": "Article text here..." }
// OR
{ "url": "https://example.com/article" }
```

**Response (immediate):**
```json
{ "id": "uuid", "status": "processing" }
```

### `GET /api/check/:id`
Poll for result.

**Response (completed):**
```json
{
  "finalVerdict": "FAKE",
  "confidenceScore": 87,
  "explanation": "ML model flagged as fake...",
  "mlPrediction": "fake",
  "mlConfidence": 0.89,
  "sources": [...],
  "ragChunks": [...],
  "processingTimeMs": 3200
}
```

### `GET /api/history` — last 20 checks
### `GET /api/stats` — aggregate statistics
### `DELETE /api/history/:id`

---

## ML Service Endpoints

### `POST /predict`
```json
{ "text": "Article text" }
→ { "prediction": "fake", "confidence": 0.87, "features": {...} }
```

### `POST /agent`
```json
{
  "text": "...",
  "ml_prediction": { "prediction": "fake", "confidence": 0.87 },
  "search_results": [...]
}
→ { "final_verdict": "FAKE", "confidence_score": 85, "explanation": "...", ... }
```

---

## How It Works

### 1. Input Processing
- **Text**: sent directly to ML model
- **URL**: scraped with Cheerio (Node) — extracts article body, strips ads/nav

### 2. ML Classification
- TF-IDF vectorizer (15k features, trigrams, sublinear TF)
- Logistic Regression with class balancing
- Returns: `fake/real/uncertain` + probability score
- Falls back to keyword heuristics if model not loaded

### 3. Live Search
- Queries SerpAPI or NewsAPI with first 150 chars of input
- Gets top 5 articles with title, snippet, source
- Scores source credibility (Reuters/BBC = high, InfoWars = low)

### 4. RAG Pipeline
- Search result snippets → sentence embeddings (`all-MiniLM-L6-v2`)
- Stored in FAISS `IndexFlatIP` (cosine similarity)
- Query against index → retrieve top-5 most relevant chunks
- Falls back to TF-IDF similarity if FAISS unavailable

### 5. Agentic Reasoning
Multi-step synthesis combining:
- ML signal (weight: 40%)
- Source corroboration (weight: 30%)
- RAG evidence quality (weight: 30%)

Scoring:
- `score ≤ -40` → **FAKE**
- `score ≤ -15` → **LIKELY FAKE**
- `score ≥ 35` → **REAL**
- `score ≥ 15` → **LIKELY REAL**
- otherwise → **UNCERTAIN**

Optional: set `OPENAI_API_KEY` to use GPT-3.5 for richer explanations.

---

## MLOps Notes

- **Model persistence**: Trained model serialized with joblib, loaded on startup
- **Auto-train**: If no saved model found, trains on synthetic data automatically
- **Retrain**: Run `train_model.py` → restart ML service → model reloads
- **RAG is ephemeral**: Re-indexed per request using live search results
- **Graceful degradation**: Every component has fallbacks — app works even without APIs

---

## Limitations & Improvements

| Current | Upgrade Path |
|---------|--------------|
| TF-IDF + LogReg | Fine-tune BERT/RoBERTa on FakeNewsAMT |
| Synthetic training data | Use real FakeNewsAMT / LIAR dataset |
| Rule-based agent | LangChain ReAct agent with tool use |
| No auth | Add JWT + user accounts |
| Single-node | Kubernetes + model serving (Triton) |
