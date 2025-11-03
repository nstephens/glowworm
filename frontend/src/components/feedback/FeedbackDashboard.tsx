import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MessageSquare, 
  Star, 
  TrendingUp, 
  Users, 
  Bug, 
  Lightbulb,
  Download,
  Filter,
  Calendar,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeedbackData } from './FeedbackWidget';
import { ABTestResult, getABTestResults } from '@/utils/abTesting';

export interface FeedbackDashboardProps {
  feedbackData: FeedbackData[];
  abTestResults: Record<string, ABTestResult>;
  className?: string;
}

/**
 * Comprehensive feedback dashboard for analyzing user feedback and A/B test results
 * Features: Analytics, charts, filtering, export functionality
 */
export const FeedbackDashboard: React.FC<FeedbackDashboardProps> = ({
  feedbackData,
  abTestResults,
  className
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  // Filter feedback data based on selected filters
  const filteredFeedback = feedbackData.filter(feedback => {
    const feedbackDate = new Date(feedback.timestamp);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - feedbackDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Time range filter
    let timeMatch = true;
    switch (selectedTimeRange) {
      case '7d':
        timeMatch = daysDiff <= 7;
        break;
      case '30d':
        timeMatch = daysDiff <= 30;
        break;
      case '90d':
        timeMatch = daysDiff <= 90;
        break;
      case 'all':
        timeMatch = true;
        break;
    }

    // Category filter
    const categoryMatch = selectedCategory === 'all' || feedback.category === selectedCategory;
    
    // Rating filter
    const ratingMatch = selectedRating === null || feedback.rating === selectedRating;

    return timeMatch && categoryMatch && ratingMatch;
  });

  // Calculate statistics
  const stats = {
    totalFeedback: filteredFeedback.length,
    averageRating: filteredFeedback.length > 0 
      ? (filteredFeedback.reduce((sum, f) => sum + f.rating, 0) / filteredFeedback.length).toFixed(1)
      : '0.0',
    categoryDistribution: filteredFeedback.reduce((acc, feedback) => {
      acc[feedback.category] = (acc[feedback.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    ratingDistribution: filteredFeedback.reduce((acc, feedback) => {
      acc[feedback.rating] = (acc[feedback.rating] || 0) + 1;
      return acc;
    }, {} as Record<number, number>),
    recentFeedback: filteredFeedback
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)
  };

  // Get category icon and color
  const getCategoryInfo = (category: string) => {
    switch (category) {
      case 'general':
        return { icon: MessageSquare, color: 'text-blue-500', bgColor: 'bg-blue-100' };
      case 'bug':
        return { icon: Bug, color: 'text-red-500', bgColor: 'bg-red-100' };
      case 'feature':
        return { icon: Lightbulb, color: 'text-yellow-500', bgColor: 'bg-yellow-100' };
      case 'ui':
        return { icon: Heart, color: 'text-pink-500', bgColor: 'bg-pink-100' };
      case 'performance':
        return { icon: Activity, color: 'text-green-500', bgColor: 'bg-green-100' };
      default:
        return { icon: MessageSquare, color: 'text-gray-500', bgColor: 'bg-gray-100' };
    }
  };

  // Export data
  const exportData = (format: 'csv' | 'json') => {
    const data = filteredFeedback.map(feedback => ({
      id: feedback.id,
      rating: feedback.rating,
      category: feedback.category,
      message: feedback.message,
      timestamp: new Date(feedback.timestamp).toISOString(),
      url: feedback.url,
      userAgent: feedback.userAgent,
      deviceInfo: feedback.deviceInfo
    }));

    if (format === 'csv') {
      const csv = [
        'ID,Rating,Category,Message,Timestamp,URL,User Agent,Device Info',
        ...data.map(item => 
          `"${item.id}","${item.rating}","${item.category}","${item.message}","${item.timestamp}","${item.url}","${item.userAgent}","${JSON.stringify(item.deviceInfo)}"`
        )
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feedback-${selectedTimeRange}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feedback-${selectedTimeRange}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Feedback Dashboard</h1>
          <p className="text-muted-foreground">
            Analyze user feedback and A/B test results
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => exportData('csv')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => exportData('json')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Time Range Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Time Range</label>
              <div className="flex gap-2">
                {[
                  { value: '7d', label: '7 Days' },
                  { value: '30d', label: '30 Days' },
                  { value: '90d', label: '90 Days' },
                  { value: 'all', label: 'All Time' }
                ].map(range => (
                  <Button
                    key={range.value}
                    variant={selectedTimeRange === range.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTimeRange(range.value as any)}
                  >
                    {range.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <div className="flex gap-2">
                <Button
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('all')}
                >
                  All
                </Button>
                {['general', 'bug', 'feature', 'ui', 'performance'].map(category => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Rating Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Rating</label>
              <div className="flex gap-2">
                <Button
                  variant={selectedRating === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedRating(null)}
                >
                  All
                </Button>
                {[1, 2, 3, 4, 5].map(rating => (
                  <Button
                    key={rating}
                    variant={selectedRating === rating ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedRating(rating)}
                  >
                    {rating} ⭐
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.totalFeedback}</p>
                <p className="text-sm text-muted-foreground">Total Feedback</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{stats.averageRating}</p>
                <p className="text-sm text-muted-foreground">Average Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {new Set(filteredFeedback.map(f => f.userId)).size}
                </p>
                <p className="text-sm text-muted-foreground">Unique Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">
                  {Object.keys(abTestResults).length}
                </p>
                <p className="text-sm text-muted-foreground">Active A/B Tests</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="feedback" className="space-y-4">
        <TabsList>
          <TabsTrigger value="feedback">Feedback Analysis</TabsTrigger>
          <TabsTrigger value="abtests">A/B Test Results</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* Feedback Analysis Tab */}
        <TabsContent value="feedback" className="space-y-4">
          {/* Category Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Feedback by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.categoryDistribution).map(([category, count]) => {
                  const percentage = (count / stats.totalFeedback) * 100;
                  const categoryInfo = getCategoryInfo(category);
                  const Icon = categoryInfo.icon;
                  
                  return (
                    <div key={category} className="flex items-center gap-3">
                      <div className={cn('p-2 rounded-lg', categoryInfo.bgColor)}>
                        <Icon className={cn('h-4 w-4', categoryInfo.color)} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium capitalize">{category}</span>
                          <span className="text-sm text-muted-foreground">
                            {count} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className={cn('h-2 rounded-full', categoryInfo.bgColor)}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Rating Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Rating Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map(rating => {
                  const count = stats.ratingDistribution[rating] || 0;
                  const percentage = stats.totalFeedback > 0 ? (count / stats.totalFeedback) * 100 : 0;
                  
                  return (
                    <div key={rating} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-16">
                        <span className="text-sm font-medium">{rating}</span>
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">{count} feedback</span>
                          <span className="text-sm text-muted-foreground">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className="bg-yellow-500 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent Feedback */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Feedback</CardTitle>
              <CardDescription>
                Latest {stats.recentFeedback.length} feedback entries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.recentFeedback.map(feedback => {
                  const categoryInfo = getCategoryInfo(feedback.category);
                  const Icon = categoryInfo.icon;
                  
                  return (
                    <div key={feedback.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={cn('p-1 rounded', categoryInfo.bgColor)}>
                            <Icon className={cn('h-3 w-3', categoryInfo.color)} />
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {feedback.category}
                          </Badge>
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  'h-3 w-3',
                                  i < feedback.rating ? 'text-yellow-500 fill-current' : 'text-gray-300'
                                )}
                              />
                            ))}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(feedback.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      {feedback.message && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {feedback.message}
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {feedback.deviceInfo?.platform} • {feedback.deviceInfo?.screenSize}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* A/B Test Results Tab */}
        <TabsContent value="abtests" className="space-y-4">
          {Object.entries(abTestResults).map(([testName, result]) => (
            <Card key={testName}>
              <CardHeader>
                <CardTitle>{testName}</CardTitle>
                <CardDescription>
                  {result.statistics.totalUsers} users • {result.events.length} events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Variant Distribution */}
                  <div>
                    <h4 className="font-medium mb-2">Variant Distribution</h4>
                    <div className="space-y-2">
                      {Object.entries(result.statistics.variantDistribution).map(([variant, count]) => {
                        const percentage = (count / result.statistics.totalUsers) * 100;
                        return (
                          <div key={variant} className="flex items-center gap-3">
                            <span className="w-20 text-sm font-medium">{variant}</span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm">{count} users</span>
                                <span className="text-sm text-muted-foreground">
                                  {percentage.toFixed(1)}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                <div
                                  className="bg-blue-500 h-2 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Conversion Rates */}
                  <div>
                    <h4 className="font-medium mb-2">Conversion Rates</h4>
                    <div className="space-y-2">
                      {Object.entries(result.statistics.conversionRates).map(([variant, rate]) => (
                        <div key={variant} className="flex items-center justify-between">
                          <span className="text-sm font-medium">{variant}</span>
                          <span className="text-sm text-muted-foreground">
                            {(rate * 100).toFixed(2)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Winner */}
                  {result.statistics.winner && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-800">
                          Winner: {result.statistics.winner}
                        </span>
                        {result.statistics.confidence && (
                          <Badge className="bg-green-100 text-green-800">
                            {result.statistics.confidence.toFixed(1)}% confidence
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Key Insights</CardTitle>
              <CardDescription>
                Automated insights from feedback analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* High Priority Issues */}
              <div>
                <h4 className="font-medium mb-2 text-red-600">High Priority Issues</h4>
                <div className="space-y-2">
                  {stats.categoryDistribution.bug > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Bug className="h-4 w-4 text-red-600" />
                        <span className="font-medium text-red-800">
                          {stats.categoryDistribution.bug} bug reports
                        </span>
                      </div>
                      <p className="text-sm text-red-600 mt-1">
                        Consider prioritizing bug fixes based on user feedback
                      </p>
                    </div>
                  )}
                  
                  {stats.averageRating < 3 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium text-yellow-800">
                          Low average rating ({stats.averageRating}/5)
                        </span>
                      </div>
                      <p className="text-sm text-yellow-600 mt-1">
                        User satisfaction is below average. Review recent changes and user feedback.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Opportunities */}
              <div>
                <h4 className="font-medium mb-2 text-blue-600">Opportunities</h4>
                <div className="space-y-2">
                  {stats.categoryDistribution.feature > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-blue-800">
                          {stats.categoryDistribution.feature} feature requests
                        </span>
                      </div>
                      <p className="text-sm text-blue-600 mt-1">
                        Consider implementing popular feature requests to improve user satisfaction
                      </p>
                    </div>
                  )}
                  
                  {stats.categoryDistribution.ui > 0 && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-purple-600" />
                        <span className="font-medium text-purple-800">
                          {stats.categoryDistribution.ui} UI/UX feedback
                        </span>
                      </div>
                      <p className="text-sm text-purple-600 mt-1">
                        Review UI/UX feedback for potential design improvements
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recommendations */}
              <div>
                <h4 className="font-medium mb-2 text-green-600">Recommendations</h4>
                <div className="space-y-2">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      • Focus on addressing bug reports to improve user experience
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      • Consider implementing popular feature requests
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      • Monitor A/B test results to optimize user experience
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};




