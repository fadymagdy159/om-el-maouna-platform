import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import {
  ArrowUpLeft,
  ArrowUpRight,
  BookOpen,
  Heart,
  HeartHandshake,
  Leaf,
  Lightbulb,
  ShieldCheck,
  Sprout,
  Users,
} from 'lucide-react';
import { Shell } from '@/components/site-shell';
import { ReferencePhoto } from '@/components/reference-photo';
import { copy, isLocale } from '@/lib/i18n';
import { getPrograms } from '@/lib/api';
import { getMedia, getSiteContent } from '@/lib/media';

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = copy[locale];
  const Arrow = locale === 'ar' ? ArrowUpLeft : ArrowUpRight;
  const { items } = await getPrograms(locale);
  const [media, content] = await Promise.all([getMedia(), getSiteContent()]);
  const foundationPhotos = media.items.filter((p) => p.kind === 'Photo');
  const hero = foundationPhotos.find((p) => p.isHero) ?? foundationPhotos[0];
  const highlights = ['P114', 'P030', 'P020']
    .map(
      (key, i) =>
        foundationPhotos.find((p) => p.sourceKey === key) ??
        foundationPhotos.filter((p) => p.id !== hero?.id)[i],
    )
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const suffix = locale === 'ar' ? 'Ar' : 'En';
  const text = (key: keyof typeof copy.ar) => content[key + suffix] || t[key];
  const pillars = [
    {
      category: 'Education',
      icon: BookOpen,
      title: t.education,
      text: t.educationText,
      color: 'blue',
      photoKey: 'P081',
    },
    {
      category: 'Health',
      icon: HeartHandshake,
      title: t.health,
      text: t.healthText,
      color: 'rose',
      photoKey: 'P035',
    },
    {
      category: 'Development',
      icon: Users,
      title: t.development,
      text: t.developmentText,
      color: 'gold',
      photoKey: 'P109',
    },
    {
      category: 'Skills',
      icon: Lightbulb,
      title: t.skills,
      text: t.skillsText,
      color: 'green',
      photoKey: 'P003',
    },
  ];
  return (
    <Shell locale={locale}>
      <div className="reference-home">
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-content">
              <span className="eyebrow">
                <span className="tiny-leaf">
                  <Leaf size={17} />
                </span>
                {t.eyebrow}
              </span>
              <h1>
                {content['heroStart' + suffix] || t.heroStart}
                <br />
                <em>{content['heroEnd' + suffix] || t.heroEnd}</em>
              </h1>
              <p>{content['heroBody' + suffix] || t.heroBody}</p>
              <div className="hero-actions">
                <Link className="button button-primary" href={`/${locale}/programs`}>
                  {t.explore}
                  <Arrow size={19} />
                </Link>
                <Link className="button button-outline" href={`/${locale}/contribute`}>
                  <Heart size={18} />
                  {locale === 'ar' ? 'ساهم معنا' : 'Get involved'}
                </Link>
              </div>
              <div className="hero-trust">
                <ShieldCheck size={18} />
                <span>{t.everyone}</span>
              </div>
            </div>
            <div className="hero-visual">
              <div
                className={`hero-photo ${content.heroVisual === 'Media' ? 'real-photo' : 'approved-photo'}`}
              >
                {content.heroVisual !== 'Media' ? (
                  <ReferencePhoto
                    alt={
                      locale === 'ar'
                        ? 'صورة توضيحية لأطفال يكتبون ويتعلمون في الفصل'
                        : 'Illustration of children writing and learning in a classroom'
                    }
                  />
                ) : (
                  hero && (
                    <Image
                      src={hero.src}
                      alt={hero.alt[locale]}
                      fill
                      preload
                      sizes="(max-width: 639px) 92vw, (max-width: 1000px) 48vw, 550px"
                    />
                  )
                )}
              </div>
            </div>
          </div>
        </section>
        <div className="values-strip">
          <div className="container values-inner">
            <span>
              <BookOpen />
              {t.education}
            </span>
            <span>
              <HeartHandshake />
              {t.health}
            </span>
            <span>
              <Users />
              {t.development}
            </span>
            <span>
              <Lightbulb />
              {t.skills}
            </span>
          </div>
        </div>
        <section className="section programs-section">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">
                <Leaf size={16} />
                {locale === 'ar' ? 'مجالات عملنا' : 'What we do'}
              </span>
              <h2>{text('pillars')}</h2>
              <p>{text('pillarsBody')}</p>
            </div>
            <div className="pillar-grid">
              {pillars.map(({ category, icon: Icon, title, text, color, photoKey }, i) => {
                const program = items.find((p) => p.category === category);
                const photo = foundationPhotos.find((p) => p.sourceKey === photoKey);
                return (
                  <Link
                    key={category}
                    href={program ? `/${locale}/programs/${program.slug}` : `/${locale}/programs`}
                    className={`pillar-card ${color}`}
                  >
                    {photo && (
                      <figure className="pillar-photo">
                        <Image
                          src={photo.src}
                          alt={photo.alt[locale]}
                          fill
                          sizes="(max-width: 600px) 90vw, (max-width: 1000px) 44vw, 24vw"
                        />
                        <figcaption>
                          {locale === 'ar' ? 'من حياة المؤسسة' : 'Life at the foundation'}
                        </figcaption>
                      </figure>
                    )}
                    <div className="pillar-top">
                      <span className="pillar-number">0{i + 1}</span>
                      <span className="pillar-icon">
                        <Icon size={28} />
                      </span>
                    </div>
                    <h3>{program?.title ?? title}</h3>
                    <p>{program?.summary ?? text}</p>
                    <span className="text-link">
                      {t.learn}
                      <Arrow size={17} />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
        <section className="section real-activities-section home-community-section">
          <div className="container home-community-grid">
            <div className="home-community-activities">
              <div className="section-heading">
                <span className="eyebrow">
                  {locale === 'ar' ? 'من قلب المؤسسة' : 'Life at the foundation'}
                </span>
                <h2>{locale === 'ar' ? 'كل لقاء… يترك حكاية' : 'Every gathering has a story'}</h2>
                <p>
                  {locale === 'ar'
                    ? 'لحظات من أنشطتنا الإبداعية، والرحلات، واحتفالات التكريم.'
                    : 'Glimpses of creative activities, outings and celebrations.'}
                </p>
              </div>
              <div className="home-photo-grid">
                {highlights.map((p) => {
                  return (
                    <Link href={`/${locale}/gallery`} className="home-photo-card" key={p.id}>
                      <div>
                        <Image
                          src={p.src}
                          alt={p.alt[locale]}
                          fill
                          sizes="(max-width: 639px) 92vw, 30vw"
                        />
                      </div>
                      <h3>{p.title[locale]}</h3>
                    </Link>
                  );
                })}
              </div>
              <div className="gallery-more">
                <Link href={`/${locale}/gallery`} className="button button-outline">
                  {locale === 'ar' ? 'شاهد الصور والفيديوهات' : 'Explore photographs & videos'}
                  <Arrow size={18} />
                </Link>
              </div>
            </div>
            <div className="participation">
              <div className="participation-visual">
                <Image
                  src="/images/success-story-v2.png"
                  fill
                  sizes="(max-width: 850px) 92vw, 550px"
                  className="success-story-image"
                  alt={
                    locale === 'ar'
                      ? 'صورة توضيحية لطفل يبتسم في الفصل'
                      : 'Illustration of a smiling child in a classroom'
                  }
                />
              </div>
              <div className="participation-copy">
                <span className="eyebrow">
                  <Leaf size={19} />
                  {t.eyebrow}
                </span>
                <h2>
                  {content['cta' + suffix] ||
                    (locale === 'ar' ? 'كن جزءًا من قصة النجاح' : 'Be part of a success story')}
                </h2>
                <p>
                  {content['ctaBody' + suffix] ||
                    (locale === 'ar'
                      ? 'كل مساهمة تصنع فرقًا حقيقيًا في حياة طفل وأسرة.'
                      : 'Every contribution can make a real difference to a child and a family.')}
                </p>
              </div>
              <Link className="button button-gold" href={`/${locale}/contribute`}>
                {locale === 'ar' ? 'ساهم الآن' : 'Contribute now'}
                <Heart size={18} />
              </Link>
            </div>
          </div>
        </section>
        <section className="section approach-section" id="our-approach">
          <div className="container approach-grid">
            <div>
              <span className="eyebrow">
                <Sprout size={18} />
                {t.ourMessage}
              </span>
              <h2>{text('approachTitle')}</h2>
              <p className="large-copy">{text('approachText')}</p>
              <Link className="text-link" href={`/${locale}/about`}>
                {t.about}
                <Arrow size={19} />
              </Link>
            </div>
            <div className="approach-steps">
              {[
                [text('step1'), text('step1Body')],
                [text('step2'), text('step2Body')],
                [text('step3'), text('step3Body')],
              ].map(([title, body], i) => (
                <div className="approach-step" key={title}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Shell>
  );
}
