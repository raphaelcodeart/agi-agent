import { redirect } from "next/navigation";

/**
 * FastAPI's OAuth callback (apps/api/app/api/v1/buffer.py) redirects the browser to
 * a hardcoded "http://localhost:3000/admin/connections" on completion. Rather than
 * changing that backend redirect target, this route mirrors it and forwards to the
 * dashboard's actual Buffer connections page, preserving the success/error query params.
 */
export default async function AdminConnectionsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
  }
  const qs = query.toString();
  redirect(`/buffer-connections${qs ? `?${qs}` : ""}`);
}
