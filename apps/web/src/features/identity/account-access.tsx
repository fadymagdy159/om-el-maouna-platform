'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clientApi, ApiError } from '@/lib/client-api';
import type { Locale } from '@/lib/i18n';
import { PasswordInput } from '@/components/password-input';
type Mode = 'register' | 'confirm-email' | 'forgot-password' | 'reset-password';
export function AccountAccess({ locale, mode }: { locale: Locale; mode: Mode }) {
  const ar = locale === 'ar';
  const [email, setEmail] = useState(''),
    [name, setName] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [local, setLocal] = useState(false),
    [previewLink, setPreviewLink] = useState(''),
    [existingReady, setExistingReady] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const q = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
    setEmail(q.get('email') ?? '');
    setCode(q.get('code') ?? '');
  }, []);
  const title =
    mode === 'register'
      ? ar
        ? 'حساب جديد، وخطوة أقرب'
        : 'Create your account'
      : mode === 'confirm-email'
        ? ar
          ? 'تأكيد بريدك الإلكتروني'
          : 'Confirm your email'
        : mode === 'forgot-password'
          ? ar
            ? 'استعادة كلمة السر'
            : 'Forgot your password?'
          : ar
            ? 'كلمة سر جديدة'
            : 'Set a new password';
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if ((mode === 'register' || mode === 'reset-password') && password !== confirm) {
      setError(ar ? 'كلمتا السر غير متطابقتين.' : 'Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const body =
        mode === 'register'
          ? { displayName: name, email: email.trim(), password, locale }
          : mode === 'confirm-email'
            ? { email: email.trim(), code }
            : mode === 'reset-password'
              ? { email: email.trim(), code, password }
              : { email: email.trim(), locale };
      const result = await clientApi<{
        delivery?: string;
        developmentConfirmationLink?: string;
        nextStep?: string;
      }>(`/auth/${mode}`, 'POST', body);
      setPassword('');
      setConfirm('');
      setDone(true);
      setLocal(result.delivery === 'LocalPreview');
      setExistingReady(result.nextStep === 'SignIn');
      if (result.developmentConfirmationLink) {
        const preview = new URL(result.developmentConfirmationLink);
        setPreviewLink(preview.pathname + preview.hash);
      }
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 429
          ? ar
            ? 'محاولات كثيرة خلال وقت قصير. انتظر دقيقة ثم اضغط إنشاء حساب مرة أخرى؛ بياناتك ما زالت موجودة.'
            : 'Too many attempts. Wait a minute and try again; your details are still here.'
          : e instanceof TypeError
            ? ar
              ? 'تعذر الاتصال بالموقع. تأكد أن الموبايل والكمبيوتر على نفس الشبكة، ثم حاول مرة أخرى.'
              : 'Could not connect. Check your network connection and try again.'
            : e instanceof ApiError && e.status === 400
              ? ar
                ? 'راجع البيانات. لو رابط التأكيد أو الاستعادة منتهي، اطلب رابطًا جديدًا. كلمة السر لا تقل عن 12 حرفًا.'
                : 'Check your details. Request a new link if this one expired. Passwords need at least 12 characters.'
              : ar
                ? 'تعذر إكمال الطلب. حاول مرة أخرى.'
                : 'Unable to complete the request. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError('');
    try {
      const r = await clientApi<{ delivery: string }>('/auth/resend-confirmation', 'POST', {
        email: email.trim(),
        locale,
      });
      setDone(true);
      setLocal(r.delivery === 'LocalPreview');
    } catch {
      setError(ar ? 'تعذر طلب رابط جديد.' : 'Could not request a new link.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">{ar ? 'أهلًا بك في أم المعونة' : 'Welcome to Om El Maouna'}</span>
        <h1>
          {done && mode === 'register' && !previewLink
            ? ar
              ? 'استكمل الدخول إلى حسابك'
              : 'Continue to your account'
            : title}
        </h1>
        <p>
          {ar
            ? 'حساب واحد لمتابعة طلباتك وبياناتك.'
            : 'One account for your profile and applications.'}
        </p>
        {error && (
          <div role="alert" className="form-status">
            {error}
          </div>
        )}
        {done ? (
          <>
            <div role="status" className="form-status success">
              {mode === 'confirm-email'
                ? ar
                  ? 'تم تأكيد بريدك. تقدر تسجّل الدخول دلوقتي.'
                  : 'Email confirmed. You can now sign in.'
                : mode === 'reset-password'
                  ? ar
                    ? 'تم تغيير كلمة السر. سجّل الدخول بكلمة السر الجديدة.'
                    : 'Password updated. Sign in with your new password.'
                  : ar
                    ? mode === 'register'
                      ? existingReady
                        ? 'حسابك موجود ومفعّل بالفعل. اضغط تسجيل الدخول باستخدام نفس البريد وكلمة السر.'
                        : previewLink
                          ? 'الخطوة التالية: أكّد بريدك الإلكتروني لتفعيل الحساب، ثم سجّل الدخول.'
                          : 'لو سبق وسجلت، استخدم تسجيل الدخول أو استعادة كلمة السر. الحساب الجديد يحتاج تأكيد البريد قبل الدخول.'
                      : 'راجع بريدك للحصول على الخطوة التالية، إن كان الحساب مؤهلًا.'
                    : existingReady
                      ? 'Your account already exists and is confirmed. Sign in with the same email and password.'
                      : 'Request received. If you registered before, sign in or recover your password. New accounts require email confirmation.'}
            </div>
            {local && (mode !== 'register' || Boolean(previewLink)) && (
              <div className="info-box">
                <strong>{ar ? 'البريد في وضع التجربة المحلية' : 'Local email preview'}</strong>
                <p>
                  {ar
                    ? previewLink
                      ? 'أنت تختبر نسخة محلية؛ لم نرسل بريدًا خارجيًا. استخدم الزر لإكمال التأكيد هنا. هذا الخيار متاح للتطوير فقط.'
                      : 'الرسالة محفوظة محليًا ولم تُرسل إلى صندوق بريدك. لعرضها على جهاز التطوير شغّل:'
                    : previewLink
                      ? 'This is a local preview; no external email was sent. Use the button to confirm here. This option is available only in development.'
                      : 'The message was saved locally, not sent to your inbox. On the development computer, run:'}
                </p>
                {previewLink ? (
                  <Link className="button button-primary" href={previewLink}>
                    {ar ? 'فتح تأكيد البريد للتجربة' : 'Open development email confirmation'}
                  </Link>
                ) : (
                  <code dir="ltr">.\scripts\show-development-mail.ps1</code>
                )}
              </div>
            )}
          </>
        ) : (
          <form onSubmit={submit}>
            {mode === 'register' && (
              <div className="field">
                <label htmlFor="signup-name">{ar ? 'الاسم' : 'Name'}</label>
                <input
                  id="signup-name"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="signup-email">{ar ? 'البريد الإلكتروني' : 'Email address'}</label>
              <input
                id="signup-email"
                type="email"
                dir="ltr"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {(mode === 'register' || mode === 'reset-password') && (
              <>
                <div className="field">
                  <label htmlFor="new-password">
                    {ar ? 'كلمة السر — 12 حرفًا على الأقل' : 'Password — at least 12 characters'}
                  </label>
                  <PasswordInput
                    locale={locale}
                    id="new-password"
                    dir="ltr"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="repeat-password">
                    {ar ? 'تأكيد كلمة السر' : 'Repeat password'}
                  </label>
                  <PasswordInput
                    locale={locale}
                    id="repeat-password"
                    dir="ltr"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
              </>
            )}
            {mode === 'confirm-email' && !code && (
              <p>
                {ar
                  ? 'افتح رابط التأكيد الموجود في رسالة البريد، أو اطلب رابطًا جديدًا بالأسفل.'
                  : 'Open the confirmation link in your email, or request a new link below.'}
              </p>
            )}
            <button
              className="button button-primary"
              disabled={busy || (mode === 'confirm-email' && !code)}
            >
              {busy
                ? ar
                  ? 'جارٍ التنفيذ…'
                  : 'Working…'
                : mode === 'register'
                  ? ar
                    ? 'إنشاء حساب'
                    : 'Create account'
                  : mode === 'confirm-email'
                    ? ar
                      ? 'تأكيد البريد'
                      : 'Confirm email'
                    : mode === 'forgot-password'
                      ? ar
                        ? 'إرسال رابط الاستعادة'
                        : 'Send reset link'
                      : ar
                        ? 'حفظ كلمة السر'
                        : 'Save password'}
            </button>
            {mode === 'register' && (
              <p className="admin-note">
                {ar
                  ? 'إنشاء الحساب لا يعني قبول طلب التحاق أو تطوع؛ كل طلب يُراجع بواسطة المؤسسة.'
                  : 'Creating an account does not approve an application; the foundation reviews each request.'}
              </p>
            )}
          </form>
        )}
        <div className="profile-links auth-actions">
          <Link href={`/${locale}/signin`}>{ar ? 'تسجيل الدخول' : 'Sign in'}</Link>
          {done && mode === 'register' ? (
            <>
              <Link href={`/${locale}/forgot-password`}>
                {ar ? 'نسيت كلمة السر؟' : 'Forgot password?'}
              </Link>
              <Link href={`/${locale}/confirm-email`}>
                {ar ? 'إعادة إرسال التأكيد' : 'Resend confirmation'}
              </Link>
            </>
          ) : (
            <Link href={`/${locale}/register`}>{ar ? 'إنشاء حساب' : 'Create account'}</Link>
          )}
        </div>
        {mode === 'confirm-email' && (
          <button
            className="button button-outline"
            disabled={busy || !email}
            onClick={() => void resend()}
          >
            {ar ? 'إرسال رابط تأكيد جديد' : 'Send a new confirmation link'}
          </button>
        )}
      </div>
    </section>
  );
}
