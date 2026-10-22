import type { Locale } from './i18n';
export type ProgramRecord = {
  id: string;
  category: string;
  acceptsSupportRequests: boolean;
  slug: string;
  title: string;
  summary: string;
  body: string;
  eligibilityText: string;
  alternateSlugs: Record<Locale, string>;
};
const origin = process.env.API_ORIGIN ?? 'http://127.0.0.1:5080';
export async function getPrograms(
  locale: Locale,
): Promise<{ items: ProgramRecord[]; unavailable: boolean }> {
  try {
    const response = await fetch(`${origin}/api/v1/programs?locale=${locale}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('API unavailable');
    const body = await response.json();
    return { items: body.items, unavailable: false };
  } catch {
    return { items: [], unavailable: true };
  }
}
export async function getProgram(locale: Locale, slug: string): Promise<ProgramRecord | null> {
  const response = await fetch(
    `${origin}/api/v1/programs/by-slug/${encodeURIComponent(slug)}?locale=${locale}`,
    { cache: 'no-store', signal: AbortSignal.timeout(5000) },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Program service unavailable');
  return response.json();
}
