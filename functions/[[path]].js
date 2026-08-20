export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const proxyHost = url.hostname; // Aapka Cloudflare Pages domain

  // 1. CORS Preflight (Video Player Buffer block rokne ke liye)
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
  const videoHost = 'rolexcoderz.com'; // <-- TYPO FIXED ('z' use kiya hai)

  // 2. Routing Logic - Decide karein traffic kahan jayega
  let targetHost = vercelHost;
  
  // Agar URL mein stream API ka path hai
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

  // Headers Spoofing taaki origin server block na kare
  modifiedRequest.headers.set('Host', targetHost);
  modifiedRequest.headers.set('Origin', `https://${targetHost}`);
  if (targetHost === videoHost) {
    modifiedRequest.headers.set('Referer', `https://${videoHost}/`);
  }

  // 3. Response Fetch Karna
  let response = await fetch(modifiedRequest);
  let newHeaders = new Headers(response.headers);
  
  newHeaders.set('Access-Control-Allow-Origin', '*');

  // Redirects rewrite
  if (newHeaders.has('Location')) {
    let loc = newHeaders.get('Location');
    loc = loc.replace(targetHost, proxyHost).replace(videoHost, proxyHost).replace(vercelHost, proxyHost);
    newHeaders.set('Location', loc);
  }

  const contentType = newHeaders.get('content-type') || '';

  // 4. Sabhi JSON, JS, aur Stream Manifests ko intercept karke rewrite karna
  const isText = contentType.includes('text/') || 
                 contentType.includes('application/json') || 
                 contentType.includes('application/javascript') || 
                 contentType.includes('application/dash+xml') || 
                 contentType.includes('application/x-mpegurl') ||
                 contentType.includes('application/vnd.apple.mpegurl');

  if (isText) {
    let text = await response.text();
    
    // Vercel aur RolexCoderz dono domains ko proxy URL se replace karein
    text = text.replaceAll(`https://${vercelHost}`, `https://${proxyHost}`);
    text = text.replaceAll(`https:\\/\\/${vercelHost}`, `https:\\/\\/${proxyHost}`);
    text = text.replaceAll(vercelHost, proxyHost);
    
    text = text.replaceAll(`https://${videoHost}`, `https://${proxyHost}`);
    text = text.replaceAll(`https:\\/\\/${videoHost}`, `https:\\/\\/${proxyHost}`);
    text = text.replaceAll(videoHost, proxyHost);

    return new Response(text, {
      status: response.status,
      headers: newHeaders
    });
  }

  // 5. Video Segments (m4s, mp4) ko direct buffer pass karna
  return new Response(response.body, {
    status: response.status,
    headers: newHeaders
  });
}
