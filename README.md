# Placeometer

**Career profile optimization assistant for campus placements.** Placeometer audits your Resume, GitHub, and LinkedIn the way a recruiter would, flags the gaps that get profiles silently rejected, and turns them into a trackable improvement roadmap.

🔗 **Live demo:** https://placeometer-score.vercel.app/

## Features

### 📄 Resume Analyzer
Upload a **PDF or DOCX** resume (max 5 MB). Placeometer extracts the text, detects sections, checks ATS match signals, scores recruiter evaluation factors, and suggests before/after rewrites.

### ⚙️ GitHub Tracker
Enter a GitHub username. Placeometer pulls your public profile and up to 100 repositories from the GitHub API, then:
- ranks repos by recruiter visibility (live demo, docs quality, recent commits)
- calculates a **Recruiter Credibility Index** out of 100, made up of profile completeness, repository quantity, documentation quality, activity, and language diversity
- lists concrete improvements, with before/after examples

### 🔗 LinkedIn Visual Audit
Upload (or paste with Ctrl+V) screenshots of your LinkedIn sections: header, about, projects, featured, experience, and activity. OCR ([Tesseract.js](https://tesseract.projectnaptha.com/)) extracts the text in the browser and generates feedback for each section based on what it finds.

### 📋 Placement Coach Roadmap
Builds a prioritized task list from the weaknesses the other three modules detected. Mark tasks done to track progress toward placement readiness. If you haven't run an audit yet, it shows the full preparation checklist.

## Privacy

Placeometer has no backend. Resume parsing and LinkedIn OCR run entirely in your browser, and your files are never uploaded anywhere. The only network call with your data is the GitHub Tracker's request to the public GitHub API. Scores and roadmap progress are saved in your browser's `localStorage`.

## Tech stack

- Plain HTML, CSS, and vanilla JavaScript (no framework, no build step)
- [PDF.js](https://mozilla.github.io/pdf.js/) for PDF parsing and [Mammoth.js](https://github.com/mwilliamson/mammoth.js) for DOCX
- [Tesseract.js](https://github.com/naptha/tesseract.js) for OCR
- [GitHub REST API](https://docs.github.com/en/rest) (unauthenticated)
- Deployed on [Vercel](https://vercel.com/)

## Project structure

```
├── index.html          # Landing page
├── resume.html         # Resume Analyzer
├── github.html         # GitHub Tracker
├── linkedin.html       # LinkedIn Visual Audit
├── tasks.html          # Placement Coach Roadmap
├── main.js             # Shared state (localStorage), scoring helpers, utilities
├── styles.css          # Shared styles
├── js/
│   ├── resume.js       # Resume extraction, scoring, and rendering
│   ├── github.js       # GitHub API fetch, scoring, and rendering
│   └── linkedin/       # OCR, analyzer, observations, renderer, upload, state
└── tests/
    └── linkedin-projects.test.js
```

## Running locally

No install is needed. Clone the repo and serve the folder with any static server:

```bash
git clone https://github.com/bhuvana-g-dev/placeometer.git
cd placeometer
python3 -m http.server 8000
```

Then open http://localhost:8000.

> Use a local server rather than opening `index.html` directly, because some browsers block the PDF/OCR web workers on `file://` URLs.

### Tests

The LinkedIn analyzer tests use Node's built-in test runner (Node 18+):

```bash
node --test tests/
```

## Notes

- The unauthenticated GitHub API allows about 60 requests per hour per IP. If you hit the limit, wait a minute and try again.
- OCR accuracy depends on screenshot quality. Clear, full-width screenshots of each LinkedIn section work best.
