export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  const originalHost = url.hostname;
  const vercelHost = 'lite-pwmarco.vercel.app';
  const videoHost = 'rolexcoderx.com';

  // 1. CORS Preflight (OPTIONS) Handle karna taaki video player block na ho
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
        'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || '*',
      }
    });
  }

  // 2. Decide karna ki request kahan bhejni hai (Routing)
  // Agar request '/RC/' se shuru hoti hai ya stream URL hai, toh videoHost par bhejo
  let targetHost = vercelHost;
  if (url.pathname.startsWith('/RC/') || url.pathname.includes('rcx.php')) {
    targetHost = videoHost;
  }

  url.hostname = targetHost;

  // 3. Naya request object banana
  const modifiedRequest = new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'manual'
  });
  
  // Headers spoof karna taaki server error na de
  modifiedRequest.headers.set('Host', targetHost);
  modifiedRequest.headers.set('Origin', `https://${targetHost}`);
  if (targetHost === videoHost) {
    modifiedRequest.headers.set('Referer', `https://${videoHost}/`);
  }

  // 4. Server se data fetch karna
  let response = await fetch(modifiedRequest);
  response = new Response(response.body, response);
  
  // CORS Headers add karna response mein
  response.headers.set('Access-Control-Allow-Origin', '*');

  // Agar server redirect (301/302) karta hai
  if (response.headers.has('Location')) {
    let location = response.headers.get('Location');
    location = location.replace(targetHost, originalHost);
    response.headers.set('Location', location);
  }

  const contentType = response.headers.get('content-type') || '';

  // 5. API API/JSON Responses Rewrite karna (Isse stream URLs app ke andar change ho jayenge)
  if (contentType.includes('application/json') || contentType.includes('text/plain')) {
    let text = await response.text();
    // Normal URLs replace karein
    text = text.replaceAll(`https://${vercelHost}`, `https://${originalHost}`);
    text = text.replaceAll(`https://${videoHost}`, `https://${originalHost}`);
    // Escaped URLs replace karein (jo JSON mein hote hain jaise https:\/\/...)
    text = text.replaceAll(`https:\\/\\/${vercelHost}`, `https:\\/\\/${originalHost}`);
    text = text.replaceAll(`https:\\/\\/${videoHost}`, `https:\\/\\/${originalHost}`);
    
    return new Response(text, {
      status: response.status,
      headers: response.headers
    });
  }

  // 6. HTML Responses Rewrite karna
  if (contentType.includes('text/html')) {
    return new HTMLRewriter()
      .on('*', {
        element(element) {
          const attributes = ['href', 'src', 'data-url', 'action'];
          attributes.forEach(attr => {
            let val = element.getAttribute(attr);
            if (val) {
              val = val.replace(`https://${vercelHost}`, `https://${originalHost}`)
                       .replace(`https://${videoHost}`, `https://${originalHost}`);
              element.setAttribute(attr, val);
            }
          });
        }
      })
      .transform(response);
  }

  // 7. Video/Stream (application/octet-stream, mp4, m3u8) ko direct pass karna bina modify kiye
  return response;
}
