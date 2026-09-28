import { Fragment, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import {
  Check,
  Crown,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  X,
  ArrowUpCircle,
  Calendar,
  TicketCheck,
} from "lucide-react";
import toast from "../../../services/toast.service";

import { useMySubscription } from "../hooks/useSubscription";
import { PLANS, COMPARISON_TABLE, getPlanById } from "../config/plans";
import { subscriptionsService } from "../services/subscriptions.service";
import { useAuthStore } from "../../auth/stores/authStore";

import Button from "../../../components/Ui/Button";

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const user = useAuthStore((s) => s.user);
  const storeIsAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthenticated = Boolean(storeIsAuthenticated || user);

  const { data: subscription, isLoading, isError } = useMySubscription();

  const [showComparison, setShowComparison] = useState(false);
  const [isLoad, setIsLoad] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);

  const effectiveSubscription = isAuthenticated ? subscription : null;
  const effectiveIsLoading = isAuthenticated ? isLoading : false;
  const effectiveIsError = isAuthenticated ? isError : false;

  const isSubscribed = effectiveSubscription?.isActive;
  const currentPlanId = effectiveSubscription?.plan;
  const currentPlan = currentPlanId ? getPlanById(currentPlanId) : null;
  const RENEW_WINDOW_DAYS = 30;

  const daysLeft = effectiveSubscription?.endDate
    ? Math.max(
        0,
        Math.ceil(
          (new Date(effectiveSubscription.endDate).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  // Loading State
  if (effectiveIsLoading) {
    return (
      <div
        className="min-h-screen bg-[var(--color-surface)] py-16 px-4"
        dir="rtl"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14 space-y-3">
            <div className="h-10 bg-[var(--color-surface-container-low)] rounded-lg mx-auto max-w-md animate-pulse" />
            <div className="h-4 bg-[var(--color-surface-container-low)] rounded mx-auto max-w-sm animate-pulse" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex flex-col rounded-3xl p-6 bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/40 h-[500px]"
              >
                <div className="h-4 bg-[var(--color-surface-container-low)] rounded w-24 mb-5 animate-pulse" />
                <div className="h-8 bg-[var(--color-surface-container-low)] rounded w-32 mb-7 animate-pulse" />
                <div className="space-y-3 flex-1">
                  {[...Array(6)].map((_, j) => (
                    <div
                      key={j}
                      className="h-4 bg-[var(--color-surface-container-low)] rounded animate-pulse"
                    />
                  ))}
                </div>
                <div className="h-12 bg-[var(--color-surface-container-low)] rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (effectiveIsError) {
    return (
      <div
        className="min-h-screen bg-[var(--color-surface)] py-16 px-4 flex items-center justify-center"
        dir="rtl"
      >
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="font-display text-xl text-[var(--color-on-surface)] mb-2">
            حدث خطأ أثناء تحميل البيانات
          </h2>
          <p className="text-sm text-[var(--color-on-surface-variant)] mb-4">
            يرجى المحاولة مرة أخرى
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  const handleSubscribe = async (planId) => {
    if (isLoad) return;

    if (!isAuthenticated) {
      toast.error("سجّل دخولك أولاً للاشتراك في الباقة");
      const redirectTo = `${location.pathname}${location.search || ""}`;
      navigate(`/login?redirect=${encodeURIComponent(redirectTo)}`);
      return;
    }

    setIsLoad(true);
    setSelectedPlanId(planId);

    try {
      const quote = await subscriptionsService.getQuote(planId);

      if (!quote?.canPurchase) {
        toast.error(quote?.message || "لا يمكن الاشتراك في هذه الباقة حالياً");
        setIsLoad(false);
        setSelectedPlanId(null);
        return;
      }

      // ✅ الخطوة 2: ابدأ عملية الدفع
      const normalizedCouponCode =
        appliedCoupon?.code || couponCode.trim().toUpperCase();
      const response = await subscriptionsService.purchase(
        planId,
        normalizedCouponCode,
      );

      if (!response?.invoiceId) {
        toast.error("تعذّر إنشاء فاتورة الدفع");
        setIsLoad(false);
        setSelectedPlanId(null);
        return;
      }

      navigate(
        `/subscription/checkout?invoice=${response.invoiceId}&plan=${planId}`,
      );
    } catch (err) {
      console.error("❌ Purchase error:", err);
      const message =
        err?.response?.data?.message ||
        err?.data?.message ||
        err?.message ||
        "تعذّر بدء عملية الدفع";

      toast.error(message);
      setIsLoad(false);
      setSelectedPlanId(null);
    }
  };

  const handleCouponChange = (value) => {
    setCouponCode(value.toUpperCase());
    setAppliedCoupon(null);
  };

  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setAppliedCoupon(null);
      return;
    }

    setIsCheckingCoupon(true);
    try {
      const coupon = await subscriptionsService.validateCoupon(code);
      setAppliedCoupon(coupon);
      toast.success(
        coupon.hasPendingInvoice
          ? "لديك فاتورة معلّقة بهذا الكوبون، سيتم استئنافها عند الاشتراك"
          : `تم تطبيق خصم ${coupon.discountPercent}%`,
      );
    } catch (error) {
      setAppliedCoupon(null);
      toast.error(error?.message || "كود الخصم غير صالح");
    } finally {
      setIsCheckingCoupon(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[var(--color-surface)] py-16 px-4 font-body"
      dir="rtl"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl md:text-5xl text-[var(--color-on-surface)] tracking-tight mb-3">
            {isSubscribed ? "خطط الاشتراك" : "أسعار بسيطة ومناسبة"}
          </h1>

          <p className="text-[var(--color-on-surface-variant)] text-sm max-w-md mx-auto leading-relaxed">
            {isSubscribed
              ? "يمكنك ترقية باقتك في أي وقت للاستفادة من ميزات إضافية"
              : "اعرض لوحاتك للمشترين. اشتراك سنوي واحد، بدون التزامات طويلة."}
          </p>
        </div>

        {/* Current Plan Banner */}
        {isSubscribed && currentPlan && (
          <div className="mb-10 bg-gradient-to-l from-emerald-500 to-teal-600 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-5 text-white flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0 backdrop-blur-sm">
                  <ShieldCheck className="w-5 h-5" strokeWidth={2} />
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-white/80 mb-0.5">اشتراكك الحالي</p>
                  <p className="font-display text-lg font-bold truncate">
                    {currentPlan.nameAr}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm flex-wrap">
                <div className="flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full backdrop-blur-sm">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-xs">
                    ينتهي في{" "}
                    <strong>
                      {new Date(
                        effectiveSubscription.endDate,
                      ).toLocaleDateString("ar-SA", {
                        month: "short",
                        day: "numeric",
                      })}
                    </strong>
                  </span>
                </div>

                <Link
                  to="/dashboard/subscription"
                  className="flex items-center gap-1 text-xs bg-white text-emerald-700 px-3 py-1.5 rounded-full font-semibold hover:bg-white/90 transition-colors"
                >
                  إدارة الاشتراك
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {currentPlanId !== "opal_prestige" && (
              <div className="bg-white/10 px-5 py-2.5 text-xs text-white border-t border-white/10 flex items-center gap-2">
                <ArrowUpCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  ترقى إلى <strong>أوبال برستيج</strong> — شارة فنان vip + شحن
                  مجاني لمشتريك في أول 10 طلبات سنوياً
                </span>
              </div>
            )}
          </div>
        )}

        {/* Pricing Cards */}
        <div className="max-w-xl mx-auto mb-8 p-4 rounded-lg">
          <div className="flex items-center justify-between gap-3 mb-2">
            <label
              htmlFor="couponCode"
              className="text-sm font-semibold text-[var(--color-on-surface)]"
            >
              كود الخصم
            </label>
            {appliedCoupon && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <TicketCheck className="w-4 h-4" />
                خصم {appliedCoupon.discountPercent}%
              </span>
            )}
          </div>
          <div className="flex gap-2" dir="ltr">
            <input
              id="couponCode"
              value={couponCode}
              onChange={(event) => handleCouponChange(event.target.value)}
              placeholder="EXAMPLE20"
              maxLength={32}
              className="min-w-0 flex-1 h-10 px-3 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface)] text-sm uppercase outline-none focus:border-[var(--color-primary)]"
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              disabled={isCheckingCoupon || !couponCode.trim()}
              className="h-10 px-4 rounded-lg cursor-pointer bg-[var(--color-primary)] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCheckingCoupon ? "جارٍ التحقق" : "تطبيق"}
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--color-on-surface-variant)]">
            طبّق الكود أولاً، ثم اختر الباقة المناسبة.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((plan) => {
            const isCurrentPlan = currentPlanId === plan.id && isSubscribed;
            const isPlanLoading = isLoad && selectedPlanId === plan.id;

            if (plan.popular) {
              return (
                <div
                  key={plan.id}
                  className="relative flex flex-col rounded-3xl p-[3px] shadow-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] transition-all duration-300"
                >
                  <p className="text-center text-white text-xs font-semibold py-2 flex items-center justify-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    الأكثر شيوعاً
                  </p>

                  <div className="flex-1 flex flex-col rounded-[22px] bg-[var(--color-surface-container-lowest)] p-6">
                    <CardInner
                      plan={plan}
                      isCurrentPlan={isCurrentPlan}
                      isSubscribed={isSubscribed}
                      currentPlanId={currentPlanId}
                      onSubscribe={handleSubscribe}
                      isLoading={isPlanLoading}
                      disabled={isLoad}
                      popular // أو popular={false}
                      daysLeft={daysLeft} // ✅ NEW
                      renewWindowDays={RENEW_WINDOW_DAYS} // ✅ NEW
                    />
                  </div>
                </div>
              );
            }

            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-3xl p-6 bg-[var(--color-surface-container-lowest)] border transition-shadow ${
                  isCurrentPlan
                    ? "border-emerald-400 shadow-md"
                    : "border-[var(--color-outline-variant)]/60 hover:shadow-lg"
                }`}
              >
                <CardInner
                  plan={plan}
                  isCurrentPlan={isCurrentPlan}
                  isSubscribed={isSubscribed}
                  currentPlanId={currentPlanId}
                  onSubscribe={handleSubscribe}
                  isLoading={isPlanLoading}
                  disabled={isLoad}
                  popular={false}
                />
              </div>
            );
          })}
        </div>

        {/* Comparison Table */}
        <div className="mt-14">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="w-full flex items-center justify-between p-4 bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/60 rounded-xl hover:bg-[var(--color-surface-container-low)] transition-colors"
          >
            <span className="font-display text-base text-[var(--color-on-surface)]">
              مقارنة تفصيلية بين الباقات
            </span>

            <ChevronRight
              className={`w-5 h-5 text-[var(--color-on-surface-variant)] transition-transform ${
                showComparison ? "rotate-90" : ""
              }`}
            />
          </button>

          {showComparison && (
            <div className="mt-4 bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/60 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-outline-variant)]/40 bg-[var(--color-surface-container-low)]/50">
                      <th className="p-3 text-right text-xs font-semibold text-[var(--color-on-surface-variant)] uppercase tracking-wider">
                        الميزة
                      </th>
                      <th className="p-3 text-center text-xs font-semibold text-[var(--color-on-surface)]">
                        Classic
                      </th>
                      <th className="p-3 text-center text-xs font-semibold text-[var(--color-primary)]">
                        Plus
                      </th>
                      <th className="p-3 text-center text-xs font-semibold text-[var(--color-secondary)]">
                        Prestige
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {COMPARISON_TABLE.map((section) => (
                      <Fragment key={section.category}>
                        <tr className="bg-[var(--color-surface-container-low)]/30">
                          <td
                            colSpan={4}
                            className="p-3 text-xs font-bold text-[var(--color-on-surface)] uppercase tracking-wider"
                          >
                            {section.category}
                          </td>
                        </tr>

                        {section.rows.map((row) => (
                          <tr
                            key={row.feature}
                            className="border-b border-[var(--color-outline-variant)]/20 last:border-0"
                          >
                            <td className="p-3 text-sm text-[var(--color-on-surface)]">
                              {row.feature}
                            </td>
                            <Cell value={row.classic} />
                            <Cell value={row.plus} />
                            <Cell value={row.prestige} />
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* FAQ Teaser */}
        <div className="mt-10 text-center">
          <p className="text-xs text-[var(--color-on-surface-variant)]">
            لديك أسئلة؟{" "}
            <Link
              to="/contact-us"
              className="text-[var(--color-primary)] hover:underline font-semibold"
            >
              تواصل مع فريق الدعم
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// Cell Helper
function Cell({ value }) {
  if (value === true) {
    return (
      <td className="p-3 text-center">
        <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={3} />
        </div>
      </td>
    );
  }

  if (value === false) {
    return (
      <td className="p-3 text-center">
        <div className="w-6 h-6 bg-[var(--color-surface-container-low)] rounded-full flex items-center justify-center mx-auto">
          <X
            className="w-3.5 h-3.5 text-[var(--color-on-surface-variant)]/40"
            strokeWidth={2.5}
          />
        </div>
      </td>
    );
  }

  return (
    <td className="p-3 text-center text-xs font-semibold text-[var(--color-on-surface)]">
      {value}
    </td>
  );
}

// Card Inner
// Card Inner
function CardInner({
  plan,
  isCurrentPlan,
  isSubscribed,
  currentPlanId,
  onSubscribe,
  isLoading,
  disabled,
  popular,
  daysLeft,
  renewWindowDays = 30,
}) {
  const planOrder = { opal_classic: 1, opal_plus: 2, opal_prestige: 3 };

  const upgrade = isSubscribed && planOrder[plan.id] > planOrder[currentPlanId];
  const downgrade =
    isSubscribed && planOrder[plan.id] < planOrder[currentPlanId];

  // ✅ التجديد متاح بس لو باقي أقل من النافذة (أو Subscription منتهي اليوم)
  const canRenewNow =
    isSubscribed && daysLeft !== null && daysLeft <= renewWindowDays;

  return (
    <>
      <div className="mb-5">
        <h3 className="text-[var(--color-on-surface-variant)] text-sm mb-1">
          {plan.nameAr || plan.name}
        </h3>
        <p className="text-xs text-[var(--color-on-surface-variant)]/70">
          {plan.tagline}
        </p>
      </div>

      <div className="flex items-baseline gap-1 mb-6">
        <span className="font-display text-[28px] text-[var(--color-on-surface)]">
          {plan.price}
        </span>
        <span className="text-[var(--color-on-surface-variant)] text-xs">
          ر.س / سنة
        </span>
      </div>

      {plan.highlights && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {plan.highlights.map((h, i) => (
            <span
              key={i}
              className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${
                popular
                  ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20"
                  : "bg-[var(--color-surface-container-low)] text-[var(--color-on-surface-variant)] border-[var(--color-outline-variant)]/40"
              }`}
            >
              {h}
            </span>
          ))}
        </div>
      )}

      <ul className="space-y-3 mb-8 flex-1">
        {plan.features.map((feature, i) => {
          const isStringFeature = typeof feature === "string";
          const included = isStringFeature ? true : feature.included;
          const text = isStringFeature ? feature : feature.text;

          return (
            <li
              key={i}
              className="flex items-start gap-3 text-sm text-[var(--color-on-surface-variant)]"
            >
              <span className="w-5 h-5 rounded-full bg-[var(--color-secondary)]/15 flex items-center justify-center shrink-0 mt-0.5">
                {included ? (
                  <Check
                    className="w-3 h-3 text-[var(--color-secondary)]"
                    strokeWidth={3}
                  />
                ) : (
                  <X
                    className="w-3 h-3 text-[var(--color-on-surface-variant)]/40"
                    strokeWidth={2.5}
                  />
                )}
              </span>

              <span className="leading-relaxed">{text}</span>
            </li>
          );
        })}
      </ul>

      {/* ═══ كارت الباقة الحالية: badge + زرار تجديد مشروط ═══ */}
      {isCurrentPlan ? (
        <div className="space-y-2">
          <div className="w-full py-2 rounded-full text-center text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4" strokeWidth={3} />
            باقتك الحالية
          </div>

          {canRenewNow ? (
            <>
              <Button
                variant="primary"
                fullWidth
                icon={Calendar}
                onClick={() => onSubscribe(plan.id)}
                isLoading={isLoading}
                disabled={disabled}
              >
                تجديد الاشتراك
              </Button>
              <p className="text-[10px] text-center text-[var(--color-on-surface-variant)] leading-relaxed">
                {daysLeft === 0
                  ? "اشتراكك ينتهي اليوم — جدّد الآن"
                  : `باقي ${daysLeft} يوم على انتهاء اشتراكك`}
                {" — "}التجديد بيُضاف بعد تاريخ الانتهاء الحالي بدون ما تضيع
                أيامك
              </p>
            </>
          ) : (
            <p className="text-[10px] text-center text-[var(--color-on-surface-variant)] leading-relaxed">
              التجديد بيتم فتحه قبل الانتهاء بـ {renewWindowDays} يوم
              {daysLeft !== null && daysLeft > renewWindowDays
                ? ` (متاح بعد ${daysLeft - renewWindowDays} يوم)`
                : ""}
            </p>
          )}
        </div>
      ) : downgrade ? (
        <div className="w-full py-3 rounded-full text-center text-sm font-medium text-[var(--color-on-surface-variant)] bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/40">
          تخفيض الباقة غير متاح حالياً
        </div>
      ) : (
        <Button
          variant={popular ? "primary" : "outline"}
          fullWidth
          icon={upgrade ? ArrowUpCircle : popular ? Crown : ChevronRight}
          onClick={() => onSubscribe(plan.id)}
          isLoading={isLoading}
          disabled={disabled}
        >
          {upgrade
            ? "ترقية الباقة"
            : currentPlanId === plan.id
              ? "تجديد الاشتراك" // ✅ للاشتراك المنتهي (isActive=false) على نفس الباقة
              : "اشترك الآن"}
        </Button>
      )}
    </>
  );
}
