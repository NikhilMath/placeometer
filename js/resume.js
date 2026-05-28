// js/resume.js — Resume Analyzer: extraction, scoring, rendering

// ─── PDF.js worker setup ───────────────────────────────────────────────────
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ─── DOM ready ────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const zone  = document.getElementById('uploadZone');
  const input = document.getElementById('resumeFile');

  // Drag-and-drop on the upload zone
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  input.addEventListener('change', () => {
    if (input.files[0]) handleFile(input.files[0]);
  });
});

// ─── Entry point ──────────────────────────────────────────────────────────
async function handleFile(file) {
  // Fix #13: client-side file size guard
  if (file.size > 5 * 1024 * 1024) {
    showParseError('File too large. Please upload a resume under 5 MB.');
    return;
  }
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf', 'docx'].includes(ext)) {
    showParseError('Unsupported format. Please upload a PDF or DOCX file.');
    return;
  }

  document.getElementById('parsingState').style.display = 'block';
  document.getElementById('uploadZone').style.pointerEvents = 'none';
  document.getElementById('uploadZone').style.opacity = '0.6';
  clearParseError();

  try {
    log('Reading file...');
    const text = ext === 'pdf' ? await extractPDF(file) : await extractDOCX(file);

    if (!text || text.trim().length < 50) {
      throw new Error('Could not extract readable text. The file may be image-based or password-protected.');
    }

    log('Detecting resume sections...');
    const sections = detectSections(text);

    log('Running ATS keyword analysis...');
    const keywords = analyzeKeywords(text);

    log('Computing recruiter readiness score...');
    const { score, breakdown, improvements } = computeScore(text, sections, keywords);

    log('Building report...');
    await delay(300);

    renderResults(file.name, text, sections, keywords, score, breakdown, improvements);

  } catch (err) {
    // Fix #13: clear error with retry
    showParseError(err.message || 'Unexpected error. Please try a different file.');
  } finally {
    document.getElementById('parsingState').style.display = 'none';
    document.getElementById('uploadZone').style.pointerEvents = '';
    document.getElementById('uploadZone').style.opacity = '';
  }
}

// ─── PDF extraction ───────────────────────────────────────────────────────
async function extractPDF(file) {
  log('Extracting text from PDF...');
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(' '));
  }
  return pages.join('\n');
}

// ─── DOCX extraction ──────────────────────────────────────────────────────
async function extractDOCX(file) {
  log('Extracting text from DOCX...');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || '';
}

// ─── Section detection ────────────────────────────────────────────────────
const SECTION_PATTERNS = {
  Contact:     /\b(email|phone|linkedin|github|portfolio|address)\b/i,
  Summary:     /\b(summary|objective|profile|about me|overview)\b/i,
  Education:   /\b(education|university|college|degree|bachelor|master|b\.?tech|gpa)\b/i,
  Experience:  /\b(experience|internship|work history|employment|position|role)\b/i,
  Projects:    /\b(projects?|built|developed|created|application|app|system)\b/i,
  Skills:      /\b(skills?|technologies|tech stack|tools|languages|frameworks)\b/i,
  Certifications: /\b(certif|aws|google cloud|azure|coursera|udemy|hackerrank)\b/i,
  Achievements: /\b(achievement|award|honor|recognition|winner|rank|leetcode)\b/i,
};

function detectSections(text) {
  const found = {};
  for (const [name, pattern] of Object.entries(SECTION_PATTERNS)) {
    found[name] = pattern.test(text);
  }
  return found;
}

