async function withSharedFooter(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  let html = await response.text();
  if (!html.includes('/adg-footer.js')) {
    html = html.includes('</body>')
      ? html.replace('</body>', '<script src="/adg-footer.js" defer></script></body>')
      : html + '<script src="/adg-footer.js" defer></script>';
  }
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    return withSharedFooter(await env.ASSETS.fetch(request));
  }
};
