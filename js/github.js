// js/github.js — GitHub Tracker page logic

const ghInput = document.getElementById('ghUsername');
ghInput.addEventListener('keydown', e => { if (e.key === 'Enter') fetchGitHub(); });

async function fetchGitHub() {
  const username = ghInput.value.trim();
  if (!username) { showGhError('Please enter a GitHub username.'); return; }

  document.getElementById('ghError').style.display = 'none';
  document.getElementById('ghResults').style.display = 'none';
  document.getElementById('ghLoading').style.display = 'block';
  document.getElementById('fetchBtn').disabled = true;
  document.getElementById('fetchBtn').textContent = 'Fetching...';

  const loadStep = document.getElementById('ghLoadStep');

  try {
    loadStep.textContent = 'Fetching profile from GitHub API...';
    const userRes = await fetch(`https://api.github.com/users/${username}`);
    if (!userRes.ok) {
      if (userRes.status === 404) throw new Error('GitHub user not found. Check the username.');
      if (userRes.status === 403) throw new Error('GitHub API rate limit exceeded. Try again in a minute.');
      throw new Error(`GitHub API error: ${userRes.status}`);
    }
    const user = await userRes.json();

    // Fix #10: fetch up to 100 repos (GitHub API max) instead of 30
    loadStep.textContent = 'Fetching repositories (up to 100)...';
    const reposRes = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=100`);
    const repos = await reposRes.json();

    loadStep.textContent = 'Analyzing repository quality...';
    await new Promise(r => setTimeout(r, 400));

    loadStep.textContent = 'Calculating readiness score...';
    await new Promise(r => setTimeout(r, 300));

    document.getElementById('ghLoading').style.display = 'none';
    renderGitHub(user, repos);

  } catch (err) {
    document.getElementById('ghLoading').style.display = 'none';
    showGhError(err.message);
  } finally {
    document.getElementById('fetchBtn').disabled = false;
    document.getElementById('fetchBtn').textContent = 'Analyze GitHub →';
  }
}

function renderGitHub(user, repos) {
  const repoSample = repos.length;
  const totalStars = repos.reduce((total, repo) => total + repo.stargazers_count, 0);
  const originalRepos = repos.filter(repo => !repo.fork);
  const forkCount = repos.filter(repo => repo.fork).length;
  const forkRatio = repoSample ? forkCount / repoSample : 0;
  const recentRepos = repos.filter(r => {
    const months = (Date.now() - new Date(r.updated_at)) / (1000 * 60 * 60 * 24 * 30);
    return months < 3;
  }).length;
  const languages = [...new Set(repos.map(r => r.language).filter(Boolean))];
  const reposWithDesc = repos.filter(r => r.description && r.description.trim().length > 20).length;
  const descRatio = repoSample ? reposWithDesc / repoSample : 0;
  const hasDeployLink = repos.some(r => {
    const desc = (r.description || '').toLowerCase();
    return !!r.homepage || /vercel|netlify|render|railway|heroku|github\.io|live|http/.test(desc);
  });

  const breakdown = { profile: 0, repos: 0, docs: 0, activity: 0, diversity: 0 };
  const weaknesses = [];

  // Fix #5: Reworked sub-score formulas — transparent, documented, no arbitrary floor/ceiling

  // Profile completeness (max 20)
  let profileScore = 0;
  const hasBio = user.bio && user.bio.trim().length > 15;
  if (hasBio) profileScore += 7;
  else weaknesses.push('Bio is missing or too short. Add a crisp technical summary with your role and stack.');
  if (user.blog) profileScore += 4;
  else weaknesses.push('Professional website or portfolio link is missing from your profile metadata.');
  if (user.location) profileScore += 3;
  if (user.company) profileScore += 2;
  if (user.twitter_username) profileScore += 1;
  if (user.followers >= 5) profileScore += 2;
  if (user.public_repos >= 8) profileScore += 1;
  breakdown.profile = Math.min(20, profileScore);

  // Repository quality (max 20): 2pts per original repo up to 10, +1pt per 5 stars up to 8, +2 for 12+ repos
  let repoQualityScore = 0;
  repoQualityScore += Math.min(10, originalRepos.length * 2);
  repoQualityScore += Math.min(8, Math.floor(totalStars / 5));
  if (user.public_repos >= 12) repoQualityScore += 2;
  if (forkRatio > 0.4) weaknesses.push('Your repo dashboard has too many forked repositories. Pin original projects instead.');
  if (originalRepos.length < 4) weaknesses.push('Showcase at least 4 original, non-forked projects to communicate ownership.');
  breakdown.repos = Math.min(20, repoQualityScore);

  // Documentation & deployment (max 20): desc ratio worth 12pts, deploy link 5pts, portfolio 3pts
  let docsScore = 0;
  docsScore += Math.round(descRatio * 12);
  if (hasDeployLink) docsScore += 5;
  if (user.blog) docsScore += 3;
  if (descRatio < 0.5) weaknesses.push('Most repositories still lack strong descriptions or README-level summaries.');
  if (!hasDeployLink) weaknesses.push('There are no visible live demo or deployment links in your repo metadata.');
  breakdown.docs = Math.min(20, docsScore);

  // Activity & consistency (max 20): 3pts per recent repo up to 12, +5 for 3+ recent, +3 for gists/stars
  let activityScore = 0;
  activityScore += Math.min(12, recentRepos * 3);
  if (recentRepos >= 3) activityScore += 5;
  if (user.public_gists > 0) activityScore += 1;
  if (totalStars >= 10) activityScore += 2;
  if (recentRepos < 2) weaknesses.push('Recent code updates are sparse. Recruiters expect active work within the last 3 months.');
  breakdown.activity = Math.min(20, activityScore);

  // Language diversity (max 20): 3pts per language up to 12, +5 for 4+ languages, +3 bonus for 6+
  let diversityScore = 0;
  diversityScore += Math.min(12, languages.length * 3);
  if (languages.length >= 4) diversityScore += 5;
  if (languages.length >= 6) diversityScore += 3;
  if (languages.length < 2) weaknesses.push('Your work appears narrow in language exposure. Add another stack or framework.');
  breakdown.diversity = Math.min(20, diversityScore);

  // Fix #5: Score range 0–100 (no artificial floor or 98 ceiling)
  const rawScore = breakdown.profile + breakdown.repos + breakdown.docs + breakdown.activity + breakdown.diversity;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';

  // ====== IMPROVEMENT ENGINE ======
  const improvements = [];

  if (!hasBio) improvements.push({
    title: 'GitHub Gap: Weak or Missing Bio', level: 'high', icon: '👤',
    why: 'Recruiters judge your profile in seconds. A poor or empty bio makes your profile look like a technical landing page without an identity.',
    how: 'Write a concise bio that includes your role, core stack, and one recent achievement or focus area.',
    before: 'No bio or generic profile copy.',
    after: 'Aspiring Software Engineer | React, Node.js, PostgreSQL | Built a production-ready note app with 500+ active users.'
  });
  if (!user.blog) improvements.push({
    title: 'GitHub Gap: Missing Portfolio Link', level: 'medium', icon: '🔗',
    why: 'Recruiters need a bridge from your GitHub profile to your resume, LinkedIn, or live project showcase.',
    how: 'Add your portfolio, personal website, or LinkedIn URL to the Website field in your GitHub profile.',
    before: 'Empty website field on GitHub.',
    after: 'Website: https://yourname.dev'
  });
  if (forkRatio > 0.4) improvements.push({
    title: 'GitHub Gap: Forked Repos Dominate Your Dashboard', level: 'high', icon: '📌',
    why: 'Recruiters want to see original engineering work, not cloned assignments or downstream repository copies.',
    how: 'Pin 4–6 original projects and hide forked or generic course repositories from your profile top section.',
    before: 'Profile dominated by forked repositories.',
    after: 'Pinned portfolio of independent projects showing end-to-end development.'
  });
  if (originalRepos.length < 4) improvements.push({
    title: 'GitHub Gap: Need More Original Project Evidence', level: 'high', icon: '🧩',
    why: 'A small number of original repos makes it hard for recruiters to evaluate your actual engineering experience.',
    how: 'Add or highlight at least 4 original apps or services demonstrating different technical skills.',
    before: 'Only 1–3 original repos visible.',
    after: 'Portfolio includes at least 4 independent, deployed projects.'
  });
  if (descRatio < 0.5) improvements.push({
    title: 'GitHub Gap: Most Repos Lack Useful Descriptions', level: 'critical', icon: '📄',
    why: 'Repo descriptions are the first thing recruiters scan. If they are missing or generic, your work looks unfinished.',
    how: 'Add short, outcome-oriented descriptions to your top repositories including tech stack, key feature, and deployment status.',
    before: 'No repo descriptions or only one-line summaries.',
    after: 'React note app — deployed on Vercel with real-time sync, authentication, and PostgreSQL backend.'
  });
  if (!hasDeployLink) improvements.push({
    title: 'GitHub Gap: No Live Demos or Deployment Evidence', level: 'critical', icon: '🌐',
    why: 'Recruiters prefer clicking a live build over cloning repositories. Live demos prove your projects actually run.',
    how: 'Add deploy URLs to your repo homepage field and mention the deployment provider in the repo description.',
    before: 'No live demo or homepage links.',
    after: 'Live app: https://my-shop.vercel.app — Source: github.com/username/my-shop'
  });
  if (recentRepos < 2) improvements.push({
    title: 'GitHub Gap: Infrequent Recent Activity', level: 'high', icon: '📈',
    why: 'Recruiters look for continuous coding habits. A stale repo graph reduces confidence in your current coding rhythm.',
    how: 'Commit and merge small changes weekly to 2–3 projects and keep your most relevant repos updated.',
    before: 'Very little activity in the last 3 months.',
    after: 'Updated two core projects with new features and bug fixes in the past month.'
  });
  if (languages.length < 2) improvements.push({
    title: 'GitHub Gap: Narrow Technology Exposure', level: 'medium', icon: '⚙️',
    why: 'Recruiters want to see adaptability across at least two complementary tech stacks.',
    how: 'Add one project using a second layer of technology, such as React + Node.js or Python + PostgreSQL.',
    before: 'Only one programming language appears across your repos.',
    after: 'Projects show both JavaScript frontend work and backend API implementation in Node.js.'
  });
  if (totalStars < 3 && user.public_repos > 4) improvements.push({
    title: 'GitHub Gap: Limited Social Proof', level: 'medium', icon: '⭐',
    why: 'A few stars show that other developers found your work useful or interesting.',
    how: 'Promote one or two strong repos on social media or developer communities to attract first stars.',
    before: 'No starred repositories or social validation.',
    after: 'Top repository has 5+ stars and growing.'
  });
  if (improvements.length === 0) improvements.push({
    title: 'Strong GitHub Presence — Add Deployment and Open Source Momentum', level: 'low', icon: '🎉',
    why: 'Your profile already shows healthy structure. The next level is live deployments and meaningful open source contribution signals.',
    how: 'Add GitHub Actions, deploy one repo publicly, and contribute to a small open-source library or issue tracker.',
    before: 'Strong personal portfolio with stable activity.',
    after: 'Live deployments and community contributions reinforce your engineer brand.'
  });

  // ===== RENDER =====
  document.getElementById('ghResults').style.display = 'block';
  document.getElementById('ghAvatar').src = user.avatar_url;
  document.getElementById('ghName').textContent = user.name || user.login;
  document.getElementById('ghBio').textContent = user.bio || 'No bio provided.';
  document.getElementById('ghMeta').innerHTML = `
    <span class="gh-meta-item">Repos: <strong>${user.public_repos}</strong></span>
    <span class="gh-meta-item">Followers: <strong>${user.followers}</strong></span>
    <span class="gh-meta-item">Following: <strong>${user.following}</strong></span>
    ${user.location ? `<span class="gh-meta-item">📍 ${user.location}</span>` : ''}
    ${user.blog ? `<span class="gh-meta-item"><a href="${user.blog}" target="_blank" style="color:var(--accent-2)">🔗 Website</a></span>` : ''}
  `;

  // Fix #10: Show how many repos are being analyzed
  document.getElementById('repoAnalysisNote').textContent =
    `Analyzing ${repoSample} of ${user.public_repos} public repositories (most recently updated).`;

  const color = scoreColor(score);
  document.getElementById('ghScoreBadge').textContent = score;
  document.getElementById('ghScoreBadge').style.color = color;

  // Ring
  const ringWrap = document.getElementById('ghRingWrap');
  ringWrap.innerHTML = buildRingSVG(score, color, 'ghRing') +
    `<div class="big-ring-label">
       <span class="big-ring-num" id="ghScoreNum">0</span>
       <span class="big-ring-sub">/ 100</span>
     </div>`;
  setTimeout(() => {
    animateRing('ghRing', score, color);
    animateNumber(document.getElementById('ghScoreNum'), score);
  }, 100);

  const g = scoreGrade(score);
  document.getElementById('ghScoreGrade').textContent = `${g.grade} (${grade})`;
  document.getElementById('ghScoreGrade').style.color = color;
  document.getElementById('ghScoreDesc').textContent = g.desc;

  // Breakdown
  const bdItems = [
    { label: 'Profile Completeness',  val: breakdown.profile,   max: 20, color: '#4ade80' },
    { label: 'Repository Quantity',   val: breakdown.repos,     max: 20, color: '#3b82f6' },
    { label: 'Documentation Quality', val: breakdown.docs,      max: 20, color: '#a78bfa' },
    { label: 'Activity & Consistency',val: breakdown.activity,  max: 20, color: '#f59e0b' },
    { label: 'Language Diversity',    val: breakdown.diversity,  max: 20, color: '#22d3ee' },
  ];
  document.getElementById('ghBreakdown').innerHTML = bdItems.map(b => {
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
    document.querySelectorAll('#ghBreakdown .breakdown-fill[data-width]').forEach(el => {
      el.style.width = el.dataset.width;
    });
  }, 150);

  // Fix #1: Use totalStars (computed at top) — NOT starsTotal global
  const signals = [
    { icon: '📁', label: 'Public Repos',           val: user.public_repos, ok: user.public_repos >= 8 },
    { icon: '👥', label: 'Followers',               val: user.followers,   ok: user.followers >= 5 },
    { icon: '🌐', label: 'Languages Used',           val: languages.length, ok: languages.length >= 3 },
    { icon: '⭐', label: 'Total Stars',              val: totalStars,       ok: totalStars >= 3 },
    { icon: '🕐', label: 'Recently Active Repos',    val: recentRepos,      ok: recentRepos >= 2 },
    { icon: '📝', label: 'Repos with Descriptions',  val: reposWithDesc,    ok: descRatio >= 0.5 },
  ];
  document.getElementById('ghSignals').innerHTML = signals.map(s => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:13px;color:var(--text-2);">${s.icon} ${s.label}</span>
      <span style="font-size:13px;font-weight:600;color:${s.ok ? 'var(--accent)' : 'var(--warn)'};">${s.val} ${s.ok ? '✓' : '↑'}</span>
    </div>`).join('');

  // Repo ranking
  const rankedRepos = repos.filter(r => !r.fork).map(r => {
    let repoScore = 0;
    const hasHomepage = !!r.homepage;
    const descLower = (r.description || '').toLowerCase();
    const hasDeployKeywords = /vercel|netlify|render|railway|heroku|github\.io|live|http/.test(descLower);
    const isDeployed = hasHomepage || hasDeployKeywords;
    if (isDeployed) repoScore += 40;
    const descLength = (r.description || '').length;
    if (descLength > 25) repoScore += 30;
    else if (descLength > 5) repoScore += 15;
    if (r.language) repoScore += 20;
    const ageDays = (Date.now() - new Date(r.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 30) repoScore += 10;
    else if (ageDays < 90) repoScore += 5;
    return { ...r, visibilityScore: repoScore, isDeployed, ageDays };
  }).sort((a, b) => b.visibilityScore - a.visibilityScore);

  document.getElementById('repoCount').textContent = `${rankedRepos.length} repos`;
  const topRepos = rankedRepos.slice(0, 8);
  document.getElementById('repoGrid').innerHTML = topRepos.length === 0
    ? '<div style="font-size:14px;color:var(--text-3);grid-column:span 2;padding:20px 0;">No original repositories found.</div>'
    : topRepos.map(r => {
        const isOld = r.ageDays > 90;
        const vColor = r.visibilityScore >= 75 ? 'var(--accent)' : (r.visibilityScore >= 50 ? 'var(--warn)' : 'var(--danger)');
        const chip = (ok, yesText, noText) => `
          <span class="repo-issue" style="font-size:9px;padding:2px 6px;border-radius:4px;font-weight:700;text-transform:uppercase;
            background:${ok ? 'rgba(74,222,128,0.07)' : 'rgba(248,113,113,0.07)'};
            color:${ok ? 'var(--accent)' : 'var(--danger)'};
            border:1px solid ${ok ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)'}">
            ${ok ? '✓ ' + yesText : '⚠️ ' + noText}
          </span>`;
        return `<div class="repo-card" style="display:flex;flex-direction:column;justify-content:space-between;min-height:180px;">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;gap:8px;">
              <div class="repo-name" style="margin:0;font-size:14px;font-weight:700;word-break:break-all;">📂 ${r.name}</div>
              <div style="font-size:10px;font-weight:700;color:${vColor};background:rgba(255,255,255,0.03);border:1px solid var(--border);padding:2px 6px;border-radius:4px;white-space:nowrap;flex-shrink:0;">
                Visibility: ${r.visibilityScore}/100
              </div>
            </div>
            <div class="repo-desc" style="font-size:12px;color:var(--text-2);line-height:1.5;margin-bottom:12px;">
              ${r.description || '<em style="color:var(--text-3)">No description provided</em>'}
            </div>
          </div>
          <div>
            <div class="repo-meta" style="margin-bottom:12px;">
              ${r.language ? `<span class="repo-tag">🔵 ${r.language}</span>` : ''}
              <span class="repo-tag">⭐ ${r.stargazers_count}</span>
              <span class="repo-tag">🍴 ${r.forks_count}</span>
            </div>
            <div class="repo-issues" style="margin-top:auto;border-top:1px solid var(--border);padding-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
              ${chip(r.isDeployed, 'Deployed App', 'No Live Demo')}
              ${chip((r.description || '').length > 15, 'Rich Docs', 'Brief desc')}
              ${chip(!isOld, 'Active Commit', 'Inactive')}
            </div>
          </div>
        </div>`;
      }).join('');

  // Improvements panel
  document.getElementById('ghImprovementsList').innerHTML = improvements.map(imp => `
    <div style="background:var(--bg-3);border:1px solid var(--border);border-radius:10px;padding:20px;display:flex;flex-direction:column;gap:12px;">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="font-size:20px;">${imp.icon}</span>
        <strong style="font-size:15px;color:var(--text);">${imp.title}</strong>
        <span class="chip ${imp.level === 'critical' ? 'missing' : imp.level === 'high' ? 'warn' : 'found'}" style="margin-left:auto;">${imp.level.toUpperCase()}</span>
      </div>
      <div style="font-size:13px;line-height:1.5;color:var(--text-2);">
        <span style="color:var(--accent-2);font-weight:600;font-size:11px;letter-spacing:0.05em;display:block;margin-bottom:2px;">WHY IT MATTERS:</span> ${imp.why}
      </div>
      <div style="font-size:13px;line-height:1.5;color:var(--text-2);">
        <span style="color:var(--accent);font-weight:600;font-size:11px;letter-spacing:0.05em;display:block;margin-bottom:2px;">HOW TO IMPROVE:</span> ${imp.how}
      </div>
      ${imp.before && imp.after ? `
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;font-family:monospace;font-size:12px;display:flex;flex-direction:column;gap:6px;margin-top:4px;">
        <div style="color:var(--danger);word-break:break-word;"><span style="font-weight:600;">❌ BEFORE:</span> ${imp.before}</div>
        <div style="color:var(--accent);word-break:break-word;"><span style="font-weight:600;">✅ AFTER:</span> ${imp.after}</div>
      </div>` : ''}
    </div>
  `).join('');

  // Save state
  PlaceometerState.githubSignal = score;
  PlaceometerState.githubSignalLevel = scoreGrade(score).grade;
  PlaceometerState.githubWeaknesses = weaknesses;
  PlaceometerState.save();
}

function showGhError(msg) {
  const el = document.getElementById('ghError');
  el.style.display = 'block';
  el.innerHTML = `<div class="alert error">⚠️ ${msg}</div>`;
}
