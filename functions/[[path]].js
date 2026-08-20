export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const proxyHost = url.hostname; 
  const vercelHost = 'lite-pwmarco.vercel.app';
  const videoHost = 'rolexcoderz.com';

  // 1. Handle CORS Preflight
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

  // 2. Routing Logic
  let targetHost = vercelHost;
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

  // Host aur Origin spoof karein
  modifiedRequest.headers.set('Host', targetHost);
  modifiedRequest.headers.set('Origin', `https://${targetHost}`);
  if (targetHost === videoHost) {
    modifiedRequest.headers.set('Referer', `https://${videoHost}/`);
  }

  // ZAROORI: Gzip compression disable karein taaki hum code modify kar sakein
  modifiedRequest.headers.delete('accept-encoding');

  let response = await fetch(modifiedRequest);
  let newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  
  // CSP hata dein taaki hamari injected script block na ho
  newHeaders.delete('content-security-policy'); 

  // Redirect handling
  if (newHeaders.has('Location')) {
    let loc = newHeaders.get('Location');
    loc = loc.replace(targetHost, proxyHost).replace(videoHost, proxyHost).replace(vercelHost, proxyHost);
    newHeaders.set('Location', loc);
  }

  const contentType = newHeaders.get('content-type') || '';

  // 3. HTML Rewriter + JavaScript Injection
  if (contentType.includes('text/html')) {
    const interceptorScript = `
      <script>
        (function() {
          const proxy = "${proxyHost}";
          const target = "${videoHost}";
          
          // Browser ke fetch API ko hijack karna
          const originalFetch = window.fetch;
          window.fetch = async function() {
            let args = arguments;
            if (typeof args[0] === 'string' && args[0].includes(target)) {
              args[0] = args[0].replace('https://' + target, 'https://' + proxy);
            } else if (args[0] instanceof Request && args[0].url.includes(target)) {
              args[0] = new Request(args[0].url.replace('https://' + target, 'https://' + proxy), args[0]);
            }
            return originalFetch.apply(this, args);
          };

          // XHR (AJAX) ko hijack karna
          const originalOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url) {
            if (typeof url === 'string' && url.includes(target)) {
              url = url.replace('https://' + target, 'https://' + proxy);
            }
            return originalOpen.apply(this, arguments);
          };
        })();
      </script>
    `;

    const rewriter = new HTMLRewriter()
      .on('head', {
        element(element) {
          // Page load hote hi sabse pehle ye script run hogi
          element.prepend(interceptorScript, { html: true });
        }
      })
      .on('*', {
        element(el) {
          ['href', 'src', 'data-url', 'action'].forEach(attr => {
            if (el.hasAttribute(attr)) {
              let val = el.getAttribute(attr);
              val = val.replace(`https://${vercelHost}`, `https://${proxyHost}`)
                       .replace(`https://${videoHost}`, `https://${proxyHost}`);
              el.setAttribute(attr, val);
            }
          });
        }
      });

    return rewriter.transform(response);
  }

  // 4. API / JSON Backend Rewrite (Backup)
  if (contentType.includes('application/json') || contentType.includes('application/javascript')) {
    let text = await response.text();
    text = text.replaceAll(vercelHost, proxyHost);
    text = text.replaceAll(videoHost, proxyHost);
    return new Response(text, { status: response.status, headers: newHeaders });
  }

  // 5. Video Stream
  return new Response(response.body, { status: response.status, headers: newHeaders });
}
