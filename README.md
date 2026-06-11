# LVT SOP Builder

A web-based Standard Operating Procedure builder for Live View Technologies manufacturing operations.

## Features
- Create and manage SOP Stations with tasks and steps
- Auto-generated SOP IDs and Task IDs
- Image uploads per station, task, and step
- Safety icon indicators (Warning, Caution, PPE, Electrical, etc.)
- PDF export formatted for 8.5×11 portrait with narrow margins
- CSV/Excel export for line balancing analysis
- Line Balance dashboard with visual bar chart
- Auto-save to browser localStorage + JSON file save/load

---

## Deploy in 5 steps

### Step 1 — Put this folder on GitHub

1. In GitHub, click **"New repository"**
2. Name it `lvt-sop-builder`, set it to **Private** (or Public), click **Create**
3. GitHub will show you a page with setup instructions. Copy the repo URL (looks like `https://github.com/YOUR_NAME/lvt-sop-builder.git`)
4. On your computer, open a terminal in this folder and run:

```bash
git init
git add .
git commit -m "Initial release"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/lvt-sop-builder.git
git push -u origin main
```

> If you don't have git installed: https://git-scm.com/downloads

---

### Step 2 — Connect to Netlify

1. Go to **https://netlify.com** and sign up (free) — use "Sign up with GitHub"
2. Click **"Add new site"** → **"Import an existing project"**
3. Click **"Deploy with GitHub"** and authorize Netlify
4. Select your `lvt-sop-builder` repository
5. Netlify will auto-detect the settings from `netlify.toml` — just click **"Deploy site"**

---

### Step 3 — Wait ~60 seconds

Netlify builds and deploys automatically. You'll see a live URL like:
```
https://amazing-name-123456.netlify.app
```

---

### Step 4 — (Optional) Set a custom subdomain

In Netlify → Site settings → Domain management → click **"Edit site name"**
Change it to something like `lvt-sop-builder` → your URL becomes:
```
https://lvt-sop-builder.netlify.app
```

---

### Step 5 — Share with your team

Send anyone the URL. No login required. The app runs entirely in the browser.

**Each user's work is saved in their own browser** (localStorage). To share SOPs between people, use the **⬇️ Export Save** button to download a `.json` file and send it — recipients use **📂 Load File** to open it.

---

## Future updates

Whenever you want to update the app:
1. Edit the files
2. Run `git add . && git commit -m "your change" && git push`
3. Netlify auto-deploys in ~60 seconds

---

## Run locally (optional)

```bash
npm install
npm run dev
```
Open http://localhost:5173

