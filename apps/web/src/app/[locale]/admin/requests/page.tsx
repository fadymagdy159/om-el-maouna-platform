import { notFound } from 'next/navigation';
import { Shell } from '@/components/site-shell';
import { isLocale } from '@/lib/i18n';
import { AdminWorkspace } from '@/features/admin/admin-workspace';
import { RequestBoard } from '@/features/services/request-board';
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <Shell locale={locale}>
      <AdminWorkspace
        locale={locale}
        title={locale === 'ar' ? 'الطلبات والرسائل' : 'Requests & messages'}
      >
        <RequestBoard locale={locale} admin />
      </AdminWorkspace>
    </Shell>
  );
}
