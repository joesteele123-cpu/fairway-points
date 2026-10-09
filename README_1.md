# Fairway Points - Ready for Netlify

### Deploy in 30 seconds
**Option 1: Drag & Drop (fastest)**
1. Run `npm install` then `npm run build`
2. Go to https://app.netlify.com/drop
3. Drag the `dist` folder onto the page - done.

**Option 2: Git**
1. Push this folder to GitHub
2. Netlify -> Add new site -> Import from Git
3. Build command: `npm run build`, Publish dir: `dist`

**Option 3: Netlify CLI**
```
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

No env vars needed. All data is localStorage - fully offline.
