import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: false });

// Make every link safe: no referrer, new context, and flagged for the OS link guard.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('rel', 'noopener noreferrer');
    node.setAttribute('target', '_blank');
    node.setAttribute('data-external', '1');
  }
  if (node.tagName === 'INPUT' && node.getAttribute('type') === 'checkbox') {
    node.removeAttribute('disabled');
  }
  // Block remote images (tracking pixels) — only local/data/blob sources are allowed.
  if (node.tagName === 'IMG') {
    const src = node.getAttribute('src') ?? '';
    if (!/^(data:|blob:)/.test(src)) {
      node.setAttribute('data-blocked-src', src);
      node.setAttribute('alt', `[remote image blocked: ${src.slice(0, 60)}]`);
      node.removeAttribute('src');
    }
  }
});

export function renderMarkdown(src: string): string {
  const html = marked.parse(src, { async: false }) as string;
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'checked'], FORBID_TAGS: ['style', 'iframe', 'form'] });
}

export function sanitizeHtml(html: string) {
  return DOMPurify.sanitize(html);
}

/** Toggle the n-th GitHub task list checkbox in markdown source. */
export function toggleTask(src: string, index: number): string {
  let i = -1;
  return src.replace(/^(\s*[-*+]\s+\[)([ xX])(\])/gm, (m, a, mark, b) => {
    i++;
    if (i !== index) return m;
    return `${a}${mark === ' ' ? 'x' : ' '}${b}`;
  });
}

export function firstHeading(src: string) {
  const m = /^#{1,3}\s+(.+)$/m.exec(src);
  return m ? m[1].trim() : null;
}

export function plainSnippet(src: string, n = 120) {
  return src
    .replace(/^#{1,6}\s+.*$/m, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~\-[\]()!|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n);
}
