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

// 只接受 POST，其他方法 Pages 会自动返回 405
export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD) {
    return json({ error: '服务端未配置 ADMIN_PASSWORD 环境变量' }, 500);
  }

  let body = {};
  try { body = await request.json(); } catch (_) {}
  const password = String(body.password || '');

  if (!password || password !== env.ADMIN_PASSWORD) {
    return json({ error: '密码错误' }, 401);
  }

  // 无状态 token：由密码派生，服务端每次重新计算即可校验
  const token = await sha256(env.ADMIN_PASSWORD + '::rules-token');
  return json({ token });
}