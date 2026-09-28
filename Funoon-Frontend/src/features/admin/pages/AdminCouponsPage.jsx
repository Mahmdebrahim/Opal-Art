import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Power, TicketPercent } from "lucide-react";
import toast from "../../../services/toast.service";
import { adminService } from "../services/admin.service";

const localDateTime = (date) => {
  if (!date) return "";
  const value = new Date(date);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
};

const emptyForm = () => ({
  code: "",
  discountPercent: "",
  maxRedemptions: "",
  startsAt: localDateTime(new Date()),
  expiresAt: "",
  isActive: true,
});

export default function AdminCouponsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const { data, isLoading } = useQuery({
    queryKey: ["adminCoupons"],
    queryFn: () => adminService.getCoupons(),
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["adminCoupons"] });
  const createMutation = useMutation({
    mutationFn: adminService.createCoupon,
    onSuccess: () => {
      toast.success("تم إنشاء الكوبون");
      setForm(emptyForm());
      invalidate();
    },
    onError: (error) => {
      (toast.error(error?.message || "تعذر إنشاء الكوبون"), console.log(error));
    },
  });
  const toggleMutation = useMutation({
    mutationFn: adminService.toggleCoupon,
    onSuccess: () => {
      toast.success("تم تحديث حالة الكوبون");
      invalidate();
    },
    onError: (error) =>
      toast.error(error?.response?.data?.message || "تعذر تحديث الكوبون"),
  });
  const updateField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    createMutation.mutate({
      ...form,
      discountPercent: Number(form.discountPercent),
      maxRedemptions: Number(form.maxRedemptions),
    });
  };
  const coupons = data?.coupons || [];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center">
          <TicketPercent className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-display text-xl text-[var(--color-on-surface)]">
            كوبونات الخصم
          </h2>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            خصومات الاشتراكات وحدود استخدامها.
          </p>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 p-4 border border-[var(--color-outline-variant)]/60 rounded-lg bg-[var(--color-surface-container-lowest)]"
      >
        <input
          required
          value={form.code}
          onChange={(event) =>
            updateField("code", event.target.value.toUpperCase())
          }
          placeholder="كود الكوبون"
          maxLength={32}
          className="h-10 px-3 border rounded-lg bg-[var(--color-surface)] uppercase"
        />
        <input
          required
          type="number"
          min="1"
          max="99"
          value={form.discountPercent}
          onChange={(event) =>
            updateField("discountPercent", event.target.value)
          }
          placeholder="نسبة الخصم %"
          className="h-10 px-3 border rounded-lg bg-[var(--color-surface)]"
        />
        <input
          required
          type="number"
          min="1"
          value={form.maxRedemptions}
          onChange={(event) =>
            updateField("maxRedemptions", event.target.value)
          }
          placeholder="عدد الاستخدامات"
          className="h-10 px-3 border rounded-lg bg-[var(--color-surface)]"
        />
        <input
          required
          type="datetime-local"
          value={form.startsAt}
          onChange={(event) => updateField("startsAt", event.target.value)}
          className="h-10 px-3 border rounded-lg bg-[var(--color-surface)]"
        />
        <input
          required
          type="datetime-local"
          value={form.expiresAt}
          onChange={(event) => updateField("expiresAt", event.target.value)}
          className="h-10 px-3 border rounded-lg bg-[var(--color-surface)]"
        />
        <button
          disabled={createMutation.isPending}
          className="h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold disabled:opacity-60"
        >
          <Plus className="w-4 h-4" />
          إضافة
        </button>
      </form>

      <div className="overflow-x-auto border border-[var(--color-outline-variant)]/60 rounded-lg bg-[var(--color-surface-container-lowest)]">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-[var(--color-surface-container-low)] text-[var(--color-on-surface-variant)]">
            <tr>
              <th className="p-3 text-right">الكود</th>
              <th className="p-3 text-right">الخصم</th>
              <th className="p-3 text-right">الاستخدام</th>
              <th className="p-3 text-right">الصلاحية</th>
              <th className="p-3 text-right">الحالة</th>
              <th className="p-3 text-left">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="6" className="p-8 text-center">
                  جاري التحميل...
                </td>
              </tr>
            ) : coupons.length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  className="p-8 text-center text-[var(--color-on-surface-variant)]"
                >
                  لا توجد كوبونات حتى الآن
                </td>
              </tr>
            ) : (
              coupons.map((coupon) => {
                const expired = new Date(coupon.expiresAt) <= new Date();
                return (
                  <tr
                    key={coupon.id}
                    className="border-t border-[var(--color-outline-variant)]/35"
                  >
                    <td className="p-3 font-mono font-semibold">
                      {coupon.code}
                    </td>
                    <td className="p-3">{coupon.discountPercent}%</td>
                    <td className="p-3">
                      {coupon.usedCount} / {coupon.maxRedemptions}
                      {coupon.reservedCount
                        ? ` (${coupon.reservedCount} معلّق)`
                        : ""}
                    </td>
                    <td className="p-3 text-xs">
                      حتى {new Date(coupon.expiresAt).toLocaleString("ar-SA")}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-xs font-semibold ${coupon.isActive && !expired ? "text-emerald-700" : "text-red-600"}`}
                      >
                        {coupon.isActive && !expired
                          ? "مفعّل"
                          : expired
                            ? "منتهي"
                            : "موقوف"}
                      </span>
                    </td>
                    <td className="p-3 text-left">
                      <button
                        title={
                          coupon.isActive ? "إيقاف الكوبون" : "تفعيل الكوبون"
                        }
                        onClick={() => toggleMutation.mutate(coupon.id)}
                        className="p-2 rounded-lg hover:bg-[var(--color-surface-container-low)]"
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
