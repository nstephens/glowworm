import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { hapticPatterns } from '@/utils/hapticFeedback';

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'password' | 'number' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    custom?: (value: string) => boolean | string;
  };
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
  helperText?: string;
  disabled?: boolean;
}

export interface MobileFormProps {
  fields: FormField[];
  onSubmit: (data: Record<string, string>) => Promise<void> | void;
  submitLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  onCancel?: () => void;
  loading?: boolean;
  success?: boolean;
  error?: string;
  successMessage?: string;
  variant?: 'default' | 'card' | 'minimal';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
  id?: string;
}

/**
 * Mobile-optimized form component with enhanced touch interactions
 * Features: Validation, loading states, success/error feedback, haptic feedback
 */
export const MobileForm: React.FC<MobileFormProps> = ({
  fields,
  onSubmit,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  showCancel = false,
  onCancel,
  loading = false,
  success = false,
  error,
  successMessage = 'Form submitted successfully!',
  variant = 'default',
  size = 'md',
  fullWidth = true,
  className,
  id
}) => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  
  const formRef = useRef<HTMLFormElement>(null);
  const formId = id || `mobile-form-${Math.random().toString(36).substr(2, 9)}`;

  // Initialize form data
  useEffect(() => {
    const initialData: Record<string, string> = {};
    fields.forEach(field => {
      initialData[field.name] = '';
    });
    setFormData(initialData);
  }, [fields]);

  // Validation logic
  const validateField = (field: FormField, value: string): string | null => {
    // Required validation
    if (field.required && !value.trim()) {
      return 'This field is required';
    }

    // Skip other validations if field is empty and not required
    if (!value.trim() && !field.required) {
      return null;
    }

    // Min length validation
    if (field.validation?.minLength && value.length < field.validation.minLength) {
      return `Minimum ${field.validation.minLength} characters required`;
    }

    // Max length validation
    if (field.validation?.maxLength && value.length > field.validation.maxLength) {
      return `Maximum ${field.validation.maxLength} characters allowed`;
    }

    // Pattern validation
    if (field.validation?.pattern && !field.validation.pattern.test(value)) {
      return 'Invalid format';
    }

    // Custom validation
    if (field.validation?.custom) {
      const customResult = field.validation.custom(value);
      if (customResult !== true) {
        return typeof customResult === 'string' ? customResult : 'Invalid value';
      }
    }

    return null;
  };

  // Handle field change
  const handleFieldChange = (fieldName: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    
    // Clear error when user starts typing
    if (fieldErrors[fieldName]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  // Handle field blur
  const handleFieldBlur = (fieldName: string) => {
    setTouchedFields(prev => new Set(prev).add(fieldName));
    
    const field = fields.find(f => f.name === fieldName);
    if (field) {
      const error = validateField(field, formData[fieldName] || '');
      if (error) {
        setFieldErrors(prev => ({ ...prev, [fieldName]: error }));
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading || isSubmitting) return;

    setIsSubmitting(true);
    hapticPatterns.medium();

    try {
      // Validate all fields
      const errors: Record<string, string> = {};
      let hasErrors = false;

      fields.forEach(field => {
        const error = validateField(field, formData[field.name] || '');
        if (error) {
          errors[field.name] = error;
          hasErrors = true;
        }
      });

      if (hasErrors) {
        setFieldErrors(errors);
        hapticPatterns.error();
        return;
      }

      // Submit form
      await onSubmit(formData);
      hapticPatterns.success();
    } catch (err) {
      hapticPatterns.error();
      console.error('Form submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    hapticPatterns.light();
    onCancel?.();
  };

  // Size classes
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  // Variant classes
  const variantClasses = {
    default: 'bg-background border border-border rounded-lg p-6',
    card: 'bg-card border border-border rounded-xl p-6 shadow-sm',
    minimal: 'bg-transparent'
  };

  // Check if form is valid
  const isFormValid = Object.keys(fieldErrors).length === 0 && 
    fields.every(field => !field.required || (formData[field.name] && formData[field.name].trim()));

  return (
    <form
      ref={formRef}
      id={formId}
      onSubmit={handleSubmit}
      className={cn(
        'w-full',
        fullWidth && 'w-full',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      noValidate
    >
      {/* Form Fields */}
      <div className="space-y-4">
        {fields.map((field) => {
          const fieldError = fieldErrors[field.name];
          const isTouched = touchedFields.has(field.name);
          const showError = isTouched && fieldError;

          return (
            <div key={field.name}>
              {field.type === 'textarea' ? (
                <div>
                  <label
                    htmlFor={`${formId}-${field.name}`}
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    {field.label}
                    {field.required && (
                      <span className="text-destructive ml-1" aria-label="required">*</span>
                    )}
                  </label>
                  <textarea
                    id={`${formId}-${field.name}`}
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    onBlur={() => handleFieldBlur(field.name)}
                    placeholder={field.placeholder}
                    disabled={field.disabled || loading}
                    className={cn(
                      'w-full px-4 py-3 border rounded-lg transition-all duration-200',
                      'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                      'placeholder:text-muted-foreground',
                      showError
                        ? 'border-destructive focus:ring-destructive focus:border-destructive'
                        : 'border-input hover:border-primary/50'
                    )}
                    rows={4}
                    aria-invalid={showError}
                    aria-describedby={cn(
                      showError && `${formId}-${field.name}-error`,
                      field.helperText && `${formId}-${field.name}-helper`
                    )}
                  />
                  {showError && (
                    <p
                      id={`${formId}-${field.name}-error`}
                      className="mt-1 text-sm text-destructive flex items-center gap-1"
                      role="alert"
                    >
                      <AlertCircle className="h-3 w-3" />
                      {fieldError}
                    </p>
                  )}
                  {field.helperText && !showError && (
                    <p
                      id={`${formId}-${field.name}-helper`}
                      className="mt-1 text-sm text-muted-foreground"
                    >
                      {field.helperText}
                    </p>
                  )}
                </div>
              ) : field.type === 'select' ? (
                <div>
                  <label
                    htmlFor={`${formId}-${field.name}`}
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    {field.label}
                    {field.required && (
                      <span className="text-destructive ml-1" aria-label="required">*</span>
                    )}
                  </label>
                  <select
                    id={`${formId}-${field.name}`}
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    onBlur={() => handleFieldBlur(field.name)}
                    disabled={field.disabled || loading}
                    className={cn(
                      'w-full px-4 py-3 border rounded-lg transition-all duration-200',
                      'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                      'bg-background',
                      showError
                        ? 'border-destructive focus:ring-destructive focus:border-destructive'
                        : 'border-input hover:border-primary/50'
                    )}
                    aria-invalid={showError}
                    aria-describedby={cn(
                      showError && `${formId}-${field.name}-error`,
                      field.helperText && `${formId}-${field.name}-helper`
                    )}
                  >
                    <option value="" disabled>
                      {field.placeholder || 'Select an option'}
                    </option>
                    {field.options?.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {showError && (
                    <p
                      id={`${formId}-${field.name}-error`}
                      className="mt-1 text-sm text-destructive flex items-center gap-1"
                      role="alert"
                    >
                      <AlertCircle className="h-3 w-3" />
                      {fieldError}
                    </p>
                  )}
                  {field.helperText && !showError && (
                    <p
                      id={`${formId}-${field.name}-helper`}
                      className="mt-1 text-sm text-muted-foreground"
                    >
                      {field.helperText}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label
                    htmlFor={`${formId}-${field.name}`}
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    {field.label}
                    {field.required && (
                      <span className="text-destructive ml-1" aria-label="required">*</span>
                    )}
                  </label>
                  <input
                    id={`${formId}-${field.name}`}
                    name={field.name}
                    type={field.type}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    onBlur={() => handleFieldBlur(field.name)}
                    placeholder={field.placeholder}
                    disabled={field.disabled || loading}
                    className={cn(
                      'w-full px-4 py-3 border rounded-lg transition-all duration-200',
                      'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                      'placeholder:text-muted-foreground',
                      showError
                        ? 'border-destructive focus:ring-destructive focus:border-destructive'
                        : 'border-input hover:border-primary/50'
                    )}
                    aria-invalid={showError}
                    aria-describedby={cn(
                      showError && `${formId}-${field.name}-error`,
                      field.helperText && `${formId}-${field.name}-helper`
                    )}
                  />
                  {showError && (
                    <p
                      id={`${formId}-${field.name}-error`}
                      className="mt-1 text-sm text-destructive flex items-center gap-1"
                      role="alert"
                    >
                      <AlertCircle className="h-3 w-3" />
                      {fieldError}
                    </p>
                  )}
                  {field.helperText && !showError && (
                    <p
                      id={`${formId}-${field.name}-helper`}
                      className="mt-1 text-sm text-muted-foreground"
                    >
                      {field.helperText}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Form Status Messages */}
      {error && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Form Actions */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <button
          type="submit"
          disabled={!isFormValid || loading || isSubmitting}
          className={cn(
            'flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'flex items-center justify-center gap-2',
            isFormValid && !loading && !isSubmitting
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {loading || isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            submitLabel
          )}
        </button>

        {showCancel && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading || isSubmitting}
            className="px-6 py-3 rounded-lg font-medium border border-input bg-background text-foreground hover:bg-muted transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        )}
      </div>
    </form>
  );
};







