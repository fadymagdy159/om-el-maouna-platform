// Transcribed from the foundation brochures supplied on 20 October 2026.
// Historical charts and future plans are not treated as current impact statistics.
export const foundationDetails = {
  registration: '5318',
  phone: '00000000000',
  telephoneLink: '+200000000000',
  email: 'contact@example.invalid',
  address: {
    ar: 'يُضاف العنوان المعتمد من لوحة الإدارة.',
    en: 'Set the approved address in the administration dashboard.',
  },
  mission: {
    ar: 'مؤسسة أم المعونة للرعاية والتنمية مؤسسة غير هادفة للربح، تدعم الطلبة الراغبين في استكمال تعليمهم رغم الظروف الحياتية الصعبة، وتساند رحلتهم بالتعليم والرعاية والأنشطة التربوية.',
    en: 'Om El Maouna Foundation for Care and Development is a nonprofit that supports students seeking to continue their education despite difficult life circumstances, through educational support, care and developmental activities.',
  },
  services: [
    {
      ar: 'التعليم',
      en: 'Education',
      items: {
        ar: [
          'المساهمة في المصروفات الدراسية والكتب والأدوات.',
          'مجموعات تقوية داخل المؤسسة أو خارجها.',
          'توفير مكان مناسب للاستذكار والمتابعة.',
        ],
        en: [
          'Support with school fees, books and supplies.',
          'Tutoring groups inside or outside the foundation.',
          'A suitable place for studying and educational follow-up.',
        ],
      },
    },
    {
      ar: 'الرعاية الصحية',
      en: 'Health support',
      items: {
        ar: [
          'الكشف الطبي عند الحاجة.',
          'التحاليل والأدوية اللازمة.',
          'المساندة في إجراء الجراحات وفق احتياج الحالة.',
        ],
        en: [
          'Medical checkups when needed.',
          'Necessary medical tests and medication.',
          'Support with surgical care according to individual needs.',
        ],
      },
    },
    {
      ar: 'الأنشطة التربوية والترفيهية',
      en: 'Developmental and recreational activities',
      items: {
        ar: [
          'ندوات للتوعية والسلوك الإيجابي.',
          'أنشطة جماعية ورحلات ترفيهية.',
          'احتفالات لتكريم المتفوقين.',
        ],
        en: [
          'Awareness sessions and positive-behavior guidance.',
          'Group activities and recreational outings.',
          'Celebrations recognizing outstanding students.',
        ],
      },
    },
  ],
  goals: {
    ar: ['تطوير المكان وتجهيزاته.', 'زيادة المنح والخدمات المتاحة للطلبة.'],
    en: [
      'Improve and develop the facilities.',
      'Expand scholarships and services available to students.',
    ],
  },
} as const;
