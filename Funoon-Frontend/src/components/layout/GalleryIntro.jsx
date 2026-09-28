import { useEffect, useState } from "react";
import logo from "../../assets/opalLogo.png";

const SESSION_KEY = "opal-gallery-intro-seen";
const EXIT_DURATION = 980;
const INTRO_DURATION = 1900;

const canUseSessionStorage = () => {
  try {
    return typeof window !== "undefined" && window.sessionStorage;
  } catch {
    return null;
  }
};

const wasShownThisSession = () => {
  const storage = canUseSessionStorage();
  return storage ? storage.getItem(SESSION_KEY) === "true" : false;
};

const markAsShown = () => {
  const storage = canUseSessionStorage();
  try {
    storage?.setItem(SESSION_KEY, "true");
  } catch {}
};

export default function GalleryIntro() {
  const [isVisible, setIsVisible] = useState(() => !wasShownThisSession());
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (!isVisible) return undefined;

    markAsShown();
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const exitDelay = reducedMotion ? 180 : INTRO_DURATION;
    const hideDelay = reducedMotion ? 360 : INTRO_DURATION + EXIT_DURATION;

    const exitTimer = window.setTimeout(() => setIsLeaving(true), exitDelay);
    const hideTimer = window.setTimeout(() => setIsVisible(false), hideDelay);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(hideTimer);
    };
  }, [isVisible]);

  const skipIntro = () => {
    if (isLeaving) return;
    markAsShown();
    setIsLeaving(true);
    window.setTimeout(() => setIsVisible(false), EXIT_DURATION);
  };

  if (!isVisible) return null;

  return (
    <div
      className={`gallery-intro${isLeaving ? " gallery-intro--leaving" : ""}`}
      role="status"
      aria-label="جاري فتح معرض اوبال ارت"
      onClick={skipIntro}
    >
      <div
        className="gallery-intro__panel gallery-intro__panel--right"
        aria-hidden="true"
      />
      <div
        className="gallery-intro__panel gallery-intro__panel--left"
        aria-hidden="true"
      />
      <div className="gallery-intro__frame" aria-hidden="true" />

      <div className="gallery-intro__content">
        <p className="gallery-intro__eyebrow">اوبال ارت / ٠١</p>
        <img className="gallery-intro__logo" src={logo} alt="اوبال ارت" />
        <span className="gallery-intro__rule" aria-hidden="true" />
        <h1 className="gallery-intro__title">حيث تبدأ الحكاية الفنية</h1>
        <p className="gallery-intro__caption">منصة الفن السعودي المعاصر</p>
        <div className="gallery-intro__progress" aria-hidden="true">
          <span />
        </div>
        <p className="gallery-intro__loading">جاري تجهيز المعرض</p>
      </div>

      <button
        type="button"
        className="gallery-intro__skip"
        onClick={(event) => {
          event.stopPropagation();
          skipIntro();
        }}
        aria-label="تخطي المقدمة"
      >
        تخطي
      </button>
    </div>
  );
}
