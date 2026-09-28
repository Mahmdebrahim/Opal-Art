import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { AlertTriangle } from "lucide-react";
import { ordersService } from "../services/orders.service";
import { SharedModal, ModalActions } from "../../../components/SharedModal";

const CANCEL_REASONS = [
    "غيّرت رأيي",
    "وجدت سعر أفضل",
    "الطلب بالخطأ",
    "مدة التوصيل طويلة",
    "أخرى",
];

export default function CancelOrderModal({ orderId, isOpen, onClose }) {
    const queryClient = useQueryClient();
    const [selectedReason, setSelectedReason] = useState("");
    const [customReason, setCustomReason] = useState("");

    const cancelMutation = useMutation({
        mutationFn: () =>
            ordersService.cancelOrder(
                orderId,
                selectedReason === "أخرى" ? customReason : selectedReason,
            ),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["myOrders"] });
            queryClient.invalidateQueries({ queryKey: ["order", orderId] });

            const hasRefund = data?.refund;
            toast.success(
                hasRefund
                    ? "تم إلغاء الطلب وسيتم إرجاع المبلغ خلال 3-14 يوم عمل"
                    : "تم إلغاء الطلب بنجاح",
            );
            onClose();
        },
        onError: (error) => {
            toast.error(error?.message || "فشل إلغاء الطلب. حاول مرة أخرى.");
        },
    });

    const handleConfirm = () => {
        if (!selectedReason) {
            toast.error("يرجى اختيار سبب الإلغاء");
            return;
        }
        if (selectedReason === "أخرى" && !customReason.trim()) {
            toast.error("يرجى كتابة السبب");
            return;
        }
        cancelMutation.mutate();
    };

    return (
        <SharedModal
            open={isOpen}
            onClose={onClose}
            title="إلغاء الطلب"
            icon={AlertTriangle}
            iconColor="text-red-500"
            size="md"
        >
            {/* رسالة التأكيد */}
            <p className="text-sm font-body text-on-surface-variant leading-relaxed mb-5">
                هل أنت متأكد من إلغاء هذا الطلب؟
                {orderId && (
                    <span className="block mt-1 font-mono text-xs text-on-surface">
                        #{orderId.slice(-8).toUpperCase()}
                    </span>
                )}
            </p>

            {/* اختيار السبب */}
            <div className="space-y-2 mb-5">
                <label className="text-xs font-body font-semibold uppercase tracking-wide text-on-surface-variant">
                    سبب الإلغاء *
                </label>
                <div className="space-y-2">
                    {CANCEL_REASONS.map((reason) => (
                        <label
                            key={reason}
                            className={`flex items-center gap-3 p-3 border cursor-pointer transition-premium ${
                                selectedReason === reason
                                    ? "border-primary bg-primary/5"
                                    : "border-outline-variant/40 hover:border-outline-variant"
                            }`}
                        >
                            <input
                                type="radio"
                                name="cancelReason"
                                value={reason}
                                checked={selectedReason === reason}
                                onChange={(e) => setSelectedReason(e.target.value)}
                                className="accent-[var(--color-primary)]"
                            />
                            <span className="text-sm font-body text-on-surface">{reason}</span>
                        </label>
                    ))}
                </div>

                {/* سبب مخصص */}
                {selectedReason === "أخرى" && (
                    <textarea
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder="اكتب السبب هنا..."
                        rows={3}
                        className="w-full p-3 bg-surface-container-low border border-outline-variant/50 focus:border-primary focus:outline-none text-sm font-body resize-none"
                    />
                )}
            </div>

            {/* ملاحظة الاسترداد */}
            <div className="bg-amber-50 border border-amber-200 p-3 text-xs font-body text-amber-800 leading-relaxed mb-5">
                💡 إذا كان الطلب مدفوعاً، سيتم إرجاع المبلغ كاملاً إلى حسابك خلال 3-14 يوم عمل حسب البنك.
            </div>

            {/* الأزرار */}
            <ModalActions
                onClose={onClose}
                onConfirm={handleConfirm}
                confirmLabel="تأكيد الإلغاء"
                cancelLabel="تراجع"
                confirmVariant="danger"
                isLoading={cancelMutation.isPending}
            />
        </SharedModal>
    );
}