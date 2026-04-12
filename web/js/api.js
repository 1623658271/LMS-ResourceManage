// ============================================================
// fetch 封装
// ============================================================
async function get(url) { const r = await fetch(API + url); return r.json(); }
async function post(url, body) {
  const r = await fetch(API + url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  return r.json();
}
async function put(url, body) {
  const r = await fetch(API + url, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  return r.json();
}
async function del(url) { const r = await fetch(API + url, { method:'DELETE' }); return r.json(); }
