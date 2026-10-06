import { useState, useRef, useEffect } from "react";

import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";

import { ROUTES } from "../../config/routes";

import { useAuthStore } from "../../features/auth/stores/authStore";

import { useCartStore } from "../../features/cart/stores/cartStore";

import { getMediaUrl } from "../../utils/media";

import Button from "../Ui/Button";

import { useUnreadCount } from "../../hooks/useNotifications";

import NotificationBell from "../NotificationBell";

import opalLogo from "../../assets/opalLogo2.png";

import {
  ShoppingCart,
  User,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  ShieldCheck,
  Palette,
  Package,
  Heart,
  Settings,
  ChevronDown,
  LogInIcon,
  Bell,
  Star,
  Users,
  Crown,
  Mail,
} from "lucide-react";

const MAIN_LINKS = [
  {
    to: ROUTES.ARTWORKS,
    label: "المعرض",
    icon: Palette,
  },
  {
    to: ROUTES.FEATURED,
    label: "المميزة",
    icon: Star,
  },
  {
    to: ROUTES.ARTISTS,
    label: "الفنانون",
    icon: Users,
  },
  {
    to: ROUTES.SUBSCRIPTIONS,
    label: "الاشتراكات",
    icon: Crown,
  },
  {
    to: ROUTES.CONTACT_US,
    label: "تواصل معنا",
    icon: Mail,
  },
];

