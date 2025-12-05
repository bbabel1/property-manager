# Performance Strategy

The app targets fast dashboard and log views while staying SSR-friendly.

- **Rendering:** Prefer server components for data-heavy views; use client components only where interactivity is required. Streaming responses and loading states keep perceived latency low.
- **Data fetching:** SWR caches client fetches; Supabase and Buildium calls use lean selects and pagination. Expensive joins are delegated to Supabase RPCs or server actions where available.
- **Caching:** Leverage browser cache via SWR, Next.js route cache for static assets, and CDN caching for PDFs and file downloads when permitted.
- **Bundling & assets:** Tailwind + PostCSS tree-shake unused styles; image optimization and icon reuse reduce payload size.
- **Monitoring:** Sentry/OTel hooks capture slow API routes and client RUM via `/api/metrics/rum` to inform regression alerts.
