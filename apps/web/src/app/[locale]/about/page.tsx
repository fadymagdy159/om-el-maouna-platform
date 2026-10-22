import { notFound } from 'next/navigation';
import { Shell } from '@/components/site-shell';
import { isLocale, copy } from '@/lib/i18n';
import { foundationDetails } from '@/content/foundation-details';
import { getSiteContent } from '@/lib/media';
export default async function About({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = copy[locale];
  const content = await getSiteContent();
  return (
    <Shell locale={locale}>
      <div className="page-intro">
        <div className="container">
          <span className="eyebrow">{t.about}</span>
          <h1>{t.heroEnd}</h1>
          <p>{t.everyone}</p>
        </div>
      </div>
      <section className="section">
        <article className="container reading-content">
          <h2>{t.ourMessage}</h2>
          <p className="large-copy">
            {content[locale === 'ar' ? 'aboutAr' : 'aboutEn'] || foundationDetails.mission[locale]}
          </p>
          <p>
            {locale === 'ar'
              ? `مؤسسة مسجلة بالقاهرة برقم ${content.registration || foundationDetails.registration}.`
              : `Registered in Cairo under number ${content.registration || foundationDetails.registration}.`}
          </p>
          {foundationDetails.services.map((service, index) => (
            <div key={service.en}>
              <h2>{service[locale]}</h2>
              <ul>
                {(
                  content[
                    ['educationServices', 'healthServices', 'activityServices'][index] +
                      (locale === 'ar' ? 'Ar' : 'En')
                  ]
                    ?.split('\n')
                    .filter(Boolean) ?? service.items[locale]
                ).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
          <h2>
            {content[locale === 'ar' ? 'approachTitleAr' : 'approachTitleEn'] || t.approachTitle}
          </h2>
          <p className="large-copy">
            {content[locale === 'ar' ? 'approachTextAr' : 'approachTextEn'] || t.approachText}
          </p>
          <div className="info-box">
            <h3>{locale === 'ar' ? 'نتطلع إلى' : 'Looking ahead'}</h3>
            <ul>
              {(
                content[locale === 'ar' ? 'goalsAr' : 'goalsEn']?.split('\n').filter(Boolean) ??
                foundationDetails.goals[locale]
              ).map((goal) => (
                <li key={goal}>{goal}</li>
              ))}
            </ul>
          </div>
        </article>
      </section>
    </Shell>
  );
}