// ─── ATS keyword analysis ─────────────────────────────────────────────────
const ATS_KEYWORD_GROUPS = [
  {
    label: 'Programming Languages',
    color: '#3b82f6',
    terms: ['javascript','python','java','c++','c#','typescript','go','rust','kotlin','swift','ruby','php','scala','r'],
  },
  {
    label: 'Frontend Frameworks',
    color: '#a78bfa',
    terms: ['react','angular','vue','next.js','nuxt','svelte','tailwind','bootstrap','html','css','sass'],
  },
  {
    label: 'Backend & APIs',
    color: '#4ade80',
    terms: ['node.js','express','django','flask','spring','fastapi','rest','graphql','grpc','microservices'],
  },
  {
    label: 'Databases',
    color: '#f59e0b',
    terms: ['sql','mysql','postgresql','mongodb','redis','firebase','dynamodb','sqlite','elasticsearch'],
  },
  {
    label: 'Cloud & DevOps',
    color: '#22d3ee',
    terms: ['aws','gcp','azure','docker','kubernetes','ci/cd','github actions','terraform','linux','nginx'],
  },
  {
    label: 'Soft / Impact Keywords',
    color: '#f87171',
    terms: ['led','built','designed','optimized','improved','reduced','increased','deployed','automated','collaborated'],
  },
];

function analyzeKeywords(text) {
  const lower = text.toLowerCase();
  return ATS_KEYWORD_GROUPS.map(group => ({
    ...group,
    found:   group.terms.filter(t => lower.includes(t)),
    missing: group.terms.filter(t => !lower.includes(t)).slice(0, 5),
  }));
}

