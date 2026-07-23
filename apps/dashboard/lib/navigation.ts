import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboardIcon,
  UsersIcon,
  UsersRoundIcon,
  LinkIcon,
  Share2Icon,
  ImagesIcon,
  MegaphoneIcon,
  SendIcon,
  AlertOctagonIcon,
  SettingsIcon,
  NewspaperIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const MAIN_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/users", label: "Utenti", icon: UsersIcon },
  { href: "/groups", label: "Gruppi", icon: UsersRoundIcon },
  { href: "/buffer-connections", label: "Connessioni Buffer", icon: LinkIcon },
  { href: "/channels", label: "Canali social", icon: Share2Icon },
  { href: "/media", label: "Media", icon: ImagesIcon },
  { href: "/campaigns", label: "Campagne", icon: MegaphoneIcon },
  { href: "/publications", label: "Pubblicazioni", icon: SendIcon },
  { href: "/errors", label: "Centro errori", icon: AlertOctagonIcon },
  { href: "/settings", label: "Impostazioni", icon: SettingsIcon },
];

// Single entry point in the sidebar - "Nuovo articolo"/"Bozze"/"Pubblicati"/
// "Siti WordPress" are reachable as action cards from the Blog Writer
// dashboard itself (and a shared sub-nav on each of its pages), not as
// separate top-level sidebar items. Keeps the two "products" visually and
// structurally distinct (see app-sidebar.tsx's separator).
export const BLOG_WRITER_NAV_ITEMS: NavItem[] = [
  { href: "/blog-writer", label: "Blog Writer AI", icon: NewspaperIcon },
];

// Combined, in sidebar order - used by findNavItem so breadcrumbs still
// resolve correctly for pages nested under /blog-writer/* even though only
// the root entry appears in the sidebar itself.
export const NAV_ITEMS: NavItem[] = [...MAIN_NAV_ITEMS, ...BLOG_WRITER_NAV_ITEMS];

export function findNavItem(pathname: string): NavItem | undefined {
  if (pathname === "/") return NAV_ITEMS[0];
  return [...NAV_ITEMS].reverse().find((item) => item.href !== "/" && pathname.startsWith(item.href));
}
