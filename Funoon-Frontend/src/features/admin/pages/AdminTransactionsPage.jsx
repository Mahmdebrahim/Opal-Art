import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Calendar, Search } from "lucide-react";
import { adminService } from "../services/admin.service";

const TYPE_LABELS = {
  CREDIT_SALE: "أرباح بيع",
  CREDIT_RELEASE: "تحرير أرباح معلقة",
  DEBIT_WITHDRAWAL: "سحب",
  DEBIT_REFUND: "خصم استرداد",
  DEBIT_CLAWBACK: "استرداد أرباح",
  REFUND: "استرداد",
  ADJUSTMENT: "تسوية إدارية",
};

const STATUS_LABELS = {
  PENDING: "قيد الانتظار",
  COMPLETED: "مكتملة",
  FAILED: "فاشلة",
};

const TYPE_OPTIONS = [["all", "كل الأنواع"], ...Object.entries(TYPE_LABELS)];

const formatAmount = (amount) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    amount || 0,
  );

const formatCurrency = (currency) =>
  !currency || currency === "SAR" ? "ر.س" : currency;

const formatDate = (date) =>
  new Date(date).toLocaleString("ar-EG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function AdminTransactionsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: [
      "adminTransactions",
      debouncedSearch,
      type,
      status,
      from,
      to,
      page,
    ],
    queryFn: () =>
      adminService.getTransactions({
        search: debouncedSearch,
        type,
        status,
        from,
        to,
        page,
        limit: 20,
      }),
  });
  console.log(data);

  const transactions = data?.transactions || [];
  const pagination = data?.pagination || { total: 0, pages: 0 };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl text-on-surface">
            <ArrowLeftRight className="h-6 w-6 text-secondary" />
            كل المعاملات
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            سجل المعاملات المالية المسجلة على الموقع
          </p>
        </div>
        <p className="text-xs text-on-surface-variant tabular-nums">
          {formatAmount(pagination.total)} معاملة
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative">
          <Search className="absolute right-3  top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث باسم المستخدم أو البريد أو الوصف"
            aria-label="البحث في المعاملات"
            className="pr-8 pl-3 py-1.5 text-sm bg-surface-container-lowest border border-outline-variant/40 focus:border-primary focus:outline-none w-56"
          />
        </label>

        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <Calendar className="h-4 w-4" />
          <input
            type="date"
            value={from}
            aria-label="من تاريخ"
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
            className="border border-outline-variant/40 bg-surface-container-lowest px-2 py-2 text-xs focus:outline-none"
          />
          <span aria-hidden="true">إلى</span>
          <input
            type="date"
            value={to}
            aria-label="إلى تاريخ"
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
            className="border border-outline-variant/40 bg-surface-container-lowest px-2 py-2 text-xs focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label="نوع المعاملة"
        >
          {TYPE_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setType(value);
                setPage(1);
              }}
              aria-pressed={type === value}
              className={`border cursor-pointer px-4 py-1.5 text-xs font-semibold transition-premium ${
                type === value
                  ? "border-primary bg-primary text-white"
                  : "border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:border-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label="حالة المعاملة"
        >
          {[["all", "كل الحالات"], ...Object.entries(STATUS_LABELS)].map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setStatus(value);
                  setPage(1);
                }}
                aria-pressed={status === value}
                className={`border px-4 py-1.5 text-xs font-semibold transition-premium ${
                  status === value
                    ? "border-primary bg-primary text-white"
                    : "border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:border-primary"
                }`}
              >
                {label}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-outline-variant/40 bg-surface-container-lowest">
        <table className="w-full min-w-200 text-sm">
          <thead>
            <tr className="border-b border-outline-variant/30 bg-surface-container-low/50 text-right text-[11px] font-semibold text-on-surface-variant">
              <th className="p-3">التاريخ والوقت</th>
              <th className="p-3">المستخدم</th>
              <th className="p-3">النوع</th>
              <th className="p-3">الوصف / المرجع</th>
              <th className="p-3">المبلغ</th>
              <th className="p-3">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 6 }, (_, index) => (
                <tr key={index} className="border-b border-outline-variant/20">
                  {Array.from({ length: 6 }, (_, cell) => (
                    <td key={cell} className="p-3">
                      <div className="h-4 animate-pulse rounded bg-surface-container-low" />
                    </td>
                  ))}
                </tr>
              ))}

            {!isLoading && isError && (
              <tr>
                <td
                  colSpan={6}
                  className="p-12 text-center text-sm text-red-600"
                >
                  تعذر تحميل المعاملات. يرجى تحديث الصفحة والمحاولة مرة أخرى.
                </td>
              </tr>
            )}

            {!isLoading && !isError && transactions.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-12 text-center text-sm text-on-surface-variant"
                >
                  لا توجد معاملات مطابقة
                </td>
              </tr>
            )}

            {transactions.map((transaction) => {
              const isCredit = transaction.type?.startsWith("CREDIT");
              const reference =
                transaction.order?._id || transaction.withdrawal?._id;
              return (
                <tr
                  key={transaction._id}
                  className="border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-low/30"
                >
                  <td className="whitespace-nowrap p-3 text-xs tabular-nums text-on-surface-variant">
                    {formatDate(transaction.createdAt)}
                  </td>
                  <td className="p-3">
                    <p className="max-w-[180px] truncate text-xs font-medium text-on-surface">
                      {transaction.user?.name || "مستخدم غير معروف"}
                    </p>
                    {transaction.user?.email && (
                      <p
                        dir="ltr"
                        className="max-w-[180px] truncate text-right text-[11px] text-on-surface-variant"
                      >
                        {transaction.user.email}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap p-3 text-xs text-on-surface">
                    {TYPE_LABELS[transaction.type] ||
                      transaction.type ||
                      "غير محدد"}
                  </td>
                  <td className="p-3">
                    <p className="max-w-[240px] truncate text-xs text-on-surface">
                      {transaction.description || "—"}
                    </p>
                    {reference && (
                      <p
                        dir="ltr"
                        className="mt-0.5 text-right text-[10px] text-on-surface-variant"
                      >
                        #{reference.toString().slice(-8).toUpperCase()}
                      </p>
                    )}
                  </td>
                  <td
                    className={`whitespace-nowrap p-3 text-xs font-semibold tabular-nums ${isCredit ? "text-emerald-700" : "text-red-600"}`}
                  >
                    {isCredit ? "+" : "-"}
                    {formatAmount(transaction.amount)}{" "}
                    {formatCurrency(transaction.currency)}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    <span
                      className={`inline-flex border px-2 py-1 text-[10px] font-semibold ${
                        transaction.status === "COMPLETED"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : transaction.status === "FAILED"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {STATUS_LABELS[transaction.status] ||
                        transaction.status ||
                        "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3">
        <p className="text-center text-xs text-on-surface-variant">
          {isFetching && !isLoading
            ? "جارٍ تحديث النتائج..."
            : `إجمالي النتائج: ${formatAmount(pagination.total)}`}
        </p>
        {pagination.pages > 1 && (
          <div className="flex justify-center gap-3">
            <button
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
              className="border border-outline-variant/40 px-4 py-2 text-xs disabled:opacity-40"
            >
              السابق
            </button>
            <span className="self-center text-sm tabular-nums text-on-surface-variant">
              {page} / {pagination.pages}
            </span>
            <button
              disabled={page === pagination.pages}
              onClick={() => setPage((current) => current + 1)}
              className="border border-outline-variant/40 px-4 py-2 text-xs disabled:opacity-40"
            >
              التالي
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
