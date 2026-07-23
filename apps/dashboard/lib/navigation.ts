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
  FileTextIcon,
  BookOpenCheckIcon,
  GlobeIcon,
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

// Own group in the sidebar, visually separated from the main app (see
// app-sidebar.tsx's separator + group label). "Nuovo articolo" stays out of
// the sidebar on purpose - reachable from the dashboard's action button and
// the in-page BlogWriterSubnav - the other three are frequent enough
// destinations to warrant their own sidebar entries.
export const BLOG_WRITER_NAV_ITEMS: NavItem[] = [
  { href: "/blog-writer", label: "Dashboard", icon: NewspaperIcon },
  { href: "/blog-writer/drafts", label: "Bozze", icon: FileTextIcon },
  { href: "/blog-writer/articles", label: "Pubblicati", icon: BookOpenCheckIcon },
  { href: "/blog-writer/sites", label: "Siti WordPress", icon: GlobeIcon },
];

// Combined, in sidebar order - used by findNavItem so breadcrumbs still
// resolve correctly for pages nested under /blog-writer/* even though only
// the root entry appears in the sidebar itself.
export const NAV_ITEMS: NavItem[] = [...MAIN_NAV_ITEMS, ...BLOG_WRITER_NAV_ITEMS];

export function findNavItem(pathname: string): NavItem | undefined {
  if (pathname === "/") return NAV_ITEMS[0];
  return [...NAV_ITEMS].reverse().find((item) => item.href !== "/" && pathname.startsWith(item.href));
}
