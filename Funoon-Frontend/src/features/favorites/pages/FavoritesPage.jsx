import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  ArrowLeft,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import toast from "../../../services/toast.service";
import { favoritesService } from "../services/favorites.service";
import { getMediaUrl } from "../../../utils/media";
import { ROUTES } from "../../../config/routes";
import ArtworkPlaceholder from "../../../assets/ArtworkPlaceholder2.png";
// ═══════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════
export default function FavoritesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["favorites"],
    queryFn: () => favoritesService.getMyFavorites(),
    staleTime: 2 * 60 * 1000,
  });

  const removeMutation = useMutation({
    mutationFn: favoritesService.toggle,
    onMutate: async (artworkId) => {
      await queryClient.cancelQueries({ queryKey: ["favorites"] });
      const prev = queryClient.getQueryData(["favorites"]);
      queryClient.setQueryData(["favorites"], (old) => {
        if (!old) return old;
        const items = old?.favorites ?? old?.artworks ?? old ?? [];
        return {
          ...old,
          favorites: items.filter(
            (item) =>
              String(item._id ?? item.artwork?._id) !== String(artworkId),
          ),
        };
      });
      return { prev };
    },
    onSuccess: (_data, artworkId) => {
      toast.success("تمت الإزالة من المفضلة");

      // Refresh Favorites
      queryClient.invalidateQueries({
        queryKey: ["favorites"],
      });

      // Refresh Artworks
      queryClient.invalidateQueries({
        queryKey: ["artworks"],
      });
      queryClient.setQueryData(["artwork", String(artworkId)], (old) => {
        if (!old?.artwork) return old;

        return {
          ...old,
          artwork: {
            ...old.artwork,
            isFavorite: false,
          },
        };
      });
    },
    onError: (_err, _id, ctx) => {
      queryClient.setQueryData(["favorites"], ctx?.prev);
      toast.error("فشل إزالة العنصر");
    },
  });

  const favorites = data?.favorites ?? data?.artworks ?? [];

  if (isLoading) return <LoadingSkeleton />;
  if (isError) return <GenericErrorPage onRetry={refetch} />;

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* ═══ Header ═══ */}
      <div className="bg-[var(--color-surface-container-lowest)] border-b border-[var(--color-outline-variant)]/40 sticky top-20 z-20">
        <div className="max-w-[1280px] mx-auto px-5 lg:px-16 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heart
                className="w-5 h-5 text-[var(--color-primary)]"
                strokeWidth={1.5}
                fill="currentColor"
              />
              <h1 className="font-display text-xl text-[var(--color-on-surface)]">
                المفضلة
              </h1>
              {favorites.length > 0 && (
                <span className="text-sm font-body text-[var(--color-on-surface-variant)]">
                  ({favorites.length})
                </span>
              )}
            </div>
            <Link
              to={ROUTES.ARTWORKS}
              className="flex items-center gap-1.5 text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-premium"
            >
              <span>تصفح المعرض</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* ═══ Content ═══ */}
      <div className="max-w-[1280px] mx-auto px-5 lg:px-16 py-8">
        {favorites.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {favorites.map((item) => {
              // الـ API ممكن يرجع { artwork: {...} } أو directly الـ artwork object
              const artwork = item.artwork ?? item;
              return (
                <FavoriteCard
                  key={artwork._id}
                  artwork={artwork}
                  onRemove={() => removeMutation.mutate(String(artwork._id))}
                  isRemoving={removeMutation.isPending}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Favorite Card
// ═══════════════════════════════════════════════════
function FavoriteCard({ artwork, onRemove, isRemoving }) {
  const imageUrl = getMediaUrl(artwork.coverImage ?? artwork.images?.[0]);

  const artistName = artwork.artist?.name ?? artwork.artistName ?? "فنان مجهول";

  const formatPrice = (value) => {
    if (!value) return "—";

    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <article className="group relative">
      {/* Image */}
      <Link to={`/artworks/${artwork._id}`} className="block">
        <div className="relative overflow-hidden bg-[var(--color-surface-container)] aspect-[3/4]">
          {imageUrl ? (
            <img
              src={imageUrl}
              onError={(e) => {
                e.target.src = ArtworkPlaceholder;
              }}
              alt={artwork.title}
              className="
                absolute inset-0
                w-full h-full
                object-cover
                transition-transform duration-700 ease-out
                group-hover:scale-105
              "
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-surface-container)]">
              <Heart
                className="w-10 h-10 text-[var(--color-outline-variant)]"
                strokeWidth={1}
              />
            </div>
          )}

          {/* Subtle hover overlay */}
          <div
            className="
              absolute inset-0
              bg-gradient-to-t
              from-black/40
              via-transparent
              to-transparent
              opacity-0
              group-hover:opacity-100
              transition-opacity duration-500
              pointer-events-none
            "
          />

          {/* Prestige Badge */}
          {artwork.artist?.plan?.id === "opal_prestige" && (
            <div
              className="
                absolute top-3 right-3
                px-2.5 py-1
                bg-[var(--color-primary)]
                text-white
                text-[9px]
                font-body font-semibold
                tracking-[0.12em]
                uppercase
              "
            >
              Prestige
            </div>
          )}

          {/* Remove Favorite */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
            disabled={isRemoving}
            aria-label="إزالة من المفضلة"
            title="إزالة من المفضلة"
            className="
              absolute top-3 left-3
              z-20
              w-9 h-9
              flex items-center justify-center
              bg-white
              backdrop-blur-sm
              text-[var(--color-on-surface-variant)]
              border border-[var(--color-outline-variant)]/30
              lg:opacity-0
              -translate-x-2
              group-hover:opacity-100
              group-hover:translate-x-0
              hover:text-secondary
              hover:bg-white
              transition-all duration-300
              disabled:opacity-40
            "
          >
            {isRemoving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-secondary" />
            ) : (
              <Heart
                className="w-4 h-4"
                strokeWidth={1.5}
                fill="currentColor"
              />
            )}
          </button>
        </div>

        {/* Info */}
        <div className="pt-4 pb-2">
          {/* Title */}
          <h3
            className="
              font-display
              text-lg
              text-[var(--color-on-surface)]
              leading-tight
              line-clamp-1
              group-hover:text-[var(--color-primary)]
              transition-premium
            "
          >
            {artwork.title}
          </h3>

          {/* Artist */}
          <p
            className="
              text-xs
              font-body
              font-medium
              tracking-wide
              text-[var(--color-on-surface-variant)]
              mt-2
              truncate
            "
          >
            {artistName}
          </p>

          {/* Divider */}
          <div className="my-3 border-t border-[var(--color-outline-variant)]/40" />

          {/* Price */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span
                className="
                  text-[9px]
                  font-body
                  font-semibold
                  tracking-[0.15em]
                  uppercase
                  text-[var(--color-on-surface-variant)]
                  mb-1
                "
              >
                السعر
              </span>

              <span
                className="
                  font-display
                  text-lg
                  leading-none
                  text-[var(--color-primary)]
                "
              >
                {formatPrice(artwork.price)} ر.س
              </span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}

// ═══════════════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════════════
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-full bg-[var(--color-surface-container)] flex items-center justify-center mb-6">
        <Heart
          className="w-9 h-9 text-[var(--color-outline-variant)]"
          strokeWidth={1}
        />
      </div>
      <h2 className="font-display text-2xl text-[var(--color-on-surface)] mb-2">
        المفضلة فارغة
      </h2>
      <p className="text-sm font-body text-[var(--color-on-surface-variant)] mb-8 max-w-xs">
        أضف الأعمال الفنية التي تعجبك إلى المفضلة وستجدها هنا
      </p>
      <Link
        to={ROUTES.ARTWORKS}
        className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary)]/90 transition-premium"
      >
        <span>تصفح المعرض</span>
        <ArrowLeft className="w-4 h-4" />
      </Link>
    </div>
  );
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
          تعذّر تحميل المفضلة
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

// ═══════════════════════════════════════════════════
// Loading Skeleton
// ═══════════════════════════════════════════════════
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <div className="bg-[var(--color-surface-container-lowest)] border-b border-[var(--color-outline-variant)]/40 py-5">
        <div className="max-w-[1280px] mx-auto px-5 lg:px-16">
          <div className="h-7 w-32 bg-[var(--color-surface-container)] animate-pulse" />
        </div>
      </div>
      <div className="max-w-[1280px] mx-auto px-5 lg:px-16 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] bg-[var(--color-surface-container)]" />
              <div className="pt-4 space-y-2">
                <div className="h-4 bg-[var(--color-surface-container)] w-3/4" />
                <div className="h-3 bg-[var(--color-surface-container)] w-1/2" />
                <div className="h-4 bg-[var(--color-surface-container)] w-1/4 mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
