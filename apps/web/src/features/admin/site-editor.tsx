'use client';
import { useEffect, useState } from 'react';
import { clientApi } from '@/lib/client-api';
import { copy } from '@/lib/i18n';
import { foundationDetails } from '@/content/foundation-details';
import type { Locale } from '@/lib/i18n';
const defaults: Record<string, string> = {
  heroVisual: 'Reference',
  heroStartAr: copy.ar.heroStart,
  heroStartEn: copy.en.heroStart,
  heroEndAr: copy.ar.heroEnd,
  heroEndEn: copy.en.heroEnd,
  heroBodyAr: copy.ar.heroBody,
  heroBodyEn: copy.en.heroBody,
  aboutAr: foundationDetails.mission.ar,
  aboutEn: foundationDetails.mission.en,
  addressAr: foundationDetails.address.ar,
  addressEn: foundationDetails.address.en,
  phone: foundationDetails.phone,
  email: foundationDetails.email,
  registration: foundationDetails.registration,
};
for (const key of [
  'pillars',
  'pillarsBody',
  'approachTitle',
  'approachText',
  'step1',
  'step1Body',
  'step2',
  'step2Body',
  'step3',
  'step3Body',
  'cta',
  'ctaBody',
] as const) {
  defaults[key + 'Ar'] = copy.ar[key];
  defaults[key + 'En'] = copy.en[key];
}
for (const locale of ['ar', 'en'] as const) {
  const suffix = locale === 'ar' ? 'Ar' : 'En';
  for (const [i, key] of ['educationServices', 'healthServices', 'activityServices'].entries())
    defaults[key + suffix] = foundationDetails.services[i].items[locale].join('\n');
  defaults['goals' + suffix] = foundationDetails.goals[locale].join('\n');
}
Object.assign(defaults, {
  ctaAr: 'كن جزءًا من قصة النجاح',
  ctaEn: 'Be part of a success story',
  ctaBodyAr: 'كل مساهمة تصنع فرقًا حقيقيًا في حياة طفل وأسرة.',
  ctaBodyEn: 'Every contribution can make a real difference to a child and a family.',
});
function contentGroup(key: string) {
  const base = key.replace(/(Ar|En)$/, '');
  return ['heroVisual', 'heroStart', 'heroEnd', 'heroBody', 'pillars', 'pillarsBody'].includes(base)
    ? 'home'
    : base.startsWith('step') || ['approachTitle', 'approachText', 'cta', 'ctaBody'].includes(base)
      ? 'message'
      : ['about', 'educationServices', 'healthServices', 'activityServices', 'goals'].includes(base)
        ? 'about'
        : 'contact';
}
export function SiteEditor({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  const [section, setSection] = useState('home');
  const [values, setValues] = useState(defaults),
    [version, setVersion] = useState(0),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    clientApi<{ values: Record<string, string>; version: number }>('/site-content')
      .then((r) => {
        setValues({ ...defaults, ...r.values });
        setVersion(r.version);
        setLoaded(true);
      })
      .catch(() => setError(ar ? 'تعذر تحميل المحتوى.' : 'Unable to load content.'));
  }, [ar]);
  async function save(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await clientApi<{ version: number }>(
        '/admin/site-content',
        'PUT',
        { values },
        version,
      );
      setVersion(r.version);
      setNotice(ar ? 'تم الحفظ وتحديث صفحات الموقع.' : 'Saved. Website content is updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }
  const names: Record<string, string> = {
    heroVisual: ar ? 'صورة الرئيسية' : 'Homepage visual',
    heroStart: ar ? 'عنوان الرئيسية — الجزء الأول' : 'Homepage heading — first line',
    heroEnd: ar ? 'عنوان الرئيسية — الجزء الثاني' : 'Homepage heading — second line',
    heroBody: ar ? 'وصف الرئيسية' : 'Homepage introduction',
    about: ar ? 'تعريف المؤسسة' : 'About the foundation',
    address: ar ? 'العنوان' : 'Address',
    phone: ar ? 'تليفون التواصل' : 'Contact phone',
    email: ar ? 'بريد التواصل المعروض' : 'Public contact email',
    registration: ar ? 'رقم التسجيل' : 'Registration number',
    pillars: ar ? 'عنوان مجالات العمل' : 'Programs section heading',
    pillarsBody: ar ? 'وصف مجالات العمل' : 'Programs section introduction',
    approachTitle: ar ? 'عنوان رسالة المؤسسة' : 'Mission heading',
    approachText: ar ? 'رسالة المؤسسة' : 'Mission text',
    step1: ar ? 'عنوان الخطوة الأولى' : 'First step heading',
    step1Body: ar ? 'وصف الخطوة الأولى' : 'First step description',
    step2: ar ? 'عنوان الخطوة الثانية' : 'Second step heading',
    step2Body: ar ? 'وصف الخطوة الثانية' : 'Second step description',
    step3: ar ? 'عنوان الخطوة الثالثة' : 'Third step heading',
    step3Body: ar ? 'وصف الخطوة الثالثة' : 'Third step description',
    cta: ar ? 'عنوان دعوة المشاركة' : 'Participation heading',
    ctaBody: ar ? 'نص دعوة المشاركة' : 'Participation text',
    educationServices: ar
      ? 'الخدمات التعليمية — بند في كل سطر'
      : 'Education services — one item per line',
    healthServices: ar ? 'الخدمات الصحية — بند في كل سطر' : 'Health services — one item per line',
    activityServices: ar ? 'الأنشطة — بند في كل سطر' : 'Activities — one item per line',
    goals: ar ? 'الأهداف المستقبلية — بند في كل سطر' : 'Future goals — one item per line',
  };
  if (!loaded)
    return (
      <div className="admin-panel">
        {error ? (
          <p role="alert" className="form-status">
            {error}
          </p>
        ) : (
          <p role="status">{ar ? 'جارٍ تحميل محتوى الموقع…' : 'Loading site content…'}</p>
        )}
      </div>
    );
  return (
    <div className="admin-panel">
      <p>
        {ar
          ? 'عدّل نصوص الرئيسية والتعريف والتواصل. صورة الرئيسية تُختار من مكتبة الوسائط، والبرامج من قسم البرامج.'
          : 'Edit homepage copy, foundation introduction and contact details. Choose the homepage photograph in Media and manage programs in Programs.'}
      </p>
      {error && (
        <div role="alert" className="form-status">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="form-status success">
          {notice}
        </div>
      )}
      <form className="profile-fields" onSubmit={save}>
        <div
          className="gallery-filters wide-field"
          role="group"
          aria-label={ar ? 'أقسام المحتوى' : 'Content sections'}
        >
          {[
            ['home', ar ? 'الرئيسية' : 'Homepage'],
            ['message', ar ? 'رسالة المؤسسة والمشاركة' : 'Mission & participation'],
            ['about', ar ? 'التعريف والخدمات' : 'About & services'],
            ['contact', ar ? 'التواصل' : 'Contact'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={section === key}
              onClick={() => setSection(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {Object.entries(values)
          .filter(([key]) => contentGroup(key) === section)
          .map(([key, value]) => {
            const base = key.replace(/(Ar|En)$/, '');
            return (
              <div
                className={`field ${['about', 'heroBody'].includes(base) ? 'wide-field' : ''}`}
                key={key}
              >
                <label htmlFor={`setting-${key}`}>
                  {names[base] ?? key}{' '}
                  {key.endsWith('Ar') ? ' — عربي' : key.endsWith('En') ? ' — English' : ''}
                </label>
                {key === 'heroVisual' ? (
                  <>
                    <select
                      id={`setting-${key}`}
                      value={value}
                      onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                    >
                      <option value="Reference">
                        {ar
                          ? 'صورة الأطفال من التصميم المعتمد'
                          : 'Children from the approved design'}
                      </option>
                      <option value="Media">
                        {ar
                          ? 'الصورة المختارة من مكتبة الوسائط'
                          : 'Selected photo from the media library'}
                      </option>
                    </select>
                    <small>
                      {ar
                        ? 'عند اختيار مكتبة الوسائط، حدد صورة الرئيسية من قسم الصور والفيديوهات.'
                        : 'When using the library, choose the homepage photograph in Photos & videos.'}
                    </small>
                  </>
                ) : (
                  <textarea
                    id={`setting-${key}`}
                    dir={key.endsWith('Ar') ? 'rtl' : 'ltr'}
                    required
                    maxLength={4000}
                    rows={['about', 'heroBody'].includes(base) ? 4 : 2}
                    value={value}
                    onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                  />
                )}
              </div>
            );
          })}
        <div className="profile-save">
          <button className="button button-primary" disabled={busy || !loaded}>
            {ar ? 'حفظ محتوى الموقع' : 'Save site content'}
          </button>
        </div>
      </form>
    </div>
  );
}
