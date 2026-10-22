import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HeartHandshake, Users, BookOpen } from 'lucide-react';
import { Shell } from '@/components/site-shell';
import { isLocale } from '@/lib/i18n';
export default async function Contribute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === 'ar';
  return (
    <Shell locale={locale}>
      <div className="page-intro">
        <div className="container">
          <span className="eyebrow">
            {ar ? 'كل مشاركة تصنع فرقًا' : 'Every contribution matters'}
          </span>
          <h1>{ar ? 'اختار طريقتك في المشاركة' : 'Choose how to get involved'}</h1>
          <p>
            {ar
              ? 'بوقتك، بمهاراتك، أو بمساهمة تتناسب مع احتياجات المؤسسة.'
              : 'Give your time, share your skills, or coordinate a contribution that meets the foundation’s needs.'}
          </p>
        </div>
      </div>
      <section className="section">
        <div className="container contribution-grid">
          {[
            {
              icon: HeartHandshake,
              title: ar ? 'مساهمة مالية أو عينية' : 'Financial or in-kind support',
              text: ar
                ? 'تواصل مع المؤسسة لتحديد الاحتياج وطريقة التسليم أو التحويل الرسمية المناسبة. الدفع الإلكتروني غير متاح حاليًا.'
                : 'Contact the foundation to agree a need and an official delivery or transfer method. Online payment is not available yet.',
              href: 'support',
              label: ar ? 'قدّم مساهمة' : 'Offer a contribution',
            },
            {
              icon: Users,
              title: ar ? 'تطوع بوقتك ومهاراتك' : 'Volunteer your time and skills',
              text: ar
                ? 'عرفنا بمهاراتك والأوقات المناسبة ليك، والمؤسسة تراجع الطلب وتتواصل معاك.'
                : 'Tell us about your skills and availability. The foundation will review your application and contact you.',
              href: 'volunteer',
              label: ar ? 'قدّم للتطوع' : 'Apply to volunteer',
            },
            {
              icon: BookOpen,
              title: ar ? 'طلب التحاق أو دعم تعليمي' : 'Enrollment or educational support',
              text: ar
                ? 'لو أنت ولي أمر وعايز تقدم لابنك أو ابنتك، قدم طلبًا مستقلًا وتابع مراجعته من حسابك.'
                : 'Parents can submit a separate application for a child and track the review from their account.',
              href: 'enroll',
              label: ar ? 'قدّم طلب التحاق' : 'Apply for enrollment',
            },
          ].map(({ icon: Icon, ...c }) => (
            <article className="admin-panel" key={c.href}>
              <Icon size={34} />
              <h2>{c.title}</h2>
              <p>{c.text}</p>
              <Link className="button button-primary" href={`/${locale}/${c.href}`}>
                {c.label}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </Shell>
  );
}
