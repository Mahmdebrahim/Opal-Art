import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Heart,
  ShoppingBag,
  Check,
  Ruler,
  Weight,
  Palette,
  Calendar,
  Tag,
  Truck,
  Shield,
  Share2,
  ZoomIn,
  X,
  ChevronLeft,
  ChevronRight,
  Star,
  Gift,
  Clock,
} from "lucide-react";
import { useArtwork } from "../hooks/useArtworks";
import { useFavorites } from "../../favorites/hooks/useFavorites";
import { useCart } from "../../cart/hooks/useCart";
import ArtworkCard from "../../../components/Ui/ArtworkCard";
import Button from "../../../components/Ui/Button";
import { getMediaUrl } from "../../../utils/media";
import { ROUTES } from "../../../config/routes";
import badge from "../../../assets/badge.png";
import SaCurr from "../../../assets/sa.svg";
import ArtworkPlaceholder from "../../../assets/ArtworkPlaceholder.png";
import userPlaceholder from "../../../assets/userPlaceholder.png";
// ═══════════════════════════════════════════════════
// Free Shipping Helper
// ═══════════════════════════════════════════════════
const FREE_SHIPPING_QUOTA = 10;

const getFreeShippingInfo = (artwork) => {
  if (!artwork || artwork.isSold) return null;
  const artist = artwork.artist;
  if (!artist) return null;
  if (artist.subscription?.plan !== "opal_prestige") return null;
  if (artwork.shippingType && artwork.shippingType !== "standard") return null;
  const remaining = FREE_SHIPPING_QUOTA - (artist.freeShippingUsed || 0);
  if (remaining <= 0) return null;
  return { eligible: true, remaining, total: FREE_SHIPPING_QUOTA };
};

