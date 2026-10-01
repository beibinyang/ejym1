export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // 1) 后台接口不参与跳转
  if (url.pathname.startsWith('/api/')) return next();

  // 2) 应急后门：加 ?__noredirect=1 可绕过跳转进入后台
  if (url.searchParams.has('__noredirect')) return next();

  // 3) 只对「网页导航请求」做跳转，静态资源请求直接放行（省 KV 读取、省延迟）
  //    老浏览器不带 Sec-Fetch-Dest，此时照常执行跳转
  const dest = request.headers.get('Sec-Fetch-Dest');
  if (dest && dest !== 'document') return next();

  // 4) 查规则
  let rules = {};
  try { rules = (await env.RULES.get('rules', 'json')) || {}; } catch (_) {}

  const host = url.hostname.toLowerCase();
  const rule = rules[host];

  if (rule && rule.enabled && rule.target) {
    return Response.redirect(rule.target, rule.status || 302);
  }

  // 5) 没有规则 → 正常返回页面
  return next();
}