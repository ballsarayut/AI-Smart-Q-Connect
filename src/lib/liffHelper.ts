import liff from '@line/liff';

let cachedLiffId: string | null = null;
let liffInitPromise: Promise<void> | null = null;

export function sanitizeLiffId(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/liff\.line\.me\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  return trimmed.split(/[?#/\s]/)[0] || '';
}

function cleanLiffCallbackParamsIfPresent(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const oauthKeys = ['code', 'state', 'liffClientId', 'liffRedirectUri', 'error', 'error_description'];
  let changed = false;
  for (const key of oauthKeys) {
    if (params.has(key)) {
      params.delete(key);
      changed = true;
    }
  }
  if (changed) {
    const remaining = params.toString();
    const nextUrl = `${window.location.pathname}${remaining ? `?${remaining}` : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
  }
  return changed;
}

export function initLiff(rawLiffId: string): Promise<void> {
  const liffId = sanitizeLiffId(rawLiffId);
  if (!liffId) {
    return Promise.reject(new Error('ยังไม่ได้ตั้งค่า LINE LIFF ID'));
  }

  if (!liffInitPromise || cachedLiffId !== liffId) {
    cachedLiffId = liffId;
    liffInitPromise = liff.init({ liffId }).catch(async (err) => {
      // If initialization failed due to a stale/expired OAuth callback URL parameter, clean URL and retry once
      if (cleanLiffCallbackParamsIfPresent()) {
        try {
          await liff.init({ liffId });
          return;
        } catch (retryErr) {
          liffInitPromise = null;
          cachedLiffId = null;
          throw retryErr;
        }
      }
      liffInitPromise = null;
      cachedLiffId = null;
      throw err;
    });
  }

  return liffInitPromise;
}

export async function getSafeLiffUser(): Promise<{ userId: string; displayName: string } | null> {
  if (!liff.isLoggedIn()) return null;

  try {
    const profile = await liff.getProfile();
    if (profile?.userId) {
      return {
        userId: profile.userId,
        displayName: profile.displayName || 'ผู้ใช้ LINE'
      };
    }
  } catch (err) {
    console.warn('liff.getProfile fallback to ID token:', err);
  }

  try {
    const decoded = liff.getDecodedIDToken();
    if (decoded?.sub) {
      return {
        userId: decoded.sub,
        displayName: decoded.name || 'ผู้ใช้ LINE'
      };
    }
  } catch (err) {
    console.warn('liff.getDecodedIDToken unavailable:', err);
  }

  return null;
}
