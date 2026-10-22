import { notFound } from 'next/navigation';
import { Shell } from '@/components/site-shell';
import { isLocale } from '@/lib/i18n';
import { AccountAccess } from '@/features/identity/account-access';
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <Shell locale={locale}>
      <AccountAccess locale={locale} mode="confirm-email" />
    </Shell>
  );
}
