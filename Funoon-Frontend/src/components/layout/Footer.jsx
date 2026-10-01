import { Link } from "react-router-dom";
import { ROUTES } from "../../config/routes";
import {
  Mail,
  Phone,
  MapPin,
  ArrowUp,
  Palette,
  Shield,
  Award,
  FileCheck,
} from "lucide-react";
import opalLogoWhite from "../../assets/opalLogoWhite.png";

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="bg-[var(--color-inverse-surface)] text-[var(--color-inverse-on-surface)]">
      {/* ═══════════════════════════════════════════════════ */}
      {/* Main Footer Content - 4 Columns                   */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="max-w-[1280px] mx-auto px-5 lg:px-16 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8">
          {/* ═══ Brand Column ═══ */}
          <div className="lg:col-span-4">
            <Link to={ROUTES.HOME} className="inline-block mb-2">
              <img src={opalLogoWhite} alt="Opal" className="h-15 w-auto" />
            </Link>
            <p className="text-white/60 text-sm leading-relaxed mb-6 max-w-sm">
              منصة سعودية راقية تربط بين الفنانين السعوديين الموهوبين ومقتني
              الفن الأصيل. نحتفي بالإبداع المحلي ونوصله إلى بيوتكم بأعلى معايير
              الجودة والأمانة.
            </p>

            {/* Trust Badges */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex items-center gap-2 text-xs text-white/70">
                <Shield
                  className="w-4 h-4 text-[var(--color-secondary)]"
                  strokeWidth={1.5}
                />
                <span>دفع آمن</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/70">
                <Award
                  className="w-4 h-4 text-[var(--color-secondary)]"
                  strokeWidth={1.5}
                />
                <span>أعمال موثقة</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/70">
                <Palette
                  className="w-4 h-4 text-[var(--color-secondary)]"
                  strokeWidth={1.5}
                />
                <span>فن سعودي أصيل</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-white/70 bg-white/5 border border-white/10 px-3 py-2 rounded-lg w-fit">
              <FileCheck
                className="w-4 h-4 text-[var(--color-secondary)]"
                strokeWidth={1.5}
              />
              <span>وثيقة عمل حر</span>
              <span className="font-mono font-semibold text-white/90">
                FL-681211769
              </span>
            </div>
          </div>

          {/* ═══ Explore Column ═══ */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--color-secondary)] mb-6">
              استكشف
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  to={ROUTES.ARTWORKS}
                  className="text-sm text-white/70 hover:text-[var(--color-secondary)] transition-premium"
                >
                  المعرض الفني
                </Link>
              </li>
              <li>
                <Link
                  to={ROUTES.ARTISTS}
                  className="text-sm text-white/70 hover:text-[var(--color-secondary)] transition-premium"
                >
                  الفنانون
                </Link>
              </li>
              <li>
                <Link
                  to={ROUTES.SUBSCRIPTIONS}
                  className="text-sm text-white/70 hover:text-[var(--color-secondary)] transition-premium"
                >
                  خطط الأسعار
                </Link>
              </li>
              <li>
                <Link
                  to={ROUTES.CATEGORIES}
                  className="text-sm text-white/70 hover:text-[var(--color-secondary)] transition-premium"
                >
                  التصنيفات
                </Link>
              </li>
            </ul>
          </div>

          {/* ═══ Support Column ═══ */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--color-secondary)] mb-6">
              الدعم
            </h4>
            <ul className="space-y-3">
              {/* <li>
                <Link
                  to={ROUTES.FAQ}
                  className="text-sm text-white/70 hover:text-[var(--color-secondary)] transition-premium"
                >
                  الأسئلة الشائعة
                </Link>
              </li> */}
              <li>
                <Link
                  to={ROUTES.CONTACT_US}
                  className="text-sm text-white/70 hover:text-[var(--color-secondary)] transition-premium"
                >
                  اتصل بنا
                </Link>
              </li>
              <li>
                <Link
                  to={ROUTES.RETURNS}
                  className="text-sm text-white/70 hover:text-[var(--color-secondary)] transition-premium"
                >
                  سياسة الإرجاع
                </Link>
              </li>
              <li>
                <Link
                  to={ROUTES.HOW_IT_WORKS}
                  className="text-sm text-white/70 hover:text-[var(--color-secondary)] transition-premium"
                >
                  كيف نعمل
                </Link>
              </li>
            </ul>
          </div>

          {/* ═══ Contact Column ═══ */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--color-secondary)] mb-6">
              تواصل معنا
            </h4>
            <ul className="space-y-4">
              <li>
                <a
                  href="mailto:hello@opalart.sa"
                  className="flex items-start gap-3 text-sm text-white/70 hover:text-[var(--color-secondary)] transition-premium group"
                >
                  <Mail
                    className="w-4 h-4 mt-0.5 flex-shrink-0 group-hover:text-[var(--color-secondary)]"
                    strokeWidth={1.5}
                  />
                  <span>hello@opalart.sa</span>
                </a>
              </li>
              <li>
                <a
                  href="tel:+966565905901"
                  className="flex items-start gap-3 text-sm text-white/70 hover:text-[var(--color-secondary)] transition-premium group"
                >
                  <Phone
                    className="w-4 h-4 mt-0.5 flex-shrink-0 group-hover:text-[var(--color-secondary)]"
                    strokeWidth={1.5}
                  />
                  <span dir="ltr">+966 56 590 5901</span>
                </a>
              </li>
              <li>
                <div className="flex items-start gap-3 text-sm text-white/70">
                  <MapPin
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    strokeWidth={1.5}
                  />
                  <span>المملكة العربية السعودية</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* Bottom Bar - Copyright + Legal                    */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="border-t border-white/10">
        <div className="max-w-[1280px] mx-auto px-5 lg:px-16 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            {/* Copyright */}
            <div className="text-xs text-white/50 text-center md:text-right">
              جميع الحقوق محفوظة لـ أوبال جاليري © 2026 . صُنع بـ{" "}
              <span className="text-[var(--color-secondary)]">بحب</span> في
              المملكة العربية السعودية
            </div>

            {/* Legal Links + Back to top */}
            <div className="flex items-center gap-6">
              <Link
                to={ROUTES.TERMS}
                className="text-xs text-white/50 hover:text-[var(--color-secondary)] transition-premium"
              >
                الشروط والأحكام
              </Link>
              <Link
                to={ROUTES.PRIVACY}
                className="text-xs text-white/50 hover:text-[var(--color-secondary)] transition-premium"
              >
                الخصوصية
              </Link>
              <button
                onClick={scrollToTop}
                aria-label="العودة للأعلى"
                className="w-9 h-9 flex items-center justify-center border border-white/10 text-white/60 hover:text-[var(--color-secondary)] hover:border-[var(--color-secondary)] transition-premium"
              >
                <ArrowUp className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