// ═══════════════════════════════════════════════════
// Corner Ribbon
// ═══════════════════════════════════════════════════
function CornerRibbon({ children, className = "" }) {
  return (
    <div className="absolute top-0 left-0 w-[130px] h-[130px] overflow-hidden pointer-events-none z-10">
      <div
        className={`absolute top-[30px] left-[-48px] w-[200px] -rotate-45 text-white text-[11px] font-body font-bold tracking-[0.08em] text-center py-[6px] shadow-lg flex items-center justify-center gap-1.5 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

export default function ArtworkDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isFavoriteLocal, setIsFavoriteLocal] = useState(false);

  const { data, isLoading, isError } = useArtwork(id);

  const artwork = data?.artwork || data;
  const relatedArtworks = data?.relatedArtworks || [];

  const { toggleFavorite, isLoading: isLoadingFav } = useFavorites();
  const { addToCart, isInCart, isLoading: isLoadingCart } = useCart();

  const freeShipping = getFreeShippingInfo(artwork);

  useEffect(() => {
    if (artwork?.isFavorite !== undefined) {
      setIsFavoriteLocal(artwork.isFavorite);
    }
  }, [artwork?.isFavorite]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setSelectedImageIndex(0);
  }, [id]);

  const isInCartNow = isInCart(id);

  if (isLoading) return <LoadingSkeleton />;
  if (isError || !artwork) return <NotFoundState />;

  const formatPrice = (v) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);

  const handleFavorite = async () => {
    const newState = !isFavoriteLocal;
    setIsFavoriteLocal(newState);
    try {
      await toggleFavorite(id);
    } catch {
      setIsFavoriteLocal(!newState);
    }
  };

  const handleAddToCart = async () => {
    if (artwork.isSold || isInCartNow) return;
    await addToCart(id);
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: artwork.title,
          text: `اكتشف ${artwork.title} على أوبال جاليري — opalart.sa`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("تم نسخ الرابط");
      }
    } catch (e) {
    }
  };

  const images = artwork.images?.length
    ? artwork.images.map((img) => getMediaUrl(img.url || img))
    : [getMediaUrl(artwork.coverImage)];

  return (
    <div className="min-h-screen bg-surface">
      {/* ═══ Breadcrumb ═══ */}
      <div className="border-b border-outline-variant/30 bg-surface-container-lowest">
        <div className="max-w-[1280px] mx-auto px-5 lg:px-16 py-4">
          <nav className="flex items-center gap-2 text-sm font-body text-on-surface-variant">
            <Link
              to={ROUTES.HOME}
              className="hover:text-primary transition-premium"
            >
              الرئيسية
            </Link>
            <ChevronLeft className="w-3.5 h-3.5" />
            <Link
              to={ROUTES.ARTWORKS}
              className="hover:text-primary transition-premium"
            >
              المعرض
            </Link>
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="text-on-surface line-clamp-1">
              {artwork.title}
            </span>
          </nav>
        </div>
      </div>

      {/* ═══ Main Content ═══ */}
      <div className="max-w-[1280px] mx-auto px-5 lg:px-16 py-8 lg:py-12">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
          {/* ═══ Left: Image Gallery ═══ */}
          <div className="space-y-4">
            {/* Main Image */}
            <div
              className="relative bg-surface-container overflow-hidden cursor-zoom-in group"
              onClick={() => setIsZoomed(true)}
            >
              <div className="aspect-[4/5]">
                <img
                  src={images[selectedImageIndex]}
                  alt={artwork.title}
                  onError={(e) => {
                    e.target.src = ArtworkPlaceholder;
                  }}
                  className={`
                                        w-full h-full object-cover 
                                        transition-all duration-700 
                                        group-hover:scale-105
                                        ${artwork.isSold ? "grayscale-[50%] opacity-80" : ""}
                                    `}
                />
              </div>

              {/* Zoom hint */}
              <div className="absolute top-4 left-4 w-10 h-10 bg-white/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-premium z-20">
                <ZoomIn className="w-4 h-4 text-on-surface" strokeWidth={1.5} />
              </div>

              {/* Corner Ribbon — شحن مجاني */}
              {freeShipping && (
                <CornerRibbon className="bg-emerald-600">
                  <Truck className="w-3.5 h-3.5" strokeWidth={2.5} />
                  <span>شحن مجاني</span>
                </CornerRibbon>
              )}

              {/* Badges Column (فوق يمين) */}
              <div className="absolute top-4 right-4 z-20 flex flex-col items-start gap-2">
                {artwork.isSold && (
                  <div className="px-3 py-1.5 bg-primary text-white text-[10px] font-body font-bold tracking-[0.15em] uppercase shadow-sm">
                    مباع
                  </div>
                )}
                {artwork.isFeatured && (
                  <div className="px-3 py-1.5 bg-secondary text-white text-[10px] font-body font-bold flex items-center gap-1 shadow-sm">
                    <Star className="w-3 h-3 fill-white" strokeWidth={0} />
                    <span>مميزة</span>
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`shrink-0 w-20 h-20 overflow-hidden border-2 transition-premium ${
                      idx === selectedImageIndex
                        ? "border-secondary"
                        : "border-transparent hover:border-outline-variant"
                    }`}
                  >
                    <img
                      src={img}
                      onError={(e) => {
                        e.target.src = ArtworkPlaceholder;
                      }}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ═══ Right: Info ═══ */}
          <div className="space-y-8">
            {/* Category tag */}
            {artwork.category && (
              <Link
                to={`${ROUTES.ARTWORKS}?category=${artwork.category}`}
                className="inline-block text-[11px] font-body font-semibold tracking-[0.2em] uppercase text-secondary hover:text-primary transition-premium"
              >
                {artwork.category}
              </Link>
            )}

            {/* Title */}
            <h1 className="font-display text-4xl lg:text-5xl text-on-surface leading-tight tracking-tight">
              {artwork.title}
            </h1>

            {/* Artist */}
            {artwork.artist && (
              <Link
                to={
                  ROUTES.ARTIST_PROFILE?.replace(":id", artwork.artist._id) ||
                  "#"
                }
                className="flex items-center gap-3 group/artist"
              >
                <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center overflow-hidden">
                  {artwork.artist.avatar ? (
                    <img
                      src={getMediaUrl(artwork.artist.avatar)}
                      alt={artwork.artist.name}
                      onError={(e)=> {
                        e.target.src = userPlaceholder 
                      }}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-body font-semibold text-on-surface-variant">
                      {artwork.artist.name?.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-body font-semibold tracking-[0.15em] uppercase text-on-surface-variant">
                    الفنان
                  </p>
                  <p className="text-base font-body font-medium text-on-surface group-hover/artist:text-primary transition-premium flex items-center gap-1.5">
                    {artwork.artist.name}
                    {artwork.artist.isVerified && (
                      <img src={badge} alt="موثق" className="w-6 h-6" />
                    )}
                  </p>
                </div>
              </Link>
            )}

            {/* Divider */}
            <div className="border-t border-outline-variant/40" />

            {/* Price */}
            <div>
              <p className="text-xs font-body font-semibold tracking-[0.2em] uppercase text-on-surface-variant mb-2">
                {artwork.isSold ? "سعر البيع" : "السعر"}
              </p>
              <div className="flex items-baseline gap-2">
                <span
                  className={`font-display text-4xl lg:text-5xl ${artwork.isSold ? "text-on-surface-variant line-through" : "text-primary"}`}
                >
                  {formatPrice(artwork.price)}
                </span>
                <span className="text-sm font-body font-semibold tracking-wider text-on-surface-variant">
                  <img className="w-10 h-10" src={SaCurr} alt="" />
                </span>
              </div>
              {/* Free shipping inline */}
              {freeShipping && !artwork.isSold && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
                  <Truck
                    className="w-3.5 h-3.5 text-emerald-700"
                    strokeWidth={2}
                  />
                  <span className="text-xs font-body font-semibold text-emerald-800">
                    شحن مجاني على هذه اللوحة
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            {artwork.description && (
              <div>
                <p className="text-xs font-body font-semibold tracking-[0.2em] uppercase text-on-surface-variant mb-3">
                  عن العمل
                </p>
                <p className="text-base font-body text-on-surface leading-relaxed whitespace-pre-wrap">
                  {artwork.description}
                </p>
              </div>
            )}

            {/* Specifications Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {artwork.dimensionType && (
                <SpecItem
                  icon={Ruler}
                  label="نوع الأبعاد"
                  value={
                    artwork.dimensionType === "3D"
                      ? "ثلاثي الأبعاد"
                      : "ثنائي الأبعاد"
                  }
                />
              )}
              {artwork.dimensions && (
                <SpecItem
                  icon={Ruler}
                  label="الأبعاد (سم)"
                  value={`${artwork.dimensions.width} × ${artwork.dimensions.height}${artwork.dimensions.depth ? ` × ${artwork.dimensions.depth}` : ""}`}
                />
              )}
              {(artwork.paintType || artwork.medium) && (
                <SpecItem
                  icon={Palette}
                  label="نوع الألوان / الخامات"
                  value={artwork.paintType || artwork.medium}
                />
              )}
              {artwork.canvasThickness && (
                <SpecItem
                  icon={Ruler}
                  label="سماكة الكانفاس"
                  value={artwork.canvasThickness}
                />
              )}
              {artwork.weight && (
                <SpecItem
                  icon={Weight}
                  label="الوزن"
                  value={`${artwork.weight} كجم`}
                />
              )}
              {artwork.createdAt && (
                <SpecItem
                  icon={Calendar}
                  label="سنة الإضافة"
                  value={new Date(artwork.createdAt).getFullYear()}
                />
              )}
            </div>

            {/* Tags */}
            {artwork.tags?.length > 0 && (
              <div>
                <p className="text-xs font-body font-semibold tracking-[0.2em] uppercase text-on-surface-variant mb-3">
                  الوسوم
                </p>
                <div className="flex flex-wrap gap-2">
                  {artwork.tags.map((tag) => (
                    <Link
                      key={tag}
                      to={`${ROUTES.ARTWORKS}?tags=${tag}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low border border-outline-variant/40 text-xs font-body text-on-surface-variant hover:border-secondary hover:text-secondary transition-premium"
                    >
                      <Tag className="w-3 h-3" strokeWidth={1.5} />
                      {tag}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ Shipping & Trust Info (محسّنة) ═══ */}
            <div className="space-y-3">
              {/* Free Shipping Callout (لو متاح) */}
              {freeShipping && !artwork.isSold && (
                <div className="relative overflow-hidden bg-gradient-to-l from-emerald-50 to-emerald-100/50 border border-emerald-300 rounded-xl p-4">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Gift
                        className="w-5 h-5 text-emerald-700"
                        strokeWidth={2}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-body font-bold text-emerald-900 mb-0.5">
                        شحن مجاني على هذه اللوحة
                      </p>
                      <p className="text-xs font-body text-emerald-800/80 leading-relaxed">
                        الفنان من مشتركي Prestige — الشحن على حساب المنصة لهذه
                        اللوحة
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Authenticity */}
              <div className="bg-surface-container-low border border-outline-variant/40 p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                  <Shield
                    className="w-5 h-5 text-secondary"
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <p className="text-sm font-body font-semibold text-on-surface">
                    عمل فني أصيل وموثق
                  </p>
                  <p className="text-xs font-body text-on-surface-variant mt-0.5">
                    توثيق مع كل عمل
                  </p>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="space-y-3">
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={handleAddToCart}
                  disabled={artwork.isSold || isInCartNow}
                  icon={isInCartNow ? Check : ShoppingBag}
                  iconPosition="start"
                  isLoading={isLoadingCart}
                >
                  {artwork.isSold
                    ? "هذا العمل مباع"
                    : isInCartNow
                      ? "مضاف للسلة"
                      : "أضف للسلة"}
                </Button>

                <button
                  onClick={handleFavorite}
                  aria-label="المفضلة"
                  disabled={artwork.isSold}
                  className={`w-14 h-14 shrink-0 flex items-center justify-center border transition-premium ${
                    isFavoriteLocal
                      ? "bg-primary/5 border-primary text-primary"
                      : "border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"
                  }`}
                >
                  {isLoadingFav ? (
                    <div className="animate-spin mt-2 rounded-full h-4 w-4 border-b-2 border-primary" />
                  ) : (
                    <Heart
                      className="w-5 h-5"
                      strokeWidth={1.5}
                      fill={isFavoriteLocal ? "currentColor" : "none"}
                    />
                  )}
                </button>

                <button
                  onClick={handleShare}
                  aria-label="مشاركة"
                  className="w-14 h-14 shrink-0 flex items-center justify-center border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-premium"
                >
                  <Share2 className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Related Artworks ═══ */}
        {relatedArtworks.length > 0 && (
          <section className="mt-20 lg:mt-32">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-[11px] font-body font-semibold tracking-[0.2em] uppercase text-secondary mb-2">
                  اكتشف أيضاً
                </p>
                <h2 className="font-display text-3xl lg:text-4xl text-on-surface">
                  أعمال <span className="text-primary">مشابهة</span>
                </h2>
              </div>
              <Link
                to={ROUTES.ARTWORKS}
                className="hidden sm:flex items-center gap-2 text-sm font-body font-semibold text-on-surface hover:text-primary transition-premium"
              >
                عرض الكل
                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </Link>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
              {relatedArtworks.slice(0, 4).map((art) => (
                <ArtworkCard
                  key={art._id}
                  artwork={art}
                  aspect="portrait"
                  showDimensions={false}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ═══ Zoom Modal ═══ */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setIsZoomed(false)}
        >
          <button
            onClick={() => setIsZoomed(false)}
            className="absolute top-6 left-6 w-12 h-12 bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-premium"
          >
            <X className="w-6 h-6" strokeWidth={1.5} />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImageIndex((prev) =>
                    prev > 0 ? prev - 1 : images.length - 1,
                  );
                }}
                className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-premium"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImageIndex((prev) =>
                    prev < images.length - 1 ? prev + 1 : 0,
                  );
                }}
                className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-premium"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            </>
          )}

          <img
            src={images[selectedImageIndex]}
            alt={artwork.title}
            onError={(e)=> {
              e.target.src = ArtworkPlaceholder
            }}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════

