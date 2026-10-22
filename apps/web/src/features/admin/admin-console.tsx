'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle, LogOut, Plus, ShieldCheck, X } from 'lucide-react';
import { clientApi, ApiError } from '@/lib/client-api';
import { PasswordInput } from '@/components/password-input';
import type { Locale } from '@/lib/i18n';
import { AdminNav } from '@/features/admin/admin-workspace';

function accountDestination(locale: Locale) {
  const next = new URLSearchParams(window.location.search).get('next');
  return next &&
    [
      `/${locale}/support`,
      `/${locale}/volunteer`,
      `/${locale}/enroll`,
      `/${locale}/account/requests`,
    ].includes(next)
    ? next
    : `/${locale}/account`;
}

type Translation = {
  locale: Locale;
  slug: string;
  title: string;
  summary: string;
  body: string;
  eligibilityText: string;
};
type ProgramInput = {
  category: string;
  acceptsSupportRequests: boolean;
  sortOrder: number;
  translations: Translation[];
};
type AdminProgram = ProgramInput & { id: string; status: string; version: number };
type Me = { displayName: string; isAdministrator: boolean; mfaVerified: boolean };
type Overview = { programs: number; publishedPrograms: number; users: number };
const empty = (): ProgramInput => ({
  category: 'Education',
  acceptsSupportRequests: false,
  sortOrder: 0,
  translations: (['ar', 'en'] as Locale[]).map((locale) => ({
    locale,
    slug: '',
    title: '',
    summary: '',
    body: '',
    eligibilityText: '',
  })),
});
export function AdminConsole({
  locale,
  archived = false,
  accountLogin = false,
}: {
  locale: Locale;
  archived?: boolean;
  accountLogin?: boolean;
}) {
  const ar = locale === 'ar';
  const [phase, setPhase] = useState<
    'loading' | 'login' | 'setup' | 'verify' | 'recovery' | 'codes' | 'ready' | 'forbidden'
  >('loading');
  const [me, setMe] = useState<Me | null>(null),
    [rows, setRows] = useState<AdminProgram[]>([]),
    [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [code, setCode] = useState(''),
    [sharedKey, setSharedKey] = useState(''),
    [codes, setCodes] = useState<string[]>([]);
  const [editing, setEditing] = useState<ProgramInput | null>(null),
    [original, setOriginal] = useState<AdminProgram | null>(null);
  const failure = (e: unknown) => {
    const status = e instanceof ApiError ? e.status : 0;
    setError(
      status === 412
        ? ar
          ? 'تم تعديل البرنامج في جلسة أخرى. أعد تحميل القائمة قبل الحفظ.'
          : 'This program changed elsewhere. Reload the list before saving.'
        : status === 401
          ? ar
            ? 'انتهت الجلسة. أعد تسجيل الدخول.'
            : 'Your session expired. Sign in again.'
          : e instanceof Error
            ? e.message
            : ar
              ? 'تعذر تنفيذ الطلب.'
              : 'The request failed.',
    );
    if (status === 401) setPhase('login');
  };
  const refresh = useCallback(async () => {
    const [programs, stats] = await Promise.all([
      clientApi<AdminProgram[]>('/admin/programs'),
      clientApi<Overview>('/admin/overview'),
    ]);
    setRows(programs);
    setOverview(stats);
  }, []);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const user = await clientApi<Me>('/me');
        if (!active) return;
        setMe(user);
        if (accountLogin && (!user.isAdministrator || user.mfaVerified)) {
          window.location.replace(accountDestination(locale));
          return;
        }
        if (!user.isAdministrator) {
          setPhase('forbidden');
          return;
        }
        if (!user.mfaVerified) {
          setPhase('setup');
          return;
        }
        await refresh();
        if (active) setPhase('ready');
      } catch (e) {
        if (active) {
          if (e instanceof ApiError && e.status === 401) setPhase('login');
          else {
            setError(
              ar ? 'تعذر الاتصال بالخادم. تأكد من تشغيل الـAPI.' : 'Could not connect to the API.',
            );
            setPhase('login');
          }
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [refresh, ar, accountLogin, locale]);
  async function login(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await clientApi<{
        requiresMfa?: boolean;
        requiresEmailConfirmation?: boolean;
        developmentConfirmationLink?: string;
        requiresMfaSetup?: boolean;
      }>('/auth/login', 'POST', { email, password });
      setPassword('');
      setCode('');
      if (response.requiresEmailConfirmation) {
        if (response.developmentConfirmationLink) {
          const link = new URL(response.developmentConfirmationLink);
          window.location.assign(link.pathname + link.hash);
        } else
          window.location.assign(
            `/${locale}/confirm-email#email=${encodeURIComponent(email.trim())}`,
          );
        return;
      }
      if (response.requiresMfaSetup) setPhase('setup');
      else if (response.requiresMfa) setPhase('verify');
      else if (accountLogin) window.location.assign(accountDestination(locale));
      else setPhase('forbidden');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        setError(
          ar
            ? 'راجع البريد وكلمة السر، وتأكد من تفعيل البريد. لو عندك حساب بالفعل، استخدم «نسيت كلمة السر» بدل إنشاء حساب جديد.'
            : 'Check your email, password and email confirmation. If you already registered, use Forgot password rather than creating another account.',
        );
      else failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function beginSetup() {
    setBusy(true);
    setError('');
    try {
      const value = await clientApi<{ sharedKey: string }>('/auth/mfa/start-setup', 'POST');
      setSharedKey(value.sharedKey);
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (phase === 'setup') {
        const result = await clientApi<{ recoveryCodes: string[] }>(
          '/auth/mfa/confirm-setup',
          'POST',
          { code },
        );
        setCodes(result.recoveryCodes);
        setSharedKey('');
        setCode('');
        setPhase('codes');
      } else {
        await clientApi(`/auth/mfa/${phase === 'recovery' ? 'recovery' : 'verify'}`, 'POST', {
          code,
        });
        setCode('');
        await enter();
      }
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function enter() {
    if (accountLogin) {
      window.location.assign(accountDestination(locale));
      return;
    }
    const user = await clientApi<Me>('/me');
    setMe(user);
    await refresh();
    setPhase('ready');
    setCodes([]);
    window.dispatchEvent(new Event('profile-updated'));
  }
  async function logout() {
    setBusy(true);
    try {
      await clientApi('/auth/logout', 'POST');
      window.dispatchEvent(new Event('profile-updated'));
      setMe(null);
      setSharedKey('');
      setCodes([]);
      setEditing(null);
      setPhase('login');
      setError('');
      setNotice('');
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (original)
        await clientApi(`/admin/programs/${original.id}`, 'PUT', editing, original.version);
      else await clientApi('/admin/programs', 'POST', editing);
      setEditing(null);
      setOriginal(null);
      await refresh();
      setNotice(ar ? 'تم حفظ البرنامج بنجاح.' : 'Program saved successfully.');
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function transition(row: AdminProgram, action: string) {
    if (
      action === 'delete' &&
      !window.confirm(
        ar
          ? `حذف برنامج «${row.translations[0].title}»؟ لا يمكن التراجع عن الحذف.`
          : 'Delete this program? This cannot be undone.',
      )
    )
      return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await clientApi(
        `/admin/programs/${row.id}${action === 'delete' ? '' : `/${action}`}`,
        action === 'delete' ? 'DELETE' : 'POST',
        undefined,
        row.version,
      );
      await refresh();
      setNotice(ar ? 'تم تحديث البرنامج.' : 'Program updated.');
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  function changeTranslation(index: number, key: keyof Omit<Translation, 'locale'>, value: string) {
    setEditing((current) =>
      current
        ? {
            ...current,
            translations: current.translations.map((t, i) =>
              i === index ? { ...t, [key]: value } : t,
            ),
          }
        : null,
    );
  }
  const status = (value: string) =>
    ar ? ({ Draft: 'مسودة', Published: 'منشور', Archived: 'مؤرشف' }[value] ?? value) : value;
  const errors = error && (
    <div className="form-status" role="alert">
      {error}
    </div>
  );
  if (phase === 'loading')
    return (
      <section className="section">
        <div className="container empty-state" role="status">
          {ar ? 'جارٍ التحقق من الجلسة…' : 'Checking your session…'}
        </div>
      </section>
    );
  if (phase !== 'ready')
    return (
      <section className="auth-page">
        <div className="auth-card">
          <span className="eyebrow">
            <ShieldCheck size={19} />
            {ar ? 'مساحة الإدارة الآمنة' : 'Secure administration'}
          </span>
          <h1>
            {accountLogin
              ? ar
                ? 'أهلًا بعودتك'
                : 'Welcome back'
              : ar
                ? 'لوحة إدارة المؤسسة'
                : 'Foundation administration'}
          </h1>
          <p>
            {ar
              ? accountLogin
                ? 'سجّل الدخول إلى حسابك لإدارة بياناتك الشخصية.'
                : 'حساب إداري واحد لإدارة المحتوى. الحسابات العادية لا تملك صلاحيات الإدارة.'
              : accountLogin
                ? 'Sign in to manage your personal profile.'
                : 'One administrator manages the website. Regular accounts have no management permissions.'}
          </p>
          {errors}
          {phase === 'login' && (
            <div className="profile-links auth-actions">
              <Link href={`/${locale}/register`}>{ar ? 'إنشاء حساب جديد' : 'Create account'}</Link>
              <Link href={`/${locale}/forgot-password`}>
                {ar ? 'نسيت كلمة السر؟' : 'Forgot password?'}
              </Link>
              <Link href={`/${locale}/confirm-email`}>{ar ? 'تأكيد البريد' : 'Confirm email'}</Link>
            </div>
          )}
          {phase === 'login' && (
            <form onSubmit={login}>
              <div className="field">
                <label htmlFor="email">{ar ? 'البريد الإلكتروني' : 'Email address'}</label>
                <input
                  id="email"
                  type="email"
                  dir="ltr"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={254}
                />
              </div>
              <div className="field">
                <label htmlFor="password">{ar ? 'كلمة السر' : 'Password'}</label>
                <PasswordInput
                  locale={locale}
                  id="password"
                  dir="ltr"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  maxLength={128}
                />
              </div>
              <button className="button button-primary" disabled={busy}>
                {busy ? (ar ? 'جارٍ الدخول…' : 'Signing in…') : ar ? 'تسجيل الدخول' : 'Sign in'}
              </button>
            </form>
          )}
          {(phase === 'setup' || phase === 'verify' || phase === 'recovery') && (
            <>
              <h2 style={{ fontSize: 20, marginBottom: 15 }}>
                {phase === 'setup'
                  ? ar
                    ? 'تفعيل التحقق بخطوتين'
                    : 'Set up two-factor authentication'
                  : ar
                    ? 'تأكيد هويتك'
                    : 'Verify your identity'}
              </h2>
              {phase === 'setup' && (
                <>
                  <p>
                    {ar
                      ? 'أضف حسابًا في تطبيق Authenticator باستخدام مفتاح الإعداد، ثم أدخل الرمز المؤلف من 6 أرقام. لن تدخل الإدارة قبل التحقق.'
                      : 'Add an account in an authenticator app using the setup key, then enter its six-digit code. Verification is required before entering the dashboard.'}
                  </p>
                  {!sharedKey ? (
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={beginSetup}
                      disabled={busy}
                    >
                      {ar ? 'إظهار مفتاح الإعداد' : 'Show setup key'}
                    </button>
                  ) : (
                    <div className="secret-key">{sharedKey}</div>
                  )}
                </>
              )}
              <form onSubmit={verify}>
                <div className="field">
                  <label htmlFor="code">
                    {phase === 'recovery'
                      ? ar
                        ? 'كود الاسترداد'
                        : 'Recovery code'
                      : ar
                        ? 'رمز التحقق'
                        : 'Verification code'}
                  </label>
                  <input
                    id="code"
                    dir="ltr"
                    autoComplete="one-time-code"
                    inputMode={phase === 'recovery' ? 'text' : 'numeric'}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    maxLength={phase === 'recovery' ? 30 : 8}
                  />
                </div>
                <button
                  className="button button-primary"
                  disabled={busy || (phase === 'setup' && !sharedKey)}
                >
                  {ar ? 'تأكيد ومتابعة' : 'Verify & continue'}
                </button>
              </form>
              {phase === 'verify' && (
                <button
                  className="button button-outline"
                  onClick={() => {
                    setError('');
                    setPhase('recovery');
                  }}
                >
                  {ar ? 'استخدام كود استرداد' : 'Use a recovery code'}
                </button>
              )}
            </>
          )}
          {phase === 'codes' && (
            <>
              <p>
                {ar
                  ? 'احفظ أكواد الاسترداد في مكان آمن. تظهر مرة واحدة، وكل كود يستخدم مرة واحدة.'
                  : 'Save these recovery codes securely. They are shown once and each can be used once.'}
              </p>
              <div className="recovery-codes">
                {codes.map((c) => (
                  <code key={c}>{c}</code>
                ))}
              </div>
              <button
                className="button button-primary"
                onClick={() => {
                  setBusy(true);
                  void enter()
                    .catch(failure)
                    .finally(() => setBusy(false));
                }}
                disabled={busy}
              >
                {accountLogin
                  ? ar
                    ? 'حفظت الأكواد — افتح حسابي'
                    : 'I saved the codes — open my account'
                  : ar
                    ? 'حفظت الأكواد — افتح لوحة الإدارة'
                    : 'I saved the codes — open dashboard'}
              </button>
            </>
          )}
          {phase === 'forbidden' && (
            <p>
              {ar
                ? 'هذا الحساب لا يملك صلاحية الإدارة.'
                : 'This account has no administrator access.'}
            </p>
          )}
          {phase !== 'login' && (
            <button className="button button-outline" onClick={logout} disabled={busy}>
              {ar ? 'خروج' : 'Sign out'}
            </button>
          )}
        </div>
      </section>
    );
  return (
    <section className="admin-wrap">
      <div className="admin-container">
        <AdminNav locale={locale} />
        <div className="admin-heading">
          <div>
            <span className="eyebrow">
              <ShieldCheck size={17} />
              {ar ? 'إدارة المؤسسة' : 'Foundation administration'}
            </span>
            <h1>{ar ? 'أهلًا، إدارة أم المعونة' : 'Welcome to Om El Maouna'}</h1>
            <p>
              {me?.displayName} · {ar ? 'إدارة البرامج والمحتوى' : 'Programs & content management'}
            </p>
          </div>
          <Link className="button button-outline" href={`/${locale}/account`}>
            {ar ? 'ملفي الشخصي' : 'My profile'}
          </Link>
          <button className="button button-outline" onClick={logout} disabled={busy}>
            <LogOut size={17} />
            {ar ? 'خروج' : 'Sign out'}
          </button>
        </div>
        {errors}
        {notice && (
          <div className="form-status success" role="status">
            {notice}
          </div>
        )}
        <div className="admin-stats">
          {[
            [overview?.programs, ar ? 'كل البرامج' : 'All programs'],
            [overview?.publishedPrograms, ar ? 'برامج منشورة' : 'Published programs'],
            [overview?.users, ar ? 'حسابات عادية' : 'Regular accounts'],
          ].map(([value, label]) => (
            <div className="stat-card" key={label}>
              <strong>{value ?? '—'}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="admin-panel">
          <nav className="admin-tabs" aria-label={ar ? 'أقسام البرامج' : 'Program sections'}>
            <Link
              aria-current={!archived ? 'page' : undefined}
              className={!archived ? 'active' : ''}
              href={`/${locale}/admin`}
            >
              {ar ? 'البرامج النشطة' : 'Active programs'}{' '}
              <span>{rows.filter((r) => r.status !== 'Archived').length}</span>
            </Link>
            <Link
              aria-current={archived ? 'page' : undefined}
              className={archived ? 'active' : ''}
              href={`/${locale}/admin/archive`}
            >
              {ar ? 'الأرشيف' : 'Archive'}{' '}
              <span>{rows.filter((r) => r.status === 'Archived').length}</span>
            </Link>
          </nav>
          {editing ? (
            <form onSubmit={save}>
              <div className="editor-heading">
                <h2>
                  {original
                    ? ar
                      ? 'تعديل البرنامج'
                      : 'Edit program'
                    : ar
                      ? 'برنامج جديد'
                      : 'New program'}
                </h2>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={ar ? 'إغلاق المحرر' : 'Close editor'}
                  onClick={() => {
                    setEditing(null);
                    setError('');
                  }}
                  disabled={busy}
                >
                  <X size={19} />
                </button>
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="category">{ar ? 'مجال البرنامج' : 'Program category'}</label>
                  <select
                    id="category"
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  >
                    <option value="Education">{ar ? 'التعليم' : 'Education'}</option>
                    <option value="Health">{ar ? 'الصحة' : 'Health'}</option>
                    <option value="Development">
                      {ar ? 'التربية والدعم النفسي' : 'Personal development'}
                    </option>
                    <option value="Skills">{ar ? 'تنمية المهارات' : 'Skills'}</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="order">{ar ? 'ترتيب العرض' : 'Display order'}</label>
                  <input
                    id="order"
                    type="number"
                    min={0}
                    max={1000}
                    value={editing.sortOrder}
                    onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })}
                  />
                </div>
              </div>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={editing.acceptsSupportRequests}
                  onChange={(e) =>
                    setEditing({ ...editing, acceptsSupportRequests: e.target.checked })
                  }
                />
                {ar
                  ? 'البرنامج يقبل طلبات دعم عند تفعيل نظام الطلبات'
                  : 'Accept support requests when request workflows are enabled'}
              </label>
              {editing.translations.map((t, i) => (
                <section
                  className="translation-block"
                  key={t.locale}
                  dir={t.locale === 'ar' ? 'rtl' : 'ltr'}
                >
                  <h3>{t.locale === 'ar' ? 'المحتوى العربي' : 'English content'}</h3>
                  {(['title', 'slug', 'summary', 'body', 'eligibilityText'] as const).map(
                    (field) => {
                      const id = `${t.locale}-${field}`;
                      const label =
                        t.locale === 'ar'
                          ? {
                              title: 'عنوان البرنامج',
                              slug: 'الرابط المختصر',
                              summary: 'ملخص البرنامج',
                              body: 'تفاصيل البرنامج',
                              eligibilityText: 'شروط الاستفادة والتقديم',
                            }[field]
                          : {
                              title: 'Program title',
                              slug: 'URL slug',
                              summary: 'Summary',
                              body: 'Program details',
                              eligibilityText: 'Eligibility information',
                            }[field];
                      return (
                        <div className="field" key={id}>
                          <label htmlFor={id}>{label}</label>
                          {field === 'body' ||
                          field === 'summary' ||
                          field === 'eligibilityText' ? (
                            <textarea
                              id={id}
                              value={t[field]}
                              maxLength={
                                field === 'body' ? 20000 : field === 'summary' ? 500 : 4000
                              }
                              onChange={(e) => changeTranslation(i, field, e.target.value)}
                            />
                          ) : (
                            <input
                              id={id}
                              required
                              dir={field === 'slug' ? 'ltr' : undefined}
                              value={t[field]}
                              maxLength={field === 'title' ? 150 : 120}
                              onChange={(e) => changeTranslation(i, field, e.target.value)}
                            />
                          )}
                        </div>
                      );
                    },
                  )}
                </section>
              ))}
              <div className="editor-actions">
                <button className="button button-primary" disabled={busy}>
                  {ar ? 'حفظ البرنامج' : 'Save program'}
                </button>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => {
                    setEditing(null);
                    setError('');
                  }}
                  disabled={busy}
                >
                  {ar ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
              <p className="admin-note">
                {ar
                  ? 'البرامج الجديدة تُحفظ كمسودة. النشر يتطلب عنوانًا وملخصًا وتفاصيل مكتملة باللغتين.'
                  : 'New programs are saved as drafts. Publishing requires complete titles, summaries and details in both languages.'}
              </p>
            </form>
          ) : (
            <>
              <div className="panel-heading">
                <h2>
                  <BookOpen
                    size={20}
                    style={{ display: 'inline', verticalAlign: 'middle', marginInlineEnd: 8 }}
                  />
                  {archived
                    ? ar
                      ? 'البرامج المؤرشفة'
                      : 'Archived programs'
                    : ar
                      ? 'برامج المؤسسة'
                      : 'Foundation programs'}
                </h2>
                <button
                  className="button button-primary"
                  onClick={() => {
                    setOriginal(null);
                    setEditing(empty());
                    setNotice('');
                    setError('');
                  }}
                >
                  <Plus size={17} />
                  {ar ? 'برنامج جديد' : 'New program'}
                </button>
              </div>
              <div className="program-admin-list">
                {rows
                  .filter((row) =>
                    archived ? row.status === 'Archived' : row.status !== 'Archived',
                  )
                  .map((row) => (
                    <div className="program-admin-row" key={row.id}>
                      <div>
                        <h3>{row.translations.find((t) => t.locale === locale)?.title}</h3>
                        <p>{row.translations.find((t) => t.locale !== locale)?.title}</p>
                        <span className={`badge ${row.status === 'Published' ? 'published' : ''}`}>
                          {status(row.status)}
                        </span>
                      </div>
                      <div className="row-actions">
                        <button
                          className="button button-outline"
                          disabled={busy}
                          onClick={() => {
                            setOriginal(row);
                            setEditing({
                              category: row.category,
                              sortOrder: row.sortOrder,
                              acceptsSupportRequests: row.acceptsSupportRequests,
                              translations: row.translations.map((t) => ({
                                locale: t.locale,
                                slug: t.slug,
                                title: t.title,
                                summary: t.summary,
                                body: t.body,
                                eligibilityText: t.eligibilityText,
                              })),
                            });
                            setError('');
                            setNotice('');
                          }}
                        >
                          {ar ? 'تعديل' : 'Edit'}
                        </button>
                        <button
                          className="button button-primary"
                          disabled={busy}
                          onClick={() =>
                            void transition(
                              row,
                              row.status === 'Archived'
                                ? 'restore'
                                : row.status === 'Published'
                                  ? 'unpublish'
                                  : 'publish',
                            )
                          }
                        >
                          <CheckCircle size={15} />
                          {row.status === 'Archived'
                            ? ar
                              ? 'استعادة كمسودة'
                              : 'Restore as draft'
                            : row.status === 'Published'
                              ? ar
                                ? 'إلغاء النشر'
                                : 'Unpublish'
                              : ar
                                ? 'نشر'
                                : 'Publish'}
                        </button>
                        {row.status !== 'Archived' && (
                          <button
                            className="button button-outline"
                            disabled={busy}
                            onClick={() => void transition(row, 'archive')}
                          >
                            {ar ? 'أرشفة' : 'Archive'}
                          </button>
                        )}
                        <button
                          className="button button-outline"
                          disabled={busy}
                          onClick={() => void transition(row, 'delete')}
                        >
                          {ar ? 'حذف' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
              {rows.filter((row) =>
                archived ? row.status === 'Archived' : row.status !== 'Archived',
              ).length === 0 && (
                <div className="empty-state">
                  <BookOpen size={35} />
                  <p>
                    {archived
                      ? ar
                        ? 'الأرشيف فارغ. البرامج التي تؤرشفها ستظهر هنا ويمكن استعادتها كمسودات.'
                        : 'Your archive is empty. Archived programs appear here and can be restored as drafts.'
                      : ar
                        ? 'ابدأ بإضافة أول برنامج للمؤسسة.'
                        : 'Add the first foundation program.'}
                  </p>
                </div>
              )}
              <p className="admin-note">
                {ar
                  ? 'الأرقام هنا من قاعدة البيانات الفعلية. باقي أقسام لوحة الإدارة تُضاف في المراحل القادمة.'
                  : 'These counts come from the database. Additional management sections will be built in the next milestones.'}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
