export function corsHeadersForOrigin(origin: string | null) {
  const configured = (Deno.env.get('SAGT_ALLOWED_ORIGINS') || 'http://localhost:8080,http://127.0.0.1:8080')
    .split(',').map((value) => value.trim()).filter(Boolean);
  const allowedOrigin = origin && configured.includes(origin) ? origin : '';
  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin, 'Vary': 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
  };
}
