import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Dashboard,
  AnimatedCounter,
  CounterCard,
  StatCard,
  ActivityTimeline,
  ActivityTimelineCard,
  UsageChart,
  StorageChart,
  TrendChart,
  SmartRecommendations,
  RecommendationCard,
  type ActivityItem,
  type Recommendation,
  type ChartData
} from '@/components/dashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Lightbulb,
  Archive,
  Folder,
  Trash
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export const DashboardShowcase: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'components' | 'charts'>('overview');
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Mock data for demonstration
  const mockActivities: ActivityItem[] = [
    {
      id: '1',
      type: 'upload',
      title: 'New photos uploaded',
      description: '5 photos added to "Summer Vacation" album',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
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
      type: 'download',
      title: 'Files downloaded',
      description: '3 documents downloaded by Sarah',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      user: 'Sarah Wilson',
      metadata: {
        fileSize: '1.2 MB',
        fileType: 'application/pdf',
      },
    },
    {
      id: '3',
      type: 'star',
      title: 'Photo starred',
      description: 'Sunset photo marked as favorite',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
      user: 'Mike Johnson',
      metadata: {
        fileType: 'image/jpeg',
        tags: ['sunset', 'nature'],
      },
    },
  ];

  const mockRecommendations: Recommendation[] = [
    {
      id: '1',
      type: 'storage',
      title: 'Storage running low',
      description: 'You\'re using 75% of your storage. Consider upgrading your plan.',
      priority: 'high',
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
    {
      id: '2',
      type: 'organization',
      title: 'Organize your photos',
      description: 'You have 50 untagged photos. Add tags to make them easier to find.',
      priority: 'medium',
      action: {
        label: 'Add Tags',
        onClick: () => console.log('Add tags'),
      },
      metadata: {
        impact: 'Medium impact',
        timeToComplete: '5 minutes',
        tags: ['organization', 'tags'],
      },
    },
    {
      id: '3',
      type: 'backup',
      title: 'Enable auto-backup',
      description: 'Protect your photos with automatic cloud backup.',
      priority: 'low',
      action: {
        label: 'Enable Backup',
        onClick: () => console.log('Enable backup'),
      },
      metadata: {
        impact: 'Low impact',
        timeToComplete: '1 minute',
        tags: ['backup', 'security'],
      },
    },
  ];

  const mockChartData: ChartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Uploads',
        data: [12, 19, 8, 15, 22, 18, 14],
        borderColor: '#4f46e5',
        backgroundColor: '#4f46e520',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Downloads',
        data: [8, 15, 12, 18, 25, 20, 16],
        borderColor: '#059669',
        backgroundColor: '#05966920',
        fill: true,
        tension: 0.4,
      },
    ],
  };

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

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="p-6 space-y-6"
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Showcase</h1>
          <p className="text-muted-foreground">
            Explore the comprehensive dashboard visualization components
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === 'overview' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </Button>
          <Button
            variant={activeTab === 'components' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('components')}
          >
            Components
          </Button>
          <Button
            variant={activeTab === 'charts' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('charts')}
          >
            Charts
          </Button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Full Dashboard */}
          <Card>
            <CardHeader>
              <CardTitle>Complete Dashboard</CardTitle>
              <CardDescription>
                The full dashboard with all components integrated
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Dashboard />
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'components' && (
        <div className="space-y-6">
          {/* Animated Counters */}
          <Card>
            <CardHeader>
              <CardTitle>Animated Counters</CardTitle>
              <CardDescription>
                Smooth number animations with various formatting options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total Files"
                  value={1247}
                  icon={<BarChart3 className="h-5 w-5" />}
                  formatter={formatNumber}
                  color="primary"
                />
                <StatCard
                  title="Storage Used"
                  value={2.4 * 1024 * 1024 * 1024}
                  subtitle={formatBytes(2.4 * 1024 * 1024 * 1024)}
                  icon={<HardDrive className="h-5 w-5" />}
                  formatter={(val) => formatBytes(val)}
                  color="secondary"
                />
                <StatCard
                  title="Active Users"
                  value={23}
                  icon={<Users className="h-5 w-5" />}
                  formatter={formatNumber}
                  color="success"
                />
                <StatCard
                  title="Total Downloads"
                  value={3456}
                  icon={<Download className="h-5 w-5" />}
                  formatter={formatNumber}
                  color="warning"
                />
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Counter Examples</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Basic Counter</h4>
                    <div className="text-2xl font-bold">
                      <AnimatedCounter value={1247} />
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">With Prefix/Suffix</h4>
                    <div className="text-2xl font-bold">
                      <AnimatedCounter 
                        value={2.4} 
                        prefix="$" 
                        suffix="M"
                        formatter={(val) => val.toFixed(1)}
                      />
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Custom Formatter</h4>
                    <div className="text-2xl font-bold">
                      <AnimatedCounter 
                        value={1024 * 1024 * 1024} 
                        formatter={formatBytes}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <ActivityTimelineCard
            activities={mockActivities}
            title="Activity Timeline"
            maxItems={5}
          />

          {/* Smart Recommendations */}
          <RecommendationCard
            recommendations={mockRecommendations}
            title="Smart Recommendations"
            maxItems={3}
          />
        </div>
      )}

      {activeTab === 'charts' && (
        <div className="space-y-6">
          {/* Usage Charts */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Charts</CardTitle>
              <CardDescription>
                Various chart types for data visualization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Line Chart</h3>
                  <UsageChart
                    data={mockChartData}
                    type="line"
                    title="Upload Trends"
                    height={300}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Bar Chart</h3>
                  <UsageChart
                    data={mockChartData}
                    type="bar"
                    title="Download Trends"
                    height={300}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Storage Chart</h3>
                  <StorageChart
                    data={{
                      used: 1.8 * 1024 * 1024 * 1024,
                      total: 5 * 1024 * 1024 * 1024,
                      breakdown: {
                        images: 1.2 * 1024 * 1024 * 1024,
                        videos: 0.4 * 1024 * 1024 * 1024,
                        documents: 0.15 * 1024 * 1024 * 1024,
                        other: 0.05 * 1024 * 1024 * 1024,
                      },
                    }}
                    height={300}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Trend Chart</h3>
                  <TrendChart
                    data={{
                      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                      values: [12, 19, 8, 15, 22, 18, 14],
                      trend: 'up',
                    }}
                    title="Weekly Activity"
                    height={300}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  );
};
