import { notFound } from 'next/navigation';
import { Shell } from '@/components/site-shell';
import { FoundationGallery } from '@/features/media/foundation-gallery';
import { isLocale } from '@/lib/i18n';
import { getMedia } from '@/lib/media';
export default async function Gallery({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const media = await getMedia();
  return (
    <Shell locale={locale}>
      <div className="page-intro">
        <div className="container">
          <span className="eyebrow">
            {locale === 'ar' ? 'حكايتنا بالصور' : 'Our story in photographs'}
          </span>
          <h1>{locale === 'ar' ? 'لحظات من أنشطتنا' : 'Moments from our activities'}</h1>
          <p>
            {locale === 'ar'
              ? 'نتعلم، نكتشف، ونحتفل معًا. صور حقيقية من حياة المؤسسة.'
              : 'Learning, exploring and celebrating together. Real photographs from life at the foundation.'}
          </p>
        </div>
      </div>
      <section className="section">
        <div className="container">
          {media.unavailable ? (
            <p role="alert" className="form-status">
              {locale === 'ar'
                ? 'تعذر تحميل المعرض. حاول مرة أخرى بعد قليل.'
                : 'Could not load the gallery. Please try again shortly.'}
            </p>
          ) : (
            <FoundationGallery locale={locale} items={media.items} />
          )}
        </div>
      </section>
    </Shell>
  );
}
