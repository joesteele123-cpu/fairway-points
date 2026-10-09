# Fairway Points - Ready for Vercel

### Deploy (30 sec)
**Option 1: Vercel Dashboard (fastest)**
1. Push this folder to GitHub
2. Go to https://vercel.com/new
3. Import repo -> Framework: Vite -> Build Command: npm run build -> Output: dist -> Deploy

**Option 2: Drag? Use CLI**
```
npm i -g vercel
npm install
vercel --prod
```

**Option 3: Netlify still works** - same build.

No env vars needed. All data is localStorage. Offline course catalog.
Fixed: Graham hole 1 win now shows Std Pts row + debug trace.
