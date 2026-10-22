import { notFound } from 'next/navigation';
import { Shell } from '@/components/site-shell';
import { isLocale } from '@/lib/i18n';
import { AdminWorkspace } from '@/features/admin/admin-workspace';
import { SiteEditor } from '@/features/admin/site-editor';
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <Shell locale={locale}>
      <AdminWorkspace locale={locale} title={locale === 'ar' ? 'محتوى الموقع' : 'Site content'}>
        <SiteEditor locale={locale} />
      </AdminWorkspace>
    </Shell>
  );
}
