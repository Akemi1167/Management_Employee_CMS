import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AppRoutes } from '@/routes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
      <Toaster
        position="top-right"
        richColors
        closeButton
        theme="dark"
        style={{ zIndex: 100000 }}
        toastOptions={{ style: { zIndex: 100000 } }}
      />
    </QueryClientProvider>
  );
}
