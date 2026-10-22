import { notFound } from 'next/navigation';
import { Shell } from '@/components/site-shell';
import { isLocale } from '@/lib/i18n';
import { RequestForm } from '@/features/services/request-form';
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const volunteer = false;
  return (
    <Shell locale={locale}>
      <div className="page-intro">
        <div className="container">
          <span className="eyebrow">
            {locale === 'ar' ? 'معًا نصنع فرصة' : 'Creating opportunities together'}
          </span>
          <h1>
            {volunteer
              ? locale === 'ar'
                ? 'وقتك ومهاراتك يصنعوا فرقًا'
                : 'Your time and skills make a difference'
              : locale === 'ar'
                ? 'فرصة لابنك أو ابنتك تبدأ هنا'
                : 'A new opportunity for your child'}
          </h1>
          <p>
            {volunteer
              ? locale === 'ar'
                ? 'شارك بمهاراتك في أنشطة المؤسسة. نراجع طلبك وننسق معك المشاركة المناسبة.'
                : 'Share your skills in foundation activities. We review each application and coordinate a suitable role.'
              : locale === 'ar'
                ? 'قدم طلب التحاق أو دعم تعليمي. المؤسسة تراجع الاحتياج والإمكانات المتاحة قبل اتخاذ القرار.'
                : 'Apply for enrollment or educational support. The foundation reviews needs and available capacity before making a decision.'}
          </p>
        </div>
      </div>
      <section className="section">
        <div className="container reading-content">
          <RequestForm locale={locale} kind="Enrollment" />
        </div>
      </section>
    </Shell>
  );
}
