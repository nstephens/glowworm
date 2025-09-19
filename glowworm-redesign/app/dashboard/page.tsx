"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Images, FolderOpen, Play, Monitor, Upload, Plus, Settings, TrendingUp, Clock, Zap } from "lucide-react"
import { Sidebar } from "@/components/sidebar"

export default function Dashboard() {
  const stats = [
    {
      title: "Total Images",
      value: "100",
      change: "+12 this week",
      icon: Images,
      color: "text-chart-1",
      bgColor: "bg-chart-1/10",
    },
    {
      title: "Albums",
      value: "1",
      change: "Organized collections",
      icon: FolderOpen,
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
    },
    {
      title: "Playlists",
      value: "1",
      change: "Scheduled content",
      icon: Play,
      color: "text-chart-3",
      bgColor: "bg-chart-3/10",
    },
    {
      title: "Active Displays",
      value: "1",
      change: "Connected devices",
      icon: Monitor,
      color: "text-chart-4",
      bgColor: "bg-chart-4/10",
    },
  ]

  const quickActions = [
    {
      title: "Upload Images",
      description: "Add new photos to your library",
      icon: Upload,
      color: "bg-primary",
      href: "/images",
    },
    {
      title: "Create Playlist",
      description: "Organize images for display",
      icon: Plus,
      color: "bg-secondary",
      href: "/playlists",
    },
    {
      title: "Manage Displays",
      description: "Configure display devices",
      icon: Settings,
      color: "bg-accent",
      href: "/displays",
    },
  ]

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 p-8 ml-64">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="animate-fade-in-up">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-8 bg-gradient-to-b from-primary to-accent rounded-full" />
              <h1 className="text-3xl font-bold text-balance">Welcome to Glowworm</h1>
            </div>
            <p className="text-muted-foreground text-lg">Manage your digital photo displays with elegance</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in-up">
            {stats.map((stat, index) => (
              <Card key={stat.title} className="gallery-item border-0 shadow-lg bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                      <stat.icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {stat.change}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="animate-fade-in-up">
            <div className="flex items-center gap-2 mb-6">
              <Zap className="w-5 h-5 text-accent" />
              <h2 className="text-xl font-semibold">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {quickActions.map((action) => (
                <Card
                  key={action.title}
                  className="gallery-item border-0 shadow-lg bg-card/50 backdrop-blur-sm cursor-pointer group"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div
                        className={`p-3 rounded-xl ${action.color} group-hover:scale-110 transition-transform duration-200`}
                      >
                        <action.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{action.title}</h3>
                        <p className="text-sm text-muted-foreground mb-4">{action.description}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary hover:text-primary-foreground hover:bg-primary"
                          onClick={() => (window.location.href = action.href)}
                        >
                          Get Started →
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <Card className="animate-fade-in-up border-0 shadow-lg bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest updates from your photo display system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
                  <div className="w-2 h-2 bg-secondary rounded-full" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Display "Office Frame" connected</p>
                    <p className="text-xs text-muted-foreground">2 minutes ago</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
                  <div className="w-2 h-2 bg-chart-1 rounded-full" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">12 new images uploaded to "Sheridan" album</p>
                    <p className="text-xs text-muted-foreground">1 hour ago</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
                  <div className="w-2 h-2 bg-chart-3 rounded-full" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Playlist "Sheridan" updated with new display settings</p>
                    <p className="text-xs text-muted-foreground">3 hours ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
