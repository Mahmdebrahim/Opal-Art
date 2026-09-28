import { useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../../config/routes";
import {
  UserPlus,
  Crown,
  Image as ImageIcon,
  Bell,
  Package,
  Wallet,
  Search,
  Heart,
  ShoppingCart,
  Truck,
  PackageCheck,
  Star,
  Shield,
  Clock,
  Handshake,
  ChevronDown,
  ArrowLeft,
  Palette,
  Sparkles,
} from "lucide-react";
import Button from "../../components/Ui/Button";

// ═══ خطوات الفنان ═══
const ARTIST_STEPS = [
  {
    icon: UserPlus,
    title: "سجّل حسابك",
    text: "أنشئ حساباً مجانياً ببريدك الإلكتروني ورقم جوالك.",
  },
  {
    icon: Crown,
    title: "اختر باقتك",
    text: "اشتراك سنوي يناسب مرحلتك: كلاسيك للبداية، بلس مع إحصائيات، برستيج مع التوثيق والشحن المجاني.",
  },
  {
    icon: ImageIcon,
    title: "ارفع أعمالك",
    text: "أضف لوحاتك مع الصور والأبعاد والوصف والسعر. فريقنا يراجعها ويعتمدها قبل الظهور في المعرض.",
  },
  {
    icon: Bell,
    title: "استقبل الطلبات",
    text: "عندما يشتري أحد لوحاتك، يصلك إشعار فوري بتفاصيل الطلب.",
  },
  {
    icon: Package,
    title: "جهّز للشحن",
    text: "غلّف العمل الفني بشكل آمن، وشركة الشحن تستلمه من عنوانك.",
  },
  {
    icon: Wallet,
    title: "استلم أرباحك",
    text: "بعد التوصيل وانتهاء فترة الضمان، تُضاف أرباحك لمحفظتك وتسحبها لحسابك البنكي.",
  },
];

// ═══ خطوات المشتري ═══
const BUYER_STEPS = [
  {
    icon: Search,
    title: "تصفح المعرض",
    text: "استكشف أعمالاً فنية أصلية من فنانين سعوديين موثوقين.",
  },
  {
    icon: Heart,
    title: "أضف للمفضلة",
    text: "احفظ الأعمال التي تعجبك في قائمتك الخاصة.",
  },
  {
    icon: ShoppingCart,
    title: "اشترِ بسهولة",
    text: "أضف العمل للسلة، أدخل عنوان التوصيل، وادفع بأمان عبر مدى أو البطاقة الائتمانية.",
  },
  {
    icon: Truck,
    title: "تتبّع طلبك",
    text: "استلم رقم التتبع وتابع شحنتك حتى باب منزلك.",
  },
  {
    icon: PackageCheck,
    title: "أكّد الاستلام",
    text: "عند وصول اللوحة، تأكيدك للاستلام ينهي الطلب بنجاح ويدعم الفنان.",
  },
  {
    icon: Star,
    title: "قيّم تجربتك",
    text: "شارك تقييمك — يساعد الفنانين والمشترين الآخرين.",
  },
];

// ═══ رحلة الشحنة ═══
const SHIPPING_STEPS = [
  "المشتري يتمم الدفع بأمان عبر بوابة Moyasar",
  "يُنشأ طلب الشحن ويُسلَّم للفنان لتجهيز العمل",
  "شركة الشحن تستلم العمل المغلّف من عنوان الفنان",
  "التوصيل لعنوان المشتري مع رقم تتبع مباشر",
  "تبدأ فترة ضمان 72 ساعة بعد التوصيل",
  "تُطلق أرباح الفنان لمحفظته تلقائياً",
];

// ═══ الأسئلة الشائعة ═══
const FAQS = [
  {
    q: "هل يمكنني إرجاع العمل أو إلغاء الطلب؟",
    a: "قبل بدء الشحن يمكنك إلغاء الطلب واسترداد مبلغك كاملاً. بعد بدء الشحن، تواصل مع فريق الدعم وسنساعدك في حل أي مشكلة.",
  },
  {
    q: "متى أستلم أرباحي كفنان؟",
    a: "تُضاف الأرباح لمحفظتك بعد توصيل الطلب وانتهاء فترة الضمان (72 ساعة). بعدها يمكنك طلب سحبها لحسابك البنكي، وتخضع الطلبات لمراجعة فريق المنصة.",
  },
  {
    q: "هل الشحن مجاني؟",
    a: "تكلفة الشحن تُحسب تلقائياً عند الدفع حسب حجم العمل ومدينة التوصيل. مشترو فناني باقة أوبال برستيج يستفيدون من شحن مجاني لأول 10 طلبات سنوياً.",
  },
  {
    q: "كيف تُحسب عمولة المنصة؟",
    a: "تُقتطع العمولة تلقائياً من سعر البيع عند إتمام العملية، وتختلف نسبتها حسب باقتك — تبدأ من 15% في باقة كلاسيك وتقل في الباقات الأعلى.",
  },
  {
    q: "لماذا توجد فترة ضمان 72 ساعة؟",
    a: "لحماية الطرفين: يتأكد المشتري من وصول العمل بحالة جيدة، ويحصل الفنان على حقه بعد إتمام العملية بنجاح، وتتدخل المنصة عند وجود أي مشكلة.",
  },
];

export default function HowItWorksPage() {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="min-h-screen bg-[var(--color-surface)] font-body" dir="rtl">
      {/* ═══ Hero ═══ */}
      <div className="bg-gradient-to-b from-[var(--color-surface-container-low)] to-[var(--color-surface)] border-b border-[var(--color-outline-variant)]/40">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 py-16 lg:py-20 text-center">
          <span className="inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] uppercase text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 border border-[var(--color-secondary)]/20 px-4 py-1.5 rounded-full">
            دليلك المختصر
          </span>
          <h1 className="font-display text-4xl md:text-6xl text-[var(--color-on-surface)] tracking-tight leading-tight mb-4">
            كيف تعمل منصة اوبال ارت؟
          </h1>
          <p className="text-[var(--color-on-surface-variant)] text-sm md:text-base max-w-2xl mx-auto leading-relaxed mb-8">
            من رفع اللوحة إلى وصولها لباب المشتري — رحلة واضحة ومبسطة نشرحها لك
            في دقائق، سواء كنت فناناً أو مقتنياً.
          </p>
          {/* <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to={ROUTES.ARTWORKS}>
              <Button variant="primary" size="lg">
                تصفح المعرض
              </Button>
            </Link>
            <Link to={ROUTES.SUBSCRIPTIONS}>
              <Button variant="outline" size="lg">
                انضم كفنان
              </Button>
            </Link>
          </div> */}
        </div>
      </div>

      {/* ═══ Artists Track ═══ */}
      <section className="max-w-6xl mx-auto px-5 lg:px-8 py-16 lg:py-20">
        <SectionHeader
          icon={Palette}
          kicker="مسار الفنان"
          title="من لوحتك إلى محفظتك في 6 خطوات"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {ARTIST_STEPS.map((step, i) => (
            <StepCard key={step.title} step={step} index={i} accent="primary" />
          ))}
        </div>
      </section>

      {/* ═══ Buyers Track ═══ */}
      <section className="bg-[var(--color-surface-container-low)]/50 border-y border-[var(--color-outline-variant)]/40">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 py-16 lg:py-20">
          <SectionHeader
            icon={ShoppingCart}
            kicker="مسار المشتري"
            title="من التصفح إلى الاقتناء في 6 خطوات"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {BUYER_STEPS.map((step, i) => (
              <StepCard
                key={step.title}
                step={step}
                index={i}
                accent="secondary"
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Earnings Breakdown ═══ */}
      <section className="max-w-6xl mx-auto px-5 lg:px-8 py-16 lg:py-20">
        <SectionHeader
          icon={Wallet}
          kicker="شفافية كاملة"
          title="كيف تُحسب أرباح الفنان؟"
        />
        <div className="max-w-md mx-auto">
          <div className=" rounded-3xl p-6 lg:p-8 shadow-sm">
            <p className="text-xs text-[var(--color-on-surface-variant)] mb-5">
              مثال: لوحة بسعر 3,000 ر.س (باقة كلاسيك)
            </p>

            <div className="space-y-3 text-sm">
              <Row label="سعر البيع" value="3,000 ر.س" />
              <Row
                label="تكلفة الشحن (تُحسب تلقائياً)"
                value="+ 25 ر.س"
                muted
              />
              <div className="h-px bg-[var(--color-outline-variant)]/50" />
              <Row
                label="الإجمالي الذي يدفعه المشتري"
                value="3,025 ر.س"
                strong
              />
              <div className="h-px bg-[var(--color-outline-variant)]/50 my-1" />
              <Row label="عمولة المنصة (15%)" value="- 450 ر.س" negative />
              <div className="h-px bg-[var(--color-outline-variant)]/50" />
              <div className="flex items-center justify-between pt-2">
                <span className="font-semibold text-[var(--color-on-surface)]">
                  ربح الفنان
                </span>
                <span className="font-display text-2xl text-[var(--color-primary)]">
                  2,550 ر.س
                </span>
              </div>
            </div>

            <p className="mt-6 text-[11px] leading-relaxed text-[var(--color-on-surface-variant)] bg-[var(--color-surface-container-low)] rounded-xl p-3">
              نسبة العمولة تختلف حسب باقتك — تبدأ من 15% وتقل في الباقات الأعلى.{" "}
              <Link
                to={ROUTES.SUBSCRIPTIONS}
                className="text-[var(--color-primary)] font-semibold hover:underline"
              >
                قارن الباقات
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ═══ Shipping Journey ═══ */}
      {/* <section className="bg-[var(--color-surface-container-low)]/50 border-y border-[var(--color-outline-variant)]/40">
        <div className="max-w-3xl mx-auto px-5 lg:px-8 py-16 lg:py-20">
          <SectionHeader
            icon={Truck}
            kicker="رحلة الشحنة"
            title="من باب الفنان إلى باب المشتري"
          />
          <ol className="relative border-s-2 border-[var(--color-primary)]/20 space-y-8 ps-8">
            {SHIPPING_STEPS.map((text, i) => (
              <li key={i} className="relative">
                <span className="absolute -start-[41px] top-0 w-6 h-6 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-sm md:text-[15px] text-[var(--color-on-surface-variant)] leading-relaxed pt-0.5">
                  {text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section> */}

      {/* ═══ 72h Guarantee ═══ */}
      <section className="max-w-6xl mx-auto px-5 lg:px-8 py-16 lg:py-20">
        <SectionHeader
          icon={Shield}
          kicker="حماية للطرفين"
          title="لماذا فترة ضمان 72 ساعة؟"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <GuaranteeCard
            icon={PackageCheck}
            title="للمشتري"
            text="فترة كافية للتأكد من وصول العمل بحالة جيدة ومطابقته للوصف."
          />
          <GuaranteeCard
            icon={Wallet}
            title="للفنان"
            text="ضمان إتمام العملية بنجاح قبل إطلاق الأرباح لمحفظته."
          />
          <GuaranteeCard
            icon={Handshake}
            title="للمنصة"
            text="مهلة للتدخل وحل أي مشكلة أو نزاع قبل إغلاق الطلب."
          />
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="bg-[var(--color-surface-container-low)]/50 border-t border-[var(--color-outline-variant)]/40">
        <div className="max-w-3xl mx-auto px-5 lg:px-8 py-16 lg:py-20">
          <SectionHeader
            icon={Clock}
            kicker="إجابات سريعة"
            title="أسئلة شائعة"
          />
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/50 rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-right"
                >
                  <span className="text-sm font-semibold text-[var(--color-on-surface)]">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-[var(--color-on-surface-variant)] flex-shrink-0 transition-transform ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5">
                    <p className="text-sm text-[var(--color-on-surface-variant)] leading-relaxed border-t border-[var(--color-outline-variant)]/40 pt-4">
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Final CTA ═══ */}
      <section className="max-w-5xl mx-auto px-5 lg:px-8 py-16 lg:py-20">
        <div className="bg-gradient-to-br from-[var(--color-primary)]/10 via-[var(--color-surface-container-lowest)] to-[var(--color-secondary)]/10 border border-[var(--color-primary)]/20 rounded-3xl p-10 lg:p-14 text-center">
          <h2 className="font-display text-3xl md:text-4xl text-[var(--color-on-surface)] mb-3">
            جاهز تبدأ رحلتك؟
          </h2>
          <p className="text-sm text-[var(--color-on-surface-variant)] max-w-md mx-auto leading-relaxed mb-8">
            سواء كنت فناناً يبحث عن منصته، أو مقتنياً يبحث عن قطعته القادمة —
            اوبال ارت وجهتك.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to={ROUTES.SUBSCRIPTIONS}>
              <Button
                variant="primary"
                size="lg"
                icon={ArrowLeft}
                iconPosition="end"
              >
                انضم كفنان
              </Button>
            </Link>
            <Link to={ROUTES.ARTWORKS}>
              <Button variant="outline" size="lg">
                تصفح المعرض
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// ═══ Section Header ═══
function SectionHeader({ icon: Icon, kicker, title }) {
  return (
    <div className="text-center mb-10 lg:mb-14">
      <div className="w-11 h-11 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center mx-auto mb-4">
        <Icon
          className="w-5 h-5 text-[var(--color-primary)]"
          strokeWidth={1.75}
        />
      </div>
      <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[var(--color-secondary)] mb-2">
        {kicker}
      </p>
      <h2 className="font-display text-2xl md:text-4xl text-[var(--color-on-surface)] tracking-tight">
        {title}
      </h2>
    </div>
  );
}

// ═══ Step Card ═══
function StepCard({ step, index, accent }) {
  const Icon = step.icon;
  const accentCls =
    accent === "primary"
      ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20"
      : "bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] border-[var(--color-secondary)]/20";

  return (
    <div className="relative bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/50 rounded-2xl p-6 hover:shadow-md hover:border-[var(--color-primary)]/30 transition-all">
      <span className="absolute top-5 left-5 font-mono text-[10px] font-bold text-[var(--color-on-surface-variant)]/50">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div
        className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${accentCls}`}
      >
        <Icon className="w-4.5 h-4.5" strokeWidth={1.75} />
      </div>
      <h3 className="font-display text-lg text-[var(--color-on-surface)] mb-2">
        {step.title}
      </h3>
      <p className="text-sm text-[var(--color-on-surface-variant)] leading-relaxed">
        {step.text}
      </p>
    </div>
  );
}

// ═══ Guarantee Card ═══
function GuaranteeCard({ icon: Icon, title, text }) {
  return (
    <div className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/50 rounded-2xl p-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[var(--color-secondary)]/10 border border-[var(--color-secondary)]/20 flex items-center justify-center mx-auto mb-4">
        <Icon
          className="w-5 h-5 text-[var(--color-secondary)]"
          strokeWidth={1.75}
        />
      </div>
      <h3 className="font-display text-lg text-[var(--color-on-surface)] mb-2">
        {title}
      </h3>
      <p className="text-sm text-[var(--color-on-surface-variant)] leading-relaxed">
        {text}
      </p>
    </div>
  );
}

// ═══ Money Row ═══
function Row({ label, value, muted, strong, negative }) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={
          muted
            ? "text-[var(--color-on-surface-variant)]"
            : "text-[var(--color-on-surface)]"
        }
      >
        {label}
      </span>
      <span
        className={`font-mono ${
          negative
            ? "text-[var(--color-error)]"
            : strong
              ? "font-semibold text-[var(--color-on-surface)]"
              : "text-[var(--color-on-surface-variant)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
