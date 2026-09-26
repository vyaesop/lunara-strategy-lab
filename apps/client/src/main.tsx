import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { router } from "./app";
import { applyTheme, loadTheme, loadToken } from "./lib/platform";
import "./styles.css";

applyTheme(loadTheme());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: (count, err) => count < 2 && !(err instanceof Error && "status" in err && (err as { status: number }).status === 401) },
  },
});

// Load the stored bearer token before the first request is made.
void loadToken().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
});
