'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clientApi } from '@/lib/client-api';
import type { Locale } from '@/lib/i18n';
export function AdminNav({ locale }: { locale: Locale }) {
  const path = usePathname(),
    ar = locale === 'ar';
  return (
    <nav
      className="workspace-nav"
      aria-label={ar ? 'أقسام لوحة الإدارة' : 'Administration sections'}
    >
      {[
        ['', ar ? 'البرامج' : 'Programs'],
        ['/archive', ar ? 'أرشيف البرامج' : 'Program archive'],
        ['/media', ar ? 'الصور والفيديوهات' : 'Photos & videos'],
        ['/requests', ar ? 'الطلبات والرسائل' : 'Requests & messages'],
        ['/settings', ar ? 'محتوى الموقع' : 'Site content'],
      ].map(([suffix, label]) => (
        <Link
          key={suffix}
          href={`/${locale}/admin${suffix}`}
          aria-current={path === `/${locale}/admin${suffix}` ? 'page' : undefined}
        >
          {label}
        </Link>
      ))}
      <Link href={`/${locale}/account`}>{ar ? 'حسابي' : 'My account'}</Link>
    </nav>
  );
}
export function AdminWorkspace({
  locale,
  title,
  children,
}: {
  locale: Locale;
  title: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState('loading');
  useEffect(() => {
    let active = true;
    clientApi<{ isAdministrator: boolean; mfaVerified: boolean }>('/me')
      .then((u) => {
        if (active) setState(u.isAdministrator && u.mfaVerified ? 'ready' : 'denied');
      })
      .catch(() => {
        if (active) setState('denied');
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="admin-wrap">
      <div className="admin-container">
        {state === 'ready' ? (
          <>
            <AdminNav locale={locale} />
            <h1>{title}</h1>
            {children}
          </>
        ) : (
          <div className="admin-panel">
            <p>
              {state === 'loading'
                ? locale === 'ar'
                  ? 'جارٍ التحقق…'
                  : 'Checking access…'
                : locale === 'ar'
                  ? 'سجّل الدخول بحساب الإدارة وأكمل التحقق بخطوتين.'
                  : 'Sign in as administrator and complete two-factor verification.'}
            </p>
            <Link className="button button-primary" href={`/${locale}/admin`}>
              {locale === 'ar' ? 'دخول الإدارة' : 'Administrator sign in'}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
