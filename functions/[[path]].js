// functions/[[path]].js

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  const originalHost = url.hostname;
  const targetHost = 'lite-pwmarco.vercel.app';

  url.hostname = targetHost;

  const modifiedRequest = new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'manual'
  });
  
  modifiedRequest.headers.set('Host', targetHost);
  modifiedRequest.headers.set('Origin', `https://${targetHost}`);

  let response = await fetch(modifiedRequest);
  response = new Response(response.body, response);
  
  response.headers.set('Access-Control-Allow-Origin', '*');

  if (response.headers.has('Location')) {
    let location = response.headers.get('Location');
    location = location.replace(targetHost, originalHost);
    response.headers.set('Location', location);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    return new HTMLRewriter()
      .on('a, link, script, img', {
        element(element) {
          const attributes = ['href', 'src'];
          attributes.forEach(attr => {
            const val = element.getAttribute(attr);
            if (val && val.includes(targetHost)) {
              element.setAttribute(attr, val.replace(targetHost, originalHost));
            }
          });
        }
      })
      .transform(response);
  }

  return response;
}
