import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "../../../services/toast.service";
import { CheckCircle } from "lucide-react";
import { ordersService } from "../services/orders.service";
import { SharedModal, ModalActions } from "../../../components/SharedModal";

export default function ConfirmDeliveryModal({ orderId, isOpen, onClose }) {
  const queryClient = useQueryClient();

  const confirmMutation = useMutation({
    mutationFn: () => ordersService.confirmDelivery(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      toast.success("تم تأكيد الاستلام بنجاح! تم تحويل الأموال للفنان ");
      onClose();
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "فشل تأكيد الاستلام. حاول مرة أخرى.",
      );
    },
  });

  return (
    <SharedModal
      open={isOpen}
      onClose={onClose}
      title="تأكيد استلام الطلب"
      icon={CheckCircle}
      iconColor="text-emerald-600"
      size="md"
    >
      {/* رسالة التأكيد */}
      <p className="text-sm font-body text-on-surface-variant leading-relaxed mb-5">
        هل تأكدت من استلام اللوحة بحالة جيدة؟
        {orderId && (
          <span className="block mt-1 font-mono text-xs text-on-surface">
            #{orderId.slice(-8).toUpperCase()}
          </span>
        )}
      </p>

      {/* ملاحظات */}
      <div className="space-y-3 mb-5">
        <div className="bg-emerald-50 border border-emerald-200 p-3 text-xs font-body text-emerald-800 leading-relaxed">
          💡 بتأكيدك الاستلام سيتم تحويل المبلغ للفنان مباشرةً وإغلاق الطلب.
        </div>

        <div className="bg-amber-50 border border-amber-200 p-3 text-xs font-body text-amber-800 leading-relaxed">
          ⚠️ إذا كانت هناك مشكلة في الطلب (تلف، قطعة خاطئة...) لا تُؤكد الاستلام
          وتواصل مع الدعم أولاً.
        </div>
      </div>

      {/* الأزرار */}
      <ModalActions
        onClose={onClose}
        onConfirm={() => confirmMutation.mutate()}
        confirmLabel="تأكيد الاستلام"
        cancelLabel="تراجع"
        confirmVariant="success"
        isLoading={confirmMutation.isPending}
      />
    </SharedModal>
  );
}
