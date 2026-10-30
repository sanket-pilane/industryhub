"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/icon";

const slides = [
  {
    image: "/figma/b1f9a.png",
    alt: "Sealed deep-groove ball bearing",
    caption: ["Precision parts,", "built to specification."],
  },
  {
    image: "/figma/c8645.png",
    alt: "ISO pneumatic cylinder",
    caption: ["Upload once.", "Track every stage."],
  },
  {
    image: "/figma/fedcf.png",
    alt: "Three-pole power contactor",
    caption: ["Verified suppliers,", "GST-ready invoices."],
  },
];
const INTERVAL_MS = 5000;

export function AuthVisual() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (
      paused ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const timer = setInterval(
      () => setActive((i) => (i + 1) % slides.length),
      INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [paused]);

  return (
    <aside
      className="auth-visual"
      aria-label="INDUSTRIHUB highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="auth-visual-top">
        <span className="auth-visual-brand">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          INDUSTRIHUB
        </span>
        <span className="auth-visual-badge">
          <Icon name="shield" />
          Secure B2B access
        </span>
      </div>
      <div className="auth-visual-stage">
        {slides.map((slide, index) => (
          <div
            className="auth-slide"
            data-active={index === active}
            aria-hidden={index !== active}
            key={slide.image}
          >
            <Image
              src={slide.image}
              alt={slide.alt}
              width={420}
              height={420}
              priority={index === 0}
            />
          </div>
        ))}
      </div>
      <div className="auth-visual-caption">
        {slides.map((slide, index) => (
          <p
            data-active={index === active}
            aria-hidden={index !== active}
            key={slide.image}
          >
            {slide.caption[0]}
            <br />
            {slide.caption[1]}
          </p>
        ))}
      </div>
      <div className="auth-dots">
        {slides.map((slide, index) => (
          <button
            type="button"
            key={slide.image}
            aria-label={`Show highlight ${index + 1} of ${slides.length}`}
            aria-current={index === active ? "true" : undefined}
            onClick={() => setActive(index)}
          >
            <span />
          </button>
        ))}
      </div>
    </aside>
  );
}
