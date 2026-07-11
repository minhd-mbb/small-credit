const fetch = globalThis.fetch;
const base = 'http://localhost:3001';
const cookieJar = [];
const fetchWithCookies = async (url, options = {}) => {
  options.headers = options.headers || {};
  if (cookieJar.length) options.headers.Cookie = cookieJar.join('; ');
  const res = await fetch(url, options);
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    setCookie.split(',').forEach(cookie => {
      const [part] = cookie.split(';');
      const trimmed = part.trim();
      const name = trimmed.split('=')[0];
      const existingIndex = cookieJar.findIndex(c => c.startsWith(name + '='));
      if (existingIndex !== -1) cookieJar[existingIndex] = trimmed;
      else cookieJar.push(trimmed);
    });
  }
  return res;
};
(async () => {
  try {
    console.log('GET /api/auth/csrf');
    const res1 = await fetchWithCookies(`${base}/api/auth/csrf`);
    const body1 = await res1.json();
    console.log('csrfToken', body1.csrfToken ? 'ok' : 'missing');
    const form = new URLSearchParams();
    form.append('csrfToken', body1.csrfToken);
    form.append('username', '1505');
    form.append('password', '1234');
    const res2 = await fetchWithCookies(`${base}/api/auth/callback/credentials?json=true`, {
      method: 'POST',
      body: form,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      redirect: 'manual',
    });
    console.log('login status', res2.status);
    console.log('location', res2.headers.get('location'));
    const text = await res2.text();
    console.log('body', text.slice(0, 500));
    if (res2.status === 200 || res2.status === 302) {
      const res3 = await fetchWithCookies(`${base}/api/auth/session`);
      console.log('session status', res3.status);
      console.log('session body', await res3.text());
    }
  } catch (err) {
    console.error(err);
  }
})();