"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Play, Plus, MoreHorizontal, Clock, Images, Settings, Eye, Shuffle } from "lucide-react"
import { Sidebar } from "@/components/sidebar"

export default function PlaylistsPage() {
  const playlists = [
    {
      id: 1,
      name: "Sheridan",
      description: "Default playlist with landscape images",
      imageCount: 137,
      duration: "10s per image",
      displayMode: "Stack consecutive landscape images",
      isDefault: true,
      thumbnail: "/abstract-landscape-art.jpg",
      lastModified: "2 hours ago",
    },
  ]

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
                  <div className="w-2 h-8 bg-gradient-to-b from-chart-3 to-chart-4 rounded-full" />
                  <h1 className="text-3xl font-bold">Playlists</h1>
                </div>
                <p className="text-muted-foreground">Create and manage display sequences</p>
              </div>
              <Button className="bg-gradient-to-r from-secondary to-secondary/90 shadow-lg">
                <Plus className="w-4 h-4 mr-2" />
                Create Playlist
              </Button>
            </div>
          </div>

          {/* Playlists Grid */}
          <div className="animate-fade-in-up">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {playlists.map((playlist) => (
                <Card
                  key={playlist.id}
                  className="gallery-item border-0 shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden group"
                >
                  <div className="relative h-48">
                    <img
                      src={playlist.thumbnail || "/placeholder.svg"}
                      alt={playlist.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Overlay Controls */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="flex items-center gap-2">
                        <Button size="sm" className="bg-white/20 backdrop-blur-sm hover:bg-white/30">
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button size="sm" className="bg-white/20 backdrop-blur-sm hover:bg-white/30">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="sm" className="bg-white/20 backdrop-blur-sm hover:bg-white/30">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      {playlist.isDefault && <Badge className="bg-secondary text-secondary-foreground">Default</Badge>}
                    </div>

                    {/* Bottom Info */}
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="text-white font-semibold text-lg mb-1">{playlist.name}</h3>
                      <div className="flex items-center gap-4 text-white/80 text-sm">
                        <span className="flex items-center gap-1">
                          <Images className="w-3 h-3" />
                          {playlist.imageCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {playlist.duration}
                        </span>
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">{playlist.description}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Shuffle className="w-3 h-3" />
                          <span>{playlist.displayMode}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-border/50">
                        <span className="text-xs text-muted-foreground">Modified {playlist.lastModified}</span>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Create New Playlist Card */}
              <Card className="gallery-item border-2 border-dashed border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer group">
                <CardContent className="p-6 h-full flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-secondary to-accent rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                    <Plus className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2">Create New Playlist</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Organize your images into a custom display sequence
                  </p>
                  <Button variant="outline" size="sm">
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="animate-fade-in-up">
            <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="w-5 h-5 text-chart-3" />
                  Playlist Overview
                </CardTitle>
                <CardDescription>Summary of your display content</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-chart-3 mb-1">1</div>
                    <div className="text-sm text-muted-foreground">Total Playlists</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-chart-1 mb-1">137</div>
                    <div className="text-sm text-muted-foreground">Images in Playlists</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-chart-2 mb-1">23m</div>
                    <div className="text-sm text-muted-foreground">Total Duration</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-chart-4 mb-1">1</div>
                    <div className="text-sm text-muted-foreground">Active Displays</div>
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
