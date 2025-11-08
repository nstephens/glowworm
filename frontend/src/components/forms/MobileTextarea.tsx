import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle, Maximize2, Minimize2 } from 'lucide-react';
import { hapticPatterns } from '@/utils/hapticFeedback';

export interface MobileTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  success?: boolean;
  variant?: 'default' | 'filled' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  animatedLabel?: boolean;
  autoResize?: boolean;
  maxRows?: number;
  minRows?: number;
  showExpandToggle?: boolean;
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    custom?: (value: string) => boolean | string;
  };
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

/**
 * Mobile-optimized textarea component with enhanced touch interactions
 * Features: Auto-resize, expand toggle, validation, haptic feedback
 */
export const MobileTextarea: React.FC<MobileTextareaProps> = ({
  label,
  error,
  helperText,
  success = false,
  variant = 'default',
  size = 'md',
  fullWidth = true,
  animatedLabel = true,
  autoResize = true,
  maxRows = 10,
  minRows = 3,
  showExpandToggle = false,
  validation,
  onValidationChange,
  className,
  id,
  value,
  onChange,
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [textareaHeight, setTextareaHeight] = useState<number>(0);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputId = id || `mobile-textarea-${Math.random().toString(36).substr(2, 9)}`;
  const labelId = `${inputId}-label`;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  // Auto-resize functionality
  const adjustHeight = () => {
    if (!textareaRef.current || !autoResize) return;

    const textarea = textareaRef.current;
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
    const minHeight = minRows * lineHeight;
    const maxHeight = maxRows * lineHeight;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    
    // Set height within min/max bounds
    const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
    textarea.style.height = `${newHeight}px`;
    setTextareaHeight(newHeight);
  };

  // Validation logic
  const validateInput = (inputValue: string) => {
    if (!validation || !hasInteracted) return true;

    setIsValidating(true);
    
    try {
      // Required validation
      if (validation.required && !inputValue.trim()) {
        setValidationError('This field is required');
        onValidationChange?.(false, 'This field is required');
        return false;
      }

      // Min length validation
      if (validation.minLength && inputValue.length < validation.minLength) {
        setValidationError(`Minimum ${validation.minLength} characters required`);
        onValidationChange?.(false, `Minimum ${validation.minLength} characters required`);
        return false;
      }

      // Max length validation
      if (validation.maxLength && inputValue.length > validation.maxLength) {
        setValidationError(`Maximum ${validation.maxLength} characters allowed`);
        onValidationChange?.(false, `Maximum ${validation.maxLength} characters allowed`);
        return false;
      }

      // Pattern validation
      if (validation.pattern && !validation.pattern.test(inputValue)) {
        setValidationError('Invalid format');
        onValidationChange?.(false, 'Invalid format');
        return false;
      }

      // Custom validation
      if (validation.custom) {
        const customResult = validation.custom(inputValue);
        if (customResult !== true) {
          const errorMessage = typeof customResult === 'string' ? customResult : 'Invalid value';
          setValidationError(errorMessage);
          onValidationChange?.(false, errorMessage);
          return false;
        }
      }

      setValidationError('');
      onValidationChange?.(true);
      return true;
    } finally {
      setIsValidating(false);
    }
  };

  // Handle input change with validation and auto-resize
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const inputValue = e.target.value;
    setHasInteracted(true);
    validateInput(inputValue);
    onChange?.(e);
    
    // Auto-resize after content change
    if (autoResize) {
      setTimeout(adjustHeight, 0);
    }
  };

  // Handle focus with haptic feedback
  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(true);
    hapticPatterns.light();
    onFocus?.(e);
  };

  // Handle blur
  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(false);
    setHasInteracted(true);
    validateInput(e.target.value);
    onBlur?.(e);
  };

  // Toggle expand/collapse
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    hapticPatterns.medium();
    
    if (!isExpanded) {
      // Expand to full height
      if (textareaRef.current) {
        const textarea = textareaRef.current;
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
        textarea.style.height = `${maxRows * lineHeight}px`;
        setTextareaHeight(maxRows * lineHeight);
      }
    } else {
      // Collapse to auto height
      adjustHeight();
    }
  };

  // Adjust height on mount and when value changes
  useEffect(() => {
    if (autoResize) {
      adjustHeight();
    }
  }, [value, autoResize, minRows, maxRows]);

  // Size classes
  const sizeClasses = {
    sm: 'text-sm px-3 py-2',
    md: 'text-base px-4 py-3',
    lg: 'text-lg px-5 py-4'
  };

  // Variant classes
  const variantClasses = {
    default: 'bg-background border border-input',
    filled: 'bg-muted border-0',
    outlined: 'bg-transparent border-2 border-input'
  };

  // State classes
  const stateClasses = {
    error: 'border-destructive focus-visible:ring-destructive focus-visible:border-destructive',
    success: 'border-green-500 focus-visible:ring-green-500 focus-visible:border-green-500',
    default: 'border-input focus-visible:border-primary'
  };

  // Determine current state
  const currentError = error || validationError;
  const hasError = Boolean(currentError);
  const hasSuccess = success && !hasError && value && String(value).length > 0;
  const currentState = hasError ? 'error' : hasSuccess ? 'success' : 'default';

  return (
    <div className={cn('w-full', fullWidth && 'w-full', className)}>
      {/* Label */}
      {label && (
        <label
          id={labelId}
          htmlFor={inputId}
          className={cn(
            'block text-sm font-medium mb-2 transition-colors duration-200',
            hasError ? 'text-destructive' : hasSuccess ? 'text-green-600' : 'text-foreground',
            animatedLabel && 'transform transition-transform duration-200',
            animatedLabel && isFocused && 'scale-105'
          )}
        >
          {label}
          {validation?.required && (
            <span className="text-destructive ml-1" aria-label="required">*</span>
          )}
        </label>
      )}

      {/* Textarea Container */}
      <div className="relative">
        {/* Textarea Field */}
        <textarea
          ref={textareaRef}
          id={inputId}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          rows={isExpanded ? maxRows : minRows}
          className={cn(
            // Base styles
            'w-full rounded-lg transition-all duration-200 resize-none',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'placeholder:text-muted-foreground',
            'hover:border-primary/50',
            
            // Size
            sizeClasses[size],
            
            // Variant
            variantClasses[variant],
            
            // State
            stateClasses[currentState],
            
            // Focus styles
            isFocused && 'ring-2 ring-primary/20',
            
            // Animation
            'transform transition-transform duration-150',
            isFocused && 'scale-[1.01]'
          )}
          aria-invalid={hasError}
          aria-describedby={cn(
            hasError && errorId,
            helperText && !hasError && helperId,
            labelId
          )}
          aria-required={validation?.required}
          {...props}
        />

        {/* Action Buttons */}
        <div className="absolute top-3 right-3 flex items-center gap-1">
          {/* Success Icon */}
          {hasSuccess && !isValidating && (
            <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
          )}

          {/* Error Icon */}
          {hasError && (
            <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
          )}

          {/* Expand Toggle */}
          {showExpandToggle && (
            <button
              type="button"
              onClick={toggleExpand}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
              aria-label={isExpanded ? 'Collapse textarea' : 'Expand textarea'}
              tabIndex={-1}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Loading Indicator */}
          {isValidating && (
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          )}
        </div>
      </div>

      {/* Error Message */}
      {hasError && (
        <p
          id={errorId}
          className="mt-2 text-sm text-destructive flex items-center gap-1 animate-in slide-in-from-top-1 duration-200"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {currentError}
        </p>
      )}

      {/* Helper Text */}
      {helperText && !hasError && (
        <p
          id={helperId}
          className="mt-2 text-sm text-muted-foreground"
        >
          {helperText}
        </p>
      )}

      {/* Character Count */}
      {validation?.maxLength && (
        <div className="mt-1 text-xs text-muted-foreground text-right">
          {String(value || '').length}/{validation.maxLength}
        </div>
      )}
    </div>
  );
};







