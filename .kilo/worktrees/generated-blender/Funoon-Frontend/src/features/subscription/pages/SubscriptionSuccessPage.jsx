import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../auth/stores/authStore";
import {
  CheckCircle2,
  XCircle,
  Crown,
  Palette,
  LayoutDashboard,
  RefreshCw,
  Clock,
  WifiOff,
} from "lucide-react";
import { subscriptionsService } from "../services/subscriptions.service";
import Button from "../../../components/Ui/Button";

const ACTIVATION_TIMEOUT_MS = 30000;

export default function SubscriptionSuccessPage() {
  const [searchParams] = useSearchParams();
  const status = (searchParams.get("status") || "").toLowerCase();
  const planIdFromUrl = searchParams.get("plan"); // ✅ الباقة اللي المستخدم دفع فيها

  const isPaid = status === "paid";
  const isFailed = [
    "failed",
    "declined",
    "canceled",
    "cancelled",
    "expired",
  ].includes(status);
  const isUnknown = !isPaid && !isFailed;

  const refreshUser = useAuthStore((s) => s.refreshUser);
  const authUserRole = useAuthStore((s) => s.user?.role);

  const [timedOut, setTimedOut] = useState(false);

  const {
    data: subscription,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["mySubscription"],
    queryFn: subscriptionsService.getMySubscription,
    enabled: isPaid || isUnknown,
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: (query) => {
      if (timedOut) return false;
      if (!isPaid) return 2000; // في حالة unknown: فضل نجرب

      const d = query.state.data;
      // ✅ الباقة في السيرفر فعلاً هي اللي المستخدم دفع فيها + نشطة
      const isCorrectPlan = !planIdFromUrl || d?.plan === planIdFromUrl;
      const isActive = !!d?.isActive;

      if (isActive && isCorrectPlan) return false; // ✅ وصلنا — وقّف
      return 2000;
    },
  });

  // ✅ التفعيل = نشط + الباقة الصح
  const isCorrectPlan = !planIdFromUrl || subscription?.plan === planIdFromUrl;
  const isActivated = !!subscription?.isActive && isCorrectPlan;

  // ✅ timeout بيقف تلقائياً لو التفعيل خلص
  useEffect(() => {
    if (!isPaid || isActivated) return;
    const timer = setTimeout(() => setTimedOut(true), ACTIVATION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isPaid, isActivated]);

  useEffect(() => {
    if (isActivated && authUserRole !== "artist") {
      refreshUser?.();
    }
  }, [isActivated, authUserRole, refreshUser]);

  return (
    <div
      className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-[var(--color-surface)] font-body"
      dir="rtl"
    >
      <div className="max-w-md w-full p-8 text-center space-y-6">
        {/* ═══ حالة النجاح + التفعيل ═══ */}
        {isActivated && !isFailed && (
          <>
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-12 h-12" strokeWidth={1.5} />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-display text-[var(--color-on-surface)]">
                مبروك، أنت الآن فنان!
              </h2>
              <p className="text-[var(--color-on-surface-variant)] text-sm leading-relaxed">
                . يمكنك الآن رفع لوحاتك وبدء البيع.
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <Link to="/dashboard">
                <Button variant="primary" fullWidth icon={LayoutDashboard}>
                  لوحة تحكم الفنان
                </Button>
              </Link>
              <Link to="/dashboard/artworks/new">
                <Button variant="outline" fullWidth icon={Palette}>
                  ارفع أول لوحة
                </Button>
              </Link>
            </div>
          </>
        )}

        {/* ═══ حالة جاري التفعيل — Sonar Medallion + Timeline ═══ */}
        {isPaid && !isActivated && !timedOut && (
          <>
            {/* ✅ Sonar Medallion */}
            <div className="flex justify-center py-1">
              <div className="relative w-24 h-24">
                <span className="absolute inset-0 rounded-full bg-[var(--color-primary)]/10 animate-ping [animation-duration:2.4s]" />
                <span className="absolute inset-2 rounded-full bg-[var(--color-primary)]/10 animate-ping [animation-duration:2.4s] [animation-delay:0.6s]" />
                <div className="absolute inset-3 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 flex items-center justify-center text-[var(--color-primary)]">
                  <Crown className="w-9 h-9" strokeWidth={1.5} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-display text-[var(--color-on-surface)]">
                تم الدفع بنجاح!
              </h2>
              <p className="text-[var(--color-on-surface-variant)] text-sm leading-relaxed">
                جاري تفعيل اشتراكك... لحظات وسيتم تحويل حسابك لحساب فنان.
              </p>
            </div>

            <ActivationSteps />

            {isError && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-[11px] text-amber-600 flex items-center gap-1.5">
                  <WifiOff className="w-3.5 h-3.5" />
                  اتصال متقطع — بنحاول تلقائياً كل ثانيتين
                </p>
                <button
                  onClick={() => refetch()}
                  className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  تحديث يدوي الآن
                </button>
              </div>
            )}

            <p className="text-[10px] text-[var(--color-on-surface-variant)]/60">
              عادةً تستغرق العملية من 5 إلى 30 ثانية
            </p>
          </>
        )}

        {/* ═══ حالة timeout ═══ */}
        {isPaid && !isActivated && timedOut && (
          <>
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
                <Crown className="w-12 h-12" strokeWidth={1.5} />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-display text-[var(--color-on-surface)]">
                تم الدفع بنجاح!
              </h2>
              <p className="text-[var(--color-on-surface-variant)] text-sm leading-relaxed">
                التفعيل بياخد وقت بسيط. هتلاقي اشتراكك مفعّل في البروفايل خلال
                لحظات. لو ما ظهرش، تواصل مع الدعم.
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <Link to="/profile">
                <Button variant="primary" fullWidth icon={LayoutDashboard}>
                  الذهاب للبروفايل
                </Button>
              </Link>
            </div>
          </>
        )}

        {/* ═══ حالة الفشل ═══ */}
        {isFailed && (
          <>
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-600">
                <XCircle className="w-12 h-12" strokeWidth={1.5} />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-display text-[var(--color-on-surface)]">
                لم تتم عملية الدفع
              </h2>
              <p className="text-[var(--color-on-surface-variant)] text-sm leading-relaxed">
                تم رفض أو إلغاء العملية. لم يتم خصم أي مبلغ. يمكنك المحاولة مرة
                أخرى في أي وقت.
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <Link to="/subscription">
                <Button variant="primary" fullWidth icon={RefreshCw}>
                  حاول مرة أخرى
                </Button>
              </Link>
            </div>
          </>
        )}

        {/* ═══ حالة غير معروفة ═══ */}
        {isUnknown && !isActivated && (
          <>
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
                <Clock className="w-12 h-12" strokeWidth={1.5} />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-display text-[var(--color-on-surface)]">
                حالة الدفع غير محددة
              </h2>
              <p className="text-[var(--color-on-surface-variant)] text-sm leading-relaxed">
                لو كنت لسه مخلص عملية الدفع، اشتراكك هيظهر في البروفايل خلال
                لحظات. لو مظهرش خلال نص ساعة، تواصل مع الدعم.
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <Link to="/profile">
                <Button variant="primary" fullWidth icon={LayoutDashboard}>
                  الذهاب للبروفايل
                </Button>
              </Link>
              <Link to="/subscription">
                <Button variant="outline" fullWidth icon={RefreshCw}>
                  الرجوع للباقات
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ✅ Vertical Timeline — خطوات التفعيل
// ═══════════════════════════════════════════════════
function ActivationSteps() {
  return (
    <div className="mx-auto max-w-[260px] pt-2 text-right">
      {/* ─── خطوة 1: تمت ─── */}
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center">
          <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="w-px h-6 my-1 bg-emerald-500/40" />
        </div>
        <div className="pt-1 pb-2">
          <p className="text-xs font-semibold text-[var(--color-on-surface)]">
            تم استلام الدفع بنجاح
          </p>
          <p className="text-[10px] text-emerald-600 mt-0.5">
            تم التحقق من العملية مع البنك
          </p>
        </div>
      </div>

      {/* ─── خطوة 2: نشطة ─── */}
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center">
          <div className="relative w-7 h-7 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/40 flex items-center justify-center shrink-0">
            <span className="absolute inset-0 rounded-full bg-[var(--color-primary)]/20 animate-ping [animation-duration:1.8s]" />
            <span className="relative w-2 h-2 rounded-full bg-[var(--color-primary)]" />
          </div>
          <div className="w-px h-6 my-1 relative overflow-hidden bg-[var(--color-outline-variant)]/30">
            <span className="absolute top-0 left-0 w-full h-1/2 bg-[var(--color-primary)] animate-[connectorFlow_1.8s_ease-in-out_infinite]" />
          </div>
        </div>
        <div className="pt-1 pb-2">
          <p className="text-xs font-semibold text-[var(--color-on-surface)]">
            جاري تفعيل الاشتراك
          </p>
          <p className="text-[10px] text-[var(--color-on-surface-variant)] mt-0.5">
            بنربط الباقة بحسابك دلوقتي
          </p>
        </div>
      </div>

      {/* ─── خطوة 3: منتظرة ─── */}
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/40 text-[var(--color-on-surface-variant)]/50 flex items-center justify-center shrink-0">
          <Palette className="w-4 h-4" />
        </div>
        <div className="pt-1">
          <p className="text-xs font-medium text-[var(--color-on-surface-variant)]/70">
            تحويل الحساب لحساب فنان
          </p>
          <p className="text-[10px] text-[var(--color-on-surface-variant)]/50 mt-0.5">
            تقدر ترفع لوحاتك وتبدأ البيع
          </p>
        </div>
      </div>
    </div>
  );
}