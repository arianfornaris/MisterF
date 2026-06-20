function e(e){let t=document.createElement(`div`);return t.textContent=e,t.innerHTML}function t(t){if(!window.marked||!window.DOMPurify)return e(t).replaceAll(`
`,`<br>`);let n=window.marked.parse(t||``);return window.DOMPurify.sanitize(n,{USE_PROFILES:{html:!0}})}export{t};
//# sourceMappingURL=markdown-BmNuvlLQ.js.map