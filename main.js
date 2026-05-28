// main.js — Placeometer shared state + utilities
// Fix #7: localStorage with sessionStorage fallback; graceful in private/Claude.ai envs

// ─── State ────────────────────────────────────────────────────────────────
const PlaceometerState = {
  resumeSignal:      null,
  githubSignal:      null,
  linkedinSignal:    null,
  resumeSignalLevel: null,
  githubSignalLevel: null,
  linkedinSignalLevel: null,
  resumeWeaknesses:  [],
  githubWeaknesses:  [],
  linkedinWeaknesses: [],

  _data() {
    return {
      resumeSignal:      this.resumeSignal,
      githubSignal:      this.githubSignal,
      linkedinSignal:    this.linkedinSignal,
      resumeSignalLevel: this.resumeSignalLevel,
      githubSignalLevel: this.githubSignalLevel,
      linkedinSignalLevel: this.linkedinSignalLevel,
      resumeWeaknesses:  this.resumeWeaknesses,
      githubWeaknesses:  this.githubWeaknesses,
      linkedinWeaknesses: this.linkedinWeaknesses,
    };
  },

  save() {
    const json = JSON.stringify(this._data());
    // Fix #7: try localStorage, fall back to sessionStorage, then in-memory only
    try { localStorage.setItem('placeometer_state', json); return; } catch (e) { /* continue */ }
    try { sessionStorage.setItem('placeometer_state', json); } catch (e) { /* in-memory only */ }
  },

  load() {
    let raw = null;
    try { raw = localStorage.getItem('placeometer_state'); } catch (e) { /* continue */ }
    if (!raw) {
      try { raw = sessionStorage.getItem('placeometer_state'); } catch (e) { /* continue */ }
    }
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      // Support legacy keys (resumeScore, githubScore, linkedinScore)
      this.resumeSignal      = d.resumeSignal  ?? d.resumeScore  ?? null;
      this.githubSignal      = d.githubSignal  ?? d.githubScore  ?? null;
      this.linkedinSignal    = d.linkedinSignal ?? d.linkedinScore ?? null;
      this.resumeSignalLevel  = d.resumeSignalLevel  || (this.resumeSignal  != null ? signalLabel(this.resumeSignal).grade  : null);
      this.githubSignalLevel  = d.githubSignalLevel  || (this.githubSignal  != null ? signalLabel(this.githubSignal).grade  : null);
      this.linkedinSignalLevel = d.linkedinSignalLevel || (this.linkedinSignal != null ? signalLabel(this.linkedinSignal).grade : null);
      this.resumeWeaknesses   = d.resumeWeaknesses   || [];
      this.githubWeaknesses   = d.githubWeaknesses   || [];
      this.linkedinWeaknesses = d.linkedinWeaknesses || [];
    } catch (e) { /* corrupt data — ignore */ }
  }
};

PlaceometerState.load();

// ─── Colour & grade utilities ─────────────────────────────────────────────
function signalColor(value) {
  if (value >= 75) return '#4ade80';
  if (value >= 50) return '#fbbf24';
  return '#f87171';
}
const scoreColor = signalColor;

function signalLabel(value) {
  if (value >= 85) return { grade: 'Strong',    desc: 'Strong recruiter visibility, with clear profile signals and solid proof-of-work.' };
  if (value >= 70) return { grade: 'Moderate',  desc: 'Moderate visibility; strengthen impact statements and project evidence.' };
  if (value >= 50) return { grade: 'Improving', desc: 'Improving visibility, but still needs clearer technical proof and outcome language.' };
  return            { grade: 'Weak',      desc: 'Weak visibility. Focus on specific technical achievements and recruiter-facing portfolio signals.' };
}
const scoreGrade = signalLabel;

// ─── Animated number counter ──────────────────────────────────────────────
function animateNumber(el, target, duration = 1200) {
  let start = 0;
  const step = (ts) => {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(ease * target);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ─── Score ring SVG builder ───────────────────────────────────────────────
function buildRingSVG(value, color, id = 'mainRing') {
  const r    = 68;
  const circ = 2 * Math.PI * r;
  // Fix #9: aria-label on SVG ring
  return `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg"
    role="img" aria-label="Score: ${value} out of 100">
    <circle cx="80" cy="80" r="${r}" fill="none" stroke="#1a2236" stroke-width="12"/>
    <circle cx="80" cy="80" r="${r}" fill="none" stroke="${color}" stroke-width="12"
      stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${circ.toFixed(2)}"
      stroke-linecap="round" transform="rotate(-90 80 80)"
      style="transition:stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)"
      id="${id}"/>
  </svg>`;
}

function animateRing(id, value, color) {
  const el = document.getElementById(id);
  if (!el) return;
  const r    = 68;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  requestAnimationFrame(() => {
    setTimeout(() => { el.style.strokeDashoffset = offset; el.style.stroke = color; }, 50);
  });
}

// ─── Expose globals ───────────────────────────────────────────────────────
window.PlaceometerState  = PlaceometerState;
window.signalColor       = signalColor;
window.scoreColor        = scoreColor;
window.signalLabel       = signalLabel;
window.scoreGrade        = scoreGrade;
window.animateNumber     = animateNumber;
window.buildRingSVG      = buildRingSVG;
window.animateRing       = animateRing;
