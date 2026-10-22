import { notFound } from 'next/navigation';
import { Shell } from '@/components/site-shell';
import { isLocale } from '@/lib/i18n';
import { ProfileEditor } from '@/features/identity/profile-editor';
export default async function Account({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <Shell locale={locale}>
      <div className="container section">
        <h1>{locale === 'ar' ? 'حسابي' : 'My account'}</h1>
        <ProfileEditor locale={locale} />
      </div>
    </Shell>
  );
}
