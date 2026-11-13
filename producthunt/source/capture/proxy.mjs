// Local-only TLS front for the private copy, so a test browser started with
//   --host-resolver-rules="MAP bublr.life 127.0.0.1:3443"
// sees the app at https://bublr.life. Nothing here touches the real site.
import https from 'https'
import http from 'http'
import fs from 'fs'
const dir = new URL('.', import.meta.url).pathname
https.createServer({ key: fs.readFileSync(dir + 'key.pem'), cert: fs.readFileSync(dir + 'cert.pem') }, (req, res) => {
  const up = http.request({ host: '127.0.0.1', port: 3107, method: req.method, path: req.url, headers: { ...req.headers, host: 'localhost:3107' } }, r => {
    res.writeHead(r.statusCode, r.headers)
    r.pipe(res)
  })
  up.on('error', e => { res.writeHead(502); res.end(String(e)) })
  req.pipe(up)
}).listen(3443, '127.0.0.1', () => console.log('proxy on 3443'))
