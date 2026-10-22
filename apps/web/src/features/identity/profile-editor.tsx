'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Camera, UserRound } from 'lucide-react';
import { clientApi, ApiError } from '@/lib/client-api';
import type { Locale } from '@/lib/i18n';

export type Profile = {
  displayName: string;
  email: string;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  age: number | null;
  avatarVersion: string | null;
  isAdministrator: boolean;
};
export function Avatar({ profile }: { profile: Pick<Profile, 'displayName' | 'avatarVersion'> }) {
  return (
    <span className="profile-avatar">
      {profile.avatarVersion ? (
        <img src={`/api/v1/me/avatar?v=${profile.avatarVersion}`} alt="" width={72} height={72} />
      ) : (
        <span aria-hidden="true">
          {profile.displayName.trim().slice(0, 1) || <UserRound size={28} />}
        </span>
      )}
    </span>
  );
}
export function ProfileEditor({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    clientApi<Profile>('/me/profile')
      .then((p) => {
        if (active) setProfile(p);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof ApiError && [401, 403].includes(e.status)
              ? ar
                ? 'سجّل الدخول وأكمل التحقق لعرض ملفك الشخصي.'
                : 'Sign in and complete verification to view your profile.'
              : ar
                ? 'تعذر تحميل الملف الشخصي.'
                : 'Could not load your profile.',
          );
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [ar]);
  function changed(p: Profile) {
    setProfile(p);
    window.dispatchEvent(new Event('profile-updated'));
  }
  async function save(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      changed(
        await clientApi<Profile>('/me/profile', 'PUT', {
          displayName: profile.displayName,
          phoneNumber: profile.phoneNumber,
          dateOfBirth: profile.dateOfBirth || null,
          gender: profile.gender || null,
        }),
      );
      setNotice(ar ? 'تم حفظ بياناتك.' : 'Your profile has been saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    setError('');
    setNotice('');
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError(
        ar
          ? 'اختر صورة JPG أو PNG أو WebP بحجم لا يتجاوز 5 ميجابايت.'
          : 'Choose a JPG, PNG or WebP image up to 5 MB.',
      );
      return;
    }
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 512;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Unable to prepare image.');
        const size = Math.min(bitmap.width, bitmap.height);
        context.fillStyle = '#fff';
        context.fillRect(0, 0, 512, 512);
        context.drawImage(
          bitmap,
          (bitmap.width - size) / 2,
          (bitmap.height - size) / 2,
          size,
          size,
          0,
          0,
          512,
          512,
        );
        changed(
          await clientApi<Profile>('/me/avatar', 'PUT', {
            base64: canvas.toDataURL('image/jpeg', 0.85).split(',')[1],
          }),
        );
        setNotice(ar ? 'تم تحديث صورتك الشخصية.' : 'Your photo has been updated.');
      } finally {
        bitmap.close();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to upload photo.');
    } finally {
      setBusy(false);
    }
  }
  async function removePhoto() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await clientApi('/me/avatar', 'DELETE');
      if (profile) changed({ ...profile, avatarVersion: null });
      setNotice(ar ? 'تم حذف الصورة.' : 'Photo removed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to remove photo.');
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    setError('');
    try {
      await clientApi('/auth/logout', 'POST');
      window.dispatchEvent(new Event('profile-updated'));
      window.location.assign(`/${locale}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign out.');
      setBusy(false);
    }
  }
  return (
    <section className="profile-panel admin-panel">
      <div className="panel-heading">
        <h2>{ar ? 'ملفي الشخصي' : 'My profile'}</h2>
        <UserRound size={22} />
      </div>
      <p className="admin-note">
        {ar
          ? 'بيانات بسيطة تخصك أنت، ولا تظهر لزوار الموقع.'
          : 'A few details about you, kept private from website visitors.'}
      </p>
      {error && (
        <div className="form-status" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="form-status success" role="status">
          {notice}
        </div>
      )}
      {!loaded && <p role="status">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p>}
      {profile ? (
        <>
          <div className="profile-links">
            <Link className="button button-outline" href={`/${locale}/account/requests`}>
              {ar ? 'طلباتي ومتابعتها' : 'My requests & updates'}
            </Link>
            <Link className="button button-outline" href={`/${locale}/contribute`}>
              {ar ? 'طرق المشاركة' : 'Ways to get involved'}
            </Link>
            {profile.isAdministrator && (
              <Link className="button button-outline" href={`/${locale}/admin`}>
                {ar ? 'العودة إلى لوحة الإدارة' : 'Back to dashboard'}
              </Link>
            )}
            <button
              type="button"
              className="button button-outline"
              onClick={() => void signOut()}
              disabled={busy}
            >
              {ar ? 'تسجيل الخروج' : 'Sign out'}
            </button>
          </div>
          <div className="profile-photo-row">
            <Avatar profile={profile} />
            <div>
              <strong>{profile.displayName}</strong>
              <p>
                {profile.isAdministrator
                  ? ar
                    ? 'مدير المؤسسة'
                    : 'Administrator'
                  : ar
                    ? 'حساب شخصي'
                    : 'Personal account'}
              </p>
            </div>
            <label className="button button-outline photo-upload">
              <Camera size={17} />
              {ar ? 'تغيير الصورة' : 'Change photo'}
              <input
                aria-label={ar ? 'الصورة الشخصية' : 'Profile photo'}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            {profile.avatarVersion && (
              <button
                className="button button-outline"
                disabled={busy}
                onClick={() => void removePhoto()}
              >
                {ar ? 'حذف الصورة' : 'Remove photo'}
              </button>
            )}
          </div>
          <form onSubmit={save} className="profile-fields">
            <div className="field">
              <label htmlFor="profile-name">{ar ? 'الاسم' : 'Name'}</label>
              <input
                id="profile-name"
                autoComplete="name"
                minLength={2}
                maxLength={100}
                required
                value={profile.displayName}
                onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="profile-email">{ar ? 'البريد الإلكتروني' : 'Email'}</label>
              <input id="profile-email" dir="ltr" type="email" value={profile.email} readOnly />
              <small>
                {ar
                  ? 'البريد المؤكد للحساب. تغيير البريد سيتاح مع مسار تأكيد البريد.'
                  : 'Your verified account email. Email changes will be available with email verification.'}
              </small>
            </div>
            <div className="field">
              <label htmlFor="profile-phone">
                {ar ? 'رقم التليفون (اختياري)' : 'Phone (optional)'}
              </label>
              <input
                id="profile-phone"
                type="tel"
                dir="ltr"
                autoComplete="tel"
                maxLength={30}
                placeholder="+20…"
                value={profile.phoneNumber ?? ''}
                onChange={(e) => setProfile({ ...profile, phoneNumber: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="profile-birth">
                {ar ? 'تاريخ الميلاد (اختياري)' : 'Date of birth (optional)'}
              </label>
              <input
                id="profile-birth"
                type="date"
                autoComplete="bday"
                max={new Date().toISOString().slice(0, 10)}
                value={profile.dateOfBirth ?? ''}
                onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })}
              />
              {profile.age !== null && (
                <small>{ar ? `العمر: ${profile.age} سنة` : `Age: ${profile.age}`}</small>
              )}
            </div>
            <div className="field">
              <label htmlFor="profile-gender">{ar ? 'النوع (اختياري)' : 'Gender (optional)'}</label>
              <select
                id="profile-gender"
                value={profile.gender ?? ''}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
              >
                <option value="">{ar ? 'غير محدد' : 'Not specified'}</option>
                <option value="Male">{ar ? 'ذكر' : 'Male'}</option>
                <option value="Female">{ar ? 'أنثى' : 'Female'}</option>
              </select>
            </div>
            <div className="profile-save">
              <button className="button button-primary" disabled={busy}>
                {busy ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : ar ? 'حفظ بياناتي' : 'Save my details'}
              </button>
            </div>
          </form>
        </>
      ) : (
        loaded && (
          <Link className="button button-primary" href={`/${locale}/signin`}>
            {ar ? 'تسجيل الدخول' : 'Sign in'}
          </Link>
        )
      )}
    </section>
  );
}
