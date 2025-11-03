import { useEffect, useRef, useState, useCallback } from 'react';
import { hapticPatterns, HapticFeedbackType } from '../utils/hapticFeedback';
import TouchTargetAuditor, { TouchTargetAuditResult } from '../utils/touchTargetAuditor';

export interface UseTouchTargetOptions {
  minimumSize?: number;
  enableHapticFeedback?: boolean;
  hapticType?: HapticFeedbackType;
  autoFix?: boolean;
  auditOnMount?: boolean;
}

export interface UseTouchTargetReturn {
  elementRef: React.RefObject<HTMLElement>;
  isCompliant: boolean;
  auditResults: TouchTargetAuditResult[];
  audit: () => void;
  applyFixes: () => number;
  addTouchTarget: () => void;
  removeTouchTarget: () => void;
}

/**
 * React hook for managing touch targets and haptic feedback
 */
export function useTouchTarget(options: UseTouchTargetOptions = {}): UseTouchTargetReturn {
  const {
    minimumSize = 44,
    enableHapticFeedback = true,
    hapticType = 'light',
    autoFix = false,
    auditOnMount = false
  } = options;

  const elementRef = useRef<HTMLElement>(null);
  const [isCompliant, setIsCompliant] = useState(true);
  const [auditResults, setAuditResults] = useState<TouchTargetAuditResult[]>([]);
  const auditorRef = useRef<TouchTargetAuditor | null>(null);

  // Initialize auditor
  useEffect(() => {
    auditorRef.current = new TouchTargetAuditor({ minimumSize });
  }, [minimumSize]);

  // Audit on mount if requested
  useEffect(() => {
    if (auditOnMount && elementRef.current) {
      audit();
    }
  }, [auditOnMount]);

  // Audit function
  const audit = useCallback(() => {
    if (!auditorRef.current || !elementRef.current) return;

    const results = auditorRef.current.audit();
    const elementResults = results.filter(result => 
      result.element === elementRef.current
    );

    setAuditResults(elementResults);
    setIsCompliant(elementResults.length === 0);

    // Auto-fix if enabled
    if (autoFix && elementResults.length > 0) {
      applyFixes();
    }
  }, [autoFix]);

  // Apply fixes function
  const applyFixes = useCallback((): number => {
    if (!auditorRef.current) return 0;

    const fixedCount = auditorRef.current.applyFixes(auditResults);
    
    // Re-audit after fixes
    if (fixedCount > 0) {
      audit();
    }

    return fixedCount;
  }, [auditResults, audit]);

  // Add touch target class
  const addTouchTarget = useCallback(() => {
    if (elementRef.current) {
      elementRef.current.classList.add('touch-target');
      audit();
    }
  }, [audit]);

  // Remove touch target class
  const removeTouchTarget = useCallback(() => {
    if (elementRef.current) {
      elementRef.current.classList.remove('touch-target');
      audit();
    }
  }, [audit]);

  // Enhanced click handler with haptic feedback
  const handleTouchInteraction = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (enableHapticFeedback) {
      hapticPatterns[hapticType]();
    }
  }, [enableHapticFeedback, hapticType]);

  return {
    elementRef,
    isCompliant,
    auditResults,
    audit,
    applyFixes,
    addTouchTarget,
    removeTouchTarget
  };
}

/**
 * Hook for managing multiple touch targets
 */
export function useTouchTargets(options: UseTouchTargetOptions = {}) {
  const [auditResults, setAuditResults] = useState<TouchTargetAuditResult[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const auditorRef = useRef<TouchTargetAuditor | null>(null);

  const {
    minimumSize = 44,
    autoFix = false
  } = options;

  // Initialize auditor
  useEffect(() => {
    auditorRef.current = new TouchTargetAuditor({ minimumSize });
  }, [minimumSize]);

  // Audit all interactive elements
  const auditAll = useCallback(async () => {
    if (!auditorRef.current) return;

    setIsAuditing(true);
    
    try {
      const results = auditorRef.current.audit();
      setAuditResults(results);

      // Auto-fix if enabled
      if (autoFix && results.length > 0) {
        const fixedCount = auditorRef.current.applyFixes(results);
        console.log(`Auto-fixed ${fixedCount} touch target issues`);
        
        // Re-audit after fixes
        const newResults = auditorRef.current.audit();
        setAuditResults(newResults);
      }
    } finally {
      setIsAuditing(false);
    }
  }, [autoFix]);

  // Apply fixes to all results
  const applyAllFixes = useCallback((): number => {
    if (!auditorRef.current) return 0;

    const fixedCount = auditorRef.current.applyFixes(auditResults);
    
    if (fixedCount > 0) {
      auditAll();
    }

    return fixedCount;
  }, [auditResults, auditAll]);

  // Generate audit report
  const generateReport = useCallback((): string => {
    if (!auditorRef.current) return '';

    return auditorRef.current.generateReport(auditResults);
  }, [auditResults]);

  // Get summary statistics
  const getSummary = useCallback(() => {
    const total = auditResults.length;
    const high = auditResults.filter(r => r.priority === 'high').length;
    const medium = auditResults.filter(r => r.priority === 'medium').length;
    const low = auditResults.filter(r => r.priority === 'low').length;

    return {
      total,
      high,
      medium,
      low,
      isCompliant: total === 0
    };
  }, [auditResults]);

  return {
    auditResults,
    isAuditing,
    auditAll,
    applyAllFixes,
    generateReport,
    getSummary
  };
}

export default useTouchTarget;
