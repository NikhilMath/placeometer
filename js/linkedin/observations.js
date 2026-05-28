// js/linkedin/observations.js

window.LinkedInObservations = {
  formatList(items) {
    if (!items || items.length === 0)
      return '<div style="font-size:13px;color:var(--text-3);">No observations available.</div>';
    return `<ul style="margin:0;padding-left:18px;line-height:1.7;">${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
  },
  formatPriorityList(items) {
    if (!items || items.length === 0)
      return '<div style="font-size:13px;color:var(--text-3);">No improvement suggestions available.</div>';
    return `<ol style="margin:0;padding-left:18px;line-height:1.7;">${items.map(i => `<li>${i}</li>`).join('')}</ol>`;
  }
};
