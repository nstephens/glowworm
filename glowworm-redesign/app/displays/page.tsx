"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Monitor, Plus, Wifi, Settings, RefreshCw, Power, Clock, Activity, Zap } from "lucide-react"
import { Sidebar } from "@/components/sidebar"

export default function DisplaysPage() {
  const displays = [
    {
      id: 1,
      name: "Office Frame",
      token: "MRTC...",
      status: "authorized",
      playlist: "Sheridan",
      lastSeen: "2 minutes ago",
      created: "9/19/2025, 12:38:07 AM",
      authorized: "9/19/2025, 12:38:21 AM",
      resolution: "4K Portrait",
      connection: "WiFi",
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "authorized":
        return "bg-secondary text-secondary-foreground"
      case "pending":
        return "bg-chart-3 text-white"
      case "rejected":
        return "bg-destructive text-destructive-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "authorized":
        return <Zap className="w-3 h-3" />
      case "pending":
        return <Clock className="w-3 h-3" />
      case "rejected":
        return <Power className="w-3 h-3" />
      default:
        return <Activity className="w-3 h-3" />
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 p-8 ml-64">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-2 h-8 bg-gradient-to-b from-chart-4 to-chart-5 rounded-full" />
                  <h1 className="text-3xl font-bold">Display Devices</h1>
                </div>
                <p className="text-muted-foreground">Manage and monitor your connected displays</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Button className="bg-gradient-to-r from-accent to-accent/90 shadow-lg">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Display
                </Button>
              </div>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="animate-fade-in-up">
            <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
              <Button variant="default" size="sm" className="shadow-sm">
                Active Devices (1)
              </Button>
              <Button variant="ghost" size="sm">
                Pending Devices (0)
              </Button>
              <Button variant="ghost" size="sm">
                Rejected Devices (0)
              </Button>
            </div>
          </div>

          {/* Displays Grid */}
          <div className="animate-fade-in-up">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {displays.map((display) => (
                <Card key={display.id} className="gallery-item border-0 shadow-lg bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-chart-4 to-chart-5 rounded-xl flex items-center justify-center">
                          <Monitor className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{display.name}</CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            <span>Token: {display.token}</span>
                          </CardDescription>
                        </div>
                      </div>
                      <Badge className={getStatusColor(display.status)}>
                        {getStatusIcon(display.status)}
                        <span className="ml-1 capitalize">{display.status}</span>
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Current Status */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Current Playlist</p>
                        <p className="font-semibold">{display.playlist}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Resolution</p>
                        <p className="font-semibold">{display.resolution}</p>
                      </div>
                    </div>

                    {/* Connection Info */}
                    <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-secondary" />
                        <span className="text-sm font-medium">{display.connection}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-secondary" />
                        <span className="text-sm">Last seen {display.lastSeen}</span>
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Created:</span>
                        <span>{display.created}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Authorized:</span>
                        <span>{display.authorized}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-4 border-t border-border/50">
                      <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                        <Settings className="w-4 h-4 mr-2" />
                        Configure
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                        Change Playlist
                      </Button>
                      <Button variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Add New Display Card */}
              <Card className="gallery-item border-2 border-dashed border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group">
                <CardContent className="p-6 h-full flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-accent to-secondary rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                    <Plus className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2">Add New Display</h3>
                  <p className="text-sm text-muted-foreground mb-4">Connect a new 4K display device to your network</p>
                  <Button variant="outline" size="sm">
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* System Status */}
          <div className="animate-fade-in-up">
            <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-chart-4" />
                  System Status
                </CardTitle>
                <CardDescription>Overall health of your display network</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-secondary mb-1">1</div>
                    <div className="text-sm text-muted-foreground">Active Displays</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-chart-2 mb-1">100%</div>
                    <div className="text-sm text-muted-foreground">Uptime</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-chart-3 mb-1">0</div>
                    <div className="text-sm text-muted-foreground">Pending Auth</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-chart-1 mb-1">2.1s</div>
                    <div className="text-sm text-muted-foreground">Avg Response</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
