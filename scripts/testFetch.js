// Usage: node scripts/testFetch.js http://localhost:5174/api/debug/ping [method] [jsonBody]
import http from 'http';
import https from 'https';
import { URL } from 'url';

const urlStr = process.argv[2];
const method = (process.argv[3] || 'GET').toUpperCase();
const body = process.argv[4] ? process.argv[4] : null;
if (!urlStr) {
  console.error('Missing URL');
  process.exit(1);
}
const u = new URL(urlStr);
const lib = u.protocol === 'https:' ? https : http;
const opts = {
  method,
  hostname: u.hostname,
  port: u.port || (u.protocol === 'https:' ? 443 : 80),
  path: u.pathname + (u.search || ''),
  headers: {}
};
let payload = null;
if (body) {
  payload = body;
  opts.headers['Content-Type'] = 'application/json';
  opts.headers['Content-Length'] = Buffer.byteLength(payload);
}
const req = lib.request(opts, res => {
  let data = '';
  res.on('data', chunk => (data += chunk));
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    console.log('BODY', data);
  });
});
req.on('error', err => {
  console.error('ERR', err.message);
  process.exit(1);
});
if (payload) req.write(payload);
req.end();


