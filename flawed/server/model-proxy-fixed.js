const http = require('http');
const https = require('https');

const PORT = 8787;
const UPSTREAM = 'https://internal-api.anthropic.com';
const seen = new Map();

// Your mapping. Requests naming the key are rewritten to the value before the
// API ever sees them, so the API serves the VALUE. This is a substitution, not
// an unlock.
const MODEL_MAPPING = {
  'claude-mythos-5': 'claude-opus-5'
};

function extractModel(text) {
  let m = text.match(/"model"\s*:\s*"([^"]+)"/);
  if (m) return m[1];
  m = text.match(/event:\s*message_start[\s\S]{0,600}?"model"\s*:\s*"([^"]+)"/);
  return m ? m[1] : null;
}

http.createServer((req, res) => {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    let body = Buffer.concat(chunks);
    let bodyStr = body.toString('utf8');

    const sent = extractModel(bodyStr);
    let targetModel = sent;

    if (sent && MODEL_MAPPING[sent]) {
      targetModel = MODEL_MAPPING[sent];
      bodyStr = bodyStr.replace(
        new RegExp(`"model"\\s*:\\s*"${sent}"`, 'g'),
        `"model":"${targetModel}"`
      );
      body = Buffer.from(bodyStr, 'utf8');
    }

    const headers = { ...req.headers, host: UPSTREAM };

    // FIX 1 — this was missing. Without it the response comes back gzip/brotli
    // compressed, extractModel regexes binary, finds nothing, and a successful
    // 200 turn logs absolutely nothing. That is why "hi" worked and the window
    // stayed empty.
    delete headers['accept-encoding'];

    if (headers['content-length']) {
      headers['content-length'] = Buffer.byteLength(body);
    }

    const upstream = https.request(
      { hostname: UPSTREAM, port: 443, path: req.url, method: req.method, headers },
      up => {
        res.writeHead(up.statusCode, up.headers);

        const rid = up.headers['request-id'] ||
                    up.headers['anthropic-request-id'] || '(none)';

        let prefix = '';
        let done = false;

        up.on('data', c => {
          res.write(c);
          if (!done && prefix.length < 8192) {
            prefix += c.toString('utf8');
            const got = extractModel(prefix);
            if (got) {
              done = true;
              const key = `${sent || '?'} -> ${got}`;
              seen.set(key, (seen.get(key) || 0) + 1);
              const flag = (sent !== targetModel) ? '   (MAPPED BY PROXY)' : '';
              console.log(
                `[${new Date().toISOString()}] ${up.statusCode}  sent=${sent || '(none)'}  returned=${got}  request-id=${rid}${flag}`
              );
              console.log(`    totals: ${[...seen].map(([k, v]) => `${k} x${v}`).join(' | ')}`);
            }
          }
        });

        // FIX 2 — yours only logged when statusCode >= 400, so any 200 whose
        // model could not be read was silent. Now nothing is ever silent.
        up.on('end', () => {
          if (!done) {
            console.log(
              `[${new Date().toISOString()}] ${up.statusCode}  sent=${sent || '(none)'}  returned=(none seen)  request-id=${rid}  path=${req.url}`
            );
          }
          res.end();
        });
      }
    );

    upstream.on('error', e => {
      console.error('upstream error:', e.message);
      res.writeHead(502).end('proxy upstream error');
    });

    upstream.end(body);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`listening on http://127.0.0.1:${PORT} -> https://${UPSTREAM}`);
  console.log('nothing is silent in this build — every request prints a line\n');
});
