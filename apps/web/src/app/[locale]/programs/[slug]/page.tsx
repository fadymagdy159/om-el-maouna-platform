import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shell } from '@/components/site-shell';
import { getProgram } from '@/lib/api';
import { isLocale, copy } from '@/lib/i18n';
import { getMedia } from '@/lib/media';
import { FoundationGallery } from '@/features/media/foundation-gallery';
export default async function ProgramDetails({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  // Next supplies the URL-encoded segment; decode once before the API client encodes it.
  let decodedSlug: string;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch {
    notFound();
  }
  const [p, media] = await Promise.all([getProgram(locale, decodedSlug), getMedia()]);
  if (!p) notFound();
  const t = copy[locale];
  const categories: Record<string, string[]> = {
    Education: ['Learning'],
    Skills: ['Skills'],
    Development: ['Events', 'Trips'],
  };
  const health = p.category === 'Health';
  const photos = media.items
    .filter(
      (m) =>
        m.kind === 'Photo' &&
        (health
          ? m.category === 'Health' || ['P035', 'P046', 'P053'].includes(m.sourceKey ?? '')
          : (categories[p.category] ?? []).includes(m.category) ||
            (p.category === 'Development' && m.sourceKey === 'P109')),
    )
    .slice(0, 6);
  const other = locale === 'ar' ? 'en' : 'ar';
  return (
    <Shell locale={locale} alternatePath={`/${other}/programs/${p.alternateSlugs[other]}`}>
      <div className="page-intro">
        <div className="container">
          <Link className="eyebrow" href={`/${locale}/programs`}>
            {t.back}
          </Link>
          <h1>{p.title}</h1>
          <p>{p.summary}</p>
        </div>
      </div>
      <section className="section">
        <article className="container reading-content">
          <div className="prose-text">
            {p.body.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
          {p.eligibilityText && (
            <aside className="info-box">
              <h2>{t.eligibility}</h2>
              <p>{p.eligibilityText}</p>
            </aside>
          )}
          <Link className="button button-primary" href={`/${locale}/contact`}>
            {t.contact}
          </Link>
        </article>
      </section>
      <section className="section program-photo-section">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">
              {locale === 'ar' ? 'من قلب المؤسسة' : 'Life at the foundation'}
            </span>
            <h2>
              {health
                ? locale === 'ar'
                  ? 'صور من حياة المؤسسة'
                  : 'Photographs from life at the foundation'
                : locale === 'ar'
                  ? 'لحظات من أنشطتنا'
                  : 'Moments from our activities'}
            </h2>
            <p>
              {health
                ? locale === 'ar'
                  ? 'لقطات عامة من أنشطة المؤسسة ومشاركاتها؛ الصور المعروضة ليست توثيقًا لخدمات طبية.'
                  : 'General photographs from foundation activities and outings; these images do not document medical services.'
                : locale === 'ar'
                  ? 'صور حقيقية من أنشطة المؤسسة. اضغط على أي صورة لمشاهدتها بحجم أكبر.'
                  : 'Real photographs from foundation activities. Select a photograph to view it full size.'}
            </p>
          </div>
          {media.unavailable ? (
            <p role="alert" className="form-status">
              {locale === 'ar'
                ? 'تعذر تحميل الصور مؤقتًا. حاول مرة أخرى.'
                : 'Could not load photographs. Please try again.'}
            </p>
          ) : (
            <FoundationGallery locale={locale} items={photos} showFilters={false} />
          )}
        </div>
      </section>
    </Shell>
  );
}
