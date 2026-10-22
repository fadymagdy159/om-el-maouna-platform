import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, copy } from '@/lib/i18n';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'أم المعونة | معًا نبني مستقبلًا أفضل', template: '%s | Om El Maouna' },
  description: 'مؤسسة أم المعونة للرعاية والتنمية — التعليم والصحة والتربية وتنمية المهارات.',
};
export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">
          {locale === 'ar' ? 'انتقل إلى المحتوى' : 'Skip to content'}
        </a>
        {children}
        {process.env.NODE_ENV !== 'production' && (
          <div className="preview-note">{copy[locale].preview}</div>
        )}
      </body>
    </html>
  );
}
