const PLACEHOLDER_CAR_IMAGE = '/placeholder-car.jpg';

// next/image's default loader calls `new URL(src)` on anything that isn't
// root-relative, and throws `Failed to construct 'URL': Invalid URL` for a
// bare string like "Test" — which some seeded/test car and host records
// carry as an images/avatarUrl placeholder. That throw is uncaught and takes
// down the whole page render, so every src pulled from that data needs this
// guard first.
export function isValidImageSrc(src: string | null | undefined): src is string {
  return !!src && (src.startsWith('/') || src.startsWith('http://') || src.startsWith('https://'));
}

export function carImageSrc(images: string[] | null | undefined, fallback: string = PLACEHOLDER_CAR_IMAGE): string {
  const first = images?.[0];
  return isValidImageSrc(first) ? first : fallback;
}
