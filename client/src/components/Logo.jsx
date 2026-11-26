// Auren işareti: A harfi, çaprazın yerinde dolu bir optik baloncuk (işaretlenmiş cevap). Renkler değiştirilebilir.
export default function Logo({ size = 28, leg = '#10B981', dot = '#06B6D4', className, title }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      <path d="M15 51 32 13l17 38" fill="none" stroke={leg} strokeWidth="6.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="39" r="5.6" fill={dot} />
    </svg>
  );
}
