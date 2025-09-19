"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Camera,
  LayoutDashboard,
  Images,
  Play,
  Monitor,
  Settings,
  LogOut,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    current: true,
  },
  {
    name: "Images",
    href: "/images",
    icon: Images,
    current: false,
    badge: "100",
  },
  {
    name: "Playlists",
    href: "/playlists",
    icon: Play,
    current: false,
    badge: "1",
  },
  {
    name: "Displays",
    href: "/displays",
    icon: Monitor,
    current: false,
    badge: "1",
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    current: false,
  },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div
      className={cn(
        "fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 z-50",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Camera className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="font-bold text-sidebar-foreground">Glowworm</h2>
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-accent" />
                    <span className="text-xs text-muted-foreground">Gallery</span>
                  </div>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8 p-0 hover:bg-sidebar-accent"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => (
            <Button
              key={item.name}
              variant={item.current ? "default" : "ghost"}
              className={cn(
                "w-full justify-start h-11 transition-all duration-200",
                collapsed ? "px-3" : "px-4",
                item.current
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
              onClick={() => (window.location.href = item.href)}
            >
              <item.icon className={cn("w-5 h-5", collapsed ? "" : "mr-3")} />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{item.name}</span>
                  {item.badge && (
                    <Badge variant={item.current ? "secondary" : "outline"} className="ml-auto text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </>
              )}
            </Button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start h-11 text-muted-foreground hover:text-destructive hover:bg-destructive/10",
              collapsed ? "px-3" : "px-4",
            )}
            onClick={() => (window.location.href = "/")}
          >
            <LogOut className={cn("w-5 h-5", collapsed ? "" : "mr-3")} />
            {!collapsed && <span>Logout</span>}
          </Button>
        </div>
      </div>
    </div>
  )
}
