import { Link } from "react-router-dom";
import { ROUTES } from "../../config/routes";
import {
  ChevronRight,
  Shield,
  Calendar,
  ArrowUp,
  Mail,
  Lock,
  UserCheck,
} from "lucide-react";
import Button from "../../components/Ui/Button";

const SECTIONS = [
  { id: "commitment", num: "1", title: "التزامنا تجاه خصوصيتك" },
  { id: "collection", num: "2", title: "البيانات التي نجمعها" },
  { id: "purpose", num: "3", title: "لماذا نجمع هذه البيانات" },
  { id: "sharing", num: "4", title: "مع من نشارك بياناتك" },
  { id: "security", num: "5", title: "كيف نحمي بياناتك" },
  { id: "rights", num: "6", title: "حقوقك" },
  { id: "responsibility", num: "7", title: "مسؤوليتك عن حسابك" },
  { id: "changes", num: "8", title: "التعديلات على السياسة" },
];

export default function PrivacyPage() {
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
            <div className="w-11 h-11 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center">
              <Shield
                className="w-5 h-5 text-[var(--color-primary)]"
                strokeWidth={1.75}
              />
            </div>
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[var(--color-secondary)]">
              وثيقة رسمية
            </span>
          </div>

          <h1 className="font-display text-3xl md:text-5xl text-[var(--color-on-surface)] tracking-tight leading-tight mb-3">
            سياسة الخصوصية
          </h1>
          <p className="text-[var(--color-on-surface-variant)] text-sm md:text-base max-w-2xl leading-relaxed">
            خصوصيتك أمانة عندنا. نجمع فقط ما نحتاجه لتشغيل الخدمة، ولا نشاركه مع
            أحد إلا لتنفيذ طلبك.
          </p>

          <div className="flex items-center gap-1.5 mt-6 text-xs text-[var(--color-on-surface-variant)]">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              آخر تحديث:{" "}
              <strong className="text-[var(--color-on-surface)]">
                سبتمبر 2026
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* ═══ Main Content ═══ */}
      <div className="max-w-4xl mx-auto px-5 lg:px-8 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
          {/* ═══ Sidebar ══ */}
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <h2 className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[var(--color-secondary)] mb-4">
                محتويات الوثيقة
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
                    <span className="w-6 h-6 rounded-md bg-[var(--color-surface-container-low)] group-hover:bg-[var(--color-primary)]/10 text-[10px] font-mono font-semibold text-[var(--color-on-surface-variant)] group-hover:text-[var(--color-primary)] flex items-center justify-center flex-shrink-0 transition-colors">
                      {section.num}
                    </span>
                    <span className="leading-tight">{section.title}</span>
                  </a>
                ))}
              </nav>

              <div className="mt-6 bg-gradient-to-br from-[var(--color-primary)]/5 to-[var(--color-secondary)]/5 border border-[var(--color-primary)]/20 rounded-2xl p-5">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center mb-3">
                  <Mail
                    className="w-4 h-4 text-[var(--color-primary)]"
                    strokeWidth={1.75}
                  />
                </div>
                <p className="text-sm font-semibold text-[var(--color-on-surface)] mb-1">
                  سؤال عن بياناتك؟
                </p>
                <p className="text-xs text-[var(--color-on-surface-variant)] leading-relaxed mb-3">
                  تقدر تراسلنا في أي وقت للاطلاع على بياناتك أو طلب حذفها.
                </p>
              </div>
            </div>
          </aside>

          {/* ═══ Content ═══ */}
          <article className="lg:col-span-8 space-y-12">
            <Section id="commitment" num="1" title="التزامنا تجاه خصوصيتك">
              <p>
                تلتزم منصة أوبال جاليري بعدم كشف أي معلومات شخصية عن المستخدمين
                — مثل الاسم أو العنوان أو رقم الجوال أو البريد الإلكتروني — لأي
                طرف غير مخول. لا نبيع بياناتك ولا نتداولها مع أي جهة، ولا يُسمح
                بالوصول إليها إلا لفريق المنصة المصرح له والذي يحتاجها لتشغيل
                الخدمة.
              </p>
            </Section>

            <Section id="collection" num="2" title="البيانات التي نجمعها">
              <p className="mb-3">نجمع فقط البيانات اللازمة لتشغيل المنصة:</p>
              <ul>
                <li>
                  <strong>بيانات التسجيل:</strong> الاسم، البريد الإلكتروني، رقم
                  الجوال، وكلمة المرور (تُخزن مشفرة).
                </li>
                <li>
                  <strong>بيانات الفنان:</strong> العنوان لاستلام الشحنات،
                  وبيانات الحساب البنكي لعمليات السحب، وبيانات الاشتراك.
                </li>
                <li>
                  <strong>بيانات المشتري:</strong> عنوان التوصيل وسجل الطلبات.
                </li>
                <li>
                  <strong>بيانات تقنية أساسية:</strong> مثل عنوان IP ونوع
                  المتصفح، وتُستخدم لحماية المنصة من إساءة الاستخدام.
                </li>
              </ul>
            </Section>

            <Section id="purpose" num="3" title="لماذا نجمع هذه البيانات">
              <ul>
                <li>إنشاء حسابك وإدارته.</li>
                <li>تنفيذ الطلبات: الدفع، الشحن، التوصيل.</li>
                <li>إشعارك بحالة طلباتك وحسابك عبر البريد الإلكتروني.</li>
                <li>حماية المنصة والمستخدمين من الاحتيال وإساءة الاستخدام.</li>
                <li>تحسين تجربة الاستخدام.</li>
              </ul>
            </Section>

            <Section id="sharing" num="4" title="مع من نشارك بياناتك">
              <p className="mb-3">
                نشارك الحد الأدنى من البيانات فقط مع الجهات اللازمة لتنفيذ
                خدمتك:
              </p>
              <ul>
                <li>
                  <strong>بوابة الدفع (Moyasar):</strong> لمعالجة عمليات الدفع
                  والاسترداد. أرقام البطاقات تُعالج لديهم مباشرة ولا تُخزن على
                  خوادمنا إطلاقاً.
                </li>
                <li>
                  <strong>خدمه الشحن (OTO):</strong> اسم وعنوان المرسل والمستلم
                  لتنفيذ التوصيل فقط.
                </li>
                <li>
                  <strong>خدمة البريد الإلكتروني:</strong> لإرسال إشعارات
                  الطلبات والحساب.
                </li>
                <li>
                  <strong>الجهات الرسمية:</strong> فقط عند وجود طلب نظامي أو
                  قضائي ملزم.
                </li>
              </ul>
              <p className="mt-4 text-sm font-semibold text-[var(--color-on-surface)]">
                لا نشارك بياناتك مع أي جهة لأغراض إعلانية أو تسويقية لطرف ثالث.
              </p>
            </Section>

            <Section id="security" num="5" title="كيف نحمي بياناتك">
              <ul>
                <li>جميع الاتصالات بينك وبين المنصة مشفرة (HTTPS).</li>
                <li>
                  كلمات المرور تُخزن مشفرة ولا يمكن لفريق المنصة الاطلاع عليها.
                </li>
                <li>لا نخزن أرقام البطاقات أو بياناتها على خوادمنا.</li>
                <li>الوصول لقواعد البيانات مقصور على المصرح لهم فقط.</li>
              </ul>
            </Section>

            <Section id="rights" num="6" title="حقوقك">
              <p className="mb-3">يمكنك في أي وقت:</p>
              <ul>
                <li>الاطلاع على بياناتك المسجلة لدينا أو تصحيحها.</li>
                <li>يمكنك طلب حذف حسابك.</li>
              </ul>
            </Section>

            <Section id="responsibility" num="7" title="مسؤوليتك عن حسابك">
              <ul>
                <li>
                  أنت المسؤول عن الحفاظ على سرية كلمة المرور وبريدك الإلكتروني.
                </li>
                <li>
                  أي نشاط يتم عبر حسابك يُنسب إليك، فأبلغنا فوراً عند فقدان
                  الوصول لحسابك.
                </li>
                <li>
                  أنت مسؤول عن دقة البيانات التي تدخلها (خاصة عنوان الشحن
                  وبيانات السحب).
                </li>
              </ul>
            </Section>

            <Section id="changes" num="8" title="التعديلات على السياسة">
              <p>
                قد نحدّث هذه السياسة من وقت لآخر لمواكبة تطور المنصة. التغييرات
                الجوهرية سنعلنها داخل المنصة أو عبر البريد الإلكتروني، ويعني
                استمرارك في الاستخدام قبولك بالنسخة المحدثة.
              </p>
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

function Section({ id, num, title, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-start gap-4 mb-5">
        <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center font-mono text-sm font-bold text-[var(--color-primary)]">
          {num}
        </span>
        <h2 className="font-display text-xl md:text-2xl text-[var(--color-on-surface)] leading-tight pt-1.5">
          {title}
        </h2>
      </div>
      <div className="pr-14 text-sm md:text-[15px] text-[var(--color-on-surface-variant)] leading-[1.9] space-y-3">
        {children}
      </div>
      <div className="mt-8 h-px bg-[var(--color-outline-variant)]/40" />
    </section>
  );
}
