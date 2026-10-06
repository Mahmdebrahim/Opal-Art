import { Link } from "react-router-dom";
import { Truck, Eye } from "lucide-react";
import { ROUTES } from "../../../config/routes";
import { getMediaUrl } from "../../../utils/media";
import ArtworkPlaceholder from "../../../assets/ArtworkPlaceholder2.png";
import SaCurr from "../../../assets/sa.svg";

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
// FeaturedCard — كارت عرض متحفي (بدون actions)
// ═══════════════════════════════════════════════════
function FeaturedCard({ item }) {
  const freeShipping = getFreeShippingInfo(item);

  const formatPrice = (v) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v || 0);

  return (
    <Link
      to={ROUTES.ARTWORK.replace(":id", item._id)}
      className="group block flex-shrink-0 w-60 sm:w-72"
    >
      {/* ═══ الصورة ═══ */}
      <div className="relative aspect-[4/5] overflow-hidden bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)]/30">
        <img
          src={getMediaUrl(item.coverImage)}
          onError={(e) => {
            e.target.src = ArtworkPlaceholder;
          }}
          alt={item.title}
          loading="lazy"
          decoding="async"
          className={`
                        w-full h-full object-cover
                        transition-transform duration-[1200ms] ease-out
                        group-hover:scale-[1.06]
                        
                    `}
        />

        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent opacity-60 group-hover:opacity-0 transition-opacity duration-500 pointer-events-none" />

        {item.isSold && (
          <span className="absolute top-3 right-3 px-2.5 py-1 bg-[var(--color-primary)] text-white text-[9px] font-bold tracking-[0.15em] uppercase shadow-sm">
            مباع
          </span>
        )}

        {freeShipping && !item.isSold && (
          <span className="absolute top-3 left-3 px-2 py-1 rounded-full bg-emerald-600/90 backdrop-blur-sm text-white text-[9px] font-bold flex items-center gap-1 shadow-sm">
            <Truck className="w-3 h-3" strokeWidth={2.5} />
            شحن مجاني
          </span>
        )}

        <div
          className="
                        absolute inset-0
                        bg-black/50 backdrop-blur-md
                        opacity-0 group-hover:opacity-100
                        transition-opacity duration-500
                        flex flex-col items-center justify-center text-center px-5 gap-1.5
                    "
        >
          <span className="text-[9px] tracking-[0.3em] text-[#C5A880] font-semibold uppercase mb-1">
            {item.category || "عمل فني أصلي"}
          </span>

          <h3 className="font-display text-lg text-white leading-snug line-clamp-2">
            {item.title}
          </h3>

          <p className="text-[11px] text-white/70 line-clamp-1">
            {item.artist?.name}
          </p>

          <span className="w-8 h-px bg-[#C5A880]/70 my-2" />

          <p className="font-display text-xl flex items-center gap-2 text-[#C5A880]">
            {formatPrice(item.price)}
            <img src={SaCurr} className="w-5 h-5 opacity-80" alt="SAR" />
          </p>

          {item.dimensions && (
            <p className="text-[10px] text-white/50 mt-0.5">
              {item.dimensions.width} × {item.dimensions.height} سم
            </p>
          )}

          <span className="mt-3 inline-flex items-center gap-1.5 text-[10px] text-white/80 border border-white/25 rounded-full px-3 py-1.5">
            <Eye className="w-3 h-3" strokeWidth={1.5} />
            عرض اللوحة
          </span>
        </div>
      </div>

      <div className="pt-3 space-y-1">
        <p className="font-display text-sm text-[var(--color-on-surface)] line-clamp-1 group-hover:text-[var(--color-primary)] transition-colors">
          {item.title}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-[var(--color-on-surface-variant)] line-clamp-1">
            {item.artist?.name}
          </span>
          <span className="text-[11px] font-semibold text-[var(--color-primary)] shrink-0 flex items-center gap-2">
            {formatPrice(item.price)}
            <img src={SaCurr} className="w-3 h-3 opacity-80" alt="SAR" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default FeaturedCard;
