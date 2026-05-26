import liff from '@line/liff';

let liffInitPromise: Promise<void> | null = null;

export function initLiff(liffId: string) {
  if (!liffInitPromise) {
    if (liffId) {
      liffInitPromise = liff.init({ liffId });
    } else {
      liffInitPromise = Promise.reject(new Error("No LIFF ID"));
    }
  }
  return liffInitPromise;
}
