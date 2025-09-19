"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Upload,
  Search,
  Filter,
  Grid3X3,
  List,
  MoreHorizontal,
  FolderOpen,
  ImageIcon,
  Calendar,
  HardDrive,
} from "lucide-react"
import { Sidebar } from "@/components/sidebar"

export default function ImagesPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")

  // Sample image data
  const images = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    name: `image-${i + 1}.jpg`,
    size: `${(Math.random() * 5 + 1).toFixed(1)} MB`,
    dimensions: "3840 × 2160",
    date: "9/18/2025",
    album: "sheridan",
    url: `/placeholder.svg?height=400&width=300&query=abstract digital art ${i + 1}`,
  }))

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
                  <div className="w-2 h-8 bg-gradient-to-b from-chart-1 to-chart-2 rounded-full" />
                  <h1 className="text-3xl font-bold">Image Library</h1>
                </div>
                <p className="text-muted-foreground">Manage and organize your photo collection</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="px-3 py-1">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  100 images
                </Badge>
                <Button className="bg-gradient-to-r from-primary to-primary/90 shadow-lg">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Images
                </Button>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-4 p-4 bg-card/50 backdrop-blur-sm rounded-xl border-0 shadow-lg">
              <div className="flex items-center gap-4 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search images..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-background/50 border-border/50"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Albums Section */}
          <div className="animate-fade-in-up">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-chart-2" />
              Albums
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="gallery-item border-0 shadow-lg bg-card/50 backdrop-blur-sm cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-chart-2 to-chart-3 rounded-lg flex items-center justify-center">
                      <FolderOpen className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">All Images</h3>
                      <p className="text-sm text-muted-foreground">100 images</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="gallery-item border-0 shadow-lg bg-card/50 backdrop-blur-sm cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                      <FolderOpen className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">Sheridan</h3>
                      <p className="text-sm text-muted-foreground">100 images</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Images Grid */}
          <div className="animate-fade-in-up">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-chart-1" />
              Recent Images
            </h2>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {images.map((image) => (
                  <Card
                    key={image.id}
                    className="gallery-item border-0 shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden group cursor-pointer"
                  >
                    <div className="aspect-square relative">
                      <img
                        src={image.url || "/placeholder.svg"}
                        alt={image.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Badge variant="secondary" className="text-xs">
                          {image.album}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 h-8 w-8 p-0"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                    <CardContent className="p-3">
                      <p className="text-sm font-medium truncate">{image.name}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                        <span>{image.size}</span>
                        <span>{image.date}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {images.map((image) => (
                  <Card key={image.id} className="gallery-item border-0 shadow-lg bg-card/50 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-lg overflow-hidden">
                          <img
                            src={image.url || "/placeholder.svg"}
                            alt={image.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium">{image.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <HardDrive className="w-3 h-3" />
                              {image.size}
                            </span>
                            <span>{image.dimensions}</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {image.date}
                            </span>
                          </div>
                        </div>
                        <Badge variant="secondary">{image.album}</Badge>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
