import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowUpLeft, BookOpen, HeartHandshake, Lightbulb, Users } from 'lucide-react';
import { Shell } from '@/components/site-shell';
import { isLocale, copy } from '@/lib/i18n';
import { getPrograms } from '@/lib/api';
export default async function Programs({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = copy[locale];
  const { items, unavailable } = await getPrograms(locale);
  const icons = {
    Education: BookOpen,
    Health: HeartHandshake,
    Development: Users,
    Skills: Lightbulb,
  };
  return (
    <Shell locale={locale}>
      <div className="page-intro">
        <div className="container">
          <span className="eyebrow">{t.programs}</span>
          <h1>{t.programHeading}</h1>
          <p>{t.programSub}</p>
        </div>
      </div>
      <section className="section">
        <div className="container">
          <div className="program-list">
            {items.map((p) => {
              const Icon = icons[p.category as keyof typeof icons] ?? BookOpen;
              return (
                <Link
                  className="program-detail-card"
                  href={`/${locale}/programs/${p.slug}`}
                  key={p.id}
                >
                  <span className="pillar-icon">
                    <Icon size={32} />
                  </span>
                  <h2>{p.title}</h2>
                  <p>{p.summary}</p>
                  <span className="text-link">
                    {t.learn}
                    <ArrowUpLeft size={18} />
                  </span>
                </Link>
              );
            })}
          </div>
          {(unavailable || !items.length) && (
            <div className="empty-state" role="status">
              <BookOpen size={40} />
              <p>{unavailable ? t.unavailable : t.empty}</p>
              <Link className="button button-outline" href={`/${locale}/programs`}>
                {locale === 'ar' ? 'إعادة المحاولة' : 'Try again'}
              </Link>
            </div>
          )}
        </div>
      </section>
    </Shell>
  );
}
