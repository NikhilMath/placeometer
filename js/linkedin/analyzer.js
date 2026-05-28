// js/linkedin/analyzer.js — Fix #4: evidence-based analysis from OCR text

window.LinkedInAnalyzer = (function () {

  // Keyword sets for each section
  const ROLE_KEYWORDS   = ['engineer','developer','intern','full-stack','frontend','backend','software','sde','devops','data','ml','ai'];
  const STACK_KEYWORDS  = ['react','node','python','javascript','typescript','java','sql','mongodb','aws','docker','kubernetes','django','flask','express','vue','angular','next','spring','redis','postgresql','mysql','firebase'];
  const IMPACT_KEYWORDS = ['built','deployed','reduced','improved','increased','optimized','led','automated','launched','scaled','designed','architected'];
  const URL_PATTERN     = /https?:\/\/\S+|github\.com\/\S+|vercel\.app|netlify\.app|linkedin\.com\/in\/\S+/i;
  const METRIC_PATTERN  = /\d+[\+%x]|\d+\s*(users|ms|seconds|million|percent|%|requests|queries)/i;

  function analyzeSection(name, text) {
    const t = (text || '').toLowerCase();
    const raw = text || '';

    const roleHits    = ROLE_KEYWORDS.filter(k => t.includes(k));
    const stackHits   = STACK_KEYWORDS.filter(k => t.includes(k));
    const impactHits  = IMPACT_KEYWORDS.filter(k => t.includes(k));
    const hasUrl      = URL_PATTERN.test(raw);
    const hasMetrics  = METRIC_PATTERN.test(raw);
    const wordCount   = t.split(/\s+/).filter(Boolean).length;
    const isEmpty     = wordCount < 15;

    return { roleHits, stackHits, impactHits, hasUrl, hasMetrics, wordCount, isEmpty };
  }

  function analyzeProfile() {
    const s = linkedinState.sectionText;
    const uploaded = (k) => linkedinUtils.getFileCount(k) > 0;

    // Per-section analysis
    const header  = analyzeSection('header',  s.header);
    const about   = analyzeSection('about',   s.about);
    const featured = analyzeSection('featured', s.featured);
    const exp     = analyzeSection('experience', s.experience);
    const skills  = analyzeSection('skills',  s.skills);
    const activity = analyzeSection('activity', s.activity);
    const certs   = analyzeSection('certifications', s.certifications);

    // ── Score sub-dimensions (each max 20) ───────────────────────────────

    // 1. Visibility (header quality)
    let visScore = 0;
    if (uploaded('header')) {
      visScore += 5;
      if (header.roleHits.length >= 1)  visScore += 6;
      if (header.stackHits.length >= 2) visScore += 5;
      if (!header.isEmpty)              visScore += 4;
    }

    // 2. Branding (about section)
    let brandScore = 0;
    if (uploaded('about')) {
      brandScore += 4;
      if (about.stackHits.length >= 3)  brandScore += 5;
      if (about.impactHits.length >= 2) brandScore += 4;
      if (about.hasMetrics)             brandScore += 4;
      if (about.wordCount >= 60)        brandScore += 3;
    }

    // 3. Portfolio (featured)
    let portfolioScore = 0;
    if (uploaded('featured')) {
      portfolioScore += 5;
      if (featured.hasUrl)              portfolioScore += 7;
      if (featured.stackHits.length >= 2) portfolioScore += 5;
      if (featured.impactHits.length >= 1) portfolioScore += 3;
    }

    // 4. Activity
    let actScore = 0;
    if (uploaded('activity')) {
      actScore += 5;
      if (activity.impactHits.length >= 1) actScore += 5;
      if (activity.stackHits.length >= 1)  actScore += 5;
      if (activity.hasUrl)                 actScore += 5;
    }

    // 5. Proof-of-work (experience + skills + certs)
    let proofScore = 0;
    if (uploaded('experience')) {
      proofScore += 4;
      if (exp.impactHits.length >= 2) proofScore += 4;
      if (exp.hasMetrics)             proofScore += 4;
    }
    if (uploaded('skills')) {
      proofScore += 4;
      if (skills.stackHits.length >= 4) proofScore += 2;
    }
    if (uploaded('certifications')) proofScore += 2;

    const scoreMap = {
      visibility: Math.min(20, visScore),
      branding:   Math.min(20, brandScore),
      portfolio:  Math.min(20, portfolioScore),
      activity:   Math.min(20, actScore),
      proof:      Math.min(20, proofScore),
    };

    const profileScore = Math.max(0, Math.min(100,
      Object.values(scoreMap).reduce((a, b) => a + b, 0)
    ));

    // ── Improvement suggestions (Fix #4: evidence-based) ─────────────────
    const improvements = [];

    // Header / visibility
    if (!uploaded('header')) {
      improvements.push({ title: 'Upload header screenshot to enable visibility analysis', severity: 'high' });
    } else if (header.roleHits.length === 0) {
      improvements.push({ title: 'Headline missing role keywords (e.g. "Full-Stack Engineer Intern")', severity: 'high' });
    } else if (header.stackHits.length < 2) {
      improvements.push({ title: `Headline only shows ${header.stackHits.length} tech keyword(s) — add your core stack`, severity: 'medium' });
    }

    // About / branding
    if (!uploaded('about')) {
      improvements.push({ title: 'Upload About section screenshot', severity: 'high' });
    } else if (about.isEmpty) {
      improvements.push({ title: 'About section appears empty or OCR extraction was weak', severity: 'high' });
    } else {
      if (about.stackHits.length < 3)  improvements.push({ title: `About section only mentions ${about.stackHits.length} tech stack keyword(s) — name your core tools`, severity: 'medium' });
      if (!about.hasMetrics)           improvements.push({ title: 'About section has no quantified results — add user counts, performance gains, or project scale', severity: 'high' });
      if (about.impactHits.length < 2) improvements.push({ title: 'About section lacks strong action verbs — use "built", "deployed", "optimized"', severity: 'medium' });
    }

    // Featured / portfolio
    if (!uploaded('featured')) {
      improvements.push({ title: 'Upload Featured section screenshot — this is your most visible portfolio space', severity: 'high' });
    } else if (!featured.hasUrl) {
      improvements.push({ title: 'No live URLs detected in Featured section — add Vercel/Netlify/GitHub links', severity: 'critical' });
    } else if (featured.stackHits.length < 2) {
      improvements.push({ title: 'Featured section does not name a tech stack — add project tech details', severity: 'medium' });
    }

    // Activity
    if (!uploaded('activity')) {
      improvements.push({ title: 'No Activity Feed uploaded — post weekly builds-in-public to boost visibility', severity: 'low' });
    } else if (activity.impactHits.length === 0 && activity.stackHits.length === 0) {
      improvements.push({ title: 'Activity posts lack technical depth — share specific code wins or deployment milestones', severity: 'medium' });
    }

    // Proof
    if (!uploaded('experience') && !uploaded('skills') && !uploaded('certifications')) {
      improvements.push({ title: 'Upload Experience, Skills, or Certifications to complete proof-of-work analysis', severity: 'high' });
    } else {
      if (uploaded('experience') && exp.impactHits.length < 2) improvements.push({ title: 'Experience bullets lack action verbs — rewrite using "led", "built", "reduced"', severity: 'medium' });
      if (uploaded('experience') && !exp.hasMetrics)           improvements.push({ title: 'Experience section has no metrics — add quantified outcomes to every bullet', severity: 'high' });
      if (uploaded('skills') && skills.stackHits.length < 4)  improvements.push({ title: `Skills section only shows ${skills.stackHits.length} recognizable tech keywords — expand your skills list`, severity: 'medium' });
    }

    // ── Observations (Fix #4: text-driven, not static) ────────────────────
    const strengths = [];
    const gaps = [];

    if (header.roleHits.length >= 1)    strengths.push(`Headline includes role keyword: "${header.roleHits[0]}"`);
    if (header.stackHits.length >= 2)   strengths.push(`Headline mentions ${header.stackHits.length} tech stack keywords`);
    if (about.stackHits.length >= 3)    strengths.push(`About section covers ${about.stackHits.length} technologies including ${about.stackHits.slice(0,3).join(', ')}`);
    if (about.hasMetrics)               strengths.push('About section contains quantified metrics — strong recruiter signal');
    if (featured.hasUrl)                strengths.push('Featured section contains live URL(s) — excellent proof-of-work');
    if (activity.stackHits.length >= 1) strengths.push('Activity feed includes technical content');
    if (certs.wordCount > 20)           strengths.push('Certifications section detected — boosts recruiter trust');
    if (skills.stackHits.length >= 4)   strengths.push(`Skills section lists ${skills.stackHits.length} recognizable technologies`);

    if (header.roleHits.length === 0 && uploaded('header'))    gaps.push('Headline does not include a role title or target position');
    if (header.stackHits.length < 2 && uploaded('header'))     gaps.push('Headline is missing tech stack keywords recruiters search for');
    if (!about.hasMetrics && uploaded('about'))                 gaps.push('About section lacks any quantified outcome or metric');
    if (!featured.hasUrl && uploaded('featured'))               gaps.push('No live deployment links visible in Featured section');
    if (!uploaded('activity'))                                  gaps.push('Activity feed not uploaded — recruiters look for active builders');
    if (exp.impactHits.length < 2 && uploaded('experience'))   gaps.push('Experience bullets use weak or passive language');
    if (!exp.hasMetrics && uploaded('experience'))              gaps.push('Experience section has no quantified results');
    if (skills.stackHits.length < 3 && uploaded('skills'))     gaps.push(`Skills section shows few recognizable tech keywords`);

    return {
      profileScore,
      scoreMap,
      improvements,
      strengths: strengths.length ? strengths : ['Upload more sections for detailed strength analysis'],
      gaps: gaps.length ? gaps : ['No major gaps detected in uploaded sections'],
      sectionAnalysis: { header, about, featured, exp, skills, activity, certs },
      ocrWarnings: linkedinState.ocrWarnings || []
    };
  }

  return { analyzeProfile };
})();
