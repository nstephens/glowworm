import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  Download, 
  Edit, 
  Trash, 
  Share, 
  Star, 
  Tag, 
  Folder,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  Archive,
  Clock,
  User,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { formatDistanceToNow, format } from 'date-fns';

export interface ActivityItem {
  id: string;
  type: 'upload' | 'download' | 'edit' | 'delete' | 'share' | 'star' | 'tag' | 'folder' | 'other';
  title: string;
  description: string;
  timestamp: Date;
  user?: string;
  metadata?: {
    fileSize?: string;
    fileType?: string;
    albumName?: string;
    tags?: string[];
  };
  actionUrl?: string;
}

interface ActivityTimelineProps {
  activities: ActivityItem[];
  className?: string;
  showUser?: boolean;
  showMetadata?: boolean;
  maxItems?: number;
  loading?: boolean;
}

const getActivityIcon = (type: ActivityItem['type']) => {
  const iconProps = { className: "h-4 w-4" };
  
  switch (type) {
    case 'upload':
      return <Upload {...iconProps} />;
    case 'download':
      return <Download {...iconProps} />;
    case 'edit':
      return <Edit {...iconProps} />;
    case 'delete':
      return <Trash {...iconProps} />;
    case 'share':
      return <Share {...iconProps} />;
    case 'star':
      return <Star {...iconProps} />;
    case 'tag':
      return <Tag {...iconProps} />;
    case 'folder':
      return <Folder {...iconProps} />;
    default:
      return <Clock {...iconProps} />;
  }
};

const getActivityColor = (type: ActivityItem['type']) => {
  switch (type) {
    case 'upload':
      return 'text-green-600 bg-green-100';
    case 'download':
      return 'text-blue-600 bg-blue-100';
    case 'edit':
      return 'text-yellow-600 bg-yellow-100';
    case 'delete':
      return 'text-red-600 bg-red-100';
    case 'share':
      return 'text-purple-600 bg-purple-100';
    case 'star':
      return 'text-amber-600 bg-amber-100';
    case 'tag':
      return 'text-indigo-600 bg-indigo-100';
    case 'folder':
      return 'text-gray-600 bg-gray-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

const getFileTypeIcon = (fileType?: string) => {
  if (!fileType) return <FileText className="h-3 w-3" />;
  
  const type = fileType.toLowerCase();
  if (type.startsWith('image/')) return <ImageIcon className="h-3 w-3" />;
  if (type.startsWith('video/')) return <Video className="h-3 w-3" />;
  if (type.startsWith('audio/')) return <Music className="h-3 w-3" />;
  if (type.includes('zip') || type.includes('archive')) return <Archive className="h-3 w-3" />;
  return <FileText className="h-3 w-3" />;
};

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  activities,
  className,
  showUser = true,
  showMetadata = true,
  maxItems = 10,
  loading = false,
}) => {
  const [visibleActivities, setVisibleActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(loading);
  const prefersReducedMotion = useReducedMotion();
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading) {
      setIsLoading(true);
      return;
    }

    const timer = setTimeout(() => {
      setVisibleActivities(activities.slice(0, maxItems));
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [activities, maxItems, loading]);

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start space-x-3 animate-pulse">
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (visibleActivities.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Recent Activity</h3>
        <p className="text-sm text-muted-foreground">
          Activity will appear here as you use the application.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)} ref={timelineRef}>
      <AnimatePresence>
        {visibleActivities.map((activity, index) => (
          <motion.div
            key={activity.id}
            initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{
              duration: 0.3,
              delay: prefersReducedMotion ? 0 : index * 0.1,
              ease: "easeOut",
            }}
            className="flex items-start space-x-3 group"
          >
            {/* Timeline line */}
            {index < visibleActivities.length - 1 && (
              <div className="absolute left-4 top-8 w-0.5 h-8 bg-border" />
            )}
            
            {/* Activity icon */}
            <div className={cn(
              "relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 border-background",
              getActivityColor(activity.type)
            )}>
              {getActivityIcon(activity.type)}
            </div>

            {/* Activity content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {activity.title}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activity.description}
                  </p>
                  
                  {/* Metadata */}
                  {showMetadata && activity.metadata && (
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {activity.metadata.fileType && (
                        <div className="flex items-center gap-1">
                          {getFileTypeIcon(activity.metadata.fileType)}
                          <span>{activity.metadata.fileType.split('/')[1]?.toUpperCase()}</span>
                        </div>
                      )}
                      {activity.metadata.fileSize && (
                        <span>{activity.metadata.fileSize}</span>
                      )}
                      {activity.metadata.albumName && (
                        <span>in {activity.metadata.albumName}</span>
                      )}
                    </div>
                  )}
                  
                  {/* Tags */}
                  {activity.metadata?.tags && activity.metadata.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {activity.metadata.tags.slice(0, 3).map((tag, tagIndex) => (
                        <span
                          key={tagIndex}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary"
                        >
                          {tag}
                        </span>
                      ))}
                      {activity.metadata.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{activity.metadata.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Timestamp */}
                <div className="flex flex-col items-end text-xs text-muted-foreground ml-4">
                  <span>{formatDistanceToNow(activity.timestamp, { addSuffix: true })}</span>
                  <span className="text-xs opacity-75">
                    {format(activity.timestamp, 'MMM d, HH:mm')}
                  </span>
                </div>
              </div>
              
              {/* User info */}
              {showUser && activity.user && (
                <div className="flex items-center gap-2 mt-2">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{activity.user}</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

interface ActivityTimelineCardProps {
  activities: ActivityItem[];
  title?: string;
  showUser?: boolean;
  showMetadata?: boolean;
  maxItems?: number;
  loading?: boolean;
  className?: string;
}

export const ActivityTimelineCard: React.FC<ActivityTimelineCardProps> = ({
  activities,
  title = "Recent Activity",
  showUser = true,
  showMetadata = true,
  maxItems = 10,
  loading = false,
  className,
}) => {
  return (
    <div className={cn("p-6 rounded-lg border bg-card text-card-foreground shadow-sm", className)}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Settings className="h-4 w-4 text-muted-foreground" />
      </div>
      
      <ActivityTimeline
        activities={activities}
        showUser={showUser}
        showMetadata={showMetadata}
        maxItems={maxItems}
        loading={loading}
      />
    </div>
  );
};
