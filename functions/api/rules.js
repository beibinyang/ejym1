const enc = new TextEncoder();

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function checkAuth(request, env) {
  if (!env.ADMIN_PASSWORD) {
    return { ok: false, res: json({ error: '服务端未配置 ADMIN_PASSWORD' }, 500) };
  }
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, res: json({ error: '未登录' }, 401) };

  const expect = await sha256(env.ADMIN_PASSWORD + '::rules-token');
  if (token !== expect) return { ok: false, res: json({ error: '登录已过期，请重新登录' }, 401) };
  return { ok: true };
}

/* ---------- 读取规则 ---------- */
export async function onRequestGet({ request, env }) {
  const a = await checkAuth(request, env);
  if (!a.ok) return a.res;

  const rules = (await env.RULES.get('rules', 'json')) || {};
  return json({ rules });
}

/* ---------- 保存规则 ---------- */
export async function onRequestPut({ request, env }) {
  const a = await checkAuth(request, env);
  if (!a.ok) return a.res;

  let body;
  try { body = await request.json(); } catch (_) {
    return json({ error: '请求体不是合法 JSON' }, 400);
  }

  const input = body && body.rules;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return json({ error: 'rules 字段格式错误' }, 400);
  }

  const clean = {};
  for (const [rawHost, r] of Object.entries(input)) {
    const host = String(rawHost).trim().toLowerCase();
    const target = String(r && r.target || '').trim();

    if (!host) return json({ error: '存在空域名' }, 400);
    if (!target) return json({ error: `域名 ${host} 缺少目标地址` }, 400);
    if (!/^https?:\/\//i.test(target)) {
      return json({ error: `域名 ${host} 的目标地址必须以 http:// 或 https:// 开头` }, 400);
    }

    const status = [301, 302, 307, 308].includes(Number(r.status)) ? Number(r.status) : 302;
    clean[host] = { target, status, enabled: r.enabled !== false };
  }

  await env.RULES.put('rules', JSON.stringify(clean));
  return json({ ok: true, rules: clean });
}