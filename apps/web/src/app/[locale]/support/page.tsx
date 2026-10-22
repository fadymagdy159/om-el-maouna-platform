import { notFound } from 'next/navigation';
import { Shell } from '@/components/site-shell';
import { isLocale } from '@/lib/i18n';
import { RequestForm } from '@/features/services/request-form';
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === 'ar';
  return (
    <Shell locale={locale}>
      <div className="page-intro">
        <div className="container">
          <span className="eyebrow">{ar ? 'مساهمتك تصنع فرقًا' : 'Your contribution matters'}</span>
          <h1>{ar ? 'مساهمة مالية أو عينية' : 'Financial or in-kind contribution'}</h1>
          <p>
            {ar
              ? 'قدّم مساهمتك من حسابك وتابع التنسيق مع المؤسسة في مكان واحد. الدفع الإلكتروني غير متاح حاليًا.'
              : 'Offer support from your account and track coordination with the foundation. Online payment is not currently available.'}
          </p>
        </div>
      </div>
      <section className="section">
        <div className="container reading-content">
          <RequestForm locale={locale} kind="Contribution" />
        </div>
      </section>
    </Shell>
  );
}
