import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useCartStore } from "../stores/cartStore";
import {
  useAddress,
  useUpdateAddress,
  useLookupAddress,
} from "../../profile/hooks/useProfile";
import { ordersService } from "../../orders/services/orders.service";
import { useAuthStore } from "../../auth/stores/authStore";
import { ROUTES } from "../../../config/routes";
import Button from "../../../components/Ui/Button";
import EmptyState from "../../../components/Ui/EmptyState";
import {
  Trash2,
  ShoppingBag,
  MapPin,
  CreditCard,
  Truck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  Edit3,
  Calendar,
  ShieldCheck,
  Lock,
  RefreshCw,
  Info,
  Search,
  Save,
} from "lucide-react";
import toast from "../../../services/toast.service";
import { getMediaUrl } from "../../../utils/media";

// ═══════════════════════════════════════════════════
// Cart Skeleton — بيعكس شكل الصفحة الحقيقي
// ═══════════════════════════════════════════════════
function CartSkeleton() {
  return (
    <div className="py-10 lg:py-14 px-4 max-w-7xl mx-auto animate-pulse">
      {/* Step Indicator Skeleton */}
      <div className="flex items-center justify-center mb-10 max-w-sm mx-auto">
        <div className="w-9 h-9 rounded-full bg-[var(--color-surface-container)]" />
        <div className="flex-1 h-px mx-3 bg-[var(--color-surface-container)]" />
        <div className="w-9 h-9 rounded-full bg-[var(--color-surface-container)]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Column Skeleton */}
        <div className="lg:col-span-8 space-y-6">
          {/* Items Card */}
          <div className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/60 p-6">
            <div className="h-5 w-40 bg-[var(--color-surface-container)] rounded mb-5 pb-4 border-b border-[var(--color-outline-variant)]/30" />
            <div className="divide-y divide-[var(--color-outline-variant)]/20">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="py-5 flex gap-4 items-center">
                  <div className="w-20 h-24 bg-[var(--color-surface-container)] rounded shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-[var(--color-surface-container)] rounded" />
                    <div className="h-3 w-1/2 bg-[var(--color-surface-container)] rounded" />
                    <div className="h-3 w-1/3 bg-[var(--color-surface-container)] rounded" />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="h-5 w-20 bg-[var(--color-surface-container)] rounded" />
                    <div className="w-5 h-5 bg-[var(--color-surface-container)] rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Address Card */}
          <div className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/60 p-6">
            <div className="h-5 w-32 bg-[var(--color-surface-container)] rounded mb-5 pb-4 border-b border-[var(--color-outline-variant)]/30" />
            <div className="space-y-3">
              <div className="h-12 bg-[var(--color-surface-container)] rounded" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-10 bg-[var(--color-surface-container)] rounded" />
                <div className="h-10 bg-[var(--color-surface-container)] rounded" />
                <div className="h-10 bg-[var(--color-surface-container)] rounded" />
                <div className="h-10 bg-[var(--color-surface-container)] rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Skeleton */}
        <div className="lg:col-span-4">
          <div className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/60 p-6 sticky top-24 space-y-4">
            <div className="h-6 w-32 bg-[var(--color-surface-container)] rounded pb-4 border-b border-[var(--color-outline-variant)]/30" />
            <div className="space-y-3">
              <div className="flex justify-between">
                <div className="h-4 w-20 bg-[var(--color-surface-container)] rounded" />
                <div className="h-4 w-16 bg-[var(--color-surface-container)] rounded" />
              </div>
              <div className="flex justify-between">
                <div className="h-4 w-24 bg-[var(--color-surface-container)] rounded" />
                <div className="h-4 w-16 bg-[var(--color-surface-container)] rounded" />
              </div>
              <div className="border-t border-[var(--color-outline-variant)]/30 pt-3 flex justify-between">
                <div className="h-5 w-16 bg-[var(--color-surface-container)] rounded" />
                <div className="h-5 w-20 bg-[var(--color-surface-container)] rounded" />
              </div>
            </div>
            <div className="h-11 w-full bg-[var(--color-surface-container)] rounded mt-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════
export default function CartPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Cart Store
  const items = useCartStore((s) => s.items);
  const summary = useCartStore((s) => s.summary);
  const isCartLoading = useCartStore((s) => s.isLoading);
  const fetchCart = useCartStore((s) => s.fetchCart);
  const artist = useCartStore((s) => s.artist);
  const removeItem = useCartStore((s) => s.removeItem);

  // Address
  const {
    data: savedAddress,
    isLoading: isAddressLoading,
    refetch: refetchAddress,
  } = useAddress();
  const updateAddressMutation = useUpdateAddress();
  const lookupMutation = useLookupAddress();

  // Local State
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    city: "",
    district: "",
    street: "",
    buildingNo: "",
    zipCode: "",
    shortAddressCode: "",
    country: "SA",
    secondaryAddressNumber: "",
    lat: "",
    lon: "",
  });
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutData, setCheckoutData] = useState(null);
  const [step, setStep] = useState(1);
  const [isPaymentStatusChecking, setIsPaymentStatusChecking] = useState(false);
  const [paymentStatusCheckError, setPaymentStatusCheckError] = useState(false);
  const [paymentFormVersion, setPaymentFormVersion] = useState(0);

  // Moyasar states
  const [moyasarLoading, setMoyasarLoading] = useState(true);
  const [moyasarError, setMoyasarError] = useState(false);
  const observerRef = useRef(null);
  const moyasarContainerRef = useRef(null);

  const revalidatePaymentInvoice = useCallback(async () => {
    if (!checkoutData?.invoiceId) return;

    setIsPaymentStatusChecking(true);
    setPaymentStatusCheckError(false);
    try {
      const invoice = await ordersService.getCheckoutInvoiceStatus(
        checkoutData.invoiceId,
      );
      if (["initiated", "pending"].includes(invoice.status)) {
        setIsPaymentStatusChecking(false);
        setPaymentFormVersion((version) => version + 1);
        return;
      }

      const params = new URLSearchParams({
        id: checkoutData.invoiceId,
        status: invoice.status || "unknown",
      });
      window.location.assign(`${ROUTES.PAYMENT_SUCCESS}?${params}`);
    } catch {
      setIsPaymentStatusChecking(false);
      setPaymentStatusCheckError(true);
    }
  }, [checkoutData?.invoiceId]);

  // Sync address
  useEffect(() => {
    if (savedAddress) {
      setAddressForm({
        city: savedAddress.city || "",
        district: savedAddress.district || "",
        street: savedAddress.street || "",
        buildingNo: savedAddress.buildingNo || "",
        zipCode: savedAddress.zipCode || "",
        shortAddressCode: savedAddress.shortAddressCode || "",
        secondaryAddressNumber: savedAddress.secondaryAddressNumber || "",
        lat: savedAddress.lat || "",
        lon: savedAddress.lon || "",
        country: savedAddress.country || "SA",
      });
      setIsEditingAddress(
        !(savedAddress.city && savedAddress.street && savedAddress.district),
      );
    } else {
      setIsEditingAddress(true);
    }
  }, [savedAddress]);

  // Moyasar Init
  useEffect(() => {
    if (step !== 2 || !checkoutData?.invoiceId || isPaymentStatusChecking)
      return;

    let cancelled = false;

    const initMoyasar = () => {
      if (cancelled) return;
      const container = moyasarContainerRef.current;
      if (!container || !window.Moyasar) {
        setTimeout(initMoyasar, 100);
        return;
      }

      container.innerHTML = "";
      setMoyasarLoading(true);

      const observer = new MutationObserver(() => {
        const hasForm =
          container.querySelector("form") ||
          container.querySelector("input") ||
          container.querySelector(".mysr-form");
        if (hasForm && !cancelled) {
          setMoyasarLoading(false);
          observer.disconnect();
        }
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
      });

      try {
        window.Moyasar.init({
          element: container,
          amount: Math.round(checkoutData.grandTotal * 100),
          currency: "SAR",
          description: "طلب شراء لوحات فنية - منصة فنون",
          publishable_api_key: import.meta.env.VITE_MOYASAR_PUBLISHABLE_KEY,
          callback_url: `${window.location.origin}/payment/success`,
          invoice_id: checkoutData.invoiceId,
          methods: ["creditcard"],
        });
      } catch (err) {
        observer.disconnect();
        if (!cancelled) {
          setMoyasarError(true);
          setMoyasarLoading(false);
        }
      }

      setTimeout(() => {
        if (!cancelled) {
          observer.disconnect();
          setMoyasarLoading(false);
        }
      }, 5000);

      return () => observer.disconnect();
    };

    if (!document.getElementById("moyasar-css")) {
      const link = document.createElement("link");
      link.id = "moyasar-css";
      link.rel = "stylesheet";
      link.href = "https://cdn.moyasar.com/mpf/1.12.0/moyasar.css";
      document.head.appendChild(link);
    }

    if (!window.Moyasar) {
      const script = document.createElement("script");
      script.src = "https://cdn.moyasar.com/mpf/1.12.0/moyasar.js";
      script.async = true;
      script.onload = () => {
        if (!cancelled) requestAnimationFrame(initMoyasar);
      };
      script.onerror = () => {
        if (!cancelled) {
          setMoyasarError(true);
          setMoyasarLoading(false);
        }
      };
      document.body.appendChild(script);
    } else {
      requestAnimationFrame(initMoyasar);
    }

    return () => {
      cancelled = true;
    };
  }, [
    step,
    checkoutData?.invoiceId,
    isPaymentStatusChecking,
    paymentFormVersion,
  ]);

  useEffect(() => {
    if (step !== 2 || !checkoutData?.invoiceId) return;

    const handlePageHide = () => {
      setIsPaymentStatusChecking(true);
      if (moyasarContainerRef.current) {
        moyasarContainerRef.current.replaceChildren();
      }
    };

    const handlePageShow = (event) => {
      if (event.persisted) revalidatePaymentInvoice();
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [step, checkoutData?.invoiceId, revalidatePaymentInvoice]);

  // Handlers
  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setAddressForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLookup = async () => {
    const code = (addressForm.shortAddressCode || "").trim();
    if (!code) {
      toast.error("أدخل رمز العنوان المختصر أولاً");
      return;
    }
    if (!/^[A-Za-z0-9]{6,10}$/.test(code)) {
      toast.error("صيغة الرمز غير صحيحة (مثال: RRRD2929)");
      return;
    }
    try {
      await lookupMutation.mutateAsync(code.toUpperCase());
    } catch {
      /* toast from hook */
    }
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (!addressForm.city || !addressForm.district || !addressForm.street) {
      toast.error("يرجى ملء الحقول الأساسية: المدينة، الحي، والشارع");
      return;
    }
    try {
      await updateAddressMutation.mutateAsync(addressForm);
      setIsEditingAddress(false);
      refetchAddress();
    } catch (error) {
      console.error("Address save error:", error);
    }
  };

  const handleProceedToPayment = async () => {
    const address = savedAddress || addressForm;
    if (!address?.city || !address?.district || !address?.street) {
      toast.error("يرجى ملء وتأكيد عنوان الشحن أولاً");
      setIsEditingAddress(true);
      return;
    }
    setIsCheckoutLoading(true);
    try {
      const response = await ordersService.checkout("creditcard");
      if (response) {
        setCheckoutData(response);
        setPaymentStatusCheckError(false);
        setStep(2);
      }
    } catch (error) {
      toast.error(error?.message || "فشل إتمام عملية الطلب");
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const handleBackToCart = () => {
    setStep(1);
    setCheckoutData(null);
    setMoyasarLoading(true);
    setMoyasarError(false);
  };

  const handleRetryMoyasar = () => {
    setMoyasarError(false);
    setMoyasarLoading(true);
    setCheckoutData((prev) => ({ ...prev }));
  };

  const handleRemoveItem = async (artworkId) => {
    try {
      await removeItem(artworkId);
      toast.success("تم الحذف من السلة");
    } catch (error) {
      toast.error(error?.message || "فشل حذف اللوحة");
    }
  };

  // ═══════════════════════════════════════════════════
  // Guards & Loading
  // ═══════════════════════════════════════════════════
  if (!isAuthenticated) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="سلتك بانتظارك"
        description="يرجى تسجيل الدخول لتتمكن من استعراض السلة وإتمام عملية الشراء."
        actionLabel="تسجيل الدخول"
        actionTo={ROUTES.LOGIN + `?redirect=${ROUTES.CART}`}
      />
    );
  }

  // Skeleton احترافي بدل الـ spinner القديم
  if (isCartLoading || isAddressLoading) {
    return <CartSkeleton />;
  }

  // ✅ Empty State موحد
  if (items.length === 0 && step === 1) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="سلة المشتريات فارغة"
        description="لم تقم بإضافة أي لوحات فنية بعد. تصفح المعرض واكتشف الفن السعودي المعاصر."
        actionLabel="تصفح اللوحات الفنية"
        actionTo={ROUTES.ARTWORKS}
      />
    );
  }

  const subtotal = summary.subtotal || 0;
  const actualShippingCost = checkoutData
    ? checkoutData.grandTotal - subtotal
    : 0;
  const totalAmount = checkoutData ? checkoutData.grandTotal : subtotal;
  const hasValidAddress =
    savedAddress?.city && savedAddress?.street && savedAddress?.district;

  return (
    <div className="max-w-[1280px] mx-auto px-5 lg:px-16 py-10 lg:py-14 ">
      {/* Step Indicator */}
      <div className="flex items-center justify-center mb-10 max-w-sm mx-auto">
        <StepDot number={1} label="مراجعة السلة" active={step >= 1} />
        <div
          className={`flex-1 h-px mb-5 mx-3 transition-colors ${step === 2 ? "bg-[var(--color-primary)]" : "bg-stone-200"}`}
        />
        <StepDot number={2} label="الدفع" active={step === 2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Column */}
        <div className="lg:col-span-8 space-y-6">
          {step === 1 && (
            <SectionCard title={`اللوحات المختارة (${items.length})`}>
              <div className="divide-y divide-stone-100">
                {items.map((item) => (
                  <div
                    key={item.artwork._id}
                    className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center"
                  >
                    <div className="flex gap-4 items-center">
                      <img
                        src={getMediaUrl(item.artwork.coverImage)}
                        alt={item.artwork.title}
                        crossOrigin="anonymous"
                        className="w-20 h-24 object-cover border border-stone-100"
                        onError={(e) => {
                          e.target.src = "/src/assets/funoon_logo_gold.png";
                        }}
                      />
                      <div>
                        <h3 className="font-semibold text-stone-800 text-base">
                          {item.artwork.title}
                        </h3>
                        <p className="text-xs text-[var(--color-secondary)] mt-1">
                          بواسطة: {item.artist.name}
                        </p>
                        {item.artwork.dimensions && (
                          <p className="text-xs text-stone-400 mt-1">
                            {item.artwork.dimensions.width} ×{" "}
                            {item.artwork.dimensions.height} سم
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex sm:flex-col justify-between sm:justify-end items-center sm:items-end w-full sm:w-auto gap-4">
                      <span className="font-display font-semibold text-lg text-[var(--color-primary)]">
                        {item.artwork.price.toLocaleString()} ر.س
                      </span>
                      {!isCheckoutLoading && (
                        <button
                          onClick={() => handleRemoveItem(item.artwork._id)}
                          className="text-stone-400 hover:text-red-600 transition-colors p-1"
                          title="حذف من السلة"
                        >
                          <Trash2 className="w-5 h-5" strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* ✅ NEW: Single-artist banner */}
              {items.length > 0 && artist && (
                <div className="mt-5 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800 leading-relaxed">
                      <strong>ملاحظة:</strong> سلتك تحتوي على أعمال من{" "}
                      <strong>{artist.name}</strong>. لإضافة أعمال من فنان آخر،
                      يرجى إتمام الشراء الحالي أولاً ثم العودة لإضافة لوحات
                      جديدة.
                    </p>
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {step === 2 && (
            <>
              <button
                onClick={handleBackToCart}
                className="flex items-center gap-2 text-stone-500 hover:text-[var(--color-primary)] transition-colors text-sm font-medium"
              >
                <ChevronLeft className="w-4 h-4 rotate-180" />
                <span>الرجوع لتعديل السلة</span>
              </button>

              <SectionCard title="تفاصيل الشحن">
                <div className="space-y-3">
                  {checkoutData?.orders.map((order, idx) => (
                    <div
                      key={order._id || idx}
                      className="bg-stone-50 p-4 border border-stone-100 flex items-start gap-4"
                    >
                      <div className="w-10 h-10 rounded-full bg-white border border-stone-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {order.shipping?.logo ? (
                          <img
                            src={order.shipping.logo}
                            alt=""
                            crossOrigin="anonymous"
                            className="w-7 h-7 object-contain"
                          />
                        ) : (
                          <Truck className="w-5 h-5 text-[var(--color-primary)]" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-stone-800 text-sm">
                          {order.shipping?.deliveryCompanyName ||
                            "شركة شحن وطنية"}
                        </p>
                        <p className="text-xs text-stone-500">
                          {order.shipping?.deliveryOptionName || "توصيل للباب"}
                        </p>
                        {order.shipping?.estimatedDeliveryDate && (
                          <p className="text-xs text-[var(--color-secondary)] font-medium flex items-center gap-1 mt-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                              التوصيل المتوقع:{" "}
                              {new Date(
                                order.shipping.estimatedDeliveryDate,
                              ).toLocaleDateString("ar-SA", {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                              })}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}

          {/* Address Section */}
          <SectionCard
            title="عنوان التوصيل"
            icon={<MapPin className="w-5 h-5 text-[var(--color-secondary)]" />}
            action={
              hasValidAddress &&
              !isEditingAddress &&
              !isCheckoutLoading &&
              step === 1 ? (
                <button
                  onClick={() => setIsEditingAddress(true)}
                  className="text-xs font-semibold text-[var(--color-secondary)] flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>تعديل</span>
                </button>
              ) : null
            }
          >
            {isEditingAddress ? (
              <form onSubmit={handleSaveAddress} className="space-y-4">
                <p className="text-xs text-stone-400">
                  أدخل رمز العنوان المختصر لتعبئة البيانات تلقائياً بدقة، أو
                  املأ الحقول يدوياً.
                </p>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[11px] uppercase font-semibold text-stone-500 tracking-wide">
                    <span>رمز العنوان المختصر</span>
                    <InfoTip hint="رمز العنوان الوطني المختصر (مثال: RRRD2929) — 4 أحرف تليها 4 أرقام. تجده في تطبيق «توكلنا» أو موقع العنوان الوطني." />
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="shortAddressCode"
                      value={addressForm.shortAddressCode}
                      onChange={handleAddressChange}
                      placeholder="RRRD2929"
                      dir="ltr"
                      className="flex-1 p-3 bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/50 focus:border-[var(--color-primary)] focus:outline-none transition-colors text-sm uppercase tracking-wider text-left"
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleLookup}
                      isLoading={lookupMutation.isPending}
                      icon={Search}
                    >
                      تحقق
                    </Button>
                  </div>
                  <a
                    href="https://accounts.splonline.com.sa/ar/Registration"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors"
                  >
                    كيف أحصل على الرمز؟ ↗
                  </a>
                </div>

                <div className="flex items-center gap-3 text-xs text-stone-400">
                  <span className="flex-1 h-px bg-stone-200" />
                  <span>أو أدخل العنوان يدوياً</span>
                  <span className="flex-1 h-px bg-stone-200" />
                </div>

                <div className="relative">
                  {lookupMutation.isPending && (
                    <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-sm">
                      <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)] mb-2" />
                      <span className="text-xs text-stone-500">
                        جاري جلب تفاصيل العنوان...
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AddressInput
                      label="المدينة *"
                      name="city"
                      value={addressForm.city}
                      onChange={handleAddressChange}
                      required
                      placeholder="الرياض"
                    />
                    <AddressInput
                      label="الحي *"
                      name="district"
                      value={addressForm.district}
                      onChange={handleAddressChange}
                      required
                      placeholder="حي الياسمين"
                    />
                    <AddressInput
                      label="الشارع *"
                      name="street"
                      value={addressForm.street}
                      onChange={handleAddressChange}
                      required
                      placeholder="طريق الملك فهد"
                    />
                    <AddressInput
                      label="رقم المبنى"
                      name="buildingNo"
                      value={addressForm.buildingNo}
                      onChange={handleAddressChange}
                      placeholder="1243"
                    />
                    <AddressInput
                      label="الرمز البريدي"
                      name="zipCode"
                      value={addressForm.zipCode}
                      onChange={handleAddressChange}
                      placeholder="11564"
                    />
                    <AddressInput
                      label="رقم الوحدة / الإضافي"
                      name="secondaryAddressNumber"
                      value={addressForm.secondaryAddressNumber}
                      onChange={handleAddressChange}
                      placeholder="4593"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={updateAddressMutation.isPending}
                    icon={Save}
                  >
                    حفظ العنوان
                  </Button>
                  {hasValidAddress && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingAddress(false)}
                    >
                      إلغاء
                    </Button>
                  )}
                </div>
              </form>
            ) : (
              <>
                <div className="bg-stone-50 p-4 border border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm text-stone-700">
                      {savedAddress.buildingNo &&
                        `مبنى ${savedAddress.buildingNo}، `}
                      {savedAddress.street}، {savedAddress.district}،{" "}
                      {savedAddress.city}
                    </p>
                    {savedAddress.zipCode && (
                      <p className="text-xs text-stone-400">
                        الرمز البريدي: {savedAddress.zipCode}
                      </p>
                    )}
                    {savedAddress.shortAddressCode && (
                      <p className="text-xs text-stone-400">
                        الرمز المختصر: {savedAddress.shortAddressCode}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full self-start font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>جاهز للتوصيل</span>
                  </div>
                </div>

                {lookupMutation.data?.formattedFullAddress && (
                  <div className="mt-3 flex items-start gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      تم التحقق: {lookupMutation.data.formattedFullAddress}
                    </span>
                  </div>
                )}
              </>
            )}
          </SectionCard>

          {/* Payment Form */}
          {step === 2 && (
            <SectionCard
              title="بيانات البطاقة الائتمانية"
              icon={<Lock className="w-5 h-5 text-[var(--color-secondary)]" />}
            >
              {isPaymentStatusChecking && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-stone-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جارٍ التحقق من حالة الدفع...</span>
                </div>
              )}

              {paymentStatusCheckError && !isPaymentStatusChecking && (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <AlertCircle className="w-8 h-8 text-amber-600" />
                  <p className="text-sm text-stone-600">
                    تعذّر التحقق من حالة الفاتورة. أعد المحاولة قبل إدخال بيانات
                    الدفع.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={revalidatePaymentInvoice}
                    icon={RefreshCw}
                  >
                    إعادة التحقق
                  </Button>
                </div>
              )}

              {!isPaymentStatusChecking && !paymentStatusCheckError && (
                <>
                  {moyasarLoading && !moyasarError && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)] mb-3" />
                      <span className="text-xs text-stone-400">
                        جاري تحميل بوابة الدفع الآمنة...
                      </span>
                    </div>
                  )}

                  {moyasarError && (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-3">
                        <AlertCircle
                          className="w-7 h-7 text-red-500"
                          strokeWidth={1.5}
                        />
                      </div>
                      <p className="text-sm text-stone-700 font-medium mb-1">
                        تعذّر تحميل بوابة الدفع
                      </p>
                      <p className="text-xs text-stone-400 mb-4">
                        تحقق من اتصالك بالإنترنت وحاول مرة أخرى
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRetryMoyasar}
                        icon={RefreshCw}
                      >
                        إعادة المحاولة
                      </Button>
                    </div>
                  )}

                  <div
                    ref={moyasarContainerRef}
                    id="moyasar-payment-form"
                    className="moyasar-wrapper"
                  />

                  <div className="flex items-center justify-center gap-2 text-stone-400 text-xs mt-5 pt-4 border-t border-stone-100">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>دفع مشفّر وآمن عبر ميسّر ومدى</span>
                  </div>
                </>
              )}
            </SectionCard>
          )}
        </div>

        {/* Sidebar: Order Summary */}
        <div className="lg:col-span-4">
          <div className="bg-[var(--color-surface-container-lowest)] rounded-lg p-6 sticky top-24 space-y-5">
            <h2 className="text-lg font-display text-[var(--color-primary)] flex items-center gap-2 pb-4 border-b border-stone-100">
              <ShieldCheck className="w-5 h-5 text-[var(--color-secondary)]" />
              <span>ملخص الطلب</span>
            </h2>

            <div className="space-y-3 text-sm font-body">
              <div className="flex justify-between text-stone-600">
                <span>سعر اللوحات</span>
                <span className="font-semibold text-stone-800">
                  {subtotal.toLocaleString()} ر.س
                </span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>الشحن والتوصيل</span>
                <span className="font-semibold text-stone-800">
                  {checkoutData
                    ? `${actualShippingCost.toLocaleString()} ر.س`
                    : "يُحسب عند تأكيد الطلب"}
                </span>
              </div>
              <div className="border-t border-stone-100 pt-3 flex justify-between text-base font-bold text-[var(--color-primary)]">
                <span>الإجمالي</span>
                <span>{totalAmount.toLocaleString()} ر.س</span>
              </div>
            </div>

            {step === 1 && (
              <div className="space-y-3 pt-2">
                <Button
                  onClick={handleProceedToPayment}
                  variant="primary"
                  fullWidth
                  isLoading={isCheckoutLoading}
                  disabled={
                    isEditingAddress || !hasValidAddress || isCheckoutLoading
                  }
                  icon={CreditCard}
                >
                  {isCheckoutLoading ? "جاري التحميل..." : "تأكيد الطلب والدفع"}
                </Button>
                {(!hasValidAddress || isEditingAddress) && (
                  <p className="text-xs text-red-600 text-center font-medium flex items-center justify-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>يرجى تأكيد العنوان أولاً</span>
                  </p>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="bg-[var(--color-surface-container-low)] p-3 text-xs text-stone-600 leading-relaxed flex gap-2">
                <CreditCard className="w-4 h-4 text-[var(--color-secondary)] shrink-0 mt-0.5" />
                <span>
                  أدخل بيانات بطاقتك في النموذج ثم اضغط زر الدفع لإتمام العملية.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════
function StepDot({ number, label, active }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center border-2 text-sm font-semibold transition-colors ${
          active
            ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
            : "border-stone-300 bg-white text-stone-400"
        }`}
      >
        {number}
      </div>
      <span
        className={`text-[11px] mt-1.5 font-medium ${active ? "text-[var(--color-primary)]" : "text-stone-400"}`}
      >
        {label}
      </span>
    </div>
  );
}

function SectionCard({ title, icon, action, children }) {
  return (
    <div className="bg-[var(--color-surface-container-lowest)] rounded-lg p-6">
      <div className="flex justify-between items-center mb-5 pb-4 border-b border-stone-100">
        <h2 className="text-lg font-display text-[var(--color-primary)] flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function AddressInput({ label, name, value, onChange, required, placeholder }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] uppercase font-semibold text-stone-500 tracking-wide">
        {label}
      </label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="w-full p-3 bg-[var(--color-surface-container-low)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none transition-colors text-sm"
      />
    </div>
  );
}

function InfoTip({ hint }) {
  return (
    <span className="group/tip relative inline-flex items-center">
      <Info
        className="w-3.5 h-3.5 text-stone-400 cursor-help hover:text-[var(--color-primary)] transition-colors"
        strokeWidth={1.5}
      />
      <span className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 z-30 w-72 rounded-md bg-stone-800 px-3 py-2.5 text-[11px] font-normal normal-case tracking-normal text-white leading-relaxed text-right opacity-0 shadow-xl transition-opacity duration-200 group-hover/tip:opacity-100">
        {hint}
      </span>
    </span>
  );
}
