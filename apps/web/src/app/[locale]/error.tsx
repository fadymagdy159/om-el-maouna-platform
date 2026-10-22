'use client';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="container empty-state">
      <h1>تعذر تحميل الصفحة / Unable to load this page</h1>
      <p>حاول مرة أخرى بعد قليل. Please try again.</p>
      <button className="button button-primary" onClick={reset}>
        إعادة المحاولة / Try again
      </button>
    </main>
  );
}
