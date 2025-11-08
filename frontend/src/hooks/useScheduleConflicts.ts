import { useState, useEffect } from 'react';
import type { ScheduleFormData, ScheduledPlaylist } from '../types';
import apiService from '../services/api';

interface ConflictInfo {
  schedule_id: number;
  schedule_name: string;
  priority: number;
  effective_priority: number;
  will_override: boolean;
  reason: string;
}

interface UseScheduleConflictsResult {
  conflicts: ConflictInfo[];
  loading: boolean;
  error: string | null;
  checkConflicts: (formData: ScheduleFormData, currentScheduleId?: number) => Promise<void>;
}

/**
 * Hook to check for schedule conflicts in real-time as user fills out form.
 */
export function useScheduleConflicts(): UseScheduleConflictsResult {
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkConflicts = async (formData: ScheduleFormData, currentScheduleId?: number) => {
    // Only check if we have enough data
    if (!formData.device_id || !formData.playlist_id) {
      setConflicts([]);
      return;
    }

    // For recurring schedules, need days and times
    if (formData.schedule_type === 'recurring') {
      if (!formData.days_of_week || formData.days_of_week.length === 0 || !formData.start_time || !formData.end_time) {
        setConflicts([]);
        return;
      }
    }

    // For specific date schedules, need date and times
    if (formData.schedule_type === 'specific_date') {
      if (!formData.specific_date || !formData.specific_start_time || !formData.specific_end_time) {
        setConflicts([]);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      // Get all schedules for this device
      const response = await apiService.getSchedules({ device_id: formData.device_id, enabled: true });
      const allSchedules = response.data || [];

      // Filter out current schedule if editing
      const otherSchedules = currentScheduleId 
        ? allSchedules.filter(s => s.id !== currentScheduleId)
        : allSchedules;

      // Check for overlaps
      const detectedConflicts: ConflictInfo[] = [];

      for (const schedule of otherSchedules) {
        if (schedulesOverlap(formData, schedule)) {
          // Calculate effective priorities
          const newEffectivePriority = formData.schedule_type === 'specific_date' 
            ? formData.priority + 1000 
            : formData.priority;
          
          const existingEffectivePriority = schedule.schedule_type === 'specific_date'
            ? schedule.priority + 1000
            : schedule.priority;

          const willOverride = newEffectivePriority > existingEffectivePriority;

          let reason = '';
          if (newEffectivePriority > existingEffectivePriority) {
            reason = `New schedule will override (priority ${newEffectivePriority} > ${existingEffectivePriority})`;
          } else if (newEffectivePriority < existingEffectivePriority) {
            reason = `Existing schedule will override (priority ${existingEffectivePriority} > ${newEffectivePriority})`;
          } else {
            reason = currentScheduleId && currentScheduleId < schedule.id
              ? 'New schedule will override (created first)'
              : 'Existing schedule will override (created first)';
          }

          detectedConflicts.push({
            schedule_id: schedule.id,
            schedule_name: schedule.name,
            priority: schedule.priority,
            effective_priority: existingEffectivePriority,
            will_override: willOverride,
            reason
          });
        }
      }

      setConflicts(detectedConflicts);
    } catch (err: any) {
      setError(err.message || 'Failed to check for conflicts');
      console.error('Conflict check error:', err);
    } finally {
      setLoading(false);
    }
  };

  return { conflicts, loading, error, checkConflicts };
}

/**
 * Check if two schedules overlap in time.
 */
function schedulesOverlap(formData: ScheduleFormData, existing: ScheduledPlaylist): boolean {
  // Recurring vs Recurring
  if (formData.schedule_type === 'recurring' && existing.schedule_type === 'recurring') {
    // Check if days overlap
    const formDays = new Set(formData.days_of_week || []);
    const existingDays = new Set(existing.days_of_week || []);
    const sharedDays = [...formDays].filter(d => existingDays.has(d));
    
    if (sharedDays.length === 0) {
      return false;
    }

    // Check if times overlap
    return timeRangesOverlap(
      formData.start_time || '',
      formData.end_time || '',
      existing.start_time || '',
      existing.end_time || ''
    );
  }

  // Specific vs Specific
  if (formData.schedule_type === 'specific_date' && existing.schedule_type === 'specific_date') {
    // Check if dates match (considering annual recurrence)
    const formDate = new Date(formData.specific_date || '');
    const existingDate = new Date(existing.specific_date || '');

    let datesMatch = false;
    if (formData.annual_recurrence && existing.annual_recurrence) {
      // Both annual - check month/day
      datesMatch = formDate.getMonth() === existingDate.getMonth() && formDate.getDate() === existingDate.getDate();
    } else if (formData.annual_recurrence || existing.annual_recurrence) {
      // One annual - could overlap
      datesMatch = formDate.getMonth() === existingDate.getMonth() && formDate.getDate() === existingDate.getDate();
    } else {
      // Both specific dates
      datesMatch = formData.specific_date === existing.specific_date;
    }

    if (!datesMatch) {
      return false;
    }

    // Check if times overlap
    return timeRangesOverlap(
      formData.specific_start_time || '',
      formData.specific_end_time || '',
      existing.specific_start_time || '',
      existing.specific_end_time || ''
    );
  }

  // Recurring vs Specific (or vice versa) - conservative approach, say they can conflict
  // The priority system will resolve it
  return true;
}

/**
 * Check if two time ranges overlap.
 */
function timeRangesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  if (!start1 || !end1 || !start2 || !end2) {
    return false;
  }

  // Convert to comparable format (remove seconds if present)
  const s1 = start1.substring(0, 5);
  const e1 = end1.substring(0, 5);
  const s2 = start2.substring(0, 5);
  const e2 = end2.substring(0, 5);

  // Overlap if: start1 < end2 AND start2 < end1
  return s1 < e2 && s2 < e1;
}

