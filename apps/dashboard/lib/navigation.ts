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
  SparklesIcon,
  FileTextIcon,
  BookOpenCheckIcon,
  GlobeIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/users", label: "Utenti", icon: UsersIcon },
  { href: "/groups", label: "Gruppi", icon: UsersRoundIcon },
  { href: "/buffer-connections", label: "Connessioni Buffer", icon: LinkIcon },
  { href: "/channels", label: "Canali social", icon: Share2Icon },
  { href: "/media", label: "Media", icon: ImagesIcon },
  { href: "/campaigns", label: "Campagne", icon: MegaphoneIcon },
  { href: "/publications", label: "Pubblicazioni", icon: SendIcon },
  { href: "/errors", label: "Centro errori", icon: AlertOctagonIcon },
  { href: "/blog-writer", label: "Blog Writer AI", icon: NewspaperIcon },
  { href: "/blog-writer/new", label: "Blog Writer · Nuovo articolo", icon: SparklesIcon },
  { href: "/blog-writer/drafts", label: "Blog Writer · Bozze", icon: FileTextIcon },
  { href: "/blog-writer/articles", label: "Blog Writer · Pubblicati", icon: BookOpenCheckIcon },
  { href: "/blog-writer/sites", label: "Blog Writer · Siti WordPress", icon: GlobeIcon },
  { href: "/settings", label: "Impostazioni", icon: SettingsIcon },
];

export function findNavItem(pathname: string): NavItem | undefined {
  if (pathname === "/") return NAV_ITEMS[0];
  return [...NAV_ITEMS].reverse().find((item) => item.href !== "/" && pathname.startsWith(item.href));
}
