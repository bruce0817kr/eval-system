"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Building2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Shield,
  type LucideIcon,
  Users,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"

type AdminNavItem = {
  title: string
  href: string
  icon: LucideIcon
}

const adminNavItems: AdminNavItem[] = [
  {
    title: "대시보드",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "평가 회차 관리",
    href: "/admin/sessions",
    icon: ClipboardList,
  },
  {
    title: "기업 관리",
    href: "/admin/companies",
    icon: Building2,
  },
  {
    title: "평가위원 관리",
    href: "/admin/committee",
    icon: Users,
  },
  {
    title: "평가표 템플릿",
    href: "/admin/templates",
    icon: FileText,
  },
  {
    title: "감사 로그",
    href: "/admin/audit-log",
    icon: Shield,
  },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const currentItem =
    adminNavItems.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    ) ?? adminNavItems[0]

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border px-2 py-3">
          <div className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-3 py-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Shield className="size-4" />
            </div>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold">선정평가 시스템</p>
              <Badge
                variant="outline"
                className="mt-1 w-fit border-primary/20 bg-primary/10 text-primary"
              >
                관리자
              </Badge>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 py-3">
          <SidebarMenu>
            {adminNavItems.map((item) => {
              const Icon = item.icon
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`)

              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isActive}
                    tooltip={item.title}
                  >
                    <Icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border px-2 py-3">
          <div className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/20 px-3 py-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <Avatar>
              <AvatarFallback>관</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium">관리자 계정</p>
              <p className="truncate text-xs text-muted-foreground">
                admin@example.com
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full justify-start group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            onClick={async () => {
              try {
                await fetch("/api/auth/logout", {
                  method: "POST",
                  credentials: "include",
                })
              } finally {
                router.push("/admin/login")
                router.refresh()
              }
            }}
          >
            <LogOut />
            <span className="group-data-[collapsible=icon]:hidden">로그아웃</span>
          </Button>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-h-svh bg-stone-50">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-stone-200 bg-stone-50/95 px-4 backdrop-blur md:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <div className="min-w-0">
            <p className="text-xs text-stone-500">관리자 포털</p>
            <p className="truncate text-sm font-medium text-stone-900">
              관리 / {currentItem.title}
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
