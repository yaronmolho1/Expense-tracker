import { Page, expect } from '@playwright/test';

/**
 * API-based login (fast fallback if storage state fails)
 * Use this for debugging individual tests
 */
export async function loginViaAPI(page: Page) {
  const response = await page.request.post('http://127.0.0.1:3000/api/auth/login', {
    data: {
      username: 'gili',
      password: 'y1a3r5o7n'
    }
  });

  expect(response.status()).toBe(200);
  const { token } = await response.json();

  await page.context().addCookies([{
    name: 'auth_token',
    value: token,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'Lax'
  }]);

  await page.goto('/');
  await page.evaluate((token) => {
    localStorage.setItem('auth_token', token);
  }, token);
}

/**
 * UI-based login for auth flow tests ONLY
 * Use this ONLY in auth.spec.ts
 */
export async function loginViaUI(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await page.fill('input[name="username"]', 'gili');
  await page.fill('input[name="password"]', 'y1a3r5o7n');

  const responsePromise = page.waitForResponse(
    resp => resp.url().includes('/api/auth/login') && resp.status() === 200,
    { timeout: 10000 }
  );

  await page.click('button[type="submit"]');
  await responsePromise;
  await page.waitForURL('/', { timeout: 10000 });

  const cookies = await page.context().cookies();
  const authCookie = cookies.find(c => c.name === 'auth_token');
  expect(authCookie).toBeTruthy();
}
