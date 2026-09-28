import { Link } from "react-router-dom";
import { ROUTES } from "../../config/routes";
import {
  ChevronRight,
  FileText,
  Calendar,
  Shield,
  FileCheck,
  ArrowUp,
  Mail,
  Palette,
} from "lucide-react";
import Button from "../../components/Ui/Button";

// ═══════════════════════════════════════════════════
// جدول المحتويات
// ═══════════════════════════════════════════════════
const SECTIONS = [
  { id: "platform", num: "1", title: "تعريف المنصة" },
  { id: "accounts", num: "2", title: "أنواع الحسابات" },
  { id: "subscriptions", num: "3", title: "باقات الاشتراك" },
  { id: "artworks", num: "4", title: "عرض وبيع الأعمال الفنية" },
  { id: "payment", num: "5", title: "عملية الشراء والدفع" },
  { id: "shipping", num: "6", title: "الشحن والتوصيل" },
  { id: "funds", num: "7", title: "إطلاق الأموال والمحفظات" },
  { id: "withdrawal", num: "8", title: "السحب" },
  { id: "reviews", num: "9", title: "التقييمات والمراجعات" },
  { id: "prohibited", num: "10", title: "السلوك المحظور" },
  { id: "suspension", num: "11", title: "الحظر وتعليق الحسابات" },
  { id: "ip", num: "12", title: "الملكية الفكرية" },
  { id: "privacy", num: "13", title: "الخصوصية وحماية البيانات" },
  { id: "disclaimer", num: "14", title: "إخلاء المسؤولية" },
  { id: "changes", num: "15", title: "التعديلات" },
  { id: "law", num: "16", title: "القانون المختص" },
];