// ─── Score computation ────────────────────────────────────────────────────
function computeScore(text, sections, keywords) {
  const lower = text.toLowerCase();
  const breakdown = {};
  const improvements = [];
  const weaknesses = [];

  // 1. Section completeness (max 25)
  const corePresent = ['Education','Experience','Projects','Skills'].filter(s => sections[s]).length;
  const bonusPresent = ['Summary','Certifications','Achievements'].filter(s => sections[s]).length;
  breakdown.sections = Math.min(25, corePresent * 5 + bonusPresent * 2 + (sections.Contact ? 3 : 0));
  if (!sections.Projects)    { weaknesses.push('Projects section missing or not detectable.'); improvements.push({ title: 'Add a dedicated Projects section', level: 'critical', icon: '🧩', why: 'Projects are the most important signal for fresh graduates. Without them, ATS filters discard resumes before a human sees them.', how: 'Add a Projects section with 2–4 builds. For each: name, tech stack used, a quantified outcome, and a live/repo link.', before: 'No projects section.', after: 'Projects: E-Commerce App | React, Node.js, MongoDB | Reduced page load by 40% | Live: vercel.app/shop' }); }
  if (!sections.Skills)      { weaknesses.push('Skills section missing.'); improvements.push({ title: 'Add a categorized Skills section', level: 'high', icon: '🔑', why: 'ATS systems parse skills blocks first. A missing or informal skills section fails keyword extraction.', how: 'Group skills: Languages | Frameworks | Databases | Tools/DevOps. Use clean comma-separated lists.', before: 'Skills buried in project descriptions.', after: 'Languages: Python, JavaScript | Frameworks: React, Django | Databases: PostgreSQL, Redis' }); }
  if (!sections.Summary)     { improvements.push({ title: 'Add a professional summary', level: 'medium', icon: '📝', why: 'A 2–3 sentence summary at the top anchors your candidacy and passes ATS keyword scans before the recruiter reads a word.', how: 'Write: Target role + core stack + one standout achievement or metric.', before: 'Resume opens directly with Education.', after: 'Full-stack developer specializing in React and Node.js. Built 5 deployed apps serving 2,000+ users. Seeking SDE internship roles.' }); }
  if (!sections.Certifications) { improvements.push({ title: 'Add certifications or online credentials', level: 'low', icon: '🎓', why: 'Certifications act as external validation of your skills, especially for students without formal work experience.', how: 'List AWS Cloud Practitioner, Google IT, or platform certs from Coursera/HackerRank.', before: 'No certifications listed.', after: 'AWS Cloud Practitioner (2024) | HackerRank Problem Solving (Gold)' }); }

  // 2. Keyword density (max 25)
  const totalFound    = keywords.reduce((s, g) => s + g.found.length, 0);
  const totalPossible = keywords.reduce((s, g) => s + g.terms.length, 0);
  const density = totalFound / totalPossible;
  breakdown.keywords = Math.min(25, Math.round(density * 35));
  if (density < 0.25) { weaknesses.push('Low ATS keyword density.'); improvements.push({ title: 'Increase ATS keyword density across all sections', level: 'high', icon: '🔑', why: 'ATS systems rank candidates by keyword match rate. A low density means your resume is filtered before a recruiter reads it.', how: 'Mirror language from job descriptions. Add specific technology names, not generic phrases like "web development".', before: '"Developed web apps using modern frameworks."', after: '"Built React + Node.js REST API serving 1,000+ users, deployed on Vercel."' }); }

  // 3. Impact language (max 20)
  const impactVerbs = ['led','built','designed','optimized','reduced','increased','improved','deployed','automated','engineered','architected','launched','scaled','delivered'];
  const quantifiers = text.match(/\d+[\+%xX]|\d+\s*(users|ms|seconds|million|thousand|percent|%)/gi) || [];
  const verbCount = impactVerbs.filter(v => lower.includes(v)).length;
  breakdown.impact = Math.min(20, verbCount * 2 + Math.min(8, quantifiers.length * 2));
  if (verbCount < 3)         { weaknesses.push('Weak action verbs.'); improvements.push({ title: 'Rewrite bullets with strong action verbs', level: 'high', icon: '💪', why: 'Passive language ("responsible for", "helped with") fails ATS ranking and reads as low-ownership to recruiters.', how: 'Start every bullet with an active verb: Engineered, Deployed, Optimized, Reduced, Automated.', before: '"Responsible for developing the backend API."', after: '"Engineered a REST API with Node.js that reduced response times by 35%."' }); }
  if (quantifiers.length < 3) { weaknesses.push('Insufficient quantified achievements.'); improvements.push({ title: 'Add quantified impact metrics to project bullets', level: 'critical', icon: '📊', why: 'Numbers instantly communicate scale and achievement. Resumes without metrics are filtered out by both ATS and hiring managers.', how: 'Apply the XYZ formula: Accomplished X, measured by Y, by doing Z. Add user counts, performance gains, time saved.', before: '"Improved website performance."', after: '"Optimized React bundle size by 42%, reducing initial load time from 4.2s to 1.8s."' }); }

  // 4. Structure & length (max 15)
  const wordCount = text.trim().split(/\s+/).length;
  const hasGithub  = /github\.com\/\S+/i.test(text);
  const hasLinkedIn = /linkedin\.com\/in\/\S+/i.test(text);
  const hasEmail   = /[\w.+-]+@[\w-]+\.\w{2,}/i.test(text);
  breakdown.structure = 0;
  if (wordCount >= 300 && wordCount <= 1200) breakdown.structure += 6;
  else if (wordCount > 0)                    breakdown.structure += 3;
  if (hasEmail)    breakdown.structure += 3;
  if (hasGithub)   breakdown.structure += 4;
  else { weaknesses.push('GitHub link missing from header.'); improvements.push({ title: 'Add GitHub profile link to resume header', level: 'high', icon: '🔗', why: 'Technical reviewers immediately look for a GitHub link. Its absence creates doubt about whether you actually write code.', how: 'Add a links block under your name: github.com/username | linkedin.com/in/name | email.', before: 'Name + email only in header.', after: 'Name | github.com/username | linkedin.com/in/name | email@domain.com' }); }
  if (hasLinkedIn) breakdown.structure += 2;
  breakdown.structure = Math.min(15, breakdown.structure);

  // 5. Formatting signals (max 15) — heuristic from text shape
  const lines     = text.split('\n').filter(l => l.trim().length > 0);
  const shortLines = lines.filter(l => l.trim().length < 80).length;
  const hasDatePattern = /\b(20\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(text);
  breakdown.formatting = 0;
  if (shortLines / Math.max(1, lines.length) > 0.4) breakdown.formatting += 6;
  if (hasDatePattern) breakdown.formatting += 5;
  if (wordCount > 200) breakdown.formatting += 4;
  breakdown.formatting = Math.min(15, breakdown.formatting);

  // Final score: 0–100, no artificial floor
  const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  // Save weaknesses for tasks page
  PlaceometerState.resumeWeaknesses = weaknesses;
  PlaceometerState.resumeSignal = score;
  PlaceometerState.resumeSignalLevel = scoreGrade(score).grade;
  PlaceometerState.save();

  return { score, breakdown, improvements };
}

// ─── Rendering ────────────────────────────────────────────────────────────
function renderResults(fileName, text, sections, keywords, score, breakdown, improvements) {
  document.getElementById('uploadSection').style.display = 'none';
  const results = document.getElementById('resultsSection');
  results.style.display = 'block';

  document.getElementById('fileNameBadge').textContent = `📎 ${fileName}`;

  // Section chips
  const chipsEl = document.getElementById('sectionChips');
  chipsEl.innerHTML = Object.entries(sections).map(([name, found]) =>
    `<span class="chip ${found ? 'found' : 'missing'}">${found ? '✓' : '✗'} ${name}</span>`
  ).join('');

  const foundCount = Object.values(sections).filter(Boolean).length;
  document.getElementById('sectionNote').textContent =
    `${foundCount} of ${Object.keys(sections).length} common resume sections detected.`;

  // ATS keywords
  const kwEl = document.getElementById('keywordAnalysis');
  kwEl.innerHTML = keywords.map(group => `
    <div style="margin-bottom:18px;">
      <div style="font-size:12px;font-weight:700;color:${group.color};text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">${group.label}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
        ${group.found.map(t => `<span class="chip found">✓ ${t}</span>`).join('')}
        ${group.missing.map(t => `<span class="chip missing">✗ ${t}</span>`).join('')}
      </div>
      ${group.found.length === 0 ? `<div style="font-size:12px;color:var(--text-3);">No ${group.label.toLowerCase()} keywords detected.</div>` : ''}
    </div>
  `).join('');

  // Score ring
  const color = scoreColor(score);
  const ringWrap = document.getElementById('resumeRingWrap');
  ringWrap.innerHTML = buildRingSVG(score, color, 'resumeRing') +
    `<div class="big-ring-label">
       <span class="big-ring-num" id="resumeScoreNum">0</span>
       <span class="big-ring-sub">/ 100</span>
     </div>`;
  setTimeout(() => {
    animateRing('resumeRing', score, color);
    animateNumber(document.getElementById('resumeScoreNum'), score);
  }, 100);
  const g = scoreGrade(score);
  document.getElementById('scoreGrade').textContent = g.grade;
  document.getElementById('scoreGrade').style.color = color;
  document.getElementById('scoreDesc').textContent = g.desc;

  // Breakdown bars
  const bdItems = [
    { label: 'Section Completeness', val: breakdown.sections,   max: 25, color: '#4ade80' },
    { label: 'ATS Keyword Density',  val: breakdown.keywords,   max: 25, color: '#3b82f6' },
    { label: 'Impact Language',      val: breakdown.impact,     max: 20, color: '#f59e0b' },
    { label: 'Structure & Links',    val: breakdown.structure,  max: 15, color: '#a78bfa' },
    { label: 'Formatting Signals',   val: breakdown.formatting, max: 15, color: '#22d3ee' },
  ];
  document.getElementById('breakdownList').innerHTML = bdItems.map(b => {
    const pct = Math.round((b.val / b.max) * 100);
    return `<div class="breakdown-item">
      <div class="breakdown-row">
        <span class="breakdown-label">${b.label}</span>
        <span class="breakdown-val" style="color:${b.color}">${Math.round(b.val)}/${b.max}</span>
      </div>
      <div class="breakdown-track">
        <div class="breakdown-fill" style="width:0%;background:${b.color}" data-width="${pct}%"></div>
      </div>
    </div>`;
  }).join('');
  setTimeout(() => {
    document.querySelectorAll('#breakdownList .breakdown-fill[data-width]').forEach(el => {
      el.style.width = el.dataset.width;
    });
  }, 150);

  // Next steps
  const nextMap = [
    { ok: score >= 70, icon: '🎯', text: score >= 70 ? 'Resume passes basic recruiter scan threshold.' : 'Resume needs improvement before ATS submission.' },
    { ok: !!text.match(/github\.com\/\S+/i), icon: '⚙️', text: 'Add GitHub link if missing', link: 'github.html' },
    { ok: false, icon: '🔗', text: 'Run LinkedIn visual audit next', link: 'linkedin.html' },
    { ok: false, icon: '📋', text: 'View your personalized placement roadmap', link: 'tasks.html' },
  ];
  document.getElementById('nextSteps').innerHTML = nextMap.map(s => `
    <div style="display:flex;gap:10px;align-items:center;font-size:13px;color:var(--text-2);">
      <span>${s.icon}</span>
      ${s.link ? `<a href="${s.link}" style="color:var(--accent);text-decoration:underline;">${s.text}</a>` : `<span>${s.text}</span>`}
    </div>`).join('');

  // Improvements
  document.getElementById('improvementsList').innerHTML = improvements.map(imp => `
    <div style="background:var(--bg-3);border:1px solid var(--border);border-radius:10px;padding:20px;display:flex;flex-direction:column;gap:12px;">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="font-size:20px;">${imp.icon}</span>
        <strong style="font-size:15px;color:var(--text);">${imp.title}</strong>
        <span class="chip ${imp.level === 'critical' ? 'missing' : imp.level === 'high' ? 'warn' : 'found'}" style="margin-left:auto;">${imp.level.toUpperCase()}</span>
      </div>
      <div style="font-size:13px;line-height:1.5;color:var(--text-2);">
        <span style="color:var(--accent-2);font-weight:600;font-size:11px;letter-spacing:.05em;display:block;margin-bottom:2px;">WHY IT MATTERS:</span>${imp.why}
      </div>
      <div style="font-size:13px;line-height:1.5;color:var(--text-2);">
        <span style="color:var(--accent);font-weight:600;font-size:11px;letter-spacing:.05em;display:block;margin-bottom:2px;">HOW TO IMPROVE:</span>${imp.how}
      </div>
      ${imp.before && imp.after ? `
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;font-family:monospace;font-size:12px;display:flex;flex-direction:column;gap:6px;">
        <div style="color:var(--danger);word-break:break-word;"><span style="font-weight:600;">❌ BEFORE:</span> ${imp.before}</div>
        <div style="color:var(--accent);word-break:break-word;"><span style="font-weight:600;">✅ AFTER:</span> ${imp.after}</div>
      </div>` : ''}
    </div>`).join('');

  // Extracted text preview
  document.getElementById('extractedPreview').textContent = text.trim().slice(0, 3000) +
    (text.length > 3000 ? '\n\n[truncated — showing first 3,000 characters]' : '');
}

// ─── Reset ────────────────────────────────────────────────────────────────
function resetAnalysis() {
  document.getElementById('resultsSection').style.display = 'none';
  document.getElementById('uploadSection').style.display = 'block';
  document.getElementById('resumeFile').value = '';
  document.getElementById('parseLog').innerHTML = '';
  clearParseError();
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function log(msg) {
  const el = document.getElementById('parseLog');
  if (el) el.innerHTML += `<div>→ ${msg}</div>`;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function showParseError(msg) {
  clearParseError();
  const zone = document.getElementById('uploadSection');
  const err  = document.createElement('div');
  err.id = 'parseError';
  err.innerHTML = `
    <div class="alert error" style="margin-top:16px;">
      ⚠️ ${msg}
      <button onclick="document.getElementById('resumeFile').click()" class="btn-secondary"
        style="margin-left:14px;padding:6px 14px;font-size:12px;">Try another file</button>
    </div>`;
  zone.appendChild(err);
}

function clearParseError() {
  const el = document.getElementById('parseError');
  if (el) el.remove();
}
