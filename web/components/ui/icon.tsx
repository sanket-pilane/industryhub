/* Figma SVGs retain intrinsic root dimensions inside a 22px design slot. */
/* eslint-disable @next/next/no-img-element */
const icons = {
  check: "06517.svg",
  search: "f01a5.svg",
  user: "67cd4.svg",
  cart: "a57b7.svg",
  gear: "1e87f.svg",
  quoteInverse: "93ca0.svg",
  quote: "0f432.svg",
  arrow: "a6353.svg",
  arrowInverse: "acfe7.svg",
  shield: "64f1a.svg",
  lock: "aa5ed.svg",
  truck: "6544d.svg",
  factory: "5a33e.svg",
  home: "f4e02.svg",
  grid: "892ce.svg",
  package: "4c79e.svg",
} as const;
export type IconName = keyof typeof icons;
export function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <span className={`figma-icon ${className}`} aria-hidden="true">
      <img src={`/figma/${icons[name]}`} alt="" />
    </span>
  );
}
