import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useToast } from '../../hooks/use-toast';
import apiService from '../../services/api';

interface QueueStats {
  queue_size: number;
  processing_count: number;
  failed_count: number;
  complete_count: number;
  oldest_job_age_seconds: number | null;
  thumbnail_stats: {
    pending: number;
    processing: number;
    failed: number;
  };
  variant_stats: {
    pending: number;
    processing: number;
    failed: number;
  };
  jobs: Array<{
    id: number;
    filename: string;
    processing_status: string;
    thumbnail_status: string;
    variant_status: string;
    attempts: number;
    error: string | null;
    uploaded_at: string;
    last_attempt: string | null;
    completed_at: string | null;
  }>;
}

/**
 * ProcessingQueueDashboard - Admin component for monitoring background processing
 * 
 * Displays real-time statistics about the image processing queue, including
 * pending, processing, failed, and completed jobs. Allows batch retry of failed jobs.
 * 
 * Features:
 * - Auto-refresh every 10 seconds
 * - Manual refresh button
 * - Batch retry for all failed jobs
 * - Individual retry buttons
 * - Visual status indicators
 * - Detailed job listings
 */
export const ProcessingQueueDashboard: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch queue status
  const { data: queueData, isLoading, error, refetch } = useQuery<QueueStats>({
    queryKey: ['processing-queue'],
    queryFn: async () => {
      const response = await apiService.get('/api/admin/processing-queue');
      return response.data;
    },
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });
  
  // Batch retry mutation
  const batchRetryMutation = useMutation({
    mutationFn: async () => {
      const response = await apiService.post('/api/admin/retry-all-failed');
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: "Batch retry initiated",
        description: `${data.retry_count} failed jobs queued for processing`,
        duration: 5000,
      });
      // Refetch queue data
      queryClient.invalidateQueries({ queryKey: ['processing-queue'] });
    },
    onError: (error: any) => {
      toast({
        title: "Batch retry failed",
        description: error.message || "Failed to retry jobs",
        variant: "destructive",
        duration: 5000,
      });
    },
  });
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2">Loading queue data...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p>Failed to load processing queue data</p>
        <Button onClick={() => refetch()} className="mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }
  
  const formatAge = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'text-green-600';
      case 'processing': return 'text-blue-600';
      case 'pending': return 'text-yellow-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete': return <CheckCircle className="w-4 h-4" />;
      case 'processing': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      default: return null;
    }
  };
  
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Processing Queue Dashboard</h1>
          <p className="text-gray-600 mt-1">Monitor background image processing status</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {queueData && queueData.failed_count > 0 && (
            <Button 
              onClick={() => batchRetryMutation.mutate()}
              disabled={batchRetryMutation.isPending}
              variant="default"
              size="sm"
            >
              {batchRetryMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Retry All Failed ({queueData.failed_count})
            </Button>
          )}
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{queueData?.queue_size || 0}</div>
            <p className="text-xs text-gray-500 mt-1">Waiting for processing</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{queueData?.processing_count || 0}</div>
            <p className="text-xs text-gray-500 mt-1">Currently processing</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{queueData?.failed_count || 0}</div>
            <p className="text-xs text-gray-500 mt-1">Require attention</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Oldest Job</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-700">
              {formatAge(queueData?.oldest_job_age_seconds || null)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Age of oldest pending</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Thumbnail Generation</CardTitle>
            <CardDescription>Status of thumbnail processing across all images</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pending:</span>
                <span className="font-semibold">{queueData?.thumbnail_stats.pending || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Processing:</span>
                <span className="font-semibold">{queueData?.thumbnail_stats.processing || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Failed:</span>
                <span className="font-semibold text-red-600">{queueData?.thumbnail_stats.failed || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Variant Generation</CardTitle>
            <CardDescription>Status of display variant processing across all images</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pending:</span>
                <span className="font-semibold">{queueData?.variant_stats.pending || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Processing:</span>
                <span className="font-semibold">{queueData?.variant_stats.processing || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Failed:</span>
                <span className="font-semibold text-red-600">{queueData?.variant_stats.failed || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Recent Jobs Table */}
      {queueData && queueData.jobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
            <CardDescription>Last 20 images in processing queue (pending, processing, or failed)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="pb-2 font-medium">ID</th>
                    <th className="pb-2 font-medium">Filename</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Thumbnails</th>
                    <th className="pb-2 font-medium">Variants</th>
                    <th className="pb-2 font-medium">Attempts</th>
                    <th className="pb-2 font-medium">Error</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queueData.jobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3">{job.id}</td>
                      <td className="py-3 max-w-xs truncate" title={job.filename}>
                        {job.filename}
                      </td>
                      <td className="py-3">
                        <div className={`flex items-center gap-1 ${getStatusColor(job.processing_status)}`}>
                          {getStatusIcon(job.processing_status)}
                          <span className="capitalize">{job.processing_status}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(job.thumbnail_status)}`}>
                          {job.thumbnail_status}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(job.variant_status)}`}>
                          {job.variant_status}
                        </span>
                      </td>
                      <td className="py-3">{job.attempts}</td>
                      <td className="py-3 max-w-xs truncate" title={job.error || ''}>
                        {job.error ? (
                          <span className="text-red-600 text-xs">{job.error}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3">
                        {job.processing_status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await apiService.post(`/api/images/${job.id}/retry-processing`);
                                toast({
                                  title: "Retry initiated",
                                  description: `Image ${job.id} queued for processing`,
                                });
                                refetch();
                              } catch (error: any) {
                                toast({
                                  title: "Retry failed",
                                  description: error.message,
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Empty State */}
      {queueData && queueData.jobs.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium">All Clear!</p>
              <p className="text-sm mt-2">No images in processing queue</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProcessingQueueDashboard;

