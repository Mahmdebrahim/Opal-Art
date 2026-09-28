import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { setSharedQueryClient } from "../features/auth/stores/authStore";
import ToastViewport from "../components/Ui/ToastViewport";
import GalleryIntro from "../components/layout/GalleryIntro";

// const queryClient = new QueryClient({
//   defaultOptions: {
//     queries: {
//       staleTime: 5 * 60 * 1000,
//       retry: 1,
//       refetchOnWindowFocus: false,
//     },
//   },
// })

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      networkMode: "always",
    },
    mutations: {
      retry: false,
      networkMode: "always",
    },
  },
});

// ربط الـ queryClient بالـ authStore عشان logout يمسح الـ cache
setSharedQueryClient(queryClient);

export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <GalleryIntro />
        {children}
        <ToastViewport />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
