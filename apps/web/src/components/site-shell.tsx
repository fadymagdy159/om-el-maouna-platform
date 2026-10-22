'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clientApi } from '@/lib/client-api';
import { Avatar, type Profile } from '@/features/identity/profile-editor';
import { ArrowUpLeft, Heart, Menu, X, Leaf } from 'lucide-react';
import { copy, type Locale } from '@/lib/i18n';

export function Brand({ locale }: { locale: Locale }) {
  const t = copy[locale];
  return (
    <Link className="brand" href={`/${locale}`} aria-label={t.foundation}>
      <span className="brand-mark" aria-hidden="true" />
      <span>
        <strong>{t.foundation}</strong>
        <small>{t.subtitle}</small>
      </span>
    </Link>
  );
}
export function Header({ locale, alternatePath }: { locale: Locale; alternatePath?: string }) {
  const t = copy[locale];
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => {
      void clientApi<Profile>('/me/profile')
        .then((p) => {
          if (active) setProfile(p);
        })
        .catch(() => {
          if (active) setProfile(null);
        });
    };
    load();
    window.addEventListener('profile-updated', load);
    return () => {
      active = false;
      window.removeEventListener('profile-updated', load);
    };
  }, [path]);
  const other = locale === 'ar' ? 'en' : 'ar';
  const links = [
    ['', t.home],
    ['/about', t.about],
    ['/programs', t.programs],
    ['/gallery', locale === 'ar' ? 'معرض الأنشطة' : 'Gallery'],
    ['/contact', t.contact],
  ];
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand locale={locale} />
        <nav
          className="desktop-nav"
          aria-label={locale === 'ar' ? 'القائمة الرئيسية' : 'Main navigation'}
        >
          {links.map(([suffix, label]) => (
            <Link
              key={suffix}
              className={path === `/${locale}${suffix}` ? 'active' : ''}
              href={`/${locale}${suffix}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <Link
            className="language-switch"
            href={alternatePath ?? path.replace(`/${locale}`, `/${other}`)}
            lang={other}
          >
            {other === 'en' ? 'EN' : 'عربي'}
          </Link>
          <Link
            href={`/${locale}/${profile ? 'account' : 'signin'}`}
            className="admin-entry account-entry"
          >
            {profile ? (
              <>
                <Avatar profile={profile} />
                <span>{profile.displayName}</span>
              </>
            ) : locale === 'ar' ? (
              'تسجيل الدخول'
            ) : (
              'Sign in'
            )}
          </Link>
          <Link className="button button-burgundy header-cta" href={`/${locale}/contribute`}>
            <Heart size={17} />
            {locale === 'ar' ? 'ساهم معنا' : 'Get involved'}
          </Link>
          <button
            className="mobile-menu-button icon-button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" className="mobile-nav">
          {links.map(([suffix, label]) => (
            <Link key={suffix} href={`/${locale}${suffix}`} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
          <Link href={`/${locale}/${profile ? 'account' : 'signin'}`}>
            {profile ? (locale === 'ar' ? 'حسابي' : 'My account') : t.account}
          </Link>
          {profile?.isAdministrator && (
            <Link href={`/${locale}/admin`}>{locale === 'ar' ? 'لوحة الإدارة' : 'Dashboard'}</Link>
          )}
        </nav>
      )}
    </header>
  );
}
export function Footer({ locale }: { locale: Locale }) {
  const t = copy[locale];
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div>
          <Brand locale={locale} />
          <p>{t.footer}</p>
        </div>
        <div>
          <h3>{locale === 'ar' ? 'اكتشف المؤسسة' : 'Explore'}</h3>
          <Link href={`/${locale}/about`}>{t.about}</Link>
          <Link href={`/${locale}/programs`}>{t.programs}</Link>
          <Link href={`/${locale}/contact`}>{t.contact}</Link>
        </div>
        <div className="footer-message">
          <Leaf size={27} />
          <h3>{t.everyone}</h3>
          <p>
            {locale === 'ar'
              ? 'نؤمن بالإنسان وقدرته على التقدم، ونقدم المساندة وفق الاحتياج، دون تمييز.'
              : 'We believe in people and their potential. Support is guided by need, without discrimination.'}
          </p>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} {t.rights}
        </span>
        <span>
          {t.eyebrow} <ArrowUpLeft size={14} />
        </span>
      </div>
    </footer>
  );
}
export function Shell({
  locale,
  children,
  alternatePath,
}: {
  locale: Locale;
  children: React.ReactNode;
  alternatePath?: string;
}) {
  return (
    <>
      <Header locale={locale} alternatePath={alternatePath} />
      <main id="main">{children}</main>
      <Footer locale={locale} />
    </>
  );
}
