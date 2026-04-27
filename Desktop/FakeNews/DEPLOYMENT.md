# 🚀 Deployment Guide - VeritAI Fake News Detector

This guide covers deploying the VeritAI project to Netlify (Frontend) and Render (Backend).

## 📋 Prerequisites

- **Netlify Account**: [https://netlify.com](https://netlify.com)
- **Render Account**: [https://render.com](https://render.com)
- **GitHub Account** with your project repository
- API Keys from:
  - Groq: [https://console.groq.com](https://console.groq.com)
  - SerpAPI: [https://serpapi.com](https://serpapi.com)
  - NewsAPI: [https://newsapi.org](https://newsapi.org)
  - OpenAI: [https://platform.openai.com](https://platform.openai.com) (optional)

---

## **Part 1: Deploy Backend on Render (with Docker)**

### Step 1: Push Project to GitHub

Make sure all files are committed and pushed:

```bash
cd c:\Users\ASUS\Desktop\FakeNews
git add .
git commit -m "Add deployment configuration"
git push origin main
```

### Step 2: Create Render Account & Service

1. Go to [https://render.com](https://render.com)
2. Sign up or log in with GitHub
3. Click **"New +"** → **"Web Service"**
4. Connect your GitHub repository: `https://github.com/harshitThafk/FakeNews.git`
5. Configure the service:

**General Settings:**
- **Name**: `fakenews-backend`
- **Environment**: `Docker`
- **Region**: `Oregon` (or closest to you)
- **Branch**: `main`
- **Root Directory**: (leave empty)

**Build & Deploy:**
- **Dockerfile Path**: `backend/Dockerfile`
- **Docker Command**: (leave empty)

### Step 3: Set Environment Variables

On the Render service page, go to **Environment**:

```
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/fakenews
ML_SERVICE_URL=https://fakenews-ml.onrender.com
FRONTEND_URL=https://your-frontend-netlify-url.netlify.app
SERPAPI_KEY=your_serpapi_key_here
NEWSAPI_KEY=your_newsapi_key_here
OPENAI_API_KEY=your_openai_key_here
GROQ_API_KEY=your_groq_key_here
```

### Step 4: Create MongoDB Database (Option A: Render)

1. On Render Dashboard, click **"New +"** → **"Database"**
2. Create a PostgreSQL or MySQL database (or use MongoDB Atlas)
3. Copy the connection string and add to environment variables

**OR Option B: MongoDB Atlas (Recommended)**

1. Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up free (500MB storage)
3. Create a cluster
4. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/fakenews`
5. Add to Render environment variables

### Step 5: Deploy Backend

1. Click **"Create Web Service"** on Render
2. Wait for the build (5-10 minutes)
3. Copy the service URL (e.g., `https://fakenews-backend.onrender.com`)

---

## **Part 2: Deploy ML Service on Render (Optional)**

### Step 1: Create ML Service Dockerfile

The ML service needs its own Dockerfile at `ml_service/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY ml_service/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY ml_service/ .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD python -c "import http.client; conn = http.client.HTTPConnection('localhost', 8000); conn.request('GET', '/health'); exit(0 if conn.getresponse().status == 200 else 1)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Step 2: Create ML Service on Render

1. On Render Dashboard, click **"New +"** → **"Web Service"**
2. Connect GitHub repository
3. Configure:
   - **Name**: `fakenews-ml`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `ml_service/Dockerfile`
   - **Plan**: `Free` (or paid for better performance)

### Step 3: Set ML Service Environment Variables

```
SERPAPI_KEY=your_serpapi_key_here
NEWSAPI_KEY=your_newsapi_key_here
OPENAI_API_KEY=your_openai_key_here
GROQ_API_KEY=your_groq_key_here
```

### Step 4: Deploy ML Service

Click **"Create Web Service"** and wait for deployment.

---

## **Part 3: Deploy Frontend on Netlify**

### Step 1: Connect to Netlify

1. Go to [https://app.netlify.com](https://app.netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Connect GitHub and select your repository
4. Choose branch: `main`

### Step 2: Configure Build Settings

Netlify should auto-detect React settings, but verify:

**Build command**: `npm run build`
**Publish directory**: `build`
**Base directory**: `frontend`

### Step 3: Set Environment Variables

Go to **Site settings** → **Build & deploy** → **Environment**:

Add:
```
REACT_APP_API_URL=https://fakenews-backend.onrender.com
```

### Step 4: Deploy Frontend

1. Click **"Deploy site"**
2. Wait for build (2-5 minutes)
3. Netlify will provide your live URL (e.g., `https://fakenews-xyz.netlify.app`)

---

## **Part 4: Connect Everything**

### Step 1: Update Backend Environment Variables

1. Go to Render backend service
2. Update `FRONTEND_URL`: `https://your-netlify-url.netlify.app`
3. Redeploy by pushing a change to GitHub

### Step 2: Update Frontend Environment Variables

1. Go to Netlify site settings
2. Update `REACT_APP_API_URL`: Use your Render backend URL
3. Trigger a new deployment (push to GitHub or use Netlify UI)

### Step 3: Test the Connection

1. Open your Netlify frontend URL
2. Submit a test claim
3. Check if you receive results from the Render backend

---

## **🔧 Troubleshooting**

### Backend Build Fails

**Error: `Cannot find module`**
- Check `backend/package.json` has all dependencies
- Ensure Node version is 18+

**Error: `MongoDB connection failed`**
- Verify `MONGODB_URI` is correct
- Check MongoDB Atlas IP whitelist includes Render IPs
- Allow all IPs: `0.0.0.0/0` (less secure, for development only)

### Frontend Won't Load

**Error: `API calls failing`**
- Check `REACT_APP_API_URL` is correct
- Verify backend is running and healthy on Render
- Check CORS settings on backend

**Error: `Build fails on Netlify`**
- Check Node version (18+ recommended)
- Verify `netlify.toml` is in project root
- Check build directory is `build` (not `dist`)

### ML Service Issues

**Error: `Model loading fails`**
- Ensure Groq API key is set correctly
- Check `requirements.txt` has all dependencies
- Verify Python version is 3.11+

---

## **📊 Service URLs After Deployment**

| Service | URL |
|---------|-----|
| Frontend | `https://your-name.netlify.app` |
| Backend API | `https://fakenews-backend.onrender.com` |
| ML Service | `https://fakenews-ml.onrender.com` |
| Health Check (Backend) | `https://fakenews-backend.onrender.com/api/health` |
| Health Check (ML) | `https://fakenews-ml.onrender.com/health` |

---

## **💰 Estimated Costs**

- **Netlify**: Free (with generous limits)
- **Render**: Free tier for one web service + PostgreSQL (limited)
- **MongoDB Atlas**: Free tier (500MB)
- **API Keys**: Free tiers available for all services

**Total**: Can be completely free or $7-15/month for better performance

---

## **🚀 Performance Tips**

1. **Use Render's paid tier** for production (better performance)
2. **Enable MongoDB indexing** for faster queries
3. **Cache API responses** on the frontend
4. **Use CDN** (Netlify provides this automatically)
5. **Monitor ML service** for slow inference times

---

## **📝 Next Steps**

1. Test all endpoints after deployment
2. Set up monitoring/alerting on Render
3. Enable auto-scaling for high traffic
4. Set up CI/CD pipeline for automatic deployments
5. Configure custom domain (optional)

---

## **❓ Need Help?**

- **Render Docs**: [https://render.com/docs](https://render.com/docs)
- **Netlify Docs**: [https://docs.netlify.com](https://docs.netlify.com)
- **MongoDB Atlas**: [https://docs.atlas.mongodb.com](https://docs.atlas.mongodb.com)

Good luck with your deployment! 🎉