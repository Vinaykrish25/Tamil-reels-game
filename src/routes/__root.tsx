import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass max-w-md rounded-3xl p-10 text-center">
        <h1 className="neon-text text-7xl font-extrabold">404</h1>
        <h2 className="mt-3 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This room doesn&apos;t exist. Head home and start a new game.
        </p>
        <Link
          to="/"
          className="neon-btn hover:neon-btn-hover mt-6 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass max-w-md rounded-3xl p-10 text-center">
        <h1 className="text-xl font-semibold">This page didn&apos;t load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something glitched. Try again.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="neon-btn hover:neon-btn-hover rounded-full px-5 py-2.5 text-sm"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-full border border-border bg-secondary px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#180b2b" },
      { title: "Tamil Movie Imposter — Multiplayer Party Game" },
      {
        name: "description",
        content:
          "Live multiplayer Tamil Movie Imposter party game. Create a room, share the link, drop clues, spot the imposter — 3 to 8 players, plays on any device.",
      },
      { property: "og:title", content: "Tamil Movie Imposter — Multiplayer Party Game" },
      {
        property: "og:description",
        content:
          "Guess the Tamil movie, spot the imposter. Real-time multiplayer party game with clues, chat and live emoji reactions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Tamil Movie Imposter — Multiplayer Party Game" },
      {
        name: "description",
        content:
          "Live multiplayer Tamil Movie Imposter party game. Create a room, share the link, drop clues, spot the imposter — 3 to 8 players, plays on any device.",
      },
      {
        property: "og:description",
        content:
          "Live multiplayer Tamil Movie Imposter party game. Create a room, share the link, drop clues, spot the imposter — 3 to 8 players, plays on any device.",
      },
      {
        name: "twitter:description",
        content:
          "Live multiplayer Tamil Movie Imposter party game. Create a room, share the link, drop clues, spot the imposter — 3 to 8 players, plays on any device.",
      },
      { property: "og:image", content: "/og-image.png" },
      { name: "twitter:image", content: "/og-image.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme="dark" position="top-center" richColors />
    </QueryClientProvider>
  );
}
