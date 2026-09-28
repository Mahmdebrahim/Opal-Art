import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Headphones,
  Clock,
  Loader2,
  CirclePlus,
  CheckCircle2,
  Archive,
  Mail,
  User,
  Calendar,
  MessageSquare,
  Filter,
  RefreshCw,
  Tag,
  ChevronLeft,
  Search,
  Inbox,
  AlertCircle,
  Send,
} from "lucide-react";

import { adminService } from "../../admin/services/admin.service";
import { SharedModal } from "../../../components/SharedModal";
import Button from "../../../components/Ui/Button";

// ═══════════════════════════════════════════════════
// Configs
// ═══════════════════════════════════════════════════
const TOPIC_LABELS = {
  ORDER: "طلب",
  PAYMENT: "دفع",
  ARTWORK: "لوحة",
  ACCOUNT: "حساب",
  PARTNERSHIP: "شراكة",
  OTHER: "عام",
};

const STATUS_CONFIG = {
  NEW: {
    label: "جديد",
    color: "blue",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-500",
    icon: CirclePlus,
  },
  IN_PROGRESS: {
    label: "قيد المعالجة",
    color: "amber",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
    icon: Clock,
  },
  RESOLVED: {
    label: "تم الحل",
    color: "emerald",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
  },
  CLOSED: {
    label: "مغلق",
    color: "stone",
    bg: "bg-stone-100",
    text: "text-stone-600",
    border: "border-stone-200",
    dot: "bg-stone-400",
    icon: Archive,
  },
};

const STATUSES = ["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"];

// ═══════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════
export default function AdminSupportPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("NEW");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["adminSupportTickets", statusFilter, debouncedQuery],
    queryFn: () =>
      adminService.getSupportTickets({
        status: statusFilter,
        q: debouncedQuery,
      }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const tickets = data?.tickets || [];
  const pagination = data?.pagination || {};

  const { mutate: updateStatus, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, status }) => adminService.updateTicketStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSupportTickets"] });
      toast.success("تم تحديث حالة الرسالة");
    },
    onError: () => {
      toast.error("تعذّر تحديث الحالة");
    },
  });

  const statsQuery = useQuery({
    queryKey: ["adminSupportTickets", "all"],
    queryFn: () =>
      adminService.getSupportTickets({ status: "all", limit: 1000 }),
    staleTime: 60_000,
  });
  const allTickets = statsQuery.data?.tickets || [];
  const stats = {
    NEW: allTickets.filter((t) => t.status === "NEW").length,
    IN_PROGRESS: allTickets.filter((t) => t.status === "IN_PROGRESS").length,
    RESOLVED: allTickets.filter((t) => t.status === "RESOLVED").length,
    CLOSED: allTickets.filter((t) => t.status === "CLOSED").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center">
              <Headphones className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-[var(--color-on-surface)]">
              رسائل الدعم
            </h1>
          </div>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            إدارة رسائل واستفسارات المستخدمين والرد عليها
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          icon={RefreshCw}
          onClick={() => {
            refetch();
            statsQuery.refetch();
          }}
          isLoading={isLoading || statsQuery.isLoading}
        >
          تحديث
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {STATUSES.map((status) => {
          const config = STATUS_CONFIG[status];
          const Icon = config.icon;
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`p-4 rounded-xl border transition-all duration-200 text-right ${
                isActive
                  ? `${config.bg} ${config.border} shadow-sm`
                  : "bg-[var(--color-surface-container-lowest)] border-[var(--color-outline-variant)]/30 hover:border-[var(--color-outline-variant)]/60"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`w-9 h-9 rounded-lg ${config.bg} ${config.text} flex items-center justify-center`}
                >
                  <Icon className="w-4 h-4" strokeWidth={2} />
                </div>
                <span
                  className={`font-display text-2xl font-bold ${config.text}`}
                >
                  {stats[status]}
                </span>
              </div>
              <p className="text-xs font-medium text-[var(--color-on-surface)]">
                {config.label}
              </p>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-on-surface-variant)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالاسم أو البريد أو رقم التذكرة (#A3F9B2)..."
            className="w-full pr-10 pl-10 py-2.5 rounded-xl bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/40 text-sm text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/60 focus:outline-none focus:border-[var(--color-primary)]/50 transition-colors"
          />
          {/* ✅ spinner أثناء البحث */}
          {isFetching && !isLoading && (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[var(--color-primary)]" />
          )}
        </div>

        <button
          onClick={() => setStatusFilter("all")}
          className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all flex items-center gap-2 shrink-0 ${
            statusFilter === "all"
              ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
              : "bg-[var(--color-surface-container-lowest)] text-[var(--color-on-surface)] border-[var(--color-outline-variant)]/40 hover:border-[var(--color-outline-variant)]/60"
          }`}
        >
          <Filter className="w-4 h-4" />
          الكل ({allTickets.length})
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <TicketsSkeleton />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : tickets.length === 0 ? (
        <EmptyState
          hasFilter={searchQuery.length > 0 || statusFilter !== "all"}
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket._id}
              ticket={ticket}
              onClick={() => setSelectedTicket(ticket)}
            />
          ))}
        </div>
      )}

      {!isLoading && pagination.pages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-4">
          <p className="text-xs text-[var(--color-on-surface-variant)]">
            صفحة {pagination.page} من {pagination.pages} — إجمالي{" "}
            {pagination.total} رسالة
          </p>
        </div>
      )}

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdateStatus={(newStatus) => {
            updateStatus({ id: selectedTicket._id, status: newStatus });
            setSelectedTicket({ ...selectedTicket, status: newStatus });
          }}
          isUpdating={isUpdating}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Ticket Card
