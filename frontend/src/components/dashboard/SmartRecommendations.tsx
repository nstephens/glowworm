import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lightbulb, 
  TrendingUp, 
  Star, 
  Tag, 
  Folder, 
  Upload, 
  Download,
  Share,
  Archive,
  Trash,
  Settings,
  X,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Info,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export interface Recommendation {
  id: string;
  type: 'storage' | 'organization' | 'sharing' | 'backup' | 'cleanup' | 'security';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
  metadata?: {
    impact?: string;
    timeToComplete?: string;
    tags?: string[];
  };
}

interface SmartRecommendationsProps {
  recommendations: Recommendation[];
  className?: string;
  maxItems?: number;
  showDismissed?: boolean;
}

const getRecommendationIcon = (type: Recommendation['type']) => {
  const iconProps = { className: "h-5 w-5" };
  
  switch (type) {
    case 'storage':
      return <Archive {...iconProps} />;
    case 'organization':
      return <Folder {...iconProps} />;
    case 'sharing':
      return <Share {...iconProps} />;
    case 'backup':
      return <Download {...iconProps} />;
    case 'cleanup':
      return <Trash {...iconProps} />;
    case 'security':
      return <Settings {...iconProps} />;
    default:
      return <Lightbulb {...iconProps} />;
  }
};

const getPriorityColor = (priority: Recommendation['priority']) => {
  switch (priority) {
    case 'high':
      return 'text-red-600 bg-red-100 border-red-200';
    case 'medium':
      return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    case 'low':
      return 'text-green-600 bg-green-100 border-green-200';
    default:
      return 'text-gray-600 bg-gray-100 border-gray-200';
  }
};

const getTypeColor = (type: Recommendation['type']) => {
  switch (type) {
    case 'storage':
      return 'text-blue-600 bg-blue-100';
    case 'organization':
      return 'text-purple-600 bg-purple-100';
    case 'sharing':
      return 'text-green-600 bg-green-100';
    case 'backup':
      return 'text-orange-600 bg-orange-100';
    case 'cleanup':
      return 'text-red-600 bg-red-100';
    case 'security':
      return 'text-indigo-600 bg-indigo-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

export const SmartRecommendations: React.FC<SmartRecommendationsProps> = ({
  recommendations,
  className,
  maxItems = 5,
  showDismissed = false,
}) => {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const prefersReducedMotion = useReducedMotion();

  const visibleRecommendations = recommendations
    .filter(rec => !dismissedIds.has(rec.id) && !completedIds.has(rec.id))
    .slice(0, maxItems);

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  };

  const handleComplete = (id: string) => {
    setCompletedIds(prev => new Set([...prev, id]));
  };

  const handleAction = (recommendation: Recommendation) => {
    recommendation.action.onClick();
    handleComplete(recommendation.id);
  };

  if (visibleRecommendations.length === 0) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">
            All Caught Up!
          </h3>
          <p className="text-sm text-muted-foreground">
            No recommendations at the moment. Keep up the great work!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <CardTitle>Smart Recommendations</CardTitle>
        </div>
        <Badge variant="secondary" className="text-xs">
          {visibleRecommendations.length} suggestions
        </Badge>
      </CardHeader>
      <CardContent>
      <div className="space-y-3">
        <AnimatePresence>
          {visibleRecommendations.map((recommendation, index) => (
            <motion.div
              key={recommendation.id}
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{
                duration: 0.3,
                delay: prefersReducedMotion ? 0 : index * 0.1,
                ease: "easeOut",
              }}
            >
              <Card className="group hover:shadow-md transition-all duration-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-lg",
                      getTypeColor(recommendation.type)
                    )}>
                      {getRecommendationIcon(recommendation.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-sm">
                              {recommendation.title}
                            </h3>
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", getPriorityColor(recommendation.priority))}
                            >
                              {recommendation.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {recommendation.description}
                          </p>
                        </div>

                        {/* Dismiss button */}
                        {recommendation.dismissible !== false && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                            onClick={() => handleDismiss(recommendation.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {/* Metadata */}
                      {recommendation.metadata && (
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                          {recommendation.metadata.impact && (
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              <span>{recommendation.metadata.impact}</span>
                            </div>
                          )}
                          {recommendation.metadata.timeToComplete && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{recommendation.metadata.timeToComplete}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tags */}
                      {recommendation.metadata?.tags && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {recommendation.metadata.tags.map((tag, tagIndex) => (
                            <Badge key={tagIndex} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Action button */}
                      <Button
                        size="sm"
                        onClick={() => handleAction(recommendation)}
                        className="w-full sm:w-auto"
                      >
                        {recommendation.action.label}
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      </CardContent>
    </Card>
  );
};

interface RecommendationCardProps {
  recommendations: Recommendation[];
  title?: string;
  maxItems?: number;
  showDismissed?: boolean;
  className?: string;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendations,
  title = "Smart Recommendations",
  maxItems = 5,
  showDismissed = false,
  className,
}) => {
  // Just wrap SmartRecommendations without additional Card wrapper
  // to prevent double wrapping and overflow issues
  return (
    <SmartRecommendations
      recommendations={recommendations}
      maxItems={maxItems}
      showDismissed={showDismissed}
      className={className}
    />
  );
};
