'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, X } from 'lucide-react';
import { clientApi, ApiError } from '@/lib/client-api';
import type { Locale } from '@/lib/i18n';
type Row = {
  id: string;
  reference: string;
  kind: string;
  name?: string;
  state: string;
  version: number;
  createdAt: string;
};
type Detail = Row & {
  name: string;
  email: string;
  phone: string;
  description: string;
  childName: string | null;
  childDateOfBirth: string | null;
  educationStage: string | null;
  skills: string | null;
  availability: string | null;
  replies: { id: string; fromAdmin: boolean; text: string; createdAt: string }[];
};
const stateAr: Record<string, string> = {
  Submitted: 'تم التقديم',
  UnderReview: 'قيد المراجعة',
  NeedsInformation: 'مطلوب معلومات',
  Approved: 'مقبول',
  Rejected: 'غير مقبول',
  Closed: 'مغلق',
  Withdrawn: 'مسحوب',
};
const nextStates: Record<string, string[]> = {
  Submitted: ['UnderReview', 'NeedsInformation', 'Rejected'],
  UnderReview: ['NeedsInformation', 'Approved', 'Rejected', 'Closed'],
  NeedsInformation: ['UnderReview', 'Rejected'],
  Approved: ['Closed'],
  Rejected: ['UnderReview'],
  Closed: ['UnderReview'],
  Withdrawn: [],
};
export function RequestBoard({ locale, admin = false }: { locale: Locale; admin?: boolean }) {
  const ar = locale === 'ar',
    base = admin ? '/admin/requests' : '/requests';
  const [mailMode, setMailMode] = useState('');
  useEffect(() => {
    if (admin)
      void clientApi<{ mode: string }>('/admin/requests/mail-status')
        .then((r) => setMailMode(r.mode))
        .catch(() => {});
  }, [admin]);
  const [rows, setRows] = useState<Row[]>([]),
    [detail, setDetail] = useState<Detail | null>(null),
    [kind, setKind] = useState(''),
    [state, setState] = useState(''),
    [text, setText] = useState(''),
    [decision, setDecision] = useState('UnderReview'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const isOpen = detail !== null;
  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus =
      returnFocusRef.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() => {
        if (previousFocus?.isConnected) previousFocus.focus();
      });
    };
  }, [isOpen]);
  const load = useCallback(async () => {
    const q = admin
      ? '?' + new URLSearchParams({ ...(kind ? { kind } : {}), ...(state ? { state } : {}) })
      : '';
    setRows(await clientApi<Row[]>(base + q));
  }, [base, admin, kind, state]);
  useEffect(() => {
    void load().catch((e) =>
      setError(
        e instanceof ApiError && e.status === 401
          ? ar
            ? 'سجّل الدخول لعرض طلباتك.'
            : 'Sign in to view your requests.'
          : ar
            ? 'تعذر تحميل الطلبات.'
            : 'Could not load requests.',
      ),
    );
  }, [load, ar]);
  const labelKind = (k: string) =>
    k === 'Contribution'
      ? ar
        ? 'مساهمة مالية أو عينية'
        : 'Contribution'
      : k === 'Volunteer'
        ? ar
          ? 'تطوع'
          : 'Volunteering'
        : k === 'Enrollment'
          ? ar
            ? 'التحاق بالمؤسسة'
            : 'Enrollment'
          : ar
            ? 'رسالة تواصل'
            : 'Contact message';
  const labelState = (s: string) =>
    ar ? (stateAr[s] ?? s) : s.replace(/([a-z])([A-Z])/g, '$1 $2');
  async function open(row: Row) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const d = await clientApi<Detail>(`${base}/${row.id}`);
      setDetail(d);
      setText('');
      setDecision((nextStates[d.state] ?? [])[0] ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to open.');
    } finally {
      setBusy(false);
    }
  }
  async function act(
    action: 'decision' | 'reply' | 'withdraw',
    e?: React.SubmitEvent<HTMLFormElement>,
  ) {
    e?.preventDefault();
    if (!detail) return;
    if (action === 'withdraw' && !confirm(ar ? 'سحب هذا الطلب؟' : 'Withdraw this application?'))
      return;
    setBusy(true);
    setError('');
    try {
      await clientApi(
        `${base}/${detail.id}/${action}`,
        'POST',
        action === 'decision'
          ? { state: decision, reason: text }
          : action === 'reply'
            ? { text }
            : undefined,
        detail.version,
      );
      await load();
      const d = await clientApi<Detail>(`${base}/${detail.id}`);
      setDetail(d);
      setDecision((nextStates[d.state] ?? [])[0] ?? '');
      setText('');
      setNotice(ar ? 'تم تحديث الطلب.' : 'Request updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-panel">
        {admin && mailMode === 'LocalPreview' && (
          <div className="info-box">
            {ar
              ? 'البريد في وضع المعاينة المحلية: الطلبات والردود محفوظة، والرسائل البريدية لم تُرسل خارجيًا بعد.'
              : 'Local email preview: requests and replies are recorded, but emails are not being sent externally yet.'}
          </div>
        )}
        <div className="panel-heading">
          <h2>
            {admin
              ? ar
                ? 'طلبات الالتحاق والتطوع والرسائل'
                : 'Applications & messages'
              : ar
                ? 'طلباتي'
                : 'My requests'}
          </h2>
          {!admin && (
            <Link className="button button-outline" href={`/${locale}/enroll`}>
              {ar ? 'طلب التحاق جديد' : 'New enrollment request'}
            </Link>
          )}
        </div>
        {admin && (
          <div className="request-filters">
            <label>
              {ar ? 'نوع الطلب' : 'Request type'}
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">{ar ? 'الكل' : 'All'}</option>
                {['Contribution', 'Enrollment', 'Volunteer', 'Contact'].map((k) => (
                  <option key={k} value={k}>
                    {labelKind(k)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {ar ? 'الحالة' : 'Status'}
              <select value={state} onChange={(e) => setState(e.target.value)}>
                <option value="">{ar ? 'الكل' : 'All'}</option>
                {Object.keys(stateAr).map((s) => (
                  <option key={s} value={s}>
                    {labelState(s)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {error && !detail && (
          <div role="alert" className="form-status">
            {error}
          </div>
        )}
        {notice && !detail && (
          <div role="status" className="form-status success">
            {notice}
          </div>
        )}
        <div className="request-list">
          {rows.map((r) => (
            <button
              key={r.id}
              className="request-summary"
              disabled={busy}
              onClick={(e) => {
                returnFocusRef.current = e.currentTarget;
                void open(r);
              }}
            >
              <span>
                <strong>{labelKind(r.kind)}</strong>
                <small dir="ltr">{r.reference}</small>
                {admin && <span>{r.name}</span>}
              </span>
              <span className="badge">{labelState(r.state)}</span>
              <span>{new Date(r.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-GB')}</span>
              <span className="request-open-action">
                <Eye size={17} aria-hidden="true" />
                {ar ? 'عرض التفاصيل' : 'View details'}
              </span>
            </button>
          ))}
        </div>
        {rows.length === 0 && (
          <div className="empty-state">
            <p>{ar ? 'لا توجد طلبات هنا حاليًا.' : 'There are no requests here yet.'}</p>
            {!admin && (
              <Link href={`/${locale}/volunteer`} className="button button-outline">
                {ar ? 'قدّم للتطوع' : 'Apply to volunteer'}
              </Link>
            )}
          </div>
        )}
      </div>
      {detail && (
        <dialog
          ref={dialogRef}
          className="request-dialog"
          aria-labelledby="request-dialog-title"
          aria-modal="true"
          onCancel={(e) => {
            e.preventDefault();
            if (!busy) setDetail(null);
          }}
          onClick={(e) => {
            if (e.target !== e.currentTarget || busy) return;
            const rect = e.currentTarget.getBoundingClientRect();
            if (
              e.clientX < rect.left ||
              e.clientX > rect.right ||
              e.clientY < rect.top ||
              e.clientY > rect.bottom
            )
              setDetail(null);
          }}
        >
          <div className="admin-panel request-detail">
            <div className="panel-heading">
              <h2 id="request-dialog-title">
                {labelKind(detail.kind)} <small dir="ltr">{detail.reference}</small>
              </h2>
              <button
                type="button"
                className="button button-outline request-close"
                disabled={busy}
                onClick={() => setDetail(null)}
              >
                <X size={17} aria-hidden="true" />
                {ar ? 'إغلاق التفاصيل' : 'Close details'}
              </button>
            </div>
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
            <p>
              <strong>{ar ? 'الحالة: ' : 'Status: '}</strong>
              {labelState(detail.state)}
            </p>
            <dl>
              {[
                [ar ? 'الاسم' : 'Name', detail.name],
                [ar ? 'البريد' : 'Email', detail.email],
                [ar ? 'التليفون' : 'Phone', detail.phone],
                [ar ? 'اسم الابن أو الابنة' : 'Child’s name', detail.childName],
                [ar ? 'تاريخ الميلاد' : 'Date of birth', detail.childDateOfBirth],
                [ar ? 'المرحلة الدراسية' : 'Education stage', detail.educationStage],
                [ar ? 'المهارات' : 'Skills', detail.skills],
                [ar ? 'التفرغ' : 'Availability', detail.availability],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>
            <h3>{ar ? 'تفاصيل الطلب' : 'Request details'}</h3>
            <p className="prose-text">{detail.description}</p>
            <h3>{ar ? 'المتابعة والردود' : 'Updates & replies'}</h3>
            {detail.replies.length === 0 && (
              <p className="admin-note">{ar ? 'لا توجد ردود بعد.' : 'No updates yet.'}</p>
            )}
            {detail.replies.map((r) => (
              <article className="request-reply" key={r.id}>
                <strong>
                  {r.fromAdmin
                    ? ar
                      ? 'إدارة المؤسسة'
                      : 'Foundation administration'
                    : ar
                      ? 'صاحب الطلب'
                      : 'Applicant'}
                </strong>
                <p className="prose-text">{r.text}</p>
                <small>{new Date(r.createdAt).toLocaleString(ar ? 'ar-EG' : 'en-GB')}</small>
              </article>
            ))}
            {admin && (nextStates[detail.state] ?? []).length > 0 && (
              <form onSubmit={(e) => void act('decision', e)}>
                <div className="field">
                  <label htmlFor="decision-state">{ar ? 'تحديث الحالة' : 'Update status'}</label>
                  <select
                    id="decision-state"
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                  >
                    {(nextStates[detail.state] ?? []).map((s) => (
                      <option value={s} key={s}>
                        {labelState(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="decision-reason">
                    {ar ? 'رسالة لصاحب الطلب / سبب القرار' : 'Message to applicant / reason'}
                  </label>
                  <textarea
                    id="decision-reason"
                    required
                    minLength={2}
                    maxLength={4000}
                    rows={4}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </div>
                <button className="button button-primary" disabled={busy}>
                  {ar ? 'حفظ وإبلاغ صاحب الطلب' : 'Save & notify applicant'}
                </button>
              </form>
            )}
            {!admin && detail.state === 'NeedsInformation' && (
              <form onSubmit={(e) => void act('reply', e)}>
                <div className="field">
                  <label htmlFor="request-reply">
                    {ar ? 'استكمال المعلومات المطلوبة' : 'Provide requested information'}
                  </label>
                  <textarea
                    id="request-reply"
                    required
                    minLength={2}
                    maxLength={4000}
                    rows={4}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </div>
                <button className="button button-primary" disabled={busy}>
                  {ar ? 'إرسال الرد' : 'Send reply'}
                </button>
              </form>
            )}
            {!admin && !['Closed', 'Rejected', 'Withdrawn'].includes(detail.state) && (
              <button
                className="button button-danger"
                disabled={busy}
                onClick={() => void act('withdraw')}
              >
                {ar ? 'سحب الطلب' : 'Withdraw application'}
              </button>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}
