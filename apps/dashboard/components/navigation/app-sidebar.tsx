"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Rss, LogOutIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useLogout } from "@/hooks/use-auth";
import {
  MAIN_NAV_ITEMS,
  BUFFER_NAV_ITEMS,
  BLOG_WRITER_NAV_ITEMS,
  SETTINGS_NAV_ITEM,
  type NavItem,
} from "@/lib/navigation";

function NavItems({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <SidebarMenu>
      {items.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton isActive={isActive} tooltip={item.label} render={<Link href={item.href} />}>
              <item.icon />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const logout = useLogout();
  const isSettingsActive = pathname.startsWith(SETTINGS_NAV_ITEM.href);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="glow-primary flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-gradient text-primary-foreground">
            <Rss className="size-4" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="gradient-text truncate text-sm font-semibold">Social Publisher</p>
            <p className="truncate text-xs text-muted-foreground">Admin Console</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <NavItems items={MAIN_NAV_ITEMS} pathname={pathname} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Social Publisher Buffer</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavItems items={BUFFER_NAV_ITEMS} pathname={pathname} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Blog Writer AI</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavItems items={BLOG_WRITER_NAV_ITEMS} pathname={pathname} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isSettingsActive}
              tooltip={SETTINGS_NAV_ITEM.label}
              render={<Link href={SETTINGS_NAV_ITEM.href} />}
            >
              <SETTINGS_NAV_ITEM.icon />
              <span>{SETTINGS_NAV_ITEM.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Esci"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="text-destructive hover:text-destructive"
            >
              <LogOutIcon />
              <span>Esci</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
