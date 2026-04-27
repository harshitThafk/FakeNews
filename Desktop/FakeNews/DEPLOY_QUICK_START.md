# ⚡ Quick Deployment Guide - 5 Easy Steps

## **Step 1: Prepare GitHub** (2 minutes)

Push all deployment files to GitHub:

```bash
cd c:\Users\ASUS\Desktop\FakeNews
git add .
git commit -m "Add deployment configuration files"
git push origin main
```

✅ Verify files were added:
- `backend/Dockerfile`
- `backend/.dockerignore`
- `frontend/netlify.toml`
- `frontend/.env.development`
- `frontend/.env.production`
- `ml_service/Dockerfile`
- `ml_service/.dockerignore`
- `render.yaml`
- `DEPLOYMENT.md`

---

## **Step 2: Deploy Backend on Render** (15 minutes)

### 2.1 Create Render Account
- Go to [https://render.com](https://render.com)
- Sign up with GitHub

### 2.2 Create Web Service
1. Dashboard → **"New +"** → **"Web Service"**
2. Select your GitHub repository
3. Fill in:
   - **Name**: `fakenews-backend`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `backend/Dockerfile`
   - **Plan**: `Free`

### 2.3 Set Environment Variables
Add these in **Environment** tab:
```
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/fakenews
ML_SERVICE_URL=https://fakenews-ml.onrender.com
FRONTEND_URL=https://your-frontend.netlify.app
SERPAPI_KEY=your_key
NEWSAPI_KEY=your_key
OPENAI_API_KEY=your_key
GROQ_API_KEY=your_key
```

### 2.4 Deploy
Click **"Create Web Service"** and wait (5-10 min)

✅ Copy your backend URL: `https://fakenews-backend.onrender.com`

---

## **Step 3: Deploy ML Service on Render** (15 minutes)

### 3.1 Create Another Web Service
1. Dashboard → **"New +"** → **"Web Service"**
2. Select repository again
3. Fill in:
   - **Name**: `fakenews-ml`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `ml_service/Dockerfile`
   - **Plan**: `Free`

### 3.2 Set Environment Variables
```
SERPAPI_KEY=your_key
NEWSAPI_KEY=your_key
OPENAI_API_KEY=your_key
GROQ_API_KEY=your_key
```

### 3.3 Deploy
Click **"Create Web Service"** and wait (5-10 min)

✅ Copy your ML URL: `https://fakenews-ml.onrender.com`

---

## **Step 4: Deploy Frontend on Netlify** (10 minutes)

### 4.1 Connect Netlify
1. Go to [https://app.netlify.com](https://app.netlify.com)
2. Sign up with GitHub
3. **"Add new site"** → **"Import an existing project"**
4. Select your GitHub repository

### 4.2 Configure Build
- **Build command**: `npm run build`
- **Publish directory**: `build`
- **Base directory**: `frontend`

### 4.3 Set Environment Variables
Go to **Site settings** → **Environment**:
```
REACT_APP_API_URL=https://fakenews-backend.onrender.com
```

### 4.4 Deploy
Click **"Deploy"** and wait (2-5 min)

✅ Copy your frontend URL from Netlify

---

## **Step 5: Connect Everything** (5 minutes)

### 5.1 Update Backend
- Go to Render backend service
- Edit environment variables
- Update `FRONTEND_URL=https://your-site.netlify.app`
- Click **"Save"** (auto-redeploys)

### 5.2 Update Frontend
- Go to Netlify site
- Edit environment variables
- Update `REACT_APP_API_URL=https://fakenews-backend.onrender.com`
- Trigger deploy (push to GitHub or use Netlify UI)

### 5.3 Test
1. Open your Netlify frontend URL
2. Submit a test claim like: "Barack Obama is president"
3. Should see analysis result in 10-15 seconds

---

## **🎯 Your Live URLs**

After deployment, you'll have:

| Service | URL |
|---------|-----|
| **Frontend** | `https://your-site.netlify.app` |
| **Backend** | `https://fakenews-backend.onrender.com` |
| **ML Service** | `https://fakenews-ml.onrender.com` |

---

## **❌ Common Issues & Fixes**

### Frontend shows "Cannot reach API"
- Check `REACT_APP_API_URL` in Netlify environment
- Verify backend URL is correct
- Wait 2-3 minutes for backend startup

### Backend crashes on startup
- Check environment variables are all set
- Verify MongoDB connection string is correct
- Check ML service URL is accessible

### ML Service won't start
- Verify all API keys (Groq, SerpAPI, NewsAPI)
- Check Docker build logs on Render
- Ensure Python dependencies are correct

---

## **💡 Next Steps**

1. ✅ Test the deployed application
2. Set up custom domain (optional)
3. Enable monitoring on Render
4. Set up auto-scaling for production
5. Configure email notifications

---

**Total Time: ~50 minutes ⏱️**

For detailed troubleshooting, see `DEPLOYMENT.md` 📖