function SpecItem({ icon: Icon, label, value }) {
  return (
    <div className="bg-surface-container-low border border-outline-variant/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-secondary" strokeWidth={1.5} />
        <p className="text-[10px] font-body font-semibold tracking-[0.2em] uppercase text-on-surface-variant">
          {label}
        </p>
      </div>
      <p className="text-sm font-body font-medium text-on-surface">{value}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-[1280px] mx-auto px-5 lg:px-16 py-8 lg:py-12">
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
        <div className="aspect-[4/5] bg-surface-container animate-pulse" />
        <div className="space-y-6">
          <div className="h-4 w-24 bg-surface-container animate-pulse" />
          <div className="h-12 w-full bg-surface-container animate-pulse" />
          <div className="h-6 w-48 bg-surface-container animate-pulse" />
          <div className="border-t border-outline-variant/40" />
          <div className="h-10 w-40 bg-surface-container animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-surface-container animate-pulse" />
            <div className="h-4 w-3/4 bg-surface-container animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="font-display text-3xl text-on-surface">
          العمل غير موجود
        </h1>
        <p className="text-sm text-on-surface-variant">
          هذا العمل الفني غير متاح حالياً
        </p>
        <Link to={ROUTES.ARTWORKS}>
          <Button variant="primary">العودة للمعرض</Button>
        </Link>
      </div>
    </div>
  );
}
