/**
 * Transition Logger Service
 * 
 * Logs detailed information about image transitions to help debug
 * stuttering and duplicate image issues during slideshow transitions.
 */

import { displayDeviceLogger } from './displayDeviceLogger';

export interface TransitionEvent {
  timestamp: number;
  eventType: 'transition_start' | 'fade_out_start' | 'fade_out_complete' | 
             'index_change' | 'src_change' | 'image_load_start' | 'image_load_complete' | 
             'image_load_error' | 'fade_in_start' | 'fade_in_complete' | 'transition_complete';
  currentIndex: number;
  nextIndex?: number;
  currentImageId?: number;
  currentImageUrl?: string;
  isPreloaded?: boolean;
  loadTime?: number;
  error?: string;
  additionalData?: Record<string, any>;
}

class TransitionLogger {
  private transitions: Map<string, TransitionEvent[]> = new Map();
  private currentTransitionId: string | null = null;
  private transitionStartTime: number | null = null;

  /**
   * Start tracking a new transition
   */
  startTransition(currentIndex: number): string {
    const transitionId = `transition_${Date.now()}_${currentIndex}`;
    this.currentTransitionId = transitionId;
    this.transitionStartTime = Date.now();
    this.transitions.set(transitionId, []);
    
    this.logEvent({
      timestamp: Date.now(),
      eventType: 'transition_start',
      currentIndex,
    });

    displayDeviceLogger.info('🎬 Starting transition', {
      transitionId,
      currentIndex
    });

    return transitionId;
  }

  /**
   * Log a transition event
   */
  logEvent(event: TransitionEvent) {
    if (!this.currentTransitionId) return;

    const events = this.transitions.get(this.currentTransitionId) || [];
    events.push(event);
    this.transitions.set(this.currentTransitionId, events);

    // Log to console for debugging
    console.log(`[Transition ${event.eventType}]`, {
      ...event,
      timeSinceTransitionStart: this.transitionStartTime ? Date.now() - this.transitionStartTime : 0
    });
  }

  /**
   * Complete the current transition and report diagnostics
   */
  completeTransition(success: boolean = true) {
    if (!this.currentTransitionId) return;

    this.logEvent({
      timestamp: Date.now(),
      eventType: 'transition_complete',
      currentIndex: -1, // Not relevant
      additionalData: { success }
    });

    const events = this.transitions.get(this.currentTransitionId) || [];
    const diagnostics = this.analyzTransition(events);

    // Report to backend
    displayDeviceLogger.info('🎬 Transition complete', diagnostics);

    // If there were issues, log as error for easier filtering
    if (!diagnostics.isHealthy) {
      displayDeviceLogger.error('⚠️ Transition had issues', diagnostics);
    }

    // Clear transition
    this.currentTransitionId = null;
    this.transitionStartTime = null;
  }

  /**
   * Analyze transition events for issues
   */
  private analyzTransition(events: TransitionEvent[]): Record<string, any> {
    const start = events.find(e => e.eventType === 'transition_start');
    const complete = events.find(e => e.eventType === 'transition_complete');
    const indexChange = events.find(e => e.eventType === 'index_change');
    const srcChange = events.find(e => e.eventType === 'src_change');
    const loadComplete = events.find(e => e.eventType === 'image_load_complete');
    const fadeInStart = events.find(e => e.eventType === 'fade_in_start');
    const loadError = events.find(e => e.eventType === 'image_load_error');

    const totalDuration = start && complete ? complete.timestamp - start.timestamp : null;
    const loadTime = srcChange && loadComplete ? loadComplete.timestamp - srcChange.timestamp : null;
    const fadeInBeforeLoad = fadeInStart && loadComplete ? fadeInStart.timestamp < loadComplete.timestamp : false;

    const issues: string[] = [];
    
    if (!loadComplete && !loadError) {
      issues.push('Image never finished loading');
    }
    
    if (fadeInBeforeLoad) {
      issues.push('Fade-in started before image fully loaded');
    }
    
    if (loadTime && loadTime > 1000) {
      issues.push(`Slow image load: ${loadTime}ms`);
    }
    
    if (loadError) {
      issues.push('Image failed to load');
    }

    return {
      transitionId: this.currentTransitionId,
      totalDuration,
      loadTime,
      fadeInBeforeLoad,
      wasPreloaded: srcChange?.isPreloaded,
      issues,
      isHealthy: issues.length === 0,
      events: events.map(e => ({
        type: e.eventType,
        time: e.timestamp,
        index: e.currentIndex
      }))
    };
  }

  /**
   * Get transition history for debugging
   */
  getTransitionHistory(limit: number = 10): Array<{id: string, events: TransitionEvent[]}> {
    const entries = Array.from(this.transitions.entries());
    return entries.slice(-limit).map(([id, events]) => ({ id, events }));
  }

  /**
   * Export transition data for clipboard/debugging
   */
  exportTransitions(): string {
    const history = this.getTransitionHistory(5);
    return JSON.stringify(history, null, 2);
  }
}

export const transitionLogger = new TransitionLogger();

