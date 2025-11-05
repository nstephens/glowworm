import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { cn } from '@/lib/utils';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
    fill?: boolean;
    tension?: number;
  }[];
}

interface UsageChartProps {
  data: ChartData;
  type: 'line' | 'bar' | 'doughnut';
  title: string;
  height?: number;
  className?: string;
  showLegend?: boolean;
  showTooltips?: boolean;
  animated?: boolean;
}

const defaultColors = {
  primary: '#4f46e5',
  secondary: '#b45309',
  success: '#059669',
  warning: '#b45309',
  destructive: '#dc2626',
  muted: '#6b7280',
};

export const UsageChart: React.FC<UsageChartProps> = ({
  data,
  type,
  title,
  height = 300,
  className,
  showLegend = true,
  showTooltips = true,
  animated = true,
}) => {
  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: animated ? {
      duration: 1000,
      easing: 'easeInOutQuart',
    } : false,
    plugins: {
      legend: {
        display: showLegend,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
        },
      },
      title: {
        display: true,
        text: title,
        font: {
          size: 16,
          weight: 'bold' as const,
        },
        padding: {
          top: 10,
          bottom: 30,
        },
      },
      tooltip: {
        enabled: showTooltips,
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
      },
    },
    scales: type !== 'doughnut' ? {
      x: {
        display: true,
        grid: {
          display: false,
        },
        ticks: {
          color: '#6b7280',
        },
      },
      y: {
        display: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          color: '#6b7280',
        },
      },
    } : undefined,
    elements: {
      line: {
        tension: 0.4,
      },
      point: {
        radius: 4,
        hoverRadius: 6,
      },
    },
  }), [title, showLegend, showTooltips, animated, type]);

  const renderChart = () => {
    switch (type) {
      case 'line':
        return <Line options={options} data={data} redraw />;
      case 'bar':
        return <Bar options={options} data={data} redraw />;
      case 'doughnut':
        return <Doughnut options={options} data={data} redraw />;
      default:
        return <Line options={options} data={data} redraw />;
    }
  };

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      {renderChart()}
    </div>
  );
};

interface StorageChartProps {
  data: {
    used: number;
    total: number;
    breakdown: {
      images: number;
      videos: number;
      documents?: number;
      other?: number;
    };
  };
  className?: string;
}

export const StorageChart: React.FC<StorageChartProps> = ({
  data,
  className,
}) => {
  const usagePercentage = (data.used / data.total) * 100;
  
  const chartData = {
    labels: ['Images', 'Videos'],
    datasets: [
      {
        data: [
          data.breakdown.images,
          data.breakdown.videos,
        ],
        backgroundColor: [
          defaultColors.primary,
          defaultColors.secondary,
        ],
        borderWidth: 0,
      },
    ],
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Storage Usage</h3>
        <div className="text-sm text-muted-foreground">
          {Math.round(usagePercentage)}% used
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Used: {formatBytes(data.used)}</span>
          <span>Total: {formatBytes(data.total)}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-1000"
            style={{ width: `${usagePercentage}%` }}
          />
        </div>
      </div>
      
      <UsageChart
        data={chartData}
        type="doughnut"
        title="Storage Breakdown"
        height={200}
        showLegend={true}
      />
    </div>
  );
};

interface TrendChartProps {
  data: {
    labels: string[];
    values: number[];
    trend: 'up' | 'down' | 'stable';
  };
  title: string;
  className?: string;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  title,
  className,
}) => {
  const chartData = {
    labels: data.labels,
    datasets: [
      {
        label: title,
        data: data.values,
        borderColor: data.trend === 'up' ? defaultColors.success : 
                     data.trend === 'down' ? defaultColors.destructive : 
                     defaultColors.muted,
        backgroundColor: data.trend === 'up' ? `${defaultColors.success}20` : 
                        data.trend === 'down' ? `${defaultColors.destructive}20` : 
                        `${defaultColors.muted}20`,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  return (
    <UsageChart
      data={chartData}
      type="line"
      title={title}
      height={250}
      className={className}
    />
  );
};

// Utility function to format bytes
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
