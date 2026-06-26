const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadLinkedInScripts() {
  const sandbox = {
    window: {},
    console,
    setTimeout,
    clearTimeout,
    document: { createElement: () => ({ getContext: () => ({}) }) },
    navigator: { userAgent: 'node.js' }
  };
  sandbox.global = sandbox;
  sandbox.window = sandbox;

  const stateCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'linkedin', 'state.js'), 'utf8');
  const analyzerCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'linkedin', 'analyzer.js'), 'utf8');

  vm.runInNewContext(stateCode, sandbox);
  sandbox.linkedinState = sandbox.window.linkedinState;
  sandbox.linkedinUtils = sandbox.window.linkedinUtils;
  sandbox.linkedinState = sandbox.window.linkedinState;
  sandbox.linkedinUtils = sandbox.window.linkedinUtils;
  sandbox.linkedinState = sandbox.window.linkedinState;
  sandbox.linkedinUtils = sandbox.window.linkedinUtils;
  sandbox.global.linkedinState = sandbox.linkedinState;
  sandbox.global.linkedinUtils = sandbox.linkedinUtils;
  vm.runInNewContext(analyzerCode, sandbox);

  return sandbox;
}

test('LinkedIn analyzer includes projects section analysis and project-specific improvement guidance', () => {
  const sandbox = loadLinkedInScripts();
  const { linkedinState, window } = sandbox;

  linkedinState.sectionAssets.projects = [{ src: 'data:image/png;base64,abc', file: {} }];
  linkedinState.sectionText.projects = 'React project with GitHub repository, deployed on Vercel and improved performance by 20%';
  linkedinState.sectionText.about = 'Built React and Node.js products for 500 users';
  linkedinState.sectionText.header = 'Full-Stack Developer | React | Node.js';
  linkedinState.sectionText.featured = 'Featured project with React and Vercel';
  linkedinState.sectionText.experience = 'Developed features and improved performance by 15%';
  linkedinState.sectionText.skills = 'React Node.js Python JavaScript TypeScript';
  linkedinState.sectionText.activity = 'Shared project milestones and deployments';
  linkedinState.sectionText.certifications = 'AWS Certified Cloud Practitioner';

  const analysis = window.LinkedInAnalyzer.analyzeProfile();

  assert.ok(analysis.sectionAnalysis.projects, 'expected projects analysis data');
  assert.ok(analysis.sectionAnalysis.projects.stackHits.includes('react'), 'expected React to be detected');
  assert.ok(analysis.sectionAnalysis.projects.hasUrl, 'expected URL detection for projects');
  assert.ok(analysis.improvements.some((item) => /deployment|github|outcomes|descriptions/i.test(item.title)), 'expected project-specific improvement suggestions');
});
