import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import { User, MapPin, Landmark, AlertTriangle } from "lucide-react";
import { ROUTES } from "../../../config/routes";
import { useAuthStore } from "../../auth/stores/authStore";
import { useProfile } from "../hooks/useProfile";
import { getMediaUrl } from "../../../utils/media";

const navItems = [
    { to: ROUTES.PROFILE, label: "البيانات الشخصية", icon: User, end: true },
    { to: ROUTES.ADDRESS, label: "العنوان", icon: MapPin },
    { to: ROUTES.BANK_ACCOUNT, label: "الحساب البنكي", icon: Landmark, artistOnly: true },
];

const roleLabels = {
    buyer: "مقتنٍ",
    artist: "فنان",
    admin: "مدير المنصة",
};

// ═══════════════════════════════════════════════════
// Main Component — NO skeleton here
// ═══════════════════════════════════════════════════
export default function ProfileLayout() {
    const { user, isAuthenticated } = useAuthStore();
    const location = useLocation();
    const { data: profile, isError, refetch } = useProfile();

    if (!isAuthenticated) {
        return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
    }

    function GenericErrorPage({ onRetry }) {
      return (
        <div
          className="min-h-[60vh] flex items-center justify-center px-4"
          dir="rtl"
        >
          <div className="max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 mx-auto bg-red-50 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="font-display text-xl text-[var(--color-on-surface)] mb-2">
              تعذّر تحميل الإحصائيات
            </h2>
            <p className="text-sm text-[var(--color-on-surface-variant)] mb-6">
              حصل خطأ غير متوقع. تحقق من اتصالك وحاول مرة أخرى.
            </p>
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-full hover:bg-[var(--color-primary)]/90 transition-colors cursor-pointer"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      );
    }

    if (isError) return <GenericErrorPage onRetry={refetch} />;

    const displayUser = profile || user; 
    const avatarUrl = getMediaUrl(displayUser?.avatar);

    const visibleNavItems = navItems.filter(
        (item) => !item.artistOnly || user?.role === "artist",
    );

    return (
        <div className="min-h-[calc(100vh-5rem)] rounded-lg bg-surface">
            <div className="max-w-[1280px] mx-auto px-5 lg:px-16 py-10 lg:py-14">
                {/* Header */}
                <div className="mb-10">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-secondary)] font-semibold mb-2">
                        حسابي
                    </p>
                    <h1 className="text-3xl lg:text-4xl font-display text-[var(--color-primary)]">
                        الملف الشخصي
                    </h1>
                </div>

                <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
                    {/* Sidebar */}
                    <aside className="lg:w-72 shrink-0">
                        <div className="bg-[var(--color-surface-container-lowest)] rounded-lg p-6">
                            {/* User summary */}
                            <div className="flex-col text-center items-center justify-center  gap-7 pb-6 mb-6 border-b border-[var(--color-outline-variant)]">
                                <div className="w-16 h-16 bg-[var(--color-surface-container-high)] mx-auto mb-2 flex items-center justify-center overflow-hidden shrink-0 rounded-full">
                                    {avatarUrl ? (
                                        <img
                                            src={avatarUrl}
                                            alt={displayUser?.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <User className="w-7 h-7 text-[var(--color-on-surface-variant)]" strokeWidth={1.5} />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="font-display text-lg text-[var(--color-on-surface)] truncate">
                                        {displayUser?.name}
                                    </h2>
                                    <p className="text-xs text-[var(--color-on-surface-variant)] truncate mt-0.5">
                                        {displayUser?.email}
                                    </p>
                                    <span className="inline-block mt-2 px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-semibold bg-[var(--color-surface-container)] text-[var(--color-primary)]">
                                        {roleLabels[displayUser?.role] || displayUser?.role}
                                    </span>
                                </div>
                            </div>

                            {/* Navigation */}
                            <nav className="space-y-1 flex-col text-center justify-center">
                                {visibleNavItems.map(({ to, label, icon: Icon, end }) => (
                                    <NavLink
                                        key={to}
                                        to={to}
                                        end={end}
                                        className={({ isActive }) =>
                                            `flex items-center text-center justify-center gap-3 px-4 py-3 text-sm font-medium transition-premium rounded-lg ${
                                                isActive
                                                    ? "bg-[var(--color-primary)] text-white"
                                                    : "text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container-low)]"
                                            }`
                                        }
                                    >
                                        <Icon className="w-4 h-4" strokeWidth={1.5} />
                                        {label}
                                    </NavLink>
                                ))}
                            </nav>
                        </div>
                    </aside>

                    {/* Content */}
                    <main className="flex-1 min-w-0">
                        <Outlet context={{ profile: displayUser }} />
                    </main>
                </div>
            </div>
        </div>
    );
}