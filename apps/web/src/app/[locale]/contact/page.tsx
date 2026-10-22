import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Phone, Mail, MapPin } from 'lucide-react';
import { Shell } from '@/components/site-shell';
import { copy, isLocale } from '@/lib/i18n';
import { foundationDetails } from '@/content/foundation-details';
import { getSiteContent } from '@/lib/media';
import { RequestForm } from '@/features/services/request-form';
export default async function Contact({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = copy[locale];
  const content = await getSiteContent();
  const phone = content.phone || foundationDetails.phone,
    email = content.email || foundationDetails.email;
  const telephone = phone.startsWith('+')
    ? phone
    : phone.startsWith('0')
      ? '+20' + phone.slice(1)
      : phone;
  return (
    <Shell locale={locale}>
      <div className="page-intro">
        <div className="container">
          <span className="eyebrow">{t.contact}</span>
          <h1>{t.cta}</h1>
          <p>{t.ctaBody}</p>
        </div>
      </div>
      <section className="section">
        <div className="container reading-content">
          <h2>{locale === 'ar' ? 'يسعدنا تواصلك' : 'We would love to hear from you'}</h2>
          <p>
            {locale === 'ar'
              ? 'للاستفسار عن برامج المؤسسة، أو التطوع، أو طرق المساهمة، تواصل معنا عبر الهاتف أو البريد الإلكتروني.'
              : 'For questions about our programs, volunteering or ways to contribute, contact us by phone or email.'}
          </p>
          <div className="contact-details">
            <div className="contact-detail">
              <Phone size={24} />
              <div>
                <h3>{locale === 'ar' ? 'التليفون' : 'Phone'}</h3>
                <a dir="ltr" href={`tel:${telephone}`}>
                  {phone}
                </a>
              </div>
            </div>
            <div className="contact-detail">
              <Mail size={24} />
              <div>
                <h3>{locale === 'ar' ? 'البريد الإلكتروني' : 'Email'}</h3>
                <a dir="ltr" href={`mailto:${email}`}>
                  {email}
                </a>
              </div>
            </div>
            <div className="contact-detail">
              <MapPin size={24} />
              <div>
                <h3>{locale === 'ar' ? 'عنوان المؤسسة' : 'Visit us'}</h3>
                <p>
                  {content[locale === 'ar' ? 'addressAr' : 'addressEn'] ||
                    foundationDetails.address[locale]}
                </p>
              </div>
            </div>
          </div>
          <div className="gallery-more">
            <Link href={`/${locale}/programs`} className="button button-primary">
              {t.explore}
            </Link>
          </div>
          <RequestForm locale={locale} kind="Contact" />
        </div>
      </section>
    </Shell>
  );
}
