import type { Locale } from '@/lib/i18n';
export type ManagedMedia = {
  id: string;
  sourceKey?: string | null;
  kind: 'Photo' | 'Video';
  category: string;
  width: number;
  height: number;
  seconds: number;
  isHero: boolean;
  isPublished: boolean;
  sortOrder: number;
  version: number;
  src: string;
  poster: string | null;
  title: Record<Locale, string>;
  alt: Record<Locale, string>;
};
export async function getMedia(): Promise<{ items: ManagedMedia[]; unavailable: boolean }> {
  try {
    const r = await fetch(`${process.env.API_ORIGIN ?? 'http://127.0.0.1:5080'}/api/v1/media`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error();
    return { ...(await r.json()), unavailable: false };
  } catch {
    return { items: [], unavailable: true };
  }
}
export async function getSiteContent(): Promise<Record<string, string>> {
  try {
    const r = await fetch(
      `${process.env.API_ORIGIN ?? 'http://127.0.0.1:5080'}/api/v1/site-content`,
      { cache: 'no-store', signal: AbortSignal.timeout(5000) },
    );
    if (!r.ok) return {};
    return (await r.json()).values;
  } catch {
    return {};
  }
}
