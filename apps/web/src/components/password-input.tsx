'use client';
import { useState, type ComponentProps } from 'react';
import type { Locale } from '@/lib/i18n';
export function PasswordInput({
  locale,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { locale: Locale }) {
  const [visible, setVisible] = useState(false);
  const ar = locale === 'ar';
  return (
    <div className="password-control">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="button button-outline"
        aria-controls={props.id}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? (ar ? 'إخفاء' : 'Hide') : ar ? 'إظهار' : 'Show'}
      </button>
    </div>
  );
}
