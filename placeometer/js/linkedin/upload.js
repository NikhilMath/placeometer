// js/linkedin/upload.js — Fix #2: fully active upload/drag/paste/analysis logic
// Fix #9: ARIA roles, tabindex, keyboard support on interactive cards

window.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.screenshot-card');

  cards.forEach(card => {
    const type = card.id.replace('card_', '');

    // Fix #9: make cards keyboard accessible
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Upload ${type} screenshot. Press Enter to open file picker.`);

    card.addEventListener('mouseenter', () => { card.dataset.hover = 'true'; });
    card.addEventListener('mouseleave', () => { card.dataset.hover = 'false'; });

    card.addEventListener('click', (e) => {
      if (e.target.closest('.thumb-remove') || e.target.closest('.btn-add-another') || e.target.closest('input')) return;
      cards.forEach(c => c.classList.remove('active-card'));
      card.classList.add('active-card');
    });

    // Fix #9: keyboard activation
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cards.forEach(c => c.classList.remove('active-card'));
        card.classList.add('active-card');
        triggerFileInput(type);
      }
    });

    card.addEventListener('dragover',  (e) => { e.preventDefault(); card.classList.add('drag-over'); });
    card.addEventListener('dragleave', ()  => card.classList.remove('drag-over'));
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length) processFiles(type, files);
    });
  });

  // Clipboard paste onto active card
  window.addEventListener('paste', (e) => {
    const activeCard = document.querySelector('.screenshot-card.active-card');
    if (!activeCard) return;
    const type = activeCard.id.replace('card_', '');
    const images = Array.from(e.clipboardData.items)
      .filter(item => item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter(Boolean);
    if (images.length) {
      e.preventDefault();
      processFiles(type, images);
    }
  });
});

function triggerFileInput(type) {
  document.getElementById(`file_${type}`).click();
}

function handleFileSelect(type, input) {
  const files = Array.from(input.files).filter(f => f.type.startsWith('image/'));
  if (files.length) {
    processFiles(type, files);
    input.value = '';
  }
}

function processFiles(type, files) {
  const card   = document.getElementById(`card_${type}`);
  const area   = card.querySelector('.upload-area');
  const btnAdd = document.getElementById(`btn_add_${type}`);

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      linkedinState.sectionAssets[type].push({ src: e.target.result, file, extractedText: '', confidence: 0 });
      renderGallery(type);
      updateGeneratorState();
    };
    reader.readAsDataURL(file);
  });

  area.style.display = 'none';
  btnAdd.style.display = 'inline-flex';
}

function removeScreenshot(type, index) {
  linkedinState.sectionAssets[type].splice(index, 1);
  renderGallery(type);
  updateGeneratorState();
  if (linkedinState.sectionAssets[type].length === 0) {
    document.getElementById(`card_${type}`).querySelector('.upload-area').style.display = 'flex';
    document.getElementById(`btn_add_${type}`).style.display = 'none';
  }
}

function renderGallery(type) {
  document.getElementById(`gallery_${type}`).innerHTML =
    linkedinState.sectionAssets[type].map((asset, idx) => `
      <div class="thumb-wrap">
        <img src="${asset.src}" class="thumb-img" alt="Screenshot ${idx + 1} for ${type}">
        <div class="thumb-remove" role="button" tabindex="0" aria-label="Remove screenshot ${idx + 1}"
          onclick="removeScreenshot('${type}', ${idx})"
          onkeydown="if(event.key==='Enter'||event.key===' '){removeScreenshot('${type}',${idx})}">✕</div>
      </div>`).join('');
}

function updateGeneratorState() {
  const total = linkedinUtils.getTotalUploads();
  const btn   = document.getElementById('generateBtn');
  btn.style.opacity       = total > 0 ? '1' : '0.6';
  btn.style.pointerEvents = total > 0 ? 'auto' : 'none';
  btn.setAttribute('aria-disabled', total === 0 ? 'true' : 'false');
}

async function startAnalysis() {
  document.getElementById('uploadWorkspace').style.display  = 'none';
  document.getElementById('analysisState').style.display    = 'block';
  document.getElementById('consoleLogs').innerHTML          = '';
  document.getElementById('loaderBar').style.width          = '0%';

  const steps = [
    { text: 'Initialising OCR engine…',             delay: 200 },
    { text: 'Extracting visible text from uploads…', delay: 300 },
    { text: 'Detecting profile keywords…',           delay: 300 },
    { text: 'Evaluating recruiter visibility…',      delay: 300 },
    { text: 'Generating evidence-based report…',     delay: 250 },
  ];

  let pct = 0;
  const inc = 100 / (steps.length + 1);

  for (const step of steps) {
    LinkedInRenderer.appendToConsole(step.text);
    await _delay(step.delay);
    pct += inc;
    document.getElementById('loaderBar').style.width = `${Math.min(90, Math.round(pct))}%`;
  }

  // Fix #4: actually run OCR
  await LinkedInOCR.extractAllSections((m) => {
    if (m.status) LinkedInRenderer.appendToConsole(m.status);
  });

  LinkedInRenderer.appendToConsole('Running profile analysis…');
  const analysis = LinkedInAnalyzer.analyzeProfile();
  linkedinState.analysisResults = analysis;

  // Persist to shared state for Tasks page
  PlaceometerState.linkedinSignal      = analysis.profileScore;
  PlaceometerState.linkedinSignalLevel = window.signalLabel(analysis.profileScore).grade;
  PlaceometerState.linkedinWeaknesses  = analysis.improvements
    .filter(i => i.severity === 'high' || i.severity === 'critical')
    .map(i => i.title);
  PlaceometerState.save();

  document.getElementById('loaderBar').style.width = '100%';
  await _delay(300);

  LinkedInRenderer.renderResults(analysis);
  document.getElementById('analysisState').style.display  = 'none';
  document.getElementById('resultsSection').style.display = 'block';

  // Fix #9: announce results to screen readers
  const live = document.getElementById('resultsLiveRegion');
  if (live) live.textContent = 'LinkedIn audit complete. Your optimization report is ready.';
}

function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function resetAuditor() {
  linkedinUtils.sectionKeys.forEach(k => {
    linkedinState.sectionAssets[k] = [];
    linkedinState.sectionText[k]   = '';
    linkedinState.extractedQuality[k] = 0;
  });
  linkedinState.analysisResults = null;
  linkedinState.ocrWarnings     = [];

  document.querySelectorAll('.screenshot-card').forEach(card => {
    card.classList.remove('active-card');
    card.querySelector('.upload-area').style.display = 'flex';
    const type = card.id.replace('card_', '');
    document.getElementById(`btn_add_${type}`).style.display  = 'none';
    document.getElementById(`gallery_${type}`).innerHTML      = '';
  });

  document.getElementById('resultsSection').style.display  = 'none';
  document.getElementById('analysisState').style.display   = 'none';
  document.getElementById('uploadWorkspace').style.display = 'block';
  document.getElementById('consoleLogs').innerHTML         = '';
  document.getElementById('loaderBar').style.width         = '0%';
  updateGeneratorState();
}
