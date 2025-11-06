import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { hapticPatterns } from '@/utils/hapticFeedback';

export interface MobileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  success?: boolean;
  showPasswordToggle?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: 'default' | 'filled' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  animatedLabel?: boolean;
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
 * Mobile-optimized input component with enhanced touch interactions
 * Features: 44px minimum touch target, haptic feedback, validation, animations
 */
export const MobileInput: React.FC<MobileInputProps> = ({
  label,
  error,
  helperText,
  success = false,
  showPasswordToggle = false,
  leftIcon,
  rightIcon,
  variant = 'default',
  size = 'md',
  fullWidth = true,
  animatedLabel = true,
  validation,
  onValidationChange,
  className,
  id,
  type = 'text',
  value,
  onChange,
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [hasInteracted, setHasInteracted] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = id || `mobile-input-${Math.random().toString(36).substr(2, 9)}`;
  const labelId = `${inputId}-label`;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

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

  // Handle input change with validation
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setHasInteracted(true);
    validateInput(inputValue);
    onChange?.(e);
  };

  // Handle focus with haptic feedback
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    hapticPatterns.light();
    onFocus?.(e);
  };

  // Handle blur
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    setHasInteracted(true);
    validateInput(e.target.value);
    onBlur?.(e);
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
    hapticPatterns.medium();
    inputRef.current?.focus();
  };

  // Size classes
  const sizeClasses = {
    sm: 'h-10 text-sm px-3 py-2',
    md: 'h-12 text-base px-4 py-3',
    lg: 'h-14 text-lg px-5 py-4'
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

  // Input type for password toggle
  const inputType = showPasswordToggle && type === 'password' ? (showPassword ? 'text' : 'password') : type;

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

      {/* Input Container */}
      <div className="relative">
        {/* Left Icon */}
        {leftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
            {leftIcon}
          </div>
        )}

        {/* Input Field */}
        <input
          ref={inputRef}
          id={inputId}
          type={inputType}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(
            // Base styles
            'w-full rounded-lg transition-all duration-200',
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
            
            // Padding adjustments for icons
            leftIcon && 'pl-10',
            (rightIcon || showPasswordToggle) && 'pr-10',
            
            // Focus styles
            isFocused && 'ring-2 ring-primary/20',
            
            // Animation
            'transform transition-transform duration-150',
            isFocused && 'scale-[1.02]'
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

        {/* Right Icons */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {/* Success Icon */}
          {hasSuccess && !isValidating && (
            <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
          )}

          {/* Error Icon */}
          {hasError && (
            <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
          )}

          {/* Password Toggle */}
          {showPasswordToggle && type === 'password' && (
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Custom Right Icon */}
          {rightIcon && !showPasswordToggle && !hasSuccess && !hasError && (
            <div className="text-muted-foreground">
              {rightIcon}
            </div>
          )}
        </div>

        {/* Loading Indicator */}
        {isValidating && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
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






