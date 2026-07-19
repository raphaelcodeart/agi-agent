import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal self-contained server (.next/standalone) for the Docker image.
  output: "standalone",
  // FastAPI routes are trailing-slash sensitive (e.g. /users/ vs /users). Without this,
  // Next.js strips the trailing slash from /api/backend/* requests before the catch-all
  // proxy route (app/api/backend/[...path]) ever sees it, silently breaking those calls.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