const ACCOUNT_LINKS = [
  {
    to: ROUTES.ORDERS,
    label: "طلباتي",
    icon: Package,
  },
  {
    to: ROUTES.FAVORITES,
    label: "المفضلة",
    icon: Heart,
  },
  {
    to: ROUTES.NOTIFICATIONS,
    label: "الإشعارات",
    icon: Bell,
  },
  {
    to: ROUTES.SETTINGS,
    label: "الإعدادات",
    icon: Settings,
  },
];

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();

  const navigate = useNavigate();
  const location = useLocation();

  const cartItems = useCartStore((s) => s.items);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const userMenuRef = useRef(null);

  const closeMobile = () => {
    setMobileMenuOpen(false);
  };

  // Lock body scroll while mobile sidebar is open
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  // Close mobile menu with Escape
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const onKey = (e) => {
      if (e.key === "Escape") {
        closeMobile();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileMenuOpen]);

  // Close menus whenever route changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Close desktop user menu when clicking outside
  useEffect(() => {
    if (!userMenuOpen) return;

    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);

    return () => {
      document.removeEventListener("mousedown", handler);
    };
  }, [userMenuOpen]);

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    closeMobile();
    navigate(ROUTES.HOME);
  };

  const { data: unreadCount = 0 } = useUnreadCount(isAuthenticated);

  const hasUnread = unreadCount > 0;

  const avatarUrl = getMediaUrl(user?.avatar);

  return (
    <>
      <header className="sticky top-0 z-50 w-full glass-card border-b border-[var(--color-outline-variant)]/30">
        <div className="max-w-[1280px] mx-auto px-5 lg:px-16">
          <div className="flex justify-between h-20 items-center">
            {/* Logo + Desktop Nav */}
            <div className="flex items-center gap-12">
              <Link to={ROUTES.HOME} className="flex items-center group">
                <img
                  src="/images/opal-logo.webp"
                  alt="Opal"
                  width={384} 
                  height={353} 
                  decoding="async"
                  className="h-9 md:h-13 w-auto transition-premium group-hover:opacity-80"
                />
              </Link>

              <nav className="hidden lg:flex items-center gap-8">
                {MAIN_LINKS.map((link) => (
                  <Link
                    key={`desktop-main-${link.to}`}
                    to={link.to}
                    className="relative text-[var(--color-on-surface)] font-body text-sm font-medium tracking-wide hover:text-[var(--color-primary)] transition-premium group"
                  >
                    {link.label}

                    <span className="absolute -bottom-1 right-0 w-0 h-[1.5px] bg-[var(--color-secondary)] transition-all duration-300 group-hover:w-full" />
                  </Link>
                ))}
              </nav>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Cart */}
              <Link
                to={ROUTES.CART}
                className="relative p-2.5 rounded-full text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-low)] hover:text-[var(--color-on-surface)] transition-colors cursor-pointer group"
                aria-label="السلة"
              >
                <ShoppingCart
                  className="w-5 h-5 group-hover:text-[var(--color-primary)] transition-premium"
                  strokeWidth={1.5}
                />

                {cartItems?.length > 0 && (
                  <span className="absolute top-1 left-0 min-w-[17px] h-[17px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-[var(--color-surface)]">
                    {cartItems.length}
                  </span>
                )}
              </Link>

              {/* Notification */}
              {isAuthenticated && (
                <div className="hidden md:block">
                  <NotificationBell />
                </div>
              )}

              {/* Authenticated */}
              {isAuthenticated ? (
                <div className="flex items-center gap-2">
                  {/* Admin Dashboard */}
                  {user?.role === "admin" && (
                    <Link
                      to={ROUTES.ADMIN}
                      className="hidden md:flex items-center gap-1.5 px-4 py-2 text-xs font-semibold tracking-wider uppercase bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90 transition-premium"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2} />
                      الإدارة
                    </Link>
                  )}

                  {/* Artist Dashboard */}
                  {user?.role === "artist" && (
                    <Link
                      to={ROUTES.ARTIST_DASHBOARD}
                      className="hidden md:flex items-center gap-1.5 px-4 py-2 text-xs font-semibold tracking-wider uppercase bg-inverse-surface text-white hover:bg-inverse-surface/70 transition-premium"
                    >
                      <LayoutDashboard
                        className="w-3.5 h-3.5"
                        strokeWidth={2}
                      />
                      لوحة التحكم
                    </Link>
                  )}

                  {/* Desktop User Menu */}
                  <div className="relative hidden md:block" ref={userMenuRef}>
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex cursor-pointer items-center gap-2 p-1 pr-3"
                    >
                      <div className="w-8 h-8 flex items-center justify-center overflow-hidden rounded-full">
                        {user?.avatar ? (
                          <img
                            src={avatarUrl}
                            alt={user.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User
                            className="w-4 h-4 text-[var(--color-on-surface-variant)]"
                            strokeWidth={1.5}
                          />
                        )}
                      </div>

                      <ChevronDown
                        className={`w-5 h-5 text-[var(--color-on-surface-variant)] transition-transform ${
                          userMenuOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {userMenuOpen && (
                      <div className="absolute left-0 top-full mt-2 w-64 bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/40 rounded-xl shadow-xl overflow-hidden z-50">
                        <div className="px-4 py-3 border-b border-[var(--color-outline-variant)]/30 bg-[var(--color-surface-container-low)]/40">
                          <p className="text-sm font-semibold text-[var(--color-on-surface)] truncate">
                            {user?.name}
                          </p>

                          <p className="text-xs text-[var(--color-on-surface-variant)] truncate mt-0.5">
                            {user?.email}
                          </p>
                        </div>

                        <nav className="py-2 space-y-1">
                          {ACCOUNT_LINKS.map((link, idx) => {
                            const Icon = link.icon;

                            const isNotifications =
                              link.to === ROUTES.NOTIFICATIONS;

                            return (
                              <NavLink
                                key={`desktop-account-${idx}-${link.to}`}
                                to={link.to}
                                onClick={() => setUserMenuOpen(false)}
                                className={({ isActive }) =>
                                  `flex items-center gap-3 px-4 py-2.5 text-sm transition-premium ${
                                    isActive
                                      ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                                      : "text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container-low)]"
                                  }`
                                }
                              >
                                <Icon
                                  className="w-4 h-4 shrink-0"
                                  strokeWidth={1.5}
                                />

                                <span className="flex-1">{link.label}</span>

                                {isNotifications && hasUnread && (
                                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                  </span>
                                )}
                              </NavLink>
                            );
                          })}
                        </nav>

                        <div className="py-2 border-t border-[var(--color-outline-variant)]/30">
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-error)] hover:bg-[var(--color-error-container)] transition-premium cursor-pointer"
                          >
                            <LogOut className="w-4 h-4" strokeWidth={1.5} />
                            تسجيل الخروج
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mobile User Avatar */}
                  <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="md:hidden relative w-9 h-9 rounded-full bg-[var(--color-surface-container-low)] flex items-center justify-center shrink-0 border border-[var(--color-outline-variant)]/40"
                    aria-label="حسابي"
                  >
                    <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
                      {user?.avatar ? (
                        <img
                          src={avatarUrl}
                          alt={user.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User
                          className="w-4 h-4 text-[var(--color-on-surface-variant)]"
                          strokeWidth={1.5}
                        />
                      )}
                    </div>

                    {hasUnread && (
                      <span className="absolute -top-0.5 -left-1 w-3 h-3 rounded-full bg-red-600 border-2 border-[var(--color-surface)]" />
                    )}
                  </button>
                </div>
              ) : (
                /* Guest */
                <div className="hidden md:flex items-center gap-3">
                  <Link
                    to={ROUTES.LOGIN}
                    className="text-sm font-medium text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-premium flex items-center gap-2"
                  >
                    تسجيل الدخول
                    <LogInIcon className="w-4 h-4" strokeWidth={1.5} />
                  </Link>
                </div>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2.5 rounded-full hover:bg-[var(--color-surface-container)] transition-premium"
                aria-label="القائمة"
              >
                {mobileMenuOpen ? (
                  <X
                    className="w-5 h-5 text-[var(--color-on-surface)]"
                    strokeWidth={1.5}
                  />
                ) : (
                  <Menu
                    className="w-5 h-5 text-[var(--color-on-surface)]"
                    strokeWidth={1.5}
                  />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================
          Mobile Drawer
      ====================================================== */}
      {mobileMenuOpen && (
        <>
          {/* Overlay */}
          <div
            className="lg:hidden fixed inset-0 z-[70] bg-black/50"
            onClick={closeMobile}
            aria-hidden="true"
          />

          {/* Sidebar */}
          <aside
            className="lg:hidden fixed top-0 right-0 z-[71] h-[100dvh] w-[85%] max-w-sm bg-[var(--color-surface-container-lowest)] shadow-2xl border-l border-[var(--color-outline-variant)]/30 flex flex-col overflow-hidden"
            dir="rtl"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between h-15 px-5 border-b border-[var(--color-outline-variant)]/30 shrink-0">
              <Link to={ROUTES.HOME} onClick={closeMobile}>
                <img src={opalLogo} alt="Opal" className="h-9 w-auto" />
              </Link>

              <button
                onClick={closeMobile}
                className="p-2.5 rounded-full hover:bg-[var(--color-surface-container-low)] transition-premium"
                aria-label="إغلاق القائمة"
              >
                <X
                  className="w-5 h-5 text-[var(--color-on-surface)]"
                  strokeWidth={1.5}
                />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-5 space-y-7 overscroll-contain">
              {/* User Card */}
              {isAuthenticated && (
                <div className="flex items-center gap-3 p-3 rounded-xl">
                  <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 bg-[var(--color-surface-container)] flex items-center justify-center">
                    {user?.avatar ? (
                      <img
                        src={avatarUrl}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User
                        className="w-5 h-5 text-[var(--color-on-surface-variant)]"
                        strokeWidth={1.5}
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-on-surface)] truncate">
                      {user?.name}
                    </p>

                    <p className="text-[11px] text-[var(--color-on-surface-variant)] truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
              )}

              {/* Dashboard */}
              {isAuthenticated &&
                (user?.role === "admin" || user?.role === "artist") && (
                  <nav>
                    {user?.role === "admin" ? (
                      <NavLink
                        to={ROUTES.ADMIN}
                        onClick={closeMobile}
                        className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20"
                      >
                        <ShieldCheck className="w-5 h-5" strokeWidth={1.5} />
                        لوحة الإدارة
                      </NavLink>
                    ) : (
                      <NavLink
                        to={ROUTES.ARTIST_DASHBOARD}
                        onClick={closeMobile}
                        className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20"
                      >
                        <LayoutDashboard
                          className="w-5 h-5"
                          strokeWidth={1.5}
                        />
                        لوحة التحكم
                      </NavLink>
                    )}
                  </nav>
                )}

              {/* Browse Links */}
              <div>
                <p className="px-3 mb-2 text-[10px] font-semibold tracking-[0.2em] text-[var(--color-on-surface-variant)]/70">
                  تصفح
                </p>

                <nav className="space-y-1">
                  {MAIN_LINKS.map((link, idx) => {
                    const Icon = link.icon;

                    return (
                      <NavLink
                        key={`drawer-main-${idx}-${link.to}`}
                        to={link.to}
                        onClick={closeMobile}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-premium ${
                            isActive
                              ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                              : "text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container-low)]"
                          }`
                        }
                      >
                        <Icon className="w-5 h-5" strokeWidth={1.5} />

                        {link.label}
                      </NavLink>
                    );
                  })}
                </nav>
              </div>

              {/* Account Links */}
              {isAuthenticated && (
                <div>
                  <p className="px-3 mb-2 text-[10px] font-semibold tracking-[0.2em] text-[var(--color-on-surface-variant)]/70">
                    حسابي
                  </p>

                  <nav className="space-y-1">
                    {ACCOUNT_LINKS.map((link, idx) => {
                      const Icon = link.icon;

                      const isNotifications = link.to === ROUTES.NOTIFICATIONS;

                      return (
                        <NavLink
                          key={`drawer-account-${idx}-${link.to}`}
                          to={link.to}
                          onClick={closeMobile}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-premium ${
                              isActive
                                ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                                : "text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container-low)]"
                            }`
                          }
                        >
                          <Icon
                            className="w-5 h-5 shrink-0"
                            strokeWidth={1.5}
                          />

                          <span className="flex-1">{link.label}</span>

                          {isNotifications && hasUnread && (
                            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                              {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </nav>
                </div>
              )}
            </div>

            {/* Drawer Footer - ثابت تحت */}
            <div className="shrink-0 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-[var(--color-surface-container-lowest)] border-t border-[var(--color-outline-variant)]/30">
              {isAuthenticated ? (
                <Button
                  variant="outline"
                  fullWidth
                  onClick={handleLogout}
                  icon={LogOut}
                  className="text-sm font-medium text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-premium flex items-center justify-center gap-2"
                >
                  تسجيل الخروج
                </Button>
              ) : (
                <Link to={ROUTES.LOGIN}>
                  <Button
                    as={Link}
                    to={ROUTES.LOGIN}
                    variant="outline"
                    icon={LogInIcon}
                    fullWidth
                    onClick={closeMobile}
                    className="text-sm font-medium text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-premium flex items-center justify-center gap-2"
                  >
                    تسجيل الدخول
                  </Button>
                </Link>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
