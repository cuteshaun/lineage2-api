/**
 * Renders a fixed-size item icon with a stable slot (no layout shift even when
 * the file is missing). Resolves the URL from `iconFile` as `/icons/${file}`
 * and falls back to `/icons/NOIMAGE.png` when `iconFile` is null.
 *
 * Plain <img> is deliberate — these are small (≈28 px) static PNGs, and
 * next/image would pull in the optimization pipeline for no measurable gain
 * at this size while requiring extra config.
 */
export function ItemIcon({
  iconFile,
  name,
  size = 28,
  decorative = false,
}: {
  iconFile: string | null;
  name: string;
  size?: number;
  decorative?: boolean;
}) {
  const src = iconFile ? `/icons/${iconFile}` : "/icons/NOIMAGE.png";
  return (
    <img
      src={src}
      alt={decorative ? "" : name}
      role={decorative ? "presentation" : undefined}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="flex-none rounded border border-zinc-200 bg-zinc-50 object-contain dark:border-zinc-800 dark:bg-zinc-900"
      style={{ width: size, height: size }}
    />
  );
}
