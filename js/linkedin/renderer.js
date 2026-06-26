// js/linkedin/renderer.js — Fix #4 #14: render real analysis, conditional improvement tips

window.LinkedInRenderer = {

  appendToConsole(text) {
    const el = document.getElementById('consoleLogs');
    if (el) el.innerHTML += `<div style="margin-bottom:5px;">→ ${text}</div>`;
  },

  renderResults(analysis) {
    const { profileScore, scoreMap, improvements, strengths, gaps, ocrWarnings, projectStrengths, projectGaps, projectInsight, projectSuggestions } = analysis;

    // ── Score ring ────────────────────────────────────────────────────────
    const color = window.scoreColor(profileScore);

    // Inject a score ring into the results header if element exists
    const ringEl = document.getElementById('liScoreRingWrap');
    if (ringEl) {
      ringEl.innerHTML = window.buildRingSVG(profileScore, color, 'liRing') +
        `<div class="big-ring-label">
           <span class="big-ring-num" id="liScoreNum">0</span>
           <span class="big-ring-sub">/ 100</span>
         </div>`;
      setTimeout(() => {
        window.animateRing('liRing', profileScore, color);
        window.animateNumber(document.getElementById('liScoreNum'), profileScore);
      }, 150);
    }

    const g = window.scoreGrade(profileScore);
    const gradeEl = document.getElementById('liScoreGrade');
    const descEl  = document.getElementById('liScoreDesc');
    if (gradeEl) { gradeEl.textContent = g.grade; gradeEl.style.color = color; }
    if (descEl)  descEl.textContent = g.desc;

    // ── OCR warnings ──────────────────────────────────────────────────────
    const warnEl = document.getElementById('ocrWarnings');
    if (warnEl) {
      warnEl.innerHTML = ocrWarnings.length
        ? ocrWarnings.map(w => `<div style="margin-bottom:6px;">⚠️ ${w}</div>`).join('')
        : '';
    }

    // ── Five report sections ──────────────────────────────────────────────
    this._renderReportBox('strength_visibility', 'strength', '🌟 Recruiter Strength',
      LinkedInObservations.formatList(strengths.filter((_, i) => i < 3))
    );
    this._renderReportBox('gap_visibility', 'gap', '⚠️ Recruiter Gap',
      LinkedInObservations.formatList(gaps.filter((_, i) => i < 3))
    );
    this._renderReportBox('insight_visibility', 'insight', '💡 Recruiter Insight',
      'Headlines with technical keywords and role titles are indexed by recruiter search tools. Generic titles are filtered out.'
    );

    this._renderReportBox('strength_branding', 'strength', '🌟 Technical Branding Strength',
      LinkedInObservations.formatList(strengths.filter(s => /about|bio|stack|metric|quant/.test(s.toLowerCase())))
        || 'Upload the About section screenshot to receive branding analysis.'
    );
    this._renderReportBox('gap_branding', 'gap', '⚠️ Branding Gap',
      LinkedInObservations.formatList(gaps.filter(g => /about|verb|metric|passive/.test(g.toLowerCase())))
        || 'No About section gaps detected.'
    );
    this._renderReportBox('insight_branding', 'insight', '💡 Branding Insight',
      'A concise technical About section is one of the top signals recruiters use to decide whether to keep reading your profile.'
    );

    this._renderReportBox('strength_portfolio', 'strength', '🌟 Portfolio Strength',
      LinkedInObservations.formatList(strengths.filter(s => /url|featured|live|link|deploy/.test(s.toLowerCase())))
        || 'Upload the Featured section screenshot to receive portfolio analysis.'
    );
    this._renderReportBox('gap_portfolio', 'gap', '⚠️ Portfolio Gap',
      LinkedInObservations.formatList(gaps.filter(g => /url|featured|live|link|deploy/.test(g.toLowerCase())))
        || 'No Featured section gaps detected.'
    );
    this._renderReportBox('insight_portfolio', 'insight', '💡 Portfolio Insight',
      'Featured builds are the fastest way to convert profile attention into recruiter confidence and interview requests.'
    );

    this._renderReportBox('strength_projects', 'strength', '🌟 Project Strengths',
      LinkedInObservations.formatList(projectStrengths)
    );
    this._renderReportBox('gap_projects', 'gap', '⚠️ Project Gaps',
      LinkedInObservations.formatList(projectGaps)
    );
    this._renderReportBox('insight_projects', 'insight', '💡 Project Insight',
      projectInsight || 'Projects should clearly show the build, the stack, the links, and the outcomes.'
    );
    this._renderReportBox('suggestions_projects', 'insight', '🛠️ Project Improvement Suggestions',
      LinkedInObservations.formatList(projectSuggestions)
    );

    this._renderReportBox('strength_activity', 'strength', '🌟 Activity Strength',
      LinkedInObservations.formatList(strengths.filter(s => /activity|post|technical/.test(s.toLowerCase())))
        || 'Upload the Activity Feed screenshot to receive activity analysis.'
    );
    this._renderReportBox('gap_activity', 'gap', '⚠️ Activity Gap',
      LinkedInObservations.formatList(gaps.filter(g => /activity|post|feed/.test(g.toLowerCase())))
        || 'No activity gaps detected.'
    );
    this._renderReportBox('insight_activity', 'insight', '💡 Activity Insight',
      'Profiles with consistent project activity are more likely to appear in recruiter outreach and LinkedIn algorithm feeds.'
    );

    this._renderReportBox('strength_pow', 'strength', '🌟 Proof-of-Work Strength',
      LinkedInObservations.formatList(strengths.filter(s => /experience|skill|cert|keyword/.test(s.toLowerCase())))
        || 'Upload Experience, Skills, or Certifications screenshots for proof-of-work analysis.'
    );
    this._renderReportBox('gap_pow', 'gap', '⚠️ Proof-of-Work Gap',
      LinkedInObservations.formatList(gaps.filter(g => /experience|skill|cert|metric|verb/.test(g.toLowerCase())))
        || 'No proof-of-work gaps detected.'
    );
    this._renderReportBox('insight_pow', 'insight', '💡 Proof-of-Work Insight',
      'Recruiters use experience bullets and skills blocks to decide if your profile belongs in a technical shortlist. Outcome-based detail is key.'
    );

    // ── Score breakdown bars ──────────────────────────────────────────────
    const bdEl = document.getElementById('liBreakdown');
    if (bdEl && scoreMap) {
      const bdItems = [
        { label: 'Recruiter Visibility', val: scoreMap.visibility, max: 20, color: '#4ade80' },
        { label: 'Technical Branding',   val: scoreMap.branding,   max: 20, color: '#3b82f6' },
        { label: 'Portfolio Presence',   val: scoreMap.portfolio,  max: 20, color: '#a78bfa' },
        { label: 'Activity Signals',     val: scoreMap.activity,   max: 20, color: '#f59e0b' },
        { label: 'Proof of Work',        val: scoreMap.proof,      max: 20, color: '#22d3ee' },
      ];
      bdEl.innerHTML = bdItems.map(b => {
        const pct = Math.round((b.val / b.max) * 100);
        return `<div class="breakdown-item">
          <div class="breakdown-row">
            <span class="breakdown-label">${b.label}</span>
            <span class="breakdown-val" style="color:${b.color}">${b.val}/${b.max}</span>
          </div>
          <div class="breakdown-track">
            <div class="breakdown-fill" style="width:0%;background:${b.color}" data-width="${pct}%"></div>
          </div>
        </div>`;
      }).join('');
      setTimeout(() => {
        document.querySelectorAll('#liBreakdown .breakdown-fill[data-width]').forEach(el => {
          el.style.width = el.dataset.width;
        });
      }, 150);
    }

    // ── Fix #14: Conditional how-to cards based on detected gaps ─────────
    this._renderConditionalHowTo(analysis);

    // ── Improvements list ─────────────────────────────────────────────────
    const impEl = document.getElementById('improvementTips');
    if (impEl) {
      if (!improvements || improvements.length === 0) {
        impEl.innerHTML = '<div style="font-size:13px;color:var(--accent);">✓ No critical improvements detected in uploaded sections. Great work!</div>';
      } else {
        impEl.innerHTML = improvements.map((imp, i) => {
          const chipClass = imp.severity === 'critical' ? 'missing' : imp.severity === 'high' ? 'warn' : 'found';
          return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
            <span style="font-size:13px;color:var(--text-3);font-weight:600;flex-shrink:0;">${i + 1}.</span>
            <span style="font-size:13px;color:var(--text-2);flex:1;">${imp.title}</span>
            <span class="chip ${chipClass}" style="flex-shrink:0;">${(imp.severity || 'low').toUpperCase()}</span>
          </div>`;
        }).join('');
      }
    }
  },

  // ── Fix #14: Only show how-to cards relevant to detected gaps ────────────
  _renderConditionalHowTo(analysis) {
    const { gaps, sectionAnalysis } = analysis;
    const gapText = gaps.join(' ').toLowerCase();
    const sa = sectionAnalysis || {};

    const allHowTo = [
      {
        id: 'howto_headline',
        trigger: () => !sa.header || sa.header.roleHits.length === 0 || sa.header.stackHits.length < 2,
        title: '1. Rewrite Headline Using Role-Specific Technical Keywords',
        desc: 'Recruiters query software engineering interns by skills. Structure your headline using this formula:',
        formula: '[Target Role] | [Core Tech Stack 1] | [Core Tech Stack 2] | [Quantifiable Project Metric]',
        example: 'Full-Stack Intern | React & Node.js | Active GitHub Builder | Deployed 4 web apps supporting 500+ users'
      },
      {
        id: 'howto_about',
        trigger: () => !sa.about || sa.about.isEmpty || !sa.about.hasMetrics || sa.about.stackHits.length < 3,
        title: '2. Build About Section Technical Storytelling Outline',
        desc: 'Recruiters read the About block to check for passion and execution. Use this 4-block structure:',
        steps: [
          '<strong>The Hook (1–2 lines):</strong> What drives you as a developer.',
          '<strong>Core Stack Table:</strong> Clean list of languages, databases, and frameworks.',
          '<strong>Primary Pinned Build:</strong> Showcase 1 key app, detailing what you solved and linking the repo.',
          '<strong>Call To Action:</strong> "Open for junior roles. Contact: myemail@domain.com."'
        ]
      },
      {
        id: 'howto_featured',
        trigger: () => !sa.featured || !sa.featured.hasUrl,
        title: '3. Visual Featured Builds & Live Deployment Proof',
        desc: 'Featured cards occupy the largest visual block on your profile. Add clickable links:',
        steps: [
          'Attach a high-contrast mock-up thumbnail to grab attention.',
          'Link directly to your working live Vercel/Netlify deployment.',
          'Link directly to the public GitHub repository source code.'
        ]
      },
      {
        id: 'howto_activity',
        trigger: () => !sa.activity || (sa.activity.impactHits.length === 0 && sa.activity.stackHits.length === 0),
        title: '4. Write Weekly Project-Focused Activity Logs',
        desc: 'To boost algorithms and catch hiring manager feeds, share weekly progress logs:',
        formula: '"Today I optimized database indices on my chat project, reducing API response times to 45ms. Here is the deployed link…"',
        note: 'Always include a clean project screenshot to raise engagement indexation.'
      },
    ];

    // Only render relevant cards. Always show as "General Best Practices" label if all sections are strong.
    const relevantCards = allHowTo.filter(c => c.trigger());
    const container = document.getElementById('howToCardsContainer');
    if (!container) return;

    if (relevantCards.length === 0) {
      container.innerHTML = `<div style="font-size:13px;color:var(--accent);padding:12px 0;">
        ✓ Uploaded sections look strong. Review the general best practices below for extra polish.
      </div>`;
      // Still show all cards collapsed as "General Best Practices"
      const allCardsHtml = allHowTo.map(c => this._buildHowToCard(c)).join('');
      container.innerHTML += `
        <details style="margin-top:12px;">
          <summary style="font-size:13px;font-weight:600;color:var(--text-2);cursor:pointer;padding:8px 0;">
            📚 Show all general best practices
          </summary>
          <div style="margin-top:16px;display:flex;flex-direction:column;gap:16px;">${allCardsHtml}</div>
        </details>`;
    } else {
      container.innerHTML = `
        <div style="font-size:12px;color:var(--text-3);margin-bottom:12px;">
          Showing ${relevantCards.length} improvement blueprint${relevantCards.length > 1 ? 's' : ''} based on your uploaded profile sections.
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${relevantCards.map(c => this._buildHowToCard(c)).join('')}
        </div>`;
    }
  },

  _buildHowToCard(card) {
    const stepsHtml = card.steps
      ? `<ul style="margin:8px 0 0;padding-left:20px;font-size:12.5px;color:var(--text-2);line-height:1.6;">
           ${card.steps.map(s => `<li style="margin-bottom:5px;">${s}</li>`).join('')}
         </ul>`
      : '';
    const formulaHtml = card.formula
      ? `<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:10px;font-family:monospace;font-size:11.5px;color:var(--accent-2);margin:6px 0;">${card.formula}</div>`
      : '';
    const noteHtml = card.note
      ? `<div style="font-size:12px;color:var(--text-2);margin-top:6px;">${card.note}</div>`
      : '';
    return `<div class="how-to-card">
      <div class="how-to-title">${card.title}</div>
      <div class="how-to-desc">${card.desc}</div>
      ${formulaHtml}${stepsHtml}${noteHtml}
    </div>`;
  },

  _renderReportBox(id, type, titleText, bodyHtml) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<span class="report-box-title">${titleText}</span>${typeof bodyHtml === 'string' ? bodyHtml : ''}`;
  }
};
