import React, { useState, useRef } from 'react';
import { 
  Monitor, 
  Wifi, 
  WifiOff, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  MoreVertical,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Edit,
  X
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '../ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';

interface DisplayDevice {
  id: number;
  device_token: string;
  device_name?: string;
  device_identifier?: string;
  status: 'pending' | 'authorized' | 'rejected' | 'offline';
  playlist_id?: number;
  playlist_name?: string;
  authorized_at?: string;
  last_seen: string;
  created_at: string;
  updated_at: string;
}

interface MobileDeviceCardProps {
  device: DisplayDevice;
  onAuthorize?: (device: DisplayDevice) => void;
  onReject?: (device: DisplayDevice) => void;
  onEdit?: (device: DisplayDevice) => void;
  onDelete?: (device: DisplayDevice) => void;
  onRefresh?: (device: DisplayDevice) => void;
  onReset?: (device: DisplayDevice) => void;
  onAssignPlaylist?: (device: DisplayDevice) => void;
  onSwipeLeft?: (device: DisplayDevice) => void;
  onSwipeRight?: (device: DisplayDevice) => void;
  enableSwipe?: boolean;
  hapticFeedback?: boolean;
  compact?: boolean;
  minimal?: boolean;
}

const MobileDeviceCard: React.FC<MobileDeviceCardProps> = ({
  device,
  onAuthorize,
  onReject,
  onEdit,
  onDelete,
  onRefresh,
  onReset,
  onAssignPlaylist,
  onSwipeLeft,
  onSwipeRight,
  enableSwipe = true,
  hapticFeedback = true,
  compact = false,
  minimal = false
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'authorized':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          color: 'bg-green-500',
          textColor: 'text-green-700',
          bgColor: 'bg-green-50',
          label: 'Online'
        };
      case 'pending':
        return {
          icon: <Clock className="w-4 h-4" />,
          color: 'bg-yellow-500',
          textColor: 'text-yellow-700',
          bgColor: 'bg-yellow-50',
          label: 'Pending'
        };
      case 'rejected':
        return {
          icon: <X className="w-4 h-4" />,
          color: 'bg-red-500',
          textColor: 'text-red-700',
          bgColor: 'bg-red-50',
          label: 'Rejected'
        };
      case 'offline':
        return {
          icon: <WifiOff className="w-4 h-4" />,
          color: 'bg-gray-500',
          textColor: 'text-gray-700',
          bgColor: 'bg-gray-50',
          label: 'Offline'
        };
      default:
        return {
          icon: <AlertTriangle className="w-4 h-4" />,
          color: 'bg-gray-500',
          textColor: 'text-gray-700',
          bgColor: 'bg-gray-50',
          label: 'Unknown'
        };
    }
  };

  const statusConfig = getStatusConfig(device.status);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enableSwipe) return;
    
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    setIsSwipeActive(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!enableSwipe) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX.current;
    const deltaY = touch.clientY - startY.current;
    
    // Only handle horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      e.preventDefault();
      setSwipeOffset(deltaX);
      setIsSwipeActive(true);
      
      if (hapticFeedback && navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
  };

  const handleTouchEnd = () => {
    if (!enableSwipe || !isSwipeActive) return;
    
    const threshold = 100;
    
    if (swipeOffset > threshold && onSwipeRight) {
      onSwipeRight(device);
      if (hapticFeedback && navigator.vibrate) {
        navigator.vibrate(50);
      }
    } else if (swipeOffset < -threshold && onSwipeLeft) {
      onSwipeLeft(device);
      if (hapticFeedback && navigator.vibrate) {
        navigator.vibrate(50);
      }
    }
    
    setSwipeOffset(0);
    setIsSwipeActive(false);
  };

  const handlePress = () => {
    setIsPressed(true);
    if (hapticFeedback && navigator.vibrate) {
      navigator.vibrate(20);
    }
  };

  const handleRelease = () => {
    setIsPressed(false);
  };

  const getActionButtons = () => {
    const buttons = [];
    
    if (device.status === 'pending') {
      buttons.push(
        <Button
          key="authorize"
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={() => onAuthorize?.(device)}
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          Authorize
        </Button>
      );
      buttons.push(
        <Button
          key="reject"
          size="sm"
          variant="destructive"
          onClick={() => onReject?.(device)}
        >
          <X className="w-4 h-4 mr-1" />
          Reject
        </Button>
      );
    } else if (device.status === 'authorized') {
      buttons.push(
        <Button
          key="playlist"
          size="sm"
          className="bg-purple-600 hover:bg-purple-700 text-white"
          onClick={() => onAssignPlaylist?.(device)}
        >
          <Play className="w-4 h-4 mr-1" />
          {device.playlist_name ? 'Change' : 'Assign'}
        </Button>
      );
      buttons.push(
        <Button
          key="refresh"
          size="sm"
          variant="outline"
          onClick={() => onRefresh?.(device)}
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      );
    }
    
    return buttons;
  };

  return (
    <motion.div
      ref={cardRef}
      className={cn(
        "relative bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden",
        "w-full max-w-full box-border",
        "transition-all duration-200",
        isPressed && "scale-95 shadow-md",
        isSwipeActive && "shadow-lg"
      )}
      style={{
        transform: `translateX(${swipeOffset}px)`,
        willChange: isSwipeActive ? 'transform' : undefined,
        width: '100%',
        marginLeft: 'auto',
        marginRight: 'auto',
        boxSizing: 'border-box',
      }}
      data-device-card
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handlePress}
      onMouseUp={handleRelease}
      onMouseLeave={handleRelease}
    >
      {/* Swipe Indicators */}
      <AnimatePresence>
        {isSwipeActive && (
          <>
            {swipeOffset > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10"
              >
                <div className="flex items-center gap-2 text-green-600">
                  <Settings className="w-5 h-5" />
                  <span className="text-sm font-medium">Configure</span>
                </div>
              </motion.div>
            )}
            {swipeOffset < 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10"
              >
                <div className="flex items-center gap-2 text-red-600">
                  <Trash2 className="w-5 h-5" />
                  <span className="text-sm font-medium">Delete</span>
                </div>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      {/* Card Content */}
      <div className={cn(compact ? "p-2.5" : "p-3") }>
        {/* Header */}
        <div className={cn("flex items-start justify-between", compact ? "mb-1.5" : "mb-2") }>
          <div className="flex-1 min-w-0">
            <div className={cn("flex items-center gap-2", compact ? "mb-0" : "mb-0.5") }>
              <Monitor className={cn("text-gray-400", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
              <h3 className={cn("font-semibold text-gray-900 truncate", compact ? "text-sm" : "text-base") }>
                {device.device_name || `Device ${device.id}`}
              </h3>
            </div>
            <div className={cn("flex items-center gap-2 text-gray-500", compact ? "text-[11px]" : "text-xs") }>
              <span>ID: {device.device_identifier || device.id}</span>
              <span>•</span>
              <span>Token: {device.device_token.substring(0, 8)}...</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge 
              className={cn(
                "flex items-center gap-1 font-medium",
                compact ? "px-1 py-0 text-[9px]" : "px-1.5 py-0.5 text-[10px]",
                statusConfig.bgColor,
                statusConfig.textColor
              )}
            >
              {statusConfig.icon}
              {statusConfig.label}
            </Badge>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("p-0", compact ? "h-6 w-6" : "h-7 w-7")}
                >
                  <MoreVertical className={cn(compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {device.status === 'authorized' && (
                  <>
                    <DropdownMenuItem onClick={() => onEdit?.(device)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Device
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onRefresh?.(device)}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Refresh Browser
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onReset?.(device)}>
                      <Settings className="w-4 h-4 mr-2" />
                      Reset Device
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem 
                  onClick={() => onDelete?.(device)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Device
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Device Info */}
        <div className={cn(compact ? "space-y-1 mb-2.5" : "space-y-1.5 mb-3") }>
          {!minimal && (
            <div className={cn("flex justify-between", compact ? "text-[11px]" : "text-xs") }>
              <span className="text-gray-500">Created</span>
              <span className="text-gray-900">{formatDate(device.created_at)}</span>
            </div>
          )}
          <div className={cn("flex justify-between", compact ? "text-[11px]" : "text-xs") }>
            <span className="text-gray-500">Last Seen</span>
            <span className="text-gray-900">{formatDate(device.last_seen)}</span>
          </div>
          {!minimal && device.authorized_at && (
            <div className={cn("flex justify-between", compact ? "text-[11px]" : "text-xs") }>
              <span className="text-gray-500">Authorized</span>
              <span className="text-gray-900">{formatDate(device.authorized_at)}</span>
            </div>
          )}
        </div>

        {/* Playlist Info */}
        {!minimal && device.status === 'authorized' && (
          <div className={cn("bg-gray-50 rounded-lg", compact ? "mb-2.5 p-2" : "mb-3 p-2.5") }>
            <div className="flex items-center gap-2">
              <Play className={cn("text-gray-400", compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
              <span className={cn("font-medium text-gray-700", compact ? "text-[11px]" : "text-xs")}>Playlist</span>
            </div>
            <p className={cn("text-gray-600", compact ? "text-[11px] mt-0.5" : "text-xs mt-1") }>
              {device.playlist_name || 'None assigned'}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        {getActionButtons().length > 0 && (
          <div className={cn("flex flex-wrap", compact ? "gap-1" : "gap-1.5") }>
            {getActionButtons()}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export { MobileDeviceCard };
