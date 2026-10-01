import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "../../../services/toast.service";
import { favoritesService } from "../services/favorites.service";

export function useFavorites() {
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: favoritesService.toggle,
    onMutate: async (artworkId) => {
      await queryClient.cancelQueries({ queryKey: ["artworks"] });

      const previousQueries = queryClient.getQueriesData({
        queryKey: ["artworks", "favorites"],
      });

      queryClient.setQueriesData({ queryKey: ["artworks"] }, (old) => {
        if (!old?.artworks) return old;

        return {
          ...old,
          artworks: old.artworks.map((artwork) =>
            String(artwork._id) === String(artworkId)
              ? { ...artwork, isFavorite: !artwork.isFavorite }
              : artwork,
          ),
        };
      });

      return { previousQueries };
    },
    onSuccess: (data, artworkId) => {
      const isFavorite = data?.isFavorite ?? false;

      // Update artworks cache
      queryClient.setQueriesData({ queryKey: ["artworks"] }, (old) => {
        if (!old?.artworks) return old;

        return {
          ...old,
          artworks: old.artworks.map((artwork) =>
            String(artwork._id) === String(artworkId)
              ? { ...artwork, isFavorite }
              : artwork,
          ),
        };
      });

      // Update single artwork cache
      queryClient.setQueryData(["artwork", artworkId], (old) => {
        if (!old?.artwork) return old;

        return {
          ...old,
          artwork: {
            ...old.artwork,
            isFavorite,
          },
        };
      });

      // Refresh Favorites page
      queryClient.invalidateQueries({
        queryKey: ["favorites"],
      });

      // Refresh Artworks page
      queryClient.invalidateQueries({
        queryKey: ["artworks"],
      });

      if (isFavorite) {
        toast.success("تمت الإضافة للمفضلة");
      } else {
        toast.success("تمت الإزالة من المفضلة");
      }
    },
    onError: (error, _artworkId, context) => {
      context?.previousQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error(error?.message || "فشل تحديث المفضلة");
    },
  });

  const toggleFavorite = async (artworkId) => {
    return toggleMutation.mutateAsync(String(artworkId));
  };

  return {
    toggleFavorite,
    isLoading: toggleMutation.isPending,
  };
}
