import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="main" className="container empty-state">
      <h1>الصفحة غير متاحة / Page not found</h1>
      <p>قد يكون الرابط غير صحيح أو المحتوى غير منشور.</p>
      <Link className="button button-primary" href="/ar">
        الرئيسية / Home
      </Link>
    </main>
  );
}
