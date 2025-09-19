"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SettingsIcon, Server, Users, Database, Shield, Monitor, Save, AlertCircle } from "lucide-react"
import { Sidebar } from "@/components/sidebar"

export default function SettingsPage() {
  const [debugLogging, setDebugLogging] = useState(true)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 p-8 ml-64">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="animate-fade-in-up">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-8 bg-gradient-to-b from-chart-5 to-primary rounded-full" />
              <h1 className="text-3xl font-bold">System Settings</h1>
            </div>
            <p className="text-muted-foreground">Configure system-wide settings and preferences</p>
          </div>

          {/* Settings Tabs */}
          <div className="animate-fade-in-up">
            <Tabs defaultValue="general" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5 bg-card/50 backdrop-blur-sm">
                <TabsTrigger value="general" className="flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4" />
                  General
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Users
                </TabsTrigger>
                <TabsTrigger value="database" className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Database
                </TabsTrigger>
                <TabsTrigger value="admin" className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Admin
                </TabsTrigger>
                <TabsTrigger value="displays" className="flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  Displays
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-6">
                <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Server className="w-5 h-5 text-primary" />
                      General Settings
                    </CardTitle>
                    <CardDescription>Basic system configuration</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="server-url">Server Base URL</Label>
                        <Input
                          id="server-url"
                          defaultValue="http://10.10.10.2:8001"
                          className="bg-input/50 border-border/50"
                        />
                        <p className="text-xs text-muted-foreground">
                          Base URL for the server (used for API endpoints and image URLs)
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="upload-dir">Upload Directory</Label>
                        <Input id="upload-dir" defaultValue="uploads" className="bg-input/50 border-border/50" />
                        <p className="text-xs text-muted-foreground">
                          Directory for uploaded files (relative to backend root)
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="backend-port">Backend Port</Label>
                        <Input id="backend-port" defaultValue="8001" className="bg-input/50 border-border/50" />
                        <p className="text-xs text-muted-foreground">Port for the backend API server</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="frontend-port">Frontend Port</Label>
                        <Input id="frontend-port" defaultValue="3003" className="bg-input/50 border-border/50" />
                        <p className="text-xs text-muted-foreground">Port for the frontend development server</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="display-time">Default Display Time (seconds)</Label>
                        <Input id="display-time" defaultValue="30" className="bg-input/50 border-border/50" />
                        <p className="text-xs text-muted-foreground">Default time to display each image in playlists</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status-check">Display Status Check Interval (seconds)</Label>
                        <Input id="status-check" defaultValue="30" className="bg-input/50 border-border/50" />
                        <p className="text-xs text-muted-foreground">How often to check display device status</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="websocket-check">WebSocket Status Check Interval (seconds)</Label>
                        <Input id="websocket-check" defaultValue="5" className="bg-input/50 border-border/50" />
                        <p className="text-xs text-muted-foreground">
                          How often to check WebSocket display connections
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="log-level">Log Level</Label>
                        <Select defaultValue="info">
                          <SelectTrigger className="bg-input/50 border-border/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="debug">Debug</SelectItem>
                            <SelectItem value="info">Info (General information and above)</SelectItem>
                            <SelectItem value="warning">Warning</SelectItem>
                            <SelectItem value="error">Error</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Level of detail for system logging</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div className="space-y-1">
                        <Label htmlFor="debug-logging" className="text-sm font-medium">
                          Enable Debug Logging
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Enable detailed debug logging for development (may impact performance)
                        </p>
                      </div>
                      <Switch id="debug-logging" checked={debugLogging} onCheckedChange={setDebugLogging} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="users" className="space-y-6">
                <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-chart-2" />
                      User Management
                    </CardTitle>
                    <CardDescription>Manage user accounts and permissions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">User Management</h3>
                      <p className="text-muted-foreground">
                        User management features will be available in a future update
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="database" className="space-y-6">
                <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-chart-3" />
                      Database Configuration
                    </CardTitle>
                    <CardDescription>Database connection and maintenance settings</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Database Settings</h3>
                      <p className="text-muted-foreground">
                        Database configuration options will be available in a future update
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="admin" className="space-y-6">
                <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-chart-4" />
                      Admin Settings
                    </CardTitle>
                    <CardDescription>Administrative controls and security settings</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Admin Controls</h3>
                      <p className="text-muted-foreground">
                        Administrative settings will be available in a future update
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="displays" className="space-y-6">
                <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Monitor className="w-5 h-5 text-chart-5" />
                      Display Settings
                    </CardTitle>
                    <CardDescription>Configure display device defaults and behavior</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <Monitor className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Display Configuration</h3>
                      <p className="text-muted-foreground">
                        Display-specific settings will be available in a future update
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Save Button */}
          <div className="animate-fade-in-up">
            <Card className="border-0 shadow-lg bg-gradient-to-r from-primary/5 to-accent/5 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">Settings Status</p>
                      <p className="text-sm text-muted-foreground">Current system settings loaded successfully</p>
                    </div>
                  </div>
                  <Button className="bg-gradient-to-r from-primary to-primary/90 shadow-lg">
                    <Save className="w-4 h-4 mr-2" />
                    Save Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
