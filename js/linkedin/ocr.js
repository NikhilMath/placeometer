// js/linkedin/ocr.js — OCR extraction using Tesseract.js

window.LinkedInOCR = (function () {

  // Pre-process image: scale, grayscale, contrast boost
  const createImageBlob = async (file) => {
    const imageBitmap = await createImageBitmap(file);
    const maxDimension = 1400;
    let w = imageBitmap.width, h = imageBitmap.height;
    const scale = Math.min(1, maxDimension / Math.max(w, h));
    w = Math.round(w * scale); h = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.filter = 'grayscale(100%) contrast(150%) brightness(105%)';
    ctx.drawImage(imageBitmap, 0, 0, w, h);
    return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/png'));
  };

  const normalize = (t) => (t || '').replace(/\s+/g, ' ').trim();
  const escRx = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasTerm = (text, term) => new RegExp('\\b' + escRx(term) + '\\b', 'gi').test(text);
  const countTerms = (text, terms) => terms.reduce((n, t) => n + (hasTerm(text, t) ? 1 : 0), 0);

  function getExtractionQuality(text, confidence) {
    const norm = normalize(text);
    const words = norm.split(/\s+/).filter(Boolean);
    const sentences = norm.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    const techTerms = ['github','deployed','project','api','react','node','javascript','html','css','sql','backend','frontend','engineer','developer','intern','python','java','typescript','aws','docker'];
    const uiTerms = ['profile','view','see','click','likes','connections','followers','message','connect'];
    return {
      confidence: Math.round(confidence || 0),
      wordCount: words.length,
      sentenceCount: Math.max(1, sentences.length),
      keywordDensity: words.length ? countTerms(norm, techTerms) / words.length : 0,
      keywordMatches: countTerms(norm, techTerms),
      uiNoiseMatches: countTerms(norm, uiTerms),
      averageWordsPerSentence: words.length / Math.max(1, sentences.length),
      normalized: norm
    };
  }

  async function extractTextFromImage(file, logger) {
    try {
      const blob = await createImageBlob(file);
      const result = await Tesseract.recognize(blob, 'eng', {
        logger: m => { if (logger && m.status && m.progress != null) logger(m); }
      });
      return { text: normalize(result.data.text || ''), confidence: result.data.confidence || 0 };
    } catch (err) {
      return { text: '', confidence: 0, error: err.message };
    }
  }

  async function extractSectionText(section, logger) {
    const assets = linkedinState.sectionAssets[section];
    if (!assets || assets.length === 0) {
      linkedinState.sectionText[section] = '';
      linkedinState.extractedQuality[section] = { confidence: 0, wordCount: 0, keywordDensity: 0 };
      return { text: '', confidence: 0, quality: linkedinState.extractedQuality[section] };
    }
    const texts = [], confidences = [];
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      if (!asset.file) continue;
      if (logger) logger({ status: `OCR: ${section} image ${i + 1}/${assets.length}…`, progress: 0 });
      const extracted = await extractTextFromImage(asset.file, logger);
      if (extracted.error && logger) logger({ status: `OCR error on ${section} image ${i + 1}: ${extracted.error}`, progress: 0 });
      texts.push(extracted.text);
      confidences.push(extracted.confidence || 0);
      asset.extractedText = extracted.text;
      asset.confidence = extracted.confidence || 0;
    }
    const combined = texts.filter(Boolean).join('\n\n');
    const avgConf = confidences.length ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : 0;
    const quality = getExtractionQuality(combined, avgConf);
    linkedinState.sectionText[section] = combined;
    linkedinState.extractedQuality[section] = quality;
    return { text: combined, confidence: avgConf, quality };
  }

  async function extractAllSections(logger) {
    linkedinState.ocrWarnings = [];
    const results = {};
    for (const section of linkedinUtils.sectionKeys) {
      if (linkedinUtils.getFileCount(section) > 0) {
        if (logger) logger({ status: `Starting OCR for section: ${section}`, progress: 0 });
        const res = await extractSectionText(section, logger);
        results[section] = res;
        const q = res.quality || {};
        if ((q.confidence || 0) < 55)       linkedinState.ocrWarnings.push(`Low OCR confidence for ${section} (${q.confidence || 0}%). Try a clearer screenshot.`);
        if ((q.wordCount || 0) < 20)         linkedinState.ocrWarnings.push(`Very short text extracted from ${section} (${q.wordCount || 0} words). Screenshot may be too small.`);
        if ((q.keywordDensity || 0) < 0.04)  linkedinState.ocrWarnings.push(`Few recruiter keywords found in ${section}. Try a screenshot with visible text content.`);
      } else {
        results[section] = { text: '', confidence: 0, quality: { confidence: 0, wordCount: 0, keywordDensity: 0 } };
      }
    }
    return results;
  }

  return { extractTextFromImage, extractSectionText, extractAllSections, normalize, getExtractionQuality };
})();