export default function TermsPage() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div className="min-h-screen bg-[var(--color-surface)] font-body" dir="rtl">
      {/* ═══ Hero Header ═══ */}
      <div className="bg-gradient-to-b from-[var(--color-surface-container-low)] to-[var(--color-surface)] border-b border-[var(--color-outline-variant)]/40">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 py-12 lg:py-16">
          <Link
            to={ROUTES.HOME}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-colors mb-6"
          >
            <ChevronRight className="w-3.5 h-3.5" />
            <span>العودة للرئيسية</span>
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center">
              <FileText
                className="w-5 h-5 text-[var(--color-primary)]"
                strokeWidth={1.75}
              />
            </div>
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[var(--color-secondary)]">
              وثيقة رسمية
            </span>
          </div>

          <h1 className="font-display text-3xl md:text-5xl text-[var(--color-on-surface)] tracking-tight leading-tight mb-3">
            الشروط والأحكام
          </h1>
          <p className="text-[var(--color-on-surface-variant)] text-sm md:text-base max-w-2xl leading-relaxed">
            استخدامك لمنصة اوبال ارت يعني موافقتك على الالتزام بالشروط التالية.
            يرجى قراءتها بعناية قبل إتمام أي عملية شراء أو اشتراك.
          </p>

          <div className="flex flex-wrap items-center gap-4 mt-6 text-xs">
            <div className="flex items-center gap-1.5 text-[var(--color-on-surface-variant)]">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                آخر تحديث:{" "}
                <strong className="text-[var(--color-on-surface)]">
                  سبتمبر 2026
                </strong>
              </span>
            </div>
            <div className="w-px h-3.5 bg-[var(--color-outline-variant)]/60" />
            <div className="flex items-center gap-1.5 text-[var(--color-on-surface-variant)]">
              <FileCheck className="w-3.5 h-3.5" />
              <span>
                وثيقة عمل حر{" "}
                <strong className="font-mono text-[var(--color-on-surface)]">
                  FL-681211769
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Main Content ═══ */}
      <div className="max-w-5xl mx-auto px-5 lg:px-8 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
          {/* ═══ Sidebar: Table of Contents ═══ */}
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

              {/* CTA Box */}
              <div className="mt-6 bg-gradient-to-br from-[var(--color-primary)]/5 to-[var(--color-secondary)]/5 border border-[var(--color-primary)]/20 rounded-2xl p-5">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center mb-3">
                  <Mail
                    className="w-4 h-4 text-[var(--color-primary)]"
                    strokeWidth={1.75}
                  />
                </div>
                <p className="text-sm font-semibold text-[var(--color-on-surface)] mb-1">
                  عندك سؤال؟
                </p>
                <p className="text-xs text-[var(--color-on-surface-variant)] leading-relaxed mb-3">
                  فريق الدعم جاهز للإجابة على أي استفسار حول الشروط أو سياسات
                  المنصة.
                </p>
              </div>
            </div>
          </aside>

          {/* ═══ Main Content ═══ */}
          <article className="lg:col-span-8 space-y-12">
            {/* ═══ 1. Platform Definition ═══ */}
            <Section id="platform" num="1" title="تعريف المنصة">
              <p>
                <strong>اوبال ارت (opalart.sa)</strong> هي منصة إلكترونية سعودية
                تربط بين الفنانين التشكيليين والمشترين (المقتنين). المنصة تعمل
                كوسيط لعرض وبيع الأعمال الفنية الأصلية، ولا تمتلك أي عمل فني
                معروض عليها.
              </p>
            </Section>

            {/* ═══ 2. Account Types ═══ */}
            <Section id="accounts" num="2" title="أنواع الحسابات">
              <Subsection title="2.1 حساب المشتري (Buyer)">
                <ul>
                  <li>متاح لأي شخص يبلغ 18 عاماً فأكثر</li>
                  <li>يتطلب بريداً إلكترونياً ورقم جوال صالحين</li>
                  <li>
                    يمكن تصفح المعرض وإضافة الأعمال للمفضلة والسلة والشراء
                  </li>
                </ul>
              </Subsection>

              <Subsection title="2.2 حساب الفنان (Artist)">
                <ul>
                  <li>يتطلب اشتراكاً مدفوعاً سنوياً في إحدى الباقات المتاحة</li>
                  <li>يتيح رفع وعرض وبيع الأعمال الفنية</li>
                  <li>
                    يخضع لمراجعة واعتماد من فريق المنصة قبل ظهور الأعمال في
                    المعرض
                  </li>
                </ul>
              </Subsection>
            </Section>

            {/* ═══ 3. Subscriptions ═══ */}
            <Section id="subscriptions" num="3" title="باقات الاشتراك">
              <Subsection title="3.1 أوبال كلاسيك (Opal Classic)">
                <ul>
                  <li>اشتراك سنوي</li>
                  <li>رفع عدد محدود من الأعمال الفنية</li>
                  <li>
                    عمولة المنصة: <strong>15%</strong> من سعر البيع
                  </li>
                </ul>
              </Subsection>

              <Subsection title="3.2 أوبال بلس (Opal Plus)">
                <ul>
                  <li>اشتراك سنوي بسعر أعلى</li>
                  <li>عدد أعمال أكبر + إحصائيات تفصيلية لأداء اللوحات</li>
                  <li>عمولة المنصة: أقل من الكلاسيك</li>
                </ul>
              </Subsection>

              <Subsection title="3.3 أوبال برستيج (Opal Prestige)">
                <ul>
                  <li>اشتراك سنوي بالسعر الأعلى</li>
                  <li>
                    شارة "فنان موثق" ✓ + شحن مجاني للمشتري في أول 10 طلبات
                    سنوياً
                  </li>
                  <li>عمولة المنصة: الأقل</li>
                </ul>
              </Subsection>

              <Subsection title="3.4 التجديد والترقية">
                <ul>
                  <li>
                    التجديد متاح قبل انتهاء الاشتراك بـ{" "}
                    <strong>30 يوماً</strong>
                  </li>
                  <li>
                    الترقية لباقة أعلى متاحة في أي وقت (يُحسب الفرق بالتناسب مع
                    الأيام المتبقية)
                  </li>
                  <li>التخفيض لباقة أقل غير متاح حالياً</li>
                </ul>
              </Subsection>
            </Section>

            {/* ═══ 4. Artworks ═══ */}
            <Section id="artworks" num="4" title="عرض وبيع الأعمال الفنية">
              <Subsection title="4.1 مسؤولية الفنان">
                <ul>
                  <li>
                    الفنان هو المسؤول الوحيد عن أصالة العمل الفني وحقوق الملكية
                    الفكرية
                  </li>
                  <li>
                    يُحظر رفع أعمال منسوخة أو مسروقة أو تنتهك حقوق طرف ثالث
                  </li>
                  <li>
                    الفنان مسؤول عن دقة وصف العمل (الأبعاد، المواد، الحالة)
                  </li>
                  <li>كل عمل فني يُباع مرة واحدة فقط (قطعة أصلية فريدة)</li>
                </ul>
              </Subsection>

              <Subsection title="4.2 مراجعة الأعمال">
                <ul>
                  <li>
                    جميع الأعمال تخضع لمراجعة فريق المنصة قبل الظهور في المعرض
                  </li>
                  <li>
                    للمنصة الحق في رفض أو إيقاف أي عمل دون إشعار مسبق إذا خالف
                    السياسات
                  </li>
                  <li>
                    أسباب الرفض الشائعة: جودة صور منخفضة، وصف غير كافٍ، محتوى
                    غير لائق
                  </li>
                </ul>
              </Subsection>

              <Subsection title="4.3 التسعير">
                <ul>
                  <li>الفنان يحدد سعر العمل بحرية</li>
                  <li>المنصة تقتطع عمولتها تلقائياً عند إتمام البيع</li>
                  <li>الأسعار بالريال السعودي (SAR) فقط</li>
                </ul>
              </Subsection>
            </Section>

            {/* ═══ 5. Payment ═══ */}
            <Section id="payment" num="5" title="عملية الشراء والدفع">
              <Subsection title="5.1 الدفع">
                <ul>
                  <li>
                    جميع المدفوعات تتم عبر بوابة <strong>Moyasar</strong>{" "}
                    المعتمدة
                  </li>
                  <li>
                    طرق الدفع المقبولة: بطاقات الائتمان (Visa, Mastercard, Mada)
                  </li>
                  <li>الأسعار تشمل تكلفة الشحن (إن وجدت)</li>
                </ul>
              </Subsection>

              <Subsection title="5.2 تأكيد الطلب">
                <ul>
                  <li>يتم إنشاء الطلب فور إتمام الدفع بنجاح</li>
                  <li>يُرسل تأكيد بالبريد الإلكتروني للمشتري والفنان</li>
                  <li>لا يمكن إلغاء الطلب بعد بدء تجهيز الشحن</li>
                </ul>
              </Subsection>

              <Subsection title="5.3 الإلغاء والاسترداد">
                <ul>
                  <li>
                    يمكن للمشتري إلغاء الطلب قبل بدء الشحن واسترداد المبلغ
                    كاملاً
                  </li>
                  <li>الاسترداد يتم عبر نفس طريقة الدفع خلال 3-14 يوم عمل</li>
                  <li>بعد بدء الشحن، يتم التعامل مع الإلغاء عبر فريق الدعم</li>
                </ul>
              </Subsection>
            </Section>

            {/* ═══ 6. Shipping ═══ */}
            <Section id="shipping" num="6" title="الشحن والتوصيل">
              <Subsection title="6.1 عملية الشحن">
                <ul>
                  <li> الشحن يتم عبر شركات شحن معتمدة من خلال (OTO)</li>
                  <li>الفنان مسؤول عن تجهيز وتغليف العمل الفني بشكل آمن</li>
                  <li>شركة الشحن تستلم العمل من عنوان الفنان</li>
                </ul>
              </Subsection>

              <Subsection title="6.2 التتبع">
                <ul>
                  <li>يتم توفير رقم تتبع وبوليصة شحن لكل طلب</li>
                  <li>يمكن للمشتري والفنان تتبع حالة الشحنة في أي وقت</li>
                </ul>
              </Subsection>

              <Subsection title="6.3 التوصيل">
                <ul>
                  <li>مدة التوصيل تعتمد على شركة الشحن والمدينة</li>
                  <li>عند التوصيل، تبدأ فترة ضمان الاستلام (72 ساعة)</li>
                </ul>
              </Subsection>

              <Subsection title="6.4 الشحن المجاني">
                <ul>
                  <li>
                    متاح لفناني باقة <strong>أوبال برستيج</strong> فقط
                  </li>
                  <li>يشمل أول 10 طلبات سنوياً لكل فنان </li>
                  <li>يتجدد العداد مع كل تجديد اشتراك سنوي</li>
                </ul>
              </Subsection>
            </Section>

            {/* ═══ 7. Funds ═══ */}
            <Section id="funds" num="7" title="إطلاق الأموال والمحفظات">
              <Subsection title="7.1 فترة الضمان">
                <ul>
                  <li>
                    بعد توصيل الطلب، تُحجز أموال الفنان لمدة{" "}
                    <strong>72 ساعة</strong> كفترة ضمان
                  </li>
                  <li>
                    خلال هذه الفترة يمكن للمشتري تأكيد الاستلام أو الإبلاغ عن
                    مشكلة
                  </li>
                </ul>
              </Subsection>

              <Subsection title="7.2 إطلاق الأموال">
                <ul>
                  <li>
                    بعد انتهاء فترة الضمان (أو عند تأكيد المشتري)، تُطلق الأموال
                    لمحفظة الفنان
                  </li>
                  <li>المبلغ المُتاح = سعر العمل - عمولة المنصة</li>
                </ul>
              </Subsection>

              <Subsection title="7.3 تجميد الأموال">
                <ul>
                  <li>للمنصة حق تجميد أموال أي طلب في حال وجود بلاغ أو نزاع</li>
                  <li>يتم إشعار الفنان بالتجميد وسببه</li>
                  <li>تُحل النزاعات عبر فريق الدعم</li>
                </ul>
              </Subsection>
            </Section>

            {/* ═══ 8. Withdrawal ═══ */}
            <Section id="withdrawal" num="8" title="السحب">
              <Subsection title="8.1 طلب السحب">
                <ul>
                  <li>يمكن للفنان طلب سحب رصيده المتاح إلى حسابه البنكي</li>
                  <li>يجب إضافة حساب بنكي سعودي والتحقق منه أولاً</li>
                  <li>
                    الحد الأدنى للسحب: <strong>50 ريال سعودي</strong>
                  </li>
                </ul>
              </Subsection>

              <Subsection title="8.2 معالجة السحب">
                <ul>
                  <li>جميع طلبات السحب تخضع لمراجعة فريق المنصة</li>
                  <li>
                    بعد الموافقة، يتم التحويل خلال <strong>3-5 أيام عمل</strong>
                  </li>
                  <li>يتم إشعار الفنان عند إتمام التحويل برقم المرجع</li>
                </ul>
              </Subsection>

              <Subsection title="8.3 حدود السحب">
                <ul>
                  <li>الحد الأقصى: طلبان سحب أسبوعياً</li>
                </ul>
              </Subsection>
            </Section>

            {/* ═══ 9. Reviews ═══ */}
            <Section id="reviews" num="9" title="التقييمات والمراجعات">
              <ul>
                <li>يمكن للمشتري تقييم الطلب بعد اكتماله</li>
                <li>التقييمات تظهر في الصفحة العامة للفنان</li>
                <li>للمنصة حق حذف التقييمات المسيئة أو غير اللائقة</li>
              </ul>
            </Section>

            {/* ═══ 10. Prohibited ═══ */}
            <Section id="prohibited" num="10" title="السلوك المحظور">
              <p className="mb-3">يُحظر على جميع المستخدمين:</p>
              <ul>
                <li>رفع محتوى ينتهك حقوق الملكية الفكرية</li>
                <li>استخدام المنصة للاحتيال أو التضليل</li>
                <li>محاولة التحايل على نظام العمولات (التعامل خارج المنصة)</li>
                <li>إنشاء حسابات متعددة بنفس البيانات</li>
                <li>مضايقة أو إساءة للمستخدمين الآخرين</li>
                <li>محاولة اختراق أو تعطيل المنصة</li>
              </ul>
            </Section>

            {/* ═══ 11. Suspension ═══ */}
            <Section id="suspension" num="11" title="الحظر وتعليق الحسابات">
              <ul>
                <li>للمنصة حق حظر أي حساب يخالف الشروط دون إشعار مسبق</li>
                <li>
                  عند الحظر: تُخفى جميع أعمال الفنان، وتُلغى طلبات السحب
                  المعلقة، وتُجمد المحفظة
                </li>
                <li>
                  يتم إشعار المستخدم المحظور بالبريد الإلكتروني مع ذكر السبب
                </li>
                <li>يمكن الطعن على قرار الحظر عبر فريق الدعم خلال 14 يوماً</li>
              </ul>
            </Section>

            {/* ═══ 12. IP ═══ */}
            <Section id="ip" num="12" title="الملكية الفكرية">
              <ul>
                <li>الفنان يحتفظ بجميع حقوق الملكية الفكرية لأعماله</li>
                <li>
                  بمنح العمل للمنصة، يمنح الفنان ترخيصاً محدوداً لعرض العمل
                  وتسويقه
                </li>
                <li>المنصة لا تدّعي ملكية أي عمل فني معروض عليها</li>
                <li>
                  يُحظر على المشترين إعادة بيع أو نسخ الأعمال دون إذن الفنان
                </li>
              </ul>
            </Section>

            {/* ═══ 13. Privacy ═══ */}
            <Section id="privacy" num="13" title="الخصوصية وحماية البيانات">
              <ul>
                <li>
                  نجمع فقط البيانات اللازمة لتقديم الخدمة (الاسم، البريد،
                  الجوال، العنوان)
                </li>
                <li>
                  لا نشارك بياناتك مع أطراف ثالثة إلا لشركات الشحن ومعالجة الدفع
                </li>
                <li>
                  بيانات الدفع تُعالج عبر Moyasar ولا نخزّن أرقام البطاقات
                </li>
                <li>يمكنك طلب حذف بياناتك في أي وقت عبر التواصل مع الدعم</li>
              </ul>
              <p className="mt-4">
                للتفاصيل الكاملة، يرجى مراجعة{" "}
                <Link
                  to={ROUTES.PRIVACY}
                  className="text-[var(--color-primary)] hover:underline font-semibold"
                >
                  سياسة الخصوصية
                </Link>
                .
              </p>
            </Section>

            {/* ═══ 14. Disclaimer ═══ */}
            <Section id="disclaimer" num="14" title="إخلاء المسؤولية">
              <ul>
                <li>
                  المنصة وسيط بين الفنان والمشتري وليست طرفاً في العملية الفنية
                  نفسها
                </li>
                <li>
                  لا نضمن أصالة كل عمل فني، رغم أننا نبذل جهداً في المراجعة
                </li>
                <li>
                  لا نتحمل مسؤولية التلف أثناء الشحن (يُغطى بتأمين شركة الشحن)
                </li>
                <li>المنصة مقدمة "كما هي" دون ضمانات صريحة أو ضمنية</li>
              </ul>
            </Section>

            {/* ═══ 15. Changes ═══ */}
            <Section id="changes" num="15" title="التعديلات">
              <ul>
                <li>نحتفظ بحق تعديل هذه الشروط في أي وقت</li>
                <li>
                  يتم إشعار المستخدمين بالتغييرات الجوهرية عبر البريد الإلكتروني
                </li>
                <li>
                  استمرار استخدام المنصة بعد التعديل يعني قبول الشروط الجديدة
                </li>
              </ul>
            </Section>

            {/* ═══ 16. Law ═══ */}
            <Section id="law" num="16" title="القانون المختص">
              <ul>
                <li>تخضع هذه الشروط لأنظمة المملكة العربية السعودية</li>
                <li>
                  أي نزاع يُحل أولاً عبر فريق الدعم، ثم عبر الجهات المختصة في
                  المملكة
                </li>
              </ul>
            </Section>
          </article>
        </div>
      </div>

      {/* ═══ Back to Top ═══ */}
      <div className="max-w-5xl mx-auto px-5 lg:px-8 pb-10">
        <button
          onClick={scrollToTop}
          className="inline-flex items-center gap-2 text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-colors"
        >
          <ArrowUp className="w-4 h-4" />
          <span>العودة لأعلى الصفحة</span>
        </button>
      </div>

      {/* ═══ Print Styles ═══ */}
      <style>{`
        @media print {
          aside, button, .no-print { display: none !important; }
          article { column-count: 1 !important; }
          .lg\\:col-span-8 { max-width: 100% !important; }
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

// ═══════════════════════════════════════════════════
// Section Component
// ═══════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════
// Subsection Component
// ═══════════════════════════════════════════════════
function Subsection({ title, children }) {
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="text-[15px] font-semibold text-[var(--color-on-surface)] mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}
