'use client';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import type { ManagedMedia } from '@/lib/media';
import type { Locale } from '@/lib/i18n';

export function FoundationGallery({
  locale,
  items,
  showFilters = true,
}: {
  locale: Locale;
  items: ManagedMedia[];
  showFilters?: boolean;
}) {
  const foundationPhotos = items.filter((m) => m.kind === 'Photo');
  const foundationClips = items.filter((m) => m.kind === 'Video');
  const ar = locale === 'ar';
  const [category, setCategory] = useState('All');
  const [active, setActive] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const categories = [
    ['All', ar ? 'كل الصور' : 'All photos'],
    ['Learning', ar ? 'التعلم' : 'Learning'],
    ['Skills', ar ? 'المهارات' : 'Skills'],
    ['Events', ar ? 'التكريم والاحتفالات' : 'Celebrations'],
    ['Trips', ar ? 'الرحلات' : 'Outings'],
  ];
  const photos = foundationPhotos.filter((p) => category === 'All' || p.category === category);
  const selected = active === null ? null : photos[active];
  function open(index: number) {
    setActive(index);
    dialog.current?.showModal();
  }
  function move(step: number) {
    setActive((current) =>
      current === null ? null : (current + step + photos.length) % photos.length,
    );
  }
  return (
    <>
      {showFilters && (
        <div
          className="gallery-filters"
          role="group"
          aria-label={ar ? 'تصفية الصور حسب النشاط' : 'Filter photos by activity'}
        >
          {categories.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={category === key}
              onClick={() => setCategory(key)}
            >
              {label}
              <span>
                {key === 'All'
                  ? foundationPhotos.length
                  : foundationPhotos.filter((p) => p.category === key).length}
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="gallery-count" aria-live="polite">
        {ar
          ? `${photos.length} صورة من أنشطتنا`
          : `${photos.length} photographs from our activities`}
      </p>
      <div className="foundation-gallery">
        {photos.length === 0 && (
          <p className="empty-state">
            {ar
              ? 'لا توجد صور منشورة في هذا القسم حاليًا.'
              : 'There are no published photos in this category yet.'}
          </p>
        )}
        {photos.map((p, index) => (
          <button
            type="button"
            className="gallery-card"
            key={p.id}
            onClick={() => open(index)}
            aria-label={`${ar ? 'عرض الصورة' : 'View photo'}: ${p.title[locale]}`}
          >
            <span className="gallery-image">
              <Image
                src={p.src}
                alt={p.alt[locale]}
                fill
                loading={index === 0 ? 'eager' : 'lazy'}
                sizes="(max-width: 640px) 92vw, (max-width: 1000px) 45vw, 30vw"
              />
            </span>
            <span className="gallery-card-caption">
              <strong>{p.title[locale]}</strong>
              <span>{ar ? 'شاهد الصورة' : 'View photograph'} ↗</span>
            </span>
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="gallery-dialog"
        aria-label={ar ? 'عارض الصور' : 'Photo viewer'}
        onClose={() => setActive(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            move(ar ? -1 : 1);
          }
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            move(ar ? 1 : -1);
          }
        }}
      >
        <button
          type="button"
          className="gallery-close icon-button"
          aria-label={ar ? 'إغلاق الصورة' : 'Close photo'}
          onClick={() => dialog.current?.close()}
        >
          <X />
        </button>
        {selected && (
          <>
            <div className="gallery-full-image">
              <Image
                key={selected.id}
                src={selected.src}
                alt={selected.alt[locale]}
                fill
                sizes="(max-width: 1000px) 92vw, 1000px"
              />
            </div>
            <div className="gallery-dialog-caption">
              <div>
                <strong>{selected.title[locale]}</strong>
                <p>{selected.alt[locale]}</p>
              </div>
              <div className="gallery-controls">
                <button
                  type="button"
                  className="icon-button"
                  aria-label={ar ? 'الصورة السابقة' : 'Previous photo'}
                  onClick={() => move(-1)}
                >
                  {ar ? <ArrowRight /> : <ArrowLeft />}
                </button>
                <span>
                  {(active ?? 0) + 1} / {photos.length}
                </span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={ar ? 'الصورة التالية' : 'Next photo'}
                  onClick={() => move(1)}
                >
                  {ar ? <ArrowLeft /> : <ArrowRight />}
                </button>
              </div>
            </div>
          </>
        )}
      </dialog>
      {foundationClips.length > 0 && (
        <section className="gallery-video-section" aria-labelledby="activity-videos-heading">
          <span className="eyebrow">{ar ? 'لحظات تتحرك' : 'Moments in motion'}</span>
          <h2 id="activity-videos-heading">{ar ? 'من قلب الأنشطة' : 'Inside our activities'}</h2>
          <p>
            {ar
              ? 'لحظات من لقاءاتنا وأنشطتنا. اختر الفيديو لتشغيله.'
              : 'Glimpses of our sessions and activities. Choose a video to play.'}
          </p>
          <div
            className={`foundation-videos ${foundationClips.length === 1 ? 'single-video' : ''}`}
          >
            {foundationClips.map((clip) => (
              <figure key={clip.id}>
                <video
                  controls
                  playsInline
                  muted
                  preload="none"
                  poster={clip.poster ?? undefined}
                  aria-label={clip.title[locale]}
                  width={clip.width}
                  height={clip.height}
                >
                  <source src={clip.src} type="video/mp4" />
                </video>
                <figcaption>
                  <strong>{clip.title[locale]}</strong>
                  <span>
                    {Math.round(clip.seconds)} {ar ? 'ثانية' : 'seconds'}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
