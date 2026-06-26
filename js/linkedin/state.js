// js/linkedin/state.js — shared state for LinkedIn audit

window.linkedinState = {
  sectionAssets: {
    header: [], about: [], projects: [], featured: [],
    experience: [], skills: [], activity: [], certifications: []
  },
  sectionText: {
    header: '', about: '', projects: '', featured: '',
    experience: '', skills: '', activity: '', certifications: ''
  },
  extractedQuality: {
    header: 0, about: 0, projects: 0, featured: 0,
    experience: 0, skills: 0, activity: 0, certifications: 0
  },
  analysisResults: null,
  ocrWarnings: []
};

window.linkedinUtils = {
  sectionKeys: ['header','about','projects','featured','experience','skills','activity','certifications'],
  getTotalUploads() {
    return this.sectionKeys.reduce((s, k) => s + linkedinState.sectionAssets[k].length, 0);
  },
  getFileCount(section) {
    return linkedinState.sectionAssets[section].length;
  }
};
