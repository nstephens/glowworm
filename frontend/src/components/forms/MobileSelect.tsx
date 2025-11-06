import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Check, AlertCircle, CheckCircle, Search } from 'lucide-react';
import { hapticPatterns } from '@/utils/hapticFeedback';

export interface MobileSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
  icon?: React.ReactNode;
}

export interface MobileSelectProps {
  label?: string;
  placeholder?: string;
  error?: string;
  helperText?: string;
  success?: boolean;
  options: MobileSelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (query: string) => void;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'filled' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  animatedLabel?: boolean;
  validation?: {
    required?: boolean;
    custom?: (value: string) => boolean | string;
  };
  onValidationChange?: (isValid: boolean, error?: string) => void;
  className?: string;
  id?: string;
}

/**
 * Mobile-optimized select component with enhanced touch interactions
 * Features: Search, clear, validation, haptic feedback, touch-friendly dropdown
 */
export const MobileSelect: React.FC<MobileSelectProps> = ({
  label,
  placeholder = 'Select an option',
  error,
  helperText,
  success = false,
  options = [],
  value,
  onChange,
  onSearch,
  searchable = false,
  clearable = false,
  disabled = false,
  variant = 'default',
  size = 'md',
  fullWidth = true,
  animatedLabel = true,
  validation,
  onValidationChange,
  className,
  id
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [hasInteracted, setHasInteracted] = useState(false);
  
  const selectRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const inputId = id || `mobile-select-${Math.random().toString(36).substr(2, 9)}`;
  const labelId = `${inputId}-label`;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;
  const listboxId = `${inputId}-listbox`;

  // Filter options based on search query
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    option.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get selected option
  const selectedOption = options.find(option => option.value === value);

  // Validation logic
  const validateInput = (inputValue: string) => {
    if (!validation || !hasInteracted) return true;

    setIsValidating(true);
    
    try {
      // Required validation
      if (validation.required && !inputValue) {
        setValidationError('This field is required');
        onValidationChange?.(false, 'This field is required');
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

  // Handle option selection
  const handleOptionSelect = (optionValue: string) => {
    if (disabled) return;
    
    setHasInteracted(true);
    validateInput(optionValue);
    onChange?.(optionValue);
    setIsOpen(false);
    setSearchQuery('');
    hapticPatterns.medium();
  };

  // Handle clear
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    
    setHasInteracted(true);
    validateInput('');
    onChange?.('');
    hapticPatterns.light();
  };

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
  };

  // Handle toggle
  const handleToggle = () => {
    if (disabled) return;
    
    setIsOpen(!isOpen);
    hapticPatterns.light();
    
    if (!isOpen && searchable) {
      // Focus search input when opening
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  };

  // Handle focus
  const handleFocus = () => {
    setIsFocused(true);
  };

  // Handle blur
  const handleBlur = () => {
    setIsFocused(false);
    setHasInteracted(true);
    if (value) {
      validateInput(value);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

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
  const hasSuccess = success && !hasError && value;
  const currentState = hasError ? 'error' : hasSuccess ? 'success' : 'default';

  return (
    <div className={cn('w-full', fullWidth && 'w-full', className)} ref={selectRef}>
      {/* Label */}
      {label && (
        <label
          id={labelId}
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

      {/* Select Container */}
      <div className="relative">
        {/* Select Trigger */}
        <button
          type="button"
          onClick={handleToggle}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          className={cn(
            // Base styles
            'w-full rounded-lg transition-all duration-200 text-left',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
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
            isFocused && 'scale-[1.02]',
            
            // Flex layout
            'flex items-center justify-between gap-2'
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={labelId}
          aria-describedby={cn(
            hasError && errorId,
            helperText && !hasError && helperId
          )}
          aria-required={validation?.required}
        >
          {/* Selected Value or Placeholder */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectedOption?.icon && (
              <div className="flex-shrink-0 text-muted-foreground">
                {selectedOption.icon}
              </div>
            )}
            <span className={cn(
              'truncate',
              !selectedOption && 'text-muted-foreground'
            )}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Success Icon */}
            {hasSuccess && !isValidating && (
              <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
            )}

            {/* Error Icon */}
            {hasError && (
              <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
            )}

            {/* Clear Button */}
            {clearable && value && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
                aria-label="Clear selection"
                tabIndex={-1}
              >
                <span className="sr-only">Clear</span>
                ×
              </button>
            )}

            {/* Dropdown Arrow */}
            <ChevronDown 
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform duration-200',
                isOpen && 'rotate-180'
              )}
              aria-hidden="true"
            />

            {/* Loading Indicator */}
            {isValidating && (
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            )}
          </div>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div
            className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg animate-in slide-in-from-top-2 duration-200"
            role="listbox"
            id={listboxId}
            aria-labelledby={labelId}
          >
            {/* Search Input */}
            {searchable && (
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Search options..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="max-h-60 overflow-y-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleOptionSelect(option.value)}
                    disabled={option.disabled}
                    className={cn(
                      'w-full px-4 py-3 text-left transition-colors duration-150',
                      'hover:bg-muted focus:bg-muted focus:outline-none',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'flex items-center gap-3',
                      value === option.value && 'bg-primary/10 text-primary'
                    )}
                    role="option"
                    aria-selected={value === option.value}
                  >
                    {/* Option Icon */}
                    {option.icon && (
                      <div className="flex-shrink-0 text-muted-foreground">
                        {option.icon}
                      </div>
                    )}

                    {/* Option Content */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{option.label}</div>
                      {option.description && (
                        <div className="text-sm text-muted-foreground truncate">
                          {option.description}
                        </div>
                      )}
                    </div>

                    {/* Selected Indicator */}
                    {value === option.value && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                  {searchQuery ? 'No options found' : 'No options available'}
                </div>
              )}
            </div>
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
    </div>
  );
};






