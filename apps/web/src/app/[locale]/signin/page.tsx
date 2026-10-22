import { notFound } from 'next/navigation';
import { Shell } from '@/components/site-shell';
import { isLocale } from '@/lib/i18n';
import { AdminConsole } from '@/features/admin/admin-console';
export default async function SignIn({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <Shell locale={locale}>
      <AdminConsole locale={locale} accountLogin />
    </Shell>
  );
}
