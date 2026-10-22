'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clientApi, ApiError } from '@/lib/client-api';
import type { Locale } from '@/lib/i18n';
import { newSubmissionKey } from '@/lib/submission-key';
export function RequestForm({
  locale,
  kind,
}: {
  locale: Locale;
  kind: 'Volunteer' | 'Enrollment' | 'Contact' | 'Contribution';
}) {
  const ar = locale === 'ar',
    contact = kind === 'Contact',
    enrollment = kind === 'Enrollment',
    contribution = kind === 'Contribution';
  const [ready, setReady] = useState(contact),
    [loaded, setLoaded] = useState(contact),
    [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [phone, setPhone] = useState(''),
    [description, setDescription] = useState(''),
    [childName, setChildName] = useState(''),
    [birth, setBirth] = useState(''),
    [stage, setStage] = useState('Primary'),
    [contributionType, setContributionType] = useState('Financial'),
    [skills, setSkills] = useState(''),
    [availability, setAvailability] = useState(''),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [reference, setReference] = useState(''),
    [local, setLocal] = useState(false);
  const [submissionKey] = useState(newSubmissionKey);
  useEffect(() => {
    if (contact) return;
    let active = true;
    clientApi<{ displayName: string; email: string; phoneNumber: string | null }>('/me/profile')
      .then((p) => {
        if (active) {
          setName(p.displayName);
          setEmail(p.email);
          setPhone(p.phoneNumber ?? '');
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setReady(false);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [contact]);
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = contact
        ? { submissionKey, name, email, phone, message: description, consent }
        : {
            submissionKey,
            kind,
            phone,
            description,
            consent,
            ...(enrollment
              ? { childName, childDateOfBirth: birth, educationStage: stage }
              : contribution
                ? { contributionType }
                : { skills, availability }),
          };
      const result = await clientApi<{ reference: string; delivery: string }>(
        contact ? '/contact' : '/requests',
        'POST',
        body,
      );
      setReference(result.reference);
      setLocal(result.delivery === 'LocalPreview');
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? ar
            ? 'سجّل الدخول أولًا، ثم أعد فتح النموذج.'
            : 'Sign in first, then reopen this form.'
          : e instanceof ApiError && e.status === 429
            ? ar
              ? 'طلبات كثيرة في وقت قصير. انتظر قليلًا وحاول مرة أخرى.'
              : 'Too many submissions. Please wait and try again.'
            : e instanceof Error
              ? e.message
              : ar
                ? 'تعذر إرسال الطلب.'
                : 'Unable to submit.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (!loaded)
    return <p role="status">{ar ? 'جارٍ التحقق من الحساب…' : 'Checking your account…'}</p>;
  if (!ready)
    return (
      <div className="admin-panel">
        <h2>{ar ? 'خطوة بسيطة قبل التقديم' : 'Sign in before applying'}</h2>
        <p>
          {ar
            ? 'أنشئ حسابك وأكّد بريدك، عشان تتابع طلبك وتستكمل أي معلومات تطلبها المؤسسة.'
            : 'Create an account and confirm your email so you can track your application and provide follow-up information.'}
        </p>
        <div className="row-actions">
          <Link
            className="button button-primary"
            href={`/${locale}/signin?next=/${locale}/${enrollment ? 'enroll' : contribution ? 'support' : 'volunteer'}`}
          >
            {ar ? 'تسجيل الدخول' : 'Sign in'}
          </Link>
          <Link className="button button-outline" href={`/${locale}/register`}>
            {ar ? 'إنشاء حساب' : 'Create account'}
          </Link>
        </div>
      </div>
    );
  if (reference)
    return (
      <div className="admin-panel">
        <div role="status" className="form-status success">
          <h2>{ar ? 'تم تسجيل طلبك' : 'Your request has been recorded'}</h2>
          <p>
            {ar ? 'رقم المتابعة:' : 'Reference:'} <strong dir="ltr">{reference}</strong>
          </p>
        </div>
        <p>
          {contact
            ? ar
              ? 'رسالتك موجودة الآن لدى الإدارة للمراجعة والرد.'
              : 'Your message is available to the administration for review and reply.'
            : ar
              ? 'المؤسسة هتراجع البيانات وتتواصل معاك. تقديم الطلب لا يعني الموافقة أو حجز مكان.'
              : 'The foundation will review your details and contact you. Applying does not mean approval or reserve a place.'}
        </p>
        {local && (
          <p className="info-box">
            {ar
              ? 'في النسخة المحلية: الإشعار البريدي محفوظ للمعاينة ولم يُرسل خارجيًا؛ الطلب نفسه محفوظ لدى الإدارة.'
              : 'Local preview: email was saved locally, not sent externally. The request itself is recorded for the administration.'}
          </p>
        )}
        {!contact && (
          <Link className="button button-primary" href={`/${locale}/account/requests`}>
            {ar ? 'متابعة طلباتي' : 'Track my requests'}
          </Link>
        )}
      </div>
    );
  return (
    <div className="admin-panel request-form-panel">
      <h2>
        {contact
          ? ar
            ? 'اكتب رسالتك'
            : 'Send us a message'
          : contribution
            ? ar
              ? 'تفاصيل المساهمة'
              : 'Contribution details'
            : enrollment
              ? ar
                ? 'بيانات طلب الالتحاق'
                : 'Enrollment request'
              : ar
                ? 'طلب التطوع'
                : 'Volunteer application'}
      </h2>
      {error && (
        <div className="form-status" role="alert">
          {error}
        </div>
      )}
      <form className="profile-fields" onSubmit={submit}>
        <div className="field">
          <label htmlFor="applicant-name">{ar ? 'الاسم' : 'Name'}</label>
          <input
            id="applicant-name"
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            readOnly={!contact}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="applicant-email">{ar ? 'البريد الإلكتروني' : 'Email'}</label>
          <input
            id="applicant-email"
            required
            type="email"
            dir="ltr"
            autoComplete="email"
            maxLength={254}
            readOnly={!contact}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="request-phone">
            {ar
              ? contact
                ? 'التليفون (اختياري)'
                : 'التليفون'
              : contact
                ? 'Phone (optional)'
                : 'Phone'}
          </label>
          <input
            id="request-phone"
            type="tel"
            dir="ltr"
            autoComplete="tel"
            required={!contact}
            maxLength={30}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        {enrollment && (
          <>
            <div className="field">
              <label htmlFor="child-name">
                {ar ? 'الاسم الأول للابن أو الابنة' : 'Child’s first name'}
              </label>
              <input
                id="child-name"
                required
                maxLength={80}
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="child-birth">
                {ar ? 'تاريخ ميلاد الابن أو الابنة' : 'Child’s date of birth'}
              </label>
              <input
                id="child-birth"
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                value={birth}
                onChange={(e) => setBirth(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="education-stage">{ar ? 'المرحلة الدراسية' : 'Education stage'}</label>
              <select id="education-stage" value={stage} onChange={(e) => setStage(e.target.value)}>
                {[
                  ['Primary', ar ? 'ابتدائي' : 'Primary'],
                  ['Preparatory', ar ? 'إعدادي' : 'Preparatory'],
                  ['Secondary', ar ? 'ثانوي' : 'Secondary'],
                  ['University', ar ? 'جامعة' : 'University'],
                  ['Other', ar ? 'أخرى' : 'Other'],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        {contribution && (
          <div className="field wide-field">
            <label htmlFor="contribution-type">{ar ? 'نوع المساهمة' : 'Contribution type'}</label>
            <select
              id="contribution-type"
              value={contributionType}
              onChange={(e) => setContributionType(e.target.value)}
            >
              <option value="Financial">{ar ? 'مالية' : 'Financial'}</option>
              <option value="InKind">{ar ? 'عينية' : 'In-kind'}</option>
            </select>
            <p>
              {ar
                ? 'ده طلب تنسيق، مش عملية دفع أو إيصال استلام. المؤسسة هتتواصل معاك لتحديد طريقة التسليم أو التحويل الرسمية.'
                : 'This coordinates a contribution; it is not a payment or receipt. The foundation will agree an official delivery or transfer method with you.'}
            </p>
          </div>
        )}
        {!contact && !enrollment && !contribution && (
          <>
            <div className="field">
              <label htmlFor="volunteer-skills">
                {ar ? 'مهاراتك ومجالات المشاركة' : 'Skills and interests'}
              </label>
              <textarea
                id="volunteer-skills"
                required
                minLength={2}
                maxLength={1000}
                rows={3}
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="volunteer-time">
                {ar ? 'الأيام والأوقات المناسبة' : 'Availability'}
              </label>
              <textarea
                id="volunteer-time"
                required
                minLength={2}
                maxLength={500}
                rows={3}
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
              />
            </div>
          </>
        )}
        <div className="field wide-field">
          <label htmlFor="request-description">
            {contact
              ? ar
                ? 'رسالتك'
                : 'Your message'
              : contribution
                ? ar
                  ? 'وصف المساهمة والكمية أو المبلغ المقترح وطريقة التواصل المناسبة'
                  : 'Describe your contribution, proposed quantity or amount, and preferred contact method'
                : enrollment
                  ? ar
                    ? 'إزاي نقدر نساعد؟'
                    : 'How can we help?'
                  : ar
                    ? 'عرفنا بنفسك وسبب رغبتك في التطوع'
                    : 'Tell us about yourself and why you would like to volunteer'}
          </label>
          <textarea
            id="request-description"
            required
            minLength={20}
            maxLength={4000}
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <small>
            {ar
              ? 'من 20 إلى 4000 حرف. لا ترفق أرقام هوية أو تفاصيل طبية حساسة.'
              : '20–4000 characters. Do not include identity numbers or sensitive medical details.'}
          </small>
        </div>
        <label className="wide-field consent-field">
          <input
            type="checkbox"
            required
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          {enrollment
            ? ar
              ? 'أنا ولي الأمر أو المسؤول عن التقديم، وأوافق على استخدام البيانات لمراجعة الطلب والتواصل بخصوصه.'
              : 'I am the parent or responsible applicant and agree to use of these details for reviewing and following up this application.'
            : ar
              ? 'أوافق على استخدام البيانات لمراجعة رسالتي أو طلبي والتواصل معي بخصوصه.'
              : 'I agree to use of these details to review my message or application and contact me about it.'}
        </label>
        <div className="profile-save">
          <button className="button button-primary" disabled={busy}>
            {busy ? (ar ? 'جارٍ الإرسال…' : 'Submitting…') : ar ? 'إرسال الطلب' : 'Submit request'}
          </button>
        </div>
      </form>
    </div>
  );
}
