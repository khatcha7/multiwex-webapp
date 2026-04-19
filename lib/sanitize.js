// Sanitize HTML rendered via dangerouslySetInnerHTML (notes Tiptap, etc.)
// Anti-XSS : un staff malveillant pourrait POST une note avec <script> via API directe.
import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'a', 'span'];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'style'];

export function sanitizeHTML(dirty) {
  if (!dirty) return '';
  return DOMPurify.sanitize(String(dirty), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
  });
}
