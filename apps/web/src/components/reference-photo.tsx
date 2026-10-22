import { getImageProps } from 'next/image';
// A code-native crop keeps the approved artwork unchanged; no generated replacement.
const source = getImageProps({
  src: '/images/homepage-final.png',
  width: 1536,
  height: 1024,
  alt: '',
  quality: 75,
}).props.src;
export function ReferencePhoto({ alt }: { alt: string }) {
  return (
    <svg
      className="reference-photo"
      viewBox="20 86 660 347"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={alt}
    >
      <image href={source} width="1536" height="1024" />
    </svg>
  );
}
