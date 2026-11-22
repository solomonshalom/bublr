import { setFrameHeaders } from '../../lib/profile-code'

/**
 * GET /api/profile-preview
 *
 * An empty sandboxed document for the Profile HTML editor's live preview. The
 * editor posts the page it built (the same buildProfileDocument the live
 * frame uses) and this writes it in. It carries the same sandbox headers as
 * the live frame, so the preview behaves exactly like the real page, and it
 * never echoes anything from the request, so its URL can't be used to show
 * someone else's HTML on bublr.life.
 */

const SHELL = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Preview</title></head><body><script>
(function(){
  var P = window.parent;
  if (!P || P === window) return;
  window.addEventListener('message', function (e) {
    if (e.source !== P) return;
    var m = e.data || {};
    if (m.type !== 'bublr:render' || typeof m.html !== 'string') return;
    document.open();
    document.write(m.html);
    document.close();
  });
  P.postMessage({ type: 'bublr:preview-shell' }, '*');
})();
</script></body></html>`

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }
  if (req.headers['sec-fetch-dest'] === 'document') {
    res.setHeader('Location', '/dashboard/settings/html')
    return res.status(302).end()
  }
  setFrameHeaders(res)
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.setHeader('Vary', 'Sec-Fetch-Dest')
  if (req.method === 'HEAD') return res.status(200).end()
  return res.status(200).send(SHELL)
}
