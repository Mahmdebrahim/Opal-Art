import { Link } from "react-router-dom";
import { ROUTES } from "../../config/routes";
import {
  ChevronRight,
  RotateCcw,
  Calendar,
  ArrowUp,
  Headphones,
  Package,
  Truck,
  Clock,
  AlertTriangle,
  Banknote,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Mail,
} from "lucide-react";
import Button from "../../components/Ui/Button";

const SECTIONS = [
  { id: "vision", num: "1", title: "رؤيتنا للاسترجاع" },
  { id: "before-shipping", num: "2", title: "قبل الشحن — إلغاء فوري" },
  { id: "after-shipping", num: "3", title: "بعد الشحن — استرجاع اللوحات" },
  { id: "damaged", num: "4", title: "اللوحات التالفة أو غير المطابقة" },
  { id: "refund-amount", num: "5", title: "المبلغ المسترد" },
  { id: "timeline", num: "6", title: "الجدول الزمني للاسترداد" },
  { id: "how-to", num: "7", title: "كيفية طلب الاسترجاع" },
  { id: "exceptions", num: "8", title: "استثناءات مهمة" },
];

export default function ReturnsPage() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div className="min-h-screen bg-[var(--color-surface)] font-body" dir="rtl">
      {/* ═══ Hero Header ═══ */}
      <div className="bg-gradient-to-b from-[var(--color-surface-container-low)] to-[var(--color-surface)] border-b border-[var(--color-outline-variant)]/40">
        <div className="max-w-4xl mx-auto px-5 lg:px-8 py-12 lg:py-16">
          <Link
            to={ROUTES.HOME}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-colors mb-6"
          >
            <ChevronRight className="w-3.5 h-3.5" />
            <span>العودة للرئيسية</span>
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-[var(--color-secondary)]/10 border border-[var(--color-secondary)]/20 flex items-center justify-center">
              <RotateCcw
                className="w-5 h-5 text-[var(--color-secondary)]"
                strokeWidth={1.75}
              />
            </div>
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[var(--color-secondary)]">
              سياسة رسمية
            </span>
          </div>

          <h1 className="font-display text-3xl md:text-5xl text-[var(--color-on-surface)] tracking-tight leading-tight mb-3">
            سياسة الاسترجاع والاسترداد
          </h1>
          <p className="text-[var(--color-on-surface-variant)] text-sm md:text-base max-w-2xl leading-relaxed">
            حقك محفوظ. سواء ألغيت طلبك قبل الشحن أو احتجت لاسترجاع لوحة، نوضحلك
            هنا كل التفاصيل بشفافية كاملة.
          </p>

          <div className="flex items-center gap-1.5 mt-6 text-xs text-[var(--color-on-surface-variant)]">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              آخر تحديث:{" "}
              <strong className="text-[var(--color-on-surface)]">
                أكتوبر 2026
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* ═══ Main Content ═══ */}
      <div className="max-w-4xl mx-auto px-5 lg:px-8 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
          {/* ═══ Sidebar ═══ */}
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <h2 className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[var(--color-secondary)] mb-4">
                محتويات السياسة
              </h2>
              <nav className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/40 rounded-2xl p-4 space-y-0.5">
                {SECTIONS.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(section.id)?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-low)] hover:text-[var(--color-on-surface)] transition-colors group"
                  >
                    <span className="w-6 h-6 rounded-md bg-[var(--color-surface-container-low)] group-hover:bg-[var(--color-secondary)]/10 text-[10px] font-mono font-semibold text-[var(--color-on-surface-variant)] group-hover:text-[var(--color-secondary)] flex items-center justify-center flex-shrink-0 transition-colors">
                      {section.num}
                    </span>
                    <span className="leading-tight">{section.title}</span>
                  </a>
                ))}
              </nav>

              <div className="mt-6 bg-gradient-to-br from-[var(--color-secondary)]/5 to-[var(--color-primary)]/5 border border-[var(--color-secondary)]/20 rounded-2xl p-5">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-secondary)]/10 flex items-center justify-center mb-3">
                  <Headphones
                    className="w-4 h-4 text-[var(--color-secondary)]"
                    strokeWidth={1.75}
                  />
                </div>
                <p className="text-sm font-semibold text-[var(--color-on-surface)] mb-1">
                  محتاج مساعدة في استرجاع؟
                </p>
                <p className="text-xs text-[var(--color-on-surface-variant)] leading-relaxed mb-3">
                  فريق الدعم جاهز يساعدك في أي خطوة من خطوات الاسترجاع.
                </p>
                <a
                  href="mailto:support@opalgallery.net"
                  className="text-xs font-semibold text-[var(--color-secondary)] hover:underline"
                >
                  support@opalgallery.net
                </a>
              </div>
            </div>
          </aside>

          {/* ═══ Content ═══ */}
          <article className="lg:col-span-8 space-y-12">
            <Section
              id="vision"
              num="1"
              title="رؤيتنا للاسترجاع"
              icon={ShieldCheck}
            >
              <p>
                نؤمن إن تجربة الشراء لازم تكون مريحة وخالية من المخاطرة. لذلك
                وضعنا سياسة استرجاع واضحة وشفافة تحمي حق المشتري في كل مرحلة،
                وتضمن للفنان حقه أيضاً عند شحن واستلام اللوحات.
              </p>
              <p>
                سواء كنت ترغب في إلغاء طلبك قبل الشحن، أو استرجاع لوحة بعد
                استلامها، أو التعامل مع لوحة تالفة، ستجد هنا كل التفاصيل بوضوح
                وبدون شروط مخفية.
              </p>
            </Section>

            <Section
              id="before-shipping"
              num="2"
              title="قبل الشحن — إلغاء فوري"
              icon={XCircle}
            >
              <p className="mb-3">
                يمكنك إلغاء طلبك مجاناً بالكامل في أي وقت{" "}
                <strong>قبل أن يقوم الفنان بتسليم اللوحة لشركة الشحن</strong>.
                في هذه الحالة:
              </p>
              <ul>
                <li>
                  <CheckCircle2 className="inline w-4 h-4 text-emerald-600 ml-1" />
                  يتم استرداد <strong>المبلغ كاملاً</strong> (قيمة اللوحة + رسوم
                  الشحن).
                </li>
                <li>
                  <CheckCircle2 className="inline w-4 h-4 text-emerald-600 ml-1" />
                  يعود المال إلى وسيلة الدفع الأصلية خلال 3-14 يوم عمل.
                </li>
                <li>
                  <CheckCircle2 className="inline w-4 h-4 text-emerald-600 ml-1" />
                  تعود اللوحة إلى المعرض لتتاح للمشترين الآخرين.
                </li>
              </ul>
              <div className="mt-4 p-4 bg-[var(--color-surface-container-low)] rounded-xl border border-[var(--color-outline-variant)]/40">
                <p className="text-sm flex items-start gap-2">
                  <Clock className="w-4 h-4 text-[var(--color-secondary)] flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>نصيحة:</strong> الإلغاء قبل الشحن يتم بضغطة زر واحدة
                    من صفحة "طلباتي" ولا يحتاج لمراجعة من فريق الدعم.
                  </span>
                </p>
              </div>
            </Section>

            <Section
              id="after-shipping"
              num="3"
              title="بعد الشحن — استرجاع اللوحات"
              icon={Truck}
            >
              <p className="mb-3">
                بمجرد أن يتم تسليم اللوحة لشركة الشحن، تبدأ عملية الاسترجاع وفق
                القواعد التالية:
              </p>
              <ul>
                <li>
                  <strong>الإرجاع التلقائي:</strong> إذا فشلت شركة الشحن في
                  التوصيل (مثل عدم القدرة على الوصول للمستلم، أو رفض الاستلام)،
                  تُرجع اللوحة تلقائياً للفنان، ويتم استرداد{" "}
                  <strong>قيمة اللوحة فقط</strong> للمشتري.
                </li>
                <li>
                  <strong>الإرجاع بطلب من المشتري:</strong> في حالات استثنائية
                  (مثل وجود عيب لم يُذكر في الوصف)، يمكن طلب الإرجاع خلال{" "}
                  <strong>72 ساعة</strong> من الاستلام، على أن يتحمل المشتري
                  رسوم إعادة الشحن.
                </li>
                <li>
                  <strong>حالة اللوحة:</strong> يجب أن تُرجع اللوحة بنفس الحالة
                  التي استُلمت بها، مع التغليف الأصلي إن وُجد.
                </li>
              </ul>
            </Section>

            <Section
              id="damaged"
              num="4"
              title="اللوحات التالفة أو غير المطابقة"
              icon={AlertTriangle}
            >
              <p className="mb-3">
                في حال وصول لوحة تالفة أو مختلفة جذرياً عن الوصف المعروض:
              </p>
              <ul>
                <li>
                  <strong>التوثيق:</strong> صوّر اللوحة فور فتح الطرد (صور واضحة
                  للضرر + صور للتغليف الخارجي).
                </li>
                <li>
                  <strong>الإبلاغ:</strong> تواصل مع الدعم خلال{" "}
                  <strong>48 ساعة</strong> من الاستلام مع إرفاق الصور.
                </li>
                <li>
                  <strong>المراجعة:</strong> يقوم فريقنا بمراجعة الحالة خلال
                  24-48 ساعة.
                </li>
                <li>
                  <strong>القرار:</strong> في حال ثبوت الضرر أو عدم المطابقة يتم
                  استرداد <strong> المبلغ </strong>
                  على حسابنا .
                </li>
              </ul>
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>تنبيه:</strong> الاختلافات البسيطة في الألوان بسبب
                    اختلاف الشاشات لا تُعتبر سبباً للاسترجاع، لأن كل لوحة فنية
                    فريدة.
                  </span>
                </p>
              </div>
            </Section>

            <Section
              id="refund-amount"
              num="5"
              title="المبلغ المسترد"
              icon={Banknote}
            >
              <p className="mb-3">
                نؤمن بالشفافية الكاملة، لذلك نوضح كيف يتم حساب المبلغ المسترد في
                كل حالة:
              </p>

              <div className="space-y-3 mt-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="font-semibold text-emerald-900 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    إلغاء قبل الشحن
                  </p>
                  <p className="text-sm text-emerald-800">
                    المبلغ كامل: قيمة اللوحة + رسوم الشحن
                  </p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    إرجاع بعد الشحن (إرجاع تلقائي من شركة الشحن)
                  </p>
                  <p className="text-sm text-blue-800">
                    قيمة اللوحة فقط — رسوم الشحن غير مستردة لأنها تكلفة خدمية تم
                    تنفيذها فعلاً من شركة الشحن
                  </p>
                </div>
              </div>
            </Section>

            <Section
              id="timeline"
              num="6"
              title="الجدول الزمني للاسترداد"
              icon={Clock}
            >
              <p className="mb-3">
                نلتزم بمعالجة طلبات الاسترجاع بأسرع وقت ممكن:
              </p>
              <ul>
                <li>
                  <strong>مراجعة الطلب:</strong> خلال 24-48 ساعة من استلام
                  البلاغ.
                </li>
                <li>
                  <strong>الموافقة على الاسترجاع:</strong> فوري في حالات الإلغاء
                  قبل الشحن.
                </li>
                <li>
                  <strong>ظهور المبلغ في حسابك:</strong> 3-14 يوم عمل (حسب البنك
                  ووسيلة الدفع).
                </li>
              </ul>
            </Section>

            <Section
              id="how-to"
              num="7"
              title="كيفية طلب الاسترجاع"
              icon={Package}
            >
              <div className="bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/40 rounded-xl p-5 mb-6">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <XCircle className="w-4 h-4 text-emerald-700" />
                  </span>
                  <h3 className="font-semibold text-[var(--color-on-surface)] text-sm">
                    أولاً: الإلغاء قبل الشحن (من الموقع مباشرة)
                  </h3>
                </div>
                <ol className="space-y-2">
                  <li>سجّل دخولك إلى حسابك على منصة فُنون.</li>
                  <li>
                    انتقل إلى صفحة <strong>"طلباتي"</strong>.
                  </li>
                  <li>اختر الطلب الذي تريد إلغاءه.</li>
                  <li>
                    اضغط على زر <strong>"إلغاء الطلب"</strong>.
                  </li>
                  <li>اكتب سبب الإلغاء ثم أكّد.</li>
                  <li>
                    يتم الاسترداد تلقائياً خلال <strong>3-14 يوم عمل</strong>{" "}
                    ويصلك إيميل بالتفاصيل.
                  </li>
                </ol>
                <p className="mt-3 text-xs text-[var(--color-on-surface-variant)] bg-[var(--color-surface-container-lowest)] rounded-lg p-3 border border-[var(--color-outline-variant)]/30">
                  💡 الإلغاء متاح فقط قبل أن يقوم الفنان بتسليم اللوحة لشركة
                  الشحن. بعد بدء الشحن، انتقل للحالة الثانية بالأسفل.
                </p>
              </div>

              <div className="bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/40 rounded-xl p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Headphones className="w-4 h-4 text-blue-700" />
                  </span>
                  <h3 className="font-semibold text-[var(--color-on-surface)] text-sm">
                    ثانياً: الاسترجاع بعد وصول اللوحة (عبر فريق الدعم)
                  </h3>
                </div>
                <ol className="space-y-2">
                  <li>
                    صوّر اللوحة فور فتح الطرد (صور واضحة للضرر + صور للتغليف
                    الخارجي).
                  </li>
                  <li>
                    تواصل معنا عبر <strong>الواتساب</strong> أو{" "}
                    <strong>البريد الإلكتروني</strong> من خلال{" "}
                    <strong>نموذج التواصل الموجود في صفحة الدفع</strong>.
                  </li>
                  <li>
                    أرفق في رسالتك: <strong>رقم الطلب</strong> +{" "}
                    <strong>وصف المشكلة</strong> +{" "}
                    <strong>الصور الداعمة</strong>.
                  </li>
                  <li>
                    سيقوم فريق الدعم بمراجعة حالتك خلال{" "}
                    <strong>24-48 ساعة</strong> والرد عليك بالقرار.
                  </li>
                  <li>
                    في حال الموافقة، سيتم ترتيب إعادة الشحن وإصدار الاسترداد
                    وفقاً لهذه السياسة.
                  </li>
                </ol>
                <div className="mt-3 flex flex-wrap gap-3">
                  <a
                    href="mailto:support@opalgallery.net"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-secondary)] hover:underline"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    support@opalgallery.net
                  </a>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-secondary)]" dir="rtl">
                    <Headphones className="w-3.5 h-3.5" />
                    واتساب: 966565905901+
                  </span>
                </div>
              </div>
            </Section>

            <Section
              id="exceptions"
              num="8"
              title="استثناءات مهمة"
              icon={AlertTriangle}
            >
              <p className="mb-3">
                هناك بعض الحالات التي لا تنطبق عليها سياسة الاسترجاع الاعتيادية:
              </p>
              <ul>
                <li>
                  <strong>الضرر بسبب سوء الاستخدام:</strong> أي ضرر يحدث بعد
                  الاستلام بسبب التخزين غير السليم أو النقل من قبل المشتري.
                </li>
                <li>
                  <strong>تغيير الرأي بعد 72 ساعة:</strong> في حال استلام اللوحة
                  بسلام ومرور 72 ساعة، لا يمكن طلب الاسترجاع بسبب تغيير الرأي
                  فقط.
                </li>
              </ul>
            </Section>
          </article>
        </div>
      </div>

      {/* ═══ Back to Top ═══ */}
      <div className="max-w-4xl mx-auto px-5 lg:px-8 pb-10">
        <button
          onClick={scrollToTop}
          className="inline-flex items-center gap-2 text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-colors"
        >
          <ArrowUp className="w-4 h-4" />
          <span>العودة لأعلى الصفحة</span>
        </button>
      </div>

      <style>{`
        @media print {
          aside, button { display: none !important; }
          body { background: white !important; color: black !important; }
          a { text-decoration: none !important; color: black !important; }
        }
        @media screen {
          html { scroll-behavior: smooth; scroll-padding-top: 6rem; }
        }
      `}</style>
    </div>
  );
}

function Section({ id, num, title, children, icon: Icon }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-start gap-4 mb-5">
        <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--color-secondary)]/10 border border-[var(--color-secondary)]/20 flex items-center justify-center font-mono text-sm font-bold text-[var(--color-secondary)]">
          {num}
        </span>
        <div className="flex-1 flex items-center gap-2">
          <h2 className="font-display text-xl md:text-2xl text-[var(--color-on-surface)] leading-tight">
            {title}
          </h2>
          {Icon && (
            <Icon
              className="w-5 h-5 text-[var(--color-secondary)] mt-1 opacity-60"
              strokeWidth={1.75}
            />
          )}
        </div>
      </div>
      <div className="pr-14 text-sm md:text-[15px] text-[var(--color-on-surface-variant)] leading-[1.9] space-y-3">
        {children}
      </div>
      <div className="mt-8 h-px bg-[var(--color-outline-variant)]/40" />
    </section>
  );
}
