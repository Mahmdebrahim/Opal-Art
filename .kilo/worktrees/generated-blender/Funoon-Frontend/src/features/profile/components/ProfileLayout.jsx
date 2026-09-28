import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import { User, MapPin, Landmark } from "lucide-react";
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
    const { data: profile } = useProfile(); // ✅ شيلنا isLoading

    if (!isAuthenticated) {
        return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
    }

    const displayUser = profile || user; // ✅ fallback لـ user من الـ store
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