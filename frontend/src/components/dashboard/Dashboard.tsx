import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  HardDrive, 
  Upload, 
  Download,
  Star,
  Share,
  Clock,
  Settings,
  RefreshCw,
  Filter,
  Search,
  Grid,
  List,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  AnimatedCounter, 
  CounterCard, 
  StatCard 
} from './AnimatedCounter';
import { CompactInfoCard } from './CompactInfoCard';
import { ActivityTimeline, ActivityTimelineCard } from './ActivityTimeline';
import { UsageChart, StorageChart, TrendChart } from './UsageChart';
import { SmartRecommendations, RecommendationCard } from './SmartRecommendations';
import { DashboardSkeleton } from './DashboardSkeleton';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface DashboardData {
  stats: {
    totalFiles: number;
    totalStorage: number;
    totalUsers: number;
    totalDownloads: number;
    uploadsToday: number;
    downloadsToday: number;
  };
  storage: {
    used: number;
    total: number;
    breakdown: {
      images: number;
      videos: number;
      documents: number;
      other: number;
    };
  };
  trends: {
    uploads: { labels: string[]; values: number[]; trend: 'up' | 'down' | 'stable' };
    downloads: { labels: string[]; values: number[]; trend: 'up' | 'down' | 'stable' };
  };
  activities: any[]; // ActivityItem[]
  recommendations: any[]; // Recommendation[]
}

interface DashboardProps {
  data?: DashboardData;
  loading?: boolean;
  className?: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

export const Dashboard: React.FC<DashboardProps> = ({
  data,
  loading = false,
  className,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Mock data for demonstration
  const mockData: DashboardData = {
    stats: {
      totalFiles: 1247,
      totalStorage: 2.4 * 1024 * 1024 * 1024, // 2.4 GB
      totalUsers: 23,
      totalDownloads: 3456,
      uploadsToday: 12,
      downloadsToday: 8,
    },
    storage: {
      used: 1.8 * 1024 * 1024 * 1024, // 1.8 GB
      total: 5 * 1024 * 1024 * 1024, // 5 GB
      breakdown: {
        images: 1.2 * 1024 * 1024 * 1024,
        videos: 0.4 * 1024 * 1024 * 1024,
        documents: 0.15 * 1024 * 1024 * 1024,
        other: 0.05 * 1024 * 1024 * 1024,
      },
    },
    trends: {
      uploads: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        values: [12, 19, 8, 15, 22, 18, 14],
        trend: 'up',
      },
      downloads: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        values: [8, 15, 12, 18, 25, 20, 16],
        trend: 'up',
      },
    },
    activities: [
      {
        id: '1',
        type: 'upload' as const,
        title: 'New photos uploaded',
        description: '5 photos added to "Summer Vacation" album',
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        user: 'John Doe',
        metadata: {
          fileSize: '2.4 MB',
          fileType: 'image/jpeg',
          albumName: 'Summer Vacation',
          tags: ['vacation', 'beach', 'family'],
        },
      },
      {
        id: '2',
        type: 'download' as const,
        title: 'Files downloaded',
        description: '3 documents downloaded by Sarah',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        user: 'Sarah Wilson',
        metadata: {
          fileSize: '1.2 MB',
          fileType: 'application/pdf',
        },
      },
    ],
    recommendations: [
      {
        id: '1',
        type: 'storage' as const,
        title: 'Storage running low',
        description: 'You\'re using 75% of your storage. Consider upgrading your plan.',
        priority: 'high' as const,
        action: {
          label: 'Upgrade Storage',
          onClick: () => console.log('Upgrade storage'),
        },
        metadata: {
          impact: 'High impact',
          timeToComplete: '2 minutes',
          tags: ['storage', 'upgrade'],
        },
      },
    ],
  };

  const dashboardData = data || mockData;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  if (loading) {
    return (
      <DashboardSkeleton 
        className={cn("p-6", className)}
        showCharts={true}
        showRecentActivity={true}
      />
    );
  }

  return (
    <motion.div
      className={cn("space-y-6", className)}
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your GlowWorm activity and insights
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
          
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards - Mobile-First Compact Grid */}
      <div className="dashboard-grid">
        <CompactInfoCard
          title="Total Files"
          value={formatNumber(dashboardData.stats.totalFiles)}
          icon={<BarChart3 className="h-4 w-4" />}
          color="primary"
          expandable
          details={
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Images:</span>
                <span>{formatNumber(dashboardData.stats.totalFiles * 0.7)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Videos:</span>
                <span>{formatNumber(dashboardData.stats.totalFiles * 0.2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Documents:</span>
                <span>{formatNumber(dashboardData.stats.totalFiles * 0.1)}</span>
              </div>
            </div>
          }
        />
        <CompactInfoCard
          title="Storage Used"
          value={formatBytes(dashboardData.stats.totalStorage)}
          icon={<HardDrive className="h-4 w-4" />}
          color="secondary"
          expandable
          details={
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Images:</span>
                <span>{formatBytes(dashboardData.stats.totalStorage * 0.6)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Videos:</span>
                <span>{formatBytes(dashboardData.stats.totalStorage * 0.3)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Other:</span>
                <span>{formatBytes(dashboardData.stats.totalStorage * 0.1)}</span>
              </div>
            </div>
          }
        />
        <CompactInfoCard
          title="Active Users"
          value={formatNumber(dashboardData.stats.totalUsers)}
          icon={<Users className="h-4 w-4" />}
          color="success"
          expandable
          details={
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Online:</span>
                <span>{formatNumber(Math.floor(dashboardData.stats.totalUsers * 0.3))}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>This week:</span>
                <span>{formatNumber(Math.floor(dashboardData.stats.totalUsers * 0.8))}</span>
              </div>
            </div>
          }
        />
        <CompactInfoCard
          title="Downloads"
          value={formatNumber(dashboardData.stats.totalDownloads)}
          icon={<Download className="h-4 w-4" />}
          color="warning"
          expandable
          details={
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Today:</span>
                <span>{formatNumber(dashboardData.stats.downloadsToday)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>This week:</span>
                <span>{formatNumber(Math.floor(dashboardData.stats.totalDownloads * 0.15))}</span>
              </div>
            </div>
          }
        />
      </div>

      {/* Main Content Grid - Adjustable width for better balance */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Charts */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Trends</CardTitle>
              <CardDescription>Daily upload activity over the past week</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart
                data={dashboardData.trends.uploads}
                title="Uploads"
                height={300}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Storage Usage</CardTitle>
              <CardDescription>Breakdown of your storage usage</CardDescription>
            </CardHeader>
            <CardContent>
              <StorageChart
                data={dashboardData.storage}
                height={300}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-2 space-y-6">
          {/* Activity Timeline */}
          <ActivityTimelineCard
            activities={dashboardData.activities}
            maxItems={5}
            loading={loading}
          />

          {/* Recommendations */}
          <RecommendationCard
            recommendations={dashboardData.recommendations}
            maxItems={3}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex-col gap-2">
              <Upload className="h-6 w-6" />
              <span>Upload Files</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2">
              <Star className="h-6 w-6" />
              <span>View Favorites</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2">
              <Share className="h-6 w-6" />
              <span>Share Album</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2">
              <Settings className="h-6 w-6" />
              <span>Settings</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
