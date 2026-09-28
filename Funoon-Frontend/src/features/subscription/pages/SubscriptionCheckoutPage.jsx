// src/features/subscription/pages/SubscriptionCheckoutPage.jsx
import { useRef, useState, useEffect } from "react";
import { useSearchParams, Navigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  Loader2,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ArrowUpCircle,
  CalendarCheck,
  Clock,
} from "lucide-react";
import { useMoyasarForm } from "../../../hooks/useMoyasarForm";
import { getPlanById } from "../config/plans";
import { subscriptionsService } from "../services/subscriptions.service";
import Button from "../../../components/Ui/Button";
import { ROUTES } from "../../../config/routes";

// ═══ Scenario badges ═══
const SCENARIO_META = {
  new: {
    label: "اشتراك جديد",
    icon: Sparkles,
    cls: "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/25",
  },
  upgrade: {
    label: "ترقية فورية",
    icon: ArrowUpCircle,
    cls: "bg-blue-50 text-blue-700 border-blue-200",
  },
  renewal: {
    label: "تجديد الاشتراك",
    icon: CalendarCheck,
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

export default function SubscriptionCheckoutPage() {
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get("invoice");
  const planIdFromUrl = searchParams.get("plan");

  const formRef = useRef(null);
  const [retryCount, setRetryCount] = useState(0);
  const [formInjected, setFormInjected] = useState(false);
  const [isRestoringFromGateway, setIsRestoringFromGateway] = useState(false);

  // ═══════════════════════════════════════════════════
  // ✅ المبلغ الحقيقي من الـ backend (مش من الـ config!)
  // ═══════════════════════════════════════════════════
  const {
    data: details,
    isLoading: detailsLoading,
    isError: detailsError,
    refetch,
  } = useQuery({
    queryKey: ["subscriptionCheckoutDetails", invoiceId],
    queryFn: () => subscriptionsService.getCheckoutDetails(invoiceId),
    enabled: !!invoiceId,
    retry: 1,
    staleTime: 0,
    refetchInterval: (query) => {
      const st = query.state.data?.status;
      if (st && st !== "PENDING") return false;
      return 5000;
    },
  });

  useEffect(() => {
    const hidePaymentForm = () => {
      setIsRestoringFromGateway(true);
      setFormInjected(false);
      formRef.current?.replaceChildren();
    };

    const handlePageShow = (event) => {
      if (!event.persisted) return;

      hidePaymentForm();
      refetch().finally(() => setIsRestoringFromGateway(false));
    };

    window.addEventListener("pagehide", hidePaymentForm);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pagehide", hidePaymentForm);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [refetch]);

  const planConfig = details?.planDetails || getPlanById(planIdFromUrl);
  const amountToPay = details?.amountToPay ?? planConfig?.price ?? 0;
  const scenario = details?.scenario || "new";
  const paymentStatus = details?.status;
  const scenarioMeta = SCENARIO_META[scenario] || SCENARIO_META.new;
  const ScenarioIcon = scenarioMeta.icon;

  // ✅ الفورم ميشتغلش إلا لما نعرف المبلغ الحقيقي وحالة الدفع PENDING
  const formEnabled =
    !!invoiceId &&
    !!details &&
    paymentStatus === "PENDING" &&
    !detailsError &&
    !isRestoringFromGateway;

  const {
    isLoading: formLoading,
    error: formError,
    retry,
  } = useMoyasarForm({
    containerRef: formRef,
    invoiceId: invoiceId || "",
    amount: amountToPay,
    description: `Opal - ${planConfig?.name || ""} Subscription`,
    callbackPath: "/subscription/success",
    enabled: formEnabled,
    key: `${invoiceId}-${retryCount}`,
  });

  // ✅ مراقبة حقن الفورم
  useEffect(() => {
    const el = formRef.current;
    if (!el) return;

    if (el.children.length > 0) {
      setFormInjected(true);
      return;
    }

    const observer = new MutationObserver(() => {
      if (el.children.length > 0) {
        setFormInjected(true);
        observer.disconnect();
      }
    });
    observer.observe(el, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [retryCount]);

  const handleRetry = () => {
    setFormInjected(false);
    setRetryCount((c) => c + 1);
    retry?.();
  };

  const actuallyLoading =
    (detailsLoading || formLoading || isRestoringFromGateway) &&
    !formError &&
    !detailsError &&
    !formInjected;

  // ═══ Redirects (بعد كل الـ hooks) ═══
  if (!invoiceId) return <Navigate to="/subscription" replace />;

  if (details && paymentStatus === "PAID") {
    return (
      <Navigate
        to={`/subscription/success?id=${invoiceId}&status=paid`}
        replace
      />
    );
  }

  return (
    <div
      className="min-h-screen bg-[var(--color-surface)] py-14 px-4 font-body"
      dir="rtl"
    >
      <div className="max-w-lg mx-auto">
        <Link
          to={ROUTES.SUBSCRIPTIONS || "/subscription"}
          className="flex items-center gap-1.5 text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-colors mb-6 w-fit"
        >
          <ChevronRight className="w-4 h-4" />
          <span>الرجوع للباقات</span>
        </Link>

        <div className="p-6 lg:p-8">
          {/* ═══ ملخص الباقة + السيناريو ═══ */}
          <div className="mb-6 pb-5 border-b border-[var(--color-outline-variant)]/40">
            <p className="text-xs text-[var(--color-on-surface-variant)] mb-2">
              الاشتراك في باقة
            </p>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {planConfig?.popular && (
                  <Sparkles className="w-4 h-4 text-[var(--color-secondary)] shrink-0" />
                )}
                <h3 className="font-display text-xl text-[var(--color-on-surface)] truncate">
                  {planConfig?.name || "..."}
                </h3>
              </div>

              {/* Scenario badge */}
              {details && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold border rounded-full shrink-0 ${scenarioMeta.cls}`}
                >
                  <ScenarioIcon className="w-3 h-3" />
                  {scenarioMeta.label}
                </span>
              )}
            </div>

            {/* ═══ تفصيل السعر حسب السيناريو ═══ */}
            {details && (
              <div className="mt-4 space-y-2 text-sm">
                {details.couponCode && (
                  <>
                    <div className="flex justify-between text-xs text-[var(--color-on-surface-variant)]">
                      <span>السعر قبل الخصم</span>
                      <span>{details.originalAmount} ر.س</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>
                        خصم الكود {details.couponCode} (
                        {details.discountPercent}%)
                      </span>
                      <span>-{details.discountAmount} ر.س</span>
                    </div>
                    {details.minimumChargeApplied && (
                      <p className="text-xs leading-relaxed text-amber-700">
                        تم الحفاظ على الحد الأدنى للدفع وهو 1 ر.س، لذلك تم
                        احتساب الخصم الفعلي المعروض أعلاه.
                      </p>
                    )}
                  </>
                )}
                {scenario === "upgrade" ? (
                  <>
                    <div className="flex justify-between text-xs text-[var(--color-on-surface-variant)]">
                      <span>سعر الباقة السنوي</span>
                      <span className="line-through">
                        {details.fullPlanPrice} ر.س
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>
                        تدفع الآن (فرق {details.daysLeftAtPurchase} يوم
                        المتبقية)
                      </span>
                      <span className="text-[var(--color-primary)] font-display text-lg">
                        {amountToPay} ر.س
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--color-on-surface-variant)] leading-relaxed">
                      الباقة الأعلى هتتفعل فوراً ولغاية نفس تاريخ انتهاء اشتراكك
                      الحالي.
                    </p>
                  </>
                ) : scenario === "renewal" ? (
                  <div className="flex justify-between font-semibold">
                    <span>تجديد سنة إضافية</span>
                    <span className="text-[var(--color-primary)] font-display text-lg">
                      {amountToPay} ر.س
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between font-semibold">
                    <span>الإجمالي</span>
                    <span className="text-[var(--color-primary)] font-display text-lg">
                      {amountToPay}{" "}
                      <span className="text-xs font-body">ر.س / سنة</span>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ═══ Invoice منتهية / فاشلة ═══ */}
          {details &&
            paymentStatus !== "PENDING" &&
            paymentStatus !== "PAID" && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mb-3">
                  <Clock className="w-7 h-7 text-amber-600" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-[var(--color-on-surface)] mb-1 font-semibold">
                  جلسة الدفع دي انتهت
                </p>
                <p className="text-xs text-[var(--color-on-surface-variant)] mb-4">
                  ارجع لصفحة الباقات وابدأ عملية شراء جديدة.
                </p>
                <Link to={ROUTES.SUBSCRIPTIONS || "/subscription"}>
                  <Button variant="primary" size="sm">
                    الرجوع للباقات
                  </Button>
                </Link>
              </div>
            )}

          {/* ═══ Error في تحميل التفاصيل ═══ */}
          {detailsError && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <AlertCircle
                className="w-10 h-10 text-red-500 mb-3"
                strokeWidth={1.5}
              />
              <p className="text-sm text-[var(--color-on-surface)] mb-4">
                تعذّر تحميل تفاصيل الدفع
              </p>
              <Link to={ROUTES.SUBSCRIPTIONS || "/subscription"}>
                <Button variant="outline" size="sm" icon={RefreshCw}>
                  الرجوع للباقات
                </Button>
              </Link>
            </div>
          )}

          {/* ═══ Skeleton ═══ */}
          {actuallyLoading && !detailsError && <CheckoutSkeleton />}

          {/* ═══ Error في الفورم ═══ */}
          {formError && !detailsError && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <AlertCircle
                className="w-10 h-10 text-red-500 mb-3"
                strokeWidth={1.5}
              />
              <p className="text-sm text-[var(--color-on-surface)] mb-4">
                تعذّر تحميل بوابة الدفع
              </p>
              <button
                onClick={handleRetry}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--color-outline-variant)] text-sm font-semibold text-[var(--color-on-surface)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                إعادة المحاولة
              </button>
            </div>
          )}

          {/* ═══ Moyasar Form ═══ */}
          {formEnabled && !detailsError && !formError && (
            <div
              ref={formRef}
              className={`moyasar-wrapper ${actuallyLoading || !formEnabled ? "invisible" : ""}`}
            />
          )}

          {/* Security */}
          <div className="flex items-center justify-center gap-2 text-xs text-[var(--color-on-surface-variant)] mt-5 pt-4 border-t border-[var(--color-outline-variant)]/40">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>دفع مشفّر وآمن عبر ميسّر </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ Loading Skeleton ═══
function CheckoutSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="h-3 w-24 bg-[var(--color-surface-container-low)] rounded" />
          <div className="h-12 bg-[var(--color-surface-container-low)] rounded-lg border border-[var(--color-outline-variant)]/30" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="h-3 w-20 bg-[var(--color-surface-container-low)] rounded" />
            <div className="h-12 bg-[var(--color-surface-container-low)] rounded-lg border border-[var(--color-outline-variant)]/30" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-16 bg-[var(--color-surface-container-low)] rounded" />
            <div className="h-12 bg-[var(--color-surface-container-low)] rounded-lg border border-[var(--color-outline-variant)]/30" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-3 w-32 bg-[var(--color-surface-container-low)] rounded" />
          <div className="h-12 bg-[var(--color-surface-container-low)] rounded-lg border border-[var(--color-outline-variant)]/30" />
        </div>

        <div className="h-12 bg-[var(--color-surface-container-low)] rounded-lg mt-4" />
      </div>

      <div className="flex items-center justify-center gap-2 py-2">
        <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
        <span className="text-xs text-[var(--color-on-surface-variant)]">
          جاري تحميل بوابة الدفع...
        </span>
      </div>
    </div>
  );
}
