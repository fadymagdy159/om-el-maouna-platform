'use client';
import { useEffect, useRef, useState } from 'react';
import { clientApi, uploadMedia } from '@/lib/client-api';
import type { ManagedMedia } from '@/lib/media';
import type { Locale } from '@/lib/i18n';
type Fields = {
  titleAr: string;
  titleEn: string;
  altAr: string;
  altEn: string;
  category: string;
  isPublished: boolean;
  sortOrder: number;
};
const blank = (): Fields => ({
  titleAr: '',
  titleEn: '',
  altAr: '',
  altEn: '',
  category: 'Skills',
  isPublished: false,
  sortOrder: 0,
});
export function MediaManager({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  const fileInput = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ManagedMedia[]>([]),
    [fields, setFields] = useState<Fields>(blank),
    [editing, setEditing] = useState<ManagedMedia | null>(null),
    [file, setFile] = useState<File | null>(null),
    [kind, setKind] = useState('Photo'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const load = () => clientApi<ManagedMedia[]>('/admin/media').then(setRows);
  useEffect(() => {
    void load().catch(() => setError(ar ? 'تعذر تحميل الوسائط.' : 'Could not load media.'));
  }, [ar]);
  function edit(m: ManagedMedia) {
    setEditing(m);
    setFile(null);
    setFields({
      titleAr: m.title.ar,
      titleEn: m.title.en,
      altAr: m.alt.ar,
      altEn: m.alt.en,
      category: m.category,
      isPublished: m.isPublished,
      sortOrder: m.sortOrder,
    });
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function save(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (editing) await clientApi(`/admin/media/${editing.id}`, 'PUT', fields, editing.version);
      else {
        if (!file) throw new Error(ar ? 'اختر ملفًا أولًا.' : 'Choose a file first.');
        await uploadMedia(file, {
          kind,
          titleAr: fields.titleAr,
          titleEn: fields.titleEn,
          altAr: fields.altAr,
          altEn: fields.altEn,
          category: fields.category,
        });
      }
      await load();
      setEditing(null);
      setFields(blank());
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      setNotice(
        ar
          ? 'تم الحفظ. الملفات الجديدة تُحفظ كمسودة؛ افتح تعديل لنشرها.'
          : 'Saved. New files are drafts; edit to publish them.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }
  async function action(m: ManagedMedia, type: 'hero' | 'delete') {
    if (
      type === 'delete' &&
      !confirm(
        ar
          ? 'إزالة هذا الملف من الموقع؟ لن نحذف ملفاتك الأصلية من جهازك.'
          : 'Remove this file from the site? Your original computer files are unchanged.',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await clientApi(
        `/admin/media/${m.id}${type === 'hero' ? '/hero' : ''}`,
        type === 'hero' ? 'POST' : 'DELETE',
        undefined,
        m.version,
      );
      await load();
      setNotice(ar ? 'تم تحديث المكتبة والموقع.' : 'Library and website updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-panel">
        <h2>
          {editing
            ? ar
              ? 'تعديل الوسائط'
              : 'Edit media'
            : ar
              ? 'إضافة صورة أو فيديو'
              : 'Add a photo or video'}
        </h2>
        <p className="admin-note">
          {ar
            ? 'تتحكم من هنا في الصور والفيديوهات الظاهرة في المعرض، وصورة الرئيسية. الرفع لا ينشر الملف تلقائيًا.'
            : 'Manage gallery photographs, videos and the homepage image. Uploading does not publish automatically.'}
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
          {!editing && (
            <>
              <div className="field">
                <label htmlFor="media-kind">{ar ? 'نوع الملف' : 'File type'}</label>
                <select
                  id="media-kind"
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value);
                    setFile(null);
                  }}
                >
                  <option value="Photo">{ar ? 'صورة' : 'Photo'}</option>
                  <option value="Video">{ar ? 'فيديو MP4' : 'MP4 video'}</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="media-file">{ar ? 'الملف' : 'File'}</label>
                <input
                  key={kind}
                  id="media-file"
                  ref={fileInput}
                  type="file"
                  accept={kind === 'Photo' ? 'image/jpeg,image/png,image/webp' : 'video/mp4'}
                  required
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <small>
                  {ar
                    ? 'صورة حتى 8 MB، أو فيديو MP4 حتى 30 MB و10 دقائق.'
                    : 'Photo up to 8 MB; MP4 video up to 30 MB and 10 minutes.'}
                </small>
              </div>
            </>
          )}
          {(
            [
              ['titleAr', ar ? 'العنوان بالعربية' : 'Arabic title'],
              ['titleEn', ar ? 'العنوان بالإنجليزية' : 'English title'],
              ['altAr', ar ? 'وصف الصورة بالعربية' : 'Arabic description'],
              ['altEn', ar ? 'وصف الصورة بالإنجليزية' : 'English description'],
            ] as const
          ).map(([key, label]) => (
            <div className="field" key={key}>
              <label htmlFor={key}>{label}</label>
              <input
                id={key}
                dir={key.endsWith('En') ? 'ltr' : 'rtl'}
                required
                maxLength={key.startsWith('title') ? 150 : 500}
                value={fields[key]}
                onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="field">
            <label htmlFor="media-category">{ar ? 'القسم' : 'Category'}</label>
            <select
              id="media-category"
              value={fields.category}
              onChange={(e) => setFields({ ...fields, category: e.target.value })}
            >
              {[
                ['Learning', ar ? 'التعلم' : 'Learning'],
                ['Skills', ar ? 'المهارات' : 'Skills'],
                ['Events', ar ? 'التكريم' : 'Celebrations'],
                ['Trips', ar ? 'الرحلات' : 'Outings'],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          {editing && (
            <>
              <div className="field">
                <label htmlFor="media-order">{ar ? 'ترتيب العرض' : 'Display order'}</label>
                <input
                  id="media-order"
                  type="number"
                  min={0}
                  max={10000}
                  value={fields.sortOrder}
                  onChange={(e) => setFields({ ...fields, sortOrder: Number(e.target.value) })}
                />
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={fields.isPublished}
                  onChange={(e) => setFields({ ...fields, isPublished: e.target.checked })}
                />{' '}
                {ar ? 'منشور على الموقع' : 'Published on the website'}
              </label>
            </>
          )}
          <div className="profile-save">
            <button className="button button-primary" disabled={busy}>
              {busy ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : ar ? 'حفظ' : 'Save'}
            </button>
            {editing && (
              <button
                type="button"
                className="button button-outline"
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setFields(blank());
                }}
              >
                {ar ? 'إلغاء التعديل' : 'Cancel'}
              </button>
            )}
          </div>
        </form>
      </div>
      <div className="admin-panel">
        <h2>{ar ? `مكتبة الوسائط · ${rows.length}` : `Media library · ${rows.length}`}</h2>
        <div className="managed-media-grid">
          {rows.map((m) => (
            <article className="managed-media-card" key={m.id}>
              {m.kind === 'Photo' ? (
                <img src={m.src} alt={m.alt[locale]} loading="lazy" />
              ) : (
                <video src={m.src} poster={m.poster ?? undefined} controls preload="none" />
              )}
              <h3>{m.title[locale]}</h3>
              <p>
                {m.isPublished ? (ar ? 'منشور' : 'Published') : ar ? 'مسودة' : 'Draft'}
                {m.isHero ? ' · ' + (ar ? 'صورة الرئيسية' : 'Homepage image') : ''}
              </p>
              <div className="row-actions">
                <button className="button button-outline" disabled={busy} onClick={() => edit(m)}>
                  {ar ? 'تعديل' : 'Edit'}
                </button>
                {m.kind === 'Photo' && m.isPublished && !m.isHero && (
                  <button
                    className="button button-outline"
                    disabled={busy}
                    onClick={() => void action(m, 'hero')}
                  >
                    {ar ? 'استخدام في الرئيسية' : 'Use on homepage'}
                  </button>
                )}
                <button
                  className="button button-outline"
                  disabled={busy}
                  onClick={() => void action(m, 'delete')}
                >
                  {ar ? 'إزالة' : 'Remove'}
                </button>
              </div>
            </article>
          ))}
        </div>
        {rows.length === 0 && (
          <p>
            {ar
              ? 'المكتبة فارغة. أضف أول ملف من النموذج أعلاه.'
              : 'Your library is empty. Upload the first file above.'}
          </p>
        )}
      </div>
    </>
  );
}
