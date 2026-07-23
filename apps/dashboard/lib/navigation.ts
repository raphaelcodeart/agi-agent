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
  Trash2Icon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Ungrouped/general items at the top of the sidebar - accounts, resources,
// connections. No section label, same as before.
export const MAIN_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/users", label: "Utenti", icon: UsersIcon },
  { href: "/groups", label: "Gruppi", icon: UsersRoundIcon },
  { href: "/buffer-connections", label: "Connessioni Buffer", icon: LinkIcon },
  { href: "/channels", label: "Canali social", icon: Share2Icon },
  { href: "/media", label: "Media", icon: ImagesIcon },
];

// Its own labeled group - the actual campaign execution/monitoring side of
// the Buffer integration, separated from the account/resource management
// items above it.
export const BUFFER_NAV_ITEMS: NavItem[] = [
  { href: "/campaigns", label: "Campagne", icon: MegaphoneIcon },
  { href: "/publications", label: "Pubblicazioni", icon: SendIcon },
  { href: "/errors", label: "Centro errori", icon: AlertOctagonIcon },
];

// Own group in the sidebar, visually separated from the main app (see
// app-sidebar.tsx's separator + group label). "Nuovo articolo" stays out of
// the sidebar on purpose - reachable from the dashboard's action button and
// the in-page BlogWriterSubnav - the other three are frequent enough
// destinations to warrant their own sidebar entries.
export const BLOG_WRITER_NAV_ITEMS: NavItem[] = [
  { href: "/blog-writer", label: "Dashboard BWA", icon: NewspaperIcon },
  { href: "/blog-writer/drafts", label: "Bozze", icon: FileTextIcon },
  { href: "/blog-writer/articles", label: "Pubblicati", icon: BookOpenCheckIcon },
  { href: "/blog-writer/sites", label: "Siti WordPress", icon: GlobeIcon },
  { href: "/blog-writer/trash", label: "Cestino", icon: Trash2Icon },
];

// Rendered in the sidebar footer, below everything else - not part of any
// group above. "Esci" (logout) sits right underneath it (see app-sidebar.tsx).
export const SETTINGS_NAV_ITEM: NavItem = { href: "/settings", label: "Impostazioni", icon: SettingsIcon };

// Combined, in sidebar order - used by findNavItem so breadcrumbs resolve
// correctly even though items live in different visual groups/the footer.
export const NAV_ITEMS: NavItem[] = [...MAIN_NAV_ITEMS, ...BUFFER_NAV_ITEMS, ...BLOG_WRITER_NAV_ITEMS, SETTINGS_NAV_ITEM];

export function findNavItem(pathname: string): NavItem | undefined {
  if (pathname === "/") return NAV_ITEMS[0];
  return [...NAV_ITEMS].reverse().find((item) => item.href !== "/" && pathname.startsWith(item.href));
}