// ═══════════════════════════════════════════════════
function TicketCard({ ticket, onClick }) {
  const config = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.NEW;
  const StatusIcon = config.icon;
  const topicLabel = TOPIC_LABELS[ticket.topic] || "عام";

  return (
    <button
      onClick={onClick}
      className="w-full p-4 md:p-5 bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/30 rounded-xl hover:border-[var(--color-primary)]/40 hover:shadow-sm transition-all duration-200 text-right group"
    >
      <div className="flex items-start gap-3 md:gap-4">
        <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center shrink-0 font-display font-bold text-base">
          {ticket.name?.charAt(0)?.toUpperCase() || "؟"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--color-on-surface)] truncate">
                {ticket.name}
              </p>
              <p className="text-xs text-[var(--color-on-surface-variant)] truncate flex items-center gap-1 mt-0.5">
                <Mail className="w-3 h-3 shrink-0" />
                {ticket.email}
              </p>
            </div>

            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${config.bg} ${config.text} border ${config.border} shrink-0`}
            >
              <StatusIcon className="w-3 h-3" strokeWidth={2.5} />
              {config.label}
            </span>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--color-primary)] bg-[var(--color-primary)]/5 px-2 py-0.5 rounded-full">
              <Tag className="w-2.5 h-2.5" />
              {topicLabel}
            </span>

            <span
              className="text-[10px] font-mono font-semibold text-[var(--color-on-surface-variant)]/70 bg-[var(--color-surface-container-low)] px-2 py-0.5 rounded-full"
              dir="ltr"
            >
              #{ticket._id.slice(-6).toUpperCase()}
            </span>

            <span className="text-[10px] text-[var(--color-on-surface-variant)]/60">
              {new Date(ticket.createdAt).toLocaleDateString("ar-SA", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          <p className="text-sm text-[var(--color-on-surface-variant)] line-clamp-2 leading-relaxed">
            {ticket.message}
          </p>
        </div>

        <ChevronLeft className="w-4 h-4 text-[var(--color-on-surface-variant)]/40 group-hover:text-[var(--color-primary)] group-hover:-translate-x-1 transition-all shrink-0 mt-1 hidden sm:block" />
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════
// Detail Modal
// ═══════════════════════════════════════════════════
function TicketDetailModal({ ticket, onClose, onUpdateStatus, isUpdating }) {
  const topicLabel = TOPIC_LABELS[ticket.topic] || "عام";

  return (
    <SharedModal
      open={!!ticket}
      onClose={onClose}
      title="تفاصيل الرسالة"
      icon={MessageSquare}
      iconColor="text-[var(--color-primary)]"
      size="xl"
      description={`رقم التذكرة: #${ticket._id.slice(-6).toUpperCase()}`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <InfoItem icon={User} label="الاسم" value={ticket.name} />
        <InfoItem
          icon={Mail}
          label="البريد الإلكتروني"
          value={ticket.email}
          isEmail
        />
        <InfoItem icon={Tag} label="الموضوع" value={topicLabel} />
        <InfoItem
          icon={Calendar}
          label="تاريخ الاستلام"
          value={new Date(ticket.createdAt).toLocaleString("ar-SA", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        />
      </div>

      <div className="bg-[var(--color-surface-container-low)]/50 border border-[var(--color-outline-variant)]/30 rounded-xl p-4 mb-5">
        <p className="text-xs font-semibold text-[var(--color-on-surface-variant)] mb-2 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          الرسالة
        </p>
        <p className="text-sm text-[var(--color-on-surface)] leading-relaxed whitespace-pre-wrap">
          {ticket.message}
        </p>
      </div>

      <div className="bg-[var(--color-surface-container-low)]/50 border border-[var(--color-outline-variant)]/30 rounded-xl p-4 mb-5">
        <p className="text-xs font-semibold text-[var(--color-on-surface-variant)] mb-3">
          تغيير الحالة
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STATUSES.map((status) => {
            const c = STATUS_CONFIG[status];
            const Icon = c.icon;
            const isActive = ticket.status === status;
            return (
              <button
                key={status}
                onClick={() => !isActive && onUpdateStatus(status)}
                disabled={isActive || isUpdating}
                className={`p-2.5 rounded-lg border text-xs font-semibold transition-all flex flex-col items-center gap-1.5 ${
                  isActive
                    ? `${c.bg} ${c.border} ${c.text}`
                    : "bg-[var(--color-surface-container-lowest)] border-[var(--color-outline-variant)]/40 text-[var(--color-on-surface-variant)] hover:border-[var(--color-outline-variant)]"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <Icon className="w-4 h-4" strokeWidth={2} />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <QuickReply email={ticket.email} name={ticket.name} topic={topicLabel} />

      <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-[var(--color-outline-variant)]/30">
        <a
          href={`mailto:${ticket.email}?subject=رد: ${topicLabel}&body=مرحباً ${ticket.name}،%0D%0A%0D%0A`}
          className="flex items-center gap-2 text-xs font-semibold text-[var(--color-primary)] hover:underline"
        >
          <Mail className="w-4 h-4" />
          فتح في البريد
        </a>
        <Button variant="outline" size="sm" onClick={onClose}>
          إغلاق
        </Button>
      </div>
    </SharedModal>
  );
}

// ═══════════════════════════════════════════════════
// Info Item
// ═══════════════════════════════════════════════════
function InfoItem({ icon: Icon, label, value, isEmail }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-[var(--color-surface-container-low)]/40 rounded-lg border border-[var(--color-outline-variant)]/20">
      <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" strokeWidth={1.5} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-[var(--color-on-surface-variant)]/70 mb-0.5">
          {label}
        </p>
        {isEmail ? (
          <a
            href={`mailto:${value}`}
            className="text-sm font-semibold text-[var(--color-primary)] hover:underline truncate block"
          >
            {value}
          </a>
        ) : (
          <p className="text-sm font-semibold text-[var(--color-on-surface)] truncate">
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Quick Reply
// ═══════════════════════════════════════════════════
function QuickReply({ email, name, topic }) {
  const template = `مرحباً ${name}،

شكراً لتواصلك مع منصة فُنون بخصوص "${topic}".

[اكتب ردك هنا]

مع تحيات،
فريق دعم فُنون`;

  const mailto = `mailto:${email}?subject=${encodeURIComponent(
    `[فُنون] رد: ${topic}`,
  )}&body=${encodeURIComponent(template)}`;

  return (
    <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center shrink-0">
          <Send className="w-4 h-4" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--color-on-surface)] mb-1">
            الرد السريع
          </p>
          <p className="text-xs text-[var(--color-on-surface-variant)] leading-relaxed mb-3">
            افتح تطبيق البريد مع قالب رد جاهز لإرساله إلى {email}
          </p>
          <a
            href={mailto}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-xs font-semibold hover:bg-[var(--color-primary)]/90 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            ابدأ الرد
          </a>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════
function TicketsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="p-4 md:p-5 bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/30 rounded-xl animate-pulse"
        >
          <div className="flex items-start gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-[var(--color-surface-container-low)]" />
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 bg-[var(--color-surface-container-low)] rounded w-32" />
                  <div className="h-3 bg-[var(--color-surface-container-low)] rounded w-48" />
                </div>
                <div className="h-5 bg-[var(--color-surface-container-low)] rounded-full w-20" />
              </div>
              <div className="h-3 bg-[var(--color-surface-container-low)] rounded w-24" />
              <div className="space-y-1.5">
                <div className="h-3 bg-[var(--color-surface-container-low)] rounded w-full" />
                <div className="h-3 bg-[var(--color-surface-container-low)] rounded w-5/6" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Error State
// ═══════════════════════════════════════════════════
function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-500" strokeWidth={1.5} />
      </div>
      <h3 className="font-display font-bold text-lg text-[var(--color-on-surface)] mb-2">
        تعذّر تحميل الرسائل
      </h3>
      <p className="text-sm text-[var(--color-on-surface-variant)] mb-4">
        حدث خطأ أثناء جلب البيانات من الخادم
      </p>
      <Button variant="outline" size="sm" icon={RefreshCw} onClick={onRetry}>
        إعادة المحاولة
      </Button>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════════════
function EmptyState({ hasFilter }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-[var(--color-surface-container-low)] flex items-center justify-center mb-4">
        <Inbox
          className="w-8 h-8 text-[var(--color-on-surface-variant)]/40"
          strokeWidth={1.5}
        />
      </div>
      <h3 className="font-display font-bold text-lg text-[var(--color-on-surface)] mb-2">
        {hasFilter ? "لا توجد نتائج مطابقة" : "لا توجد رسائل حالياً"}
      </h3>
      <p className="text-sm text-[var(--color-on-surface-variant)] max-w-md">
        {hasFilter
          ? "جرّب تغيير الفلتر أو كلمة البحث للعثور على نتائج"
          : "ستظهر هنا جميع رسائل الدعم المرسلة من المستخدمين"}
      </p>
    </div>
  );
}
