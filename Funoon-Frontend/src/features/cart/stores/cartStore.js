// import { create } from "zustand";
// import { cartService } from "../services/cart.service";

// export const useCartStore = create((set, get) => ({
//   items: [],
//   summary: { subtotal: 0, totalShipping: 0, total: 0 },
//   isLoading: false,
//   isInCartMap: {},
//   _syncing: false, 

//   fetchCart: async () => {
//     set({ isLoading: true });
//     try {
//       const cart = await cartService.getCart();
//       const isInCartMap = {};
//       cart.items?.forEach((item) => {
//         const id = item.artwork?._id ?? item.artwork;
//         if (id) isInCartMap[String(id)] = true;
//       });
//       set({
//         items: cart.items || [],
//         summary: cart.summary || { subtotal: 0, totalShipping: 0, total: 0 },
//         isInCartMap,
//         isLoading: false,
//       });
//     } catch (error) {
//       console.error("Failed to fetch cart:", error);
//       set({ isLoading: false });
//     }
//   },

//   isInCart: (artworkId) => !!get().isInCartMap[String(artworkId)],

//   resetCart: () =>
//     set({
//       items: [],
//       summary: { subtotal: 0, totalShipping: 0, total: 0 },
//       isInCartMap: {},
//       isLoading: false,
//     }),

//   syncAfterPayment: async () => {
//     if (get()._syncing) return; // منع تزامن أكتر من polling
//     set({ _syncing: true });
//     try {
//       // استنى لحظة عشان الـ webhook ياخد وقته يفضي السلة
//       await new Promise((resolve) => setTimeout(resolve, 1000));

//       let attempts = 0;
//       const maxAttempts = 8; // ~12 ثانية كحد أقصى

//       while (attempts < maxAttempts) {
//         await get().fetchCart();
//         if (get().items.length === 0) break; 
//         attempts += 1;
//         if (attempts < maxAttempts) {
//           await new Promise((resolve) => setTimeout(resolve, 1500));
//         }
//       }
//     } catch (error) {
//       console.error("syncAfterPayment error:", error);
//     } finally {
//       set({ _syncing: false });
//     }
//   },

//   addItem: async (artworkId) => {
//     const id = String(artworkId);
//     set((state) => ({
//       isInCartMap: { ...state.isInCartMap, [id]: true },
//     }));
//     try {
//       await cartService.addItem(id);
//       await get().fetchCart();
//       return true;
//     } catch (error) {
//       set((state) => {
//         const nextMap = { ...state.isInCartMap };
//         delete nextMap[id];
//         return { isInCartMap: nextMap };
//       });
//       throw error;
//     }
//   },

//   removeItem: async (artworkId) => {
//     const id = String(artworkId);
//     const previousMap = get().isInCartMap;
//     set((state) => {
//       const nextMap = { ...state.isInCartMap };
//       delete nextMap[id];
//       return { isInCartMap: nextMap };
//     });
//     try {
//       await cartService.removeItem(id);
//       await get().fetchCart();
//       return true;
//     } catch (error) {
//       set({ isInCartMap: previousMap });
//       throw error;
//     }
//   },

//   clearCart: async () => {
//     try {
//       await cartService.clearCart();
//       set({
//         items: [],
//         summary: { subtotal: 0, totalShipping: 0, total: 0 },
//         isInCartMap: {},
//       });
//       return true;
//     } catch (error) {
//       throw error;
//     }
//   },
// }));


import { create } from "zustand";
import { cartService } from "../services/cart.service";

export const useCartStore = create((set, get) => ({
  items: [],
  artist: null, 
  summary: { subtotal: 0, totalShipping: 0, total: 0 },
  isLoading: false,
  isError: false,
  isInCartMap: {},
  _syncing: false,

  fetchCart: async () => {
    set({ isLoading: true });
    try {
      const cart = await cartService.getCart();
      const isInCartMap = {};
      cart.items?.forEach((item) => {
        const id = item.artwork?._id ?? item.artwork;
        if (id) isInCartMap[String(id)] = true;
      });
      set({
        items: cart.items || [],
        artist: cart.artist || null,
        summary: cart.summary || { subtotal: 0, totalShipping: 0, total: 0 },
        isInCartMap,
        isLoading: false,
        isError: false, 
      });
    } catch (error) {
      set({ isLoading: false });
      set({ isError: true });
    }
  },

  isInCart: (artworkId) => !!get().isInCartMap[String(artworkId)],

  resetCart: () =>
    set({
      items: [],
      artist: null, 
      summary: { subtotal: 0, totalShipping: 0, total: 0 },
      isInCartMap: {},
      isLoading: false,
      isError: false,
    }),

  syncAfterPayment: async () => {
    if (get()._syncing) return;
    set({ _syncing: true });
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      let attempts = 0;
      const maxAttempts = 8;

      while (attempts < maxAttempts) {
        await get().fetchCart();
        if (get().items.length === 0) break;
        attempts += 1;
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    } catch (error) {
    } finally {
      set({ _syncing: false });
    }
  },

  addItem: async (artworkId) => {
    const id = String(artworkId);
    set((state) => ({
      isInCartMap: { ...state.isInCartMap, [id]: true },
    }));
    try {
      await cartService.addItem(id);
      await get().fetchCart();
      return true;
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error?.message || "";
      const isArtistError = errorMessage.includes("فنانين مختلفين");

      if (isArtistError) {
        set((state) => {
          const nextMap = { ...state.isInCartMap };
          delete nextMap[id];
          return { isInCartMap: nextMap };
        });

        // Extract artist name from error message
        const artistNameMatch = errorMessage.match(/"([^"]+)"/);
        const artistName = artistNameMatch ? artistNameMatch[1] : "فنان آخر";

        // Throw special error for UI to handle
        throw { type: "DIFFERENT_ARTIST", artistName };
      }

      // Other errors - revert optimistic update
      set((state) => {
        const nextMap = { ...state.isInCartMap };
        delete nextMap[id];
        return { isInCartMap: nextMap };
      });
      throw error;
    }
  },

  clearAndAdd: async (artworkId) => {
    const id = String(artworkId);
    try {
      await cartService.clearCart();
      await cartService.addItem(id);
      await get().fetchCart();
      return true;
    } catch (error) {
      throw error;
    }
  },

  removeItem: async (artworkId) => {
    const id = String(artworkId);
    const previousMap = get().isInCartMap;
    set((state) => {
      const nextMap = { ...state.isInCartMap };
      delete nextMap[id];
      return { isInCartMap: nextMap };
    });
    try {
      await cartService.removeItem(id);
      await get().fetchCart();
      return true;
    } catch (error) {
      set({ isInCartMap: previousMap });
      throw error;
    }
  },

  clearCart: async () => {
    try {
      await cartService.clearCart();
      set({
        items: [],
        artist: null, 
        summary: { subtotal: 0, totalShipping: 0, total: 0 },
        isInCartMap: {},
      });
      return true;
    } catch (error) {
      throw error;
    }
  },
}));