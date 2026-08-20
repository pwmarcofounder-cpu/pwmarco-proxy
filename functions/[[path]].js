export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const proxyHost = url.hostname; // Aapka Cloudflare Pages domain

  // 1. CORS Preflight Handle karna (Taki video player block na ho)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
        'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || '*',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  const vercelHost = 'lite-pwmarco.vercel.app';
  const videoHost = 'rolexcoderx.com';

  // 2. Routing Logic
  let targetHost = vercelHost;
  // Agar path /RC/ se shuru ho ya rcx.php ho
  if (url.pathname.startsWith('/RC/') || url.pathname.includes('rcx.php')) {
    targetHost = videoHost;
  }

  url.hostname = targetHost;

  const modifiedRequest = new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'manual'
  });

  // Headers spoofing
  modifiedRequest.headers.set('Host', targetHost);
  modifiedRequest.headers.set('Origin', `https://${targetHost}`);
  if (targetHost === videoHost) {
    modifiedRequest.headers.set('Referer', `https://${videoHost}/`);
  }

  // 3. Fetch Response
  let response = await fetch(modifiedRequest);
  let newHeaders = new Headers(response.headers);
  
  newHeaders.set('Access-Control-Allow-Origin', '*');

  // Redirects Handle karna
  if (newHeaders.has('Location')) {
    let loc = newHeaders.get('Location');
    loc = loc.replace(targetHost, proxyHost).replace(videoHost, proxyHost).replace(vercelHost, proxyHost);
    newHeaders.set('Location', loc);
  }

  const contentType = newHeaders.get('content-type') || '';

  // 4. Sabhi Text-based files ko intercept karna (JS, JSON, XML, HTML, M3U8, DASH)
  const isText = contentType.includes('text/') || 
                 contentType.includes('application/json') || 
                 contentType.includes('application/javascript') || 
                 contentType.includes('application/dash+xml') || 
                 contentType.includes('application/x-mpegurl') ||
                 contentType.includes('application/vnd.apple.mpegurl');

  if (isText) {
    let text = await response.text();
    
    // Aggressive Replace: Har tarah ke format mein domain ko proxy domain se badalna
    
    // Vercel domain replace
    text = text.replaceAll(`https://${vercelHost}`, `https://${proxyHost}`);
    text = text.replaceAll(`https:\\/\\/${vercelHost}`, `https:\\/\\/${proxyHost}`);
    text = text.replaceAll(vercelHost, proxyHost); // Agar bina https ke hai
    
    // RolexCoderx domain replace
    text = text.replaceAll(`https://${videoHost}`, `https://${proxyHost}`);
    text = text.replaceAll(`https:\\/\\/${videoHost}`, `https:\\/\\/${proxyHost}`);
    text = text.replaceAll(videoHost, proxyHost); // Hardcoded JS variables ke liye

    return new Response(text, {
      status: response.status,
      headers: newHeaders
    });
  }

  // 5. Binary files (mp4, m4s video segments, images) ko bina modify kiye bhejna
  return new Response(response.body, {
    status: response.status,
    headers: newHeaders
  });
}
