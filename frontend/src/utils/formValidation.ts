/**
 * Comprehensive form validation utilities for mobile-optimized forms
 * Provides validation functions, patterns, and error messages
 */

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => boolean | string;
  message?: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// Common validation patterns
export const validationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[\+]?[1-9][\d]{0,15}$/,
  phoneUS: /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/,
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  alphanumericWithSpaces: /^[a-zA-Z0-9\s]+$/,
  lettersOnly: /^[a-zA-Z\s]+$/,
  numbersOnly: /^\d+$/,
  decimal: /^\d*\.?\d+$/,
  strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  mediumPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,}$/,
  username: /^[a-zA-Z0-9_]{3,20}$/,
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  hexColor: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  ipAddress: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  creditCard: /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})$/,
  ssn: /^\d{3}-?\d{2}-?\d{4}$/,
  zipCode: /^\d{5}(-\d{4})?$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  time: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
  datetime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/
};

// Common error messages
export const errorMessages = {
  required: 'This field is required',
  minLength: (min: number) => `Minimum ${min} characters required`,
  maxLength: (max: number) => `Maximum ${max} characters allowed`,
  pattern: 'Invalid format',
  email: 'Please enter a valid email address',
  phone: 'Please enter a valid phone number',
  url: 'Please enter a valid URL',
  alphanumeric: 'Only letters and numbers are allowed',
  lettersOnly: 'Only letters are allowed',
  numbersOnly: 'Only numbers are allowed',
  strongPassword: 'Password must contain at least 8 characters with uppercase, lowercase, number, and special character',
  mediumPassword: 'Password must contain at least 6 characters with uppercase, lowercase, and number',
  username: 'Username must be 3-20 characters long and contain only letters, numbers, and underscores',
  slug: 'Slug must contain only lowercase letters, numbers, and hyphens',
  hexColor: 'Please enter a valid hex color code',
  ipAddress: 'Please enter a valid IP address',
  creditCard: 'Please enter a valid credit card number',
  ssn: 'Please enter a valid Social Security Number',
  zipCode: 'Please enter a valid ZIP code',
  date: 'Please enter a valid date',
  time: 'Please enter a valid time',
  datetime: 'Please enter a valid date and time'
};

/**
 * Validate a single field value against validation rules
 */
export const validateField = (value: string, rules: ValidationRule): ValidationResult => {
  // Required validation
  if (rules.required && !value.trim()) {
    return {
      isValid: false,
      error: rules.message || errorMessages.required
    };
  }

  // Skip other validations if field is empty and not required
  if (!value.trim() && !rules.required) {
    return { isValid: true };
  }

  // Min length validation
  if (rules.minLength && value.length < rules.minLength) {
    return {
      isValid: false,
      error: rules.message || errorMessages.minLength(rules.minLength)
    };
  }

  // Max length validation
  if (rules.maxLength && value.length > rules.maxLength) {
    return {
      isValid: false,
      error: rules.message || errorMessages.maxLength(rules.maxLength)
    };
  }

  // Pattern validation
  if (rules.pattern && !rules.pattern.test(value)) {
    return {
      isValid: false,
      error: rules.message || errorMessages.pattern
    };
  }

  // Custom validation
  if (rules.custom) {
    const customResult = rules.custom(value);
    if (customResult !== true) {
      return {
        isValid: false,
        error: typeof customResult === 'string' ? customResult : rules.message || 'Invalid value'
      };
    }
  }

  return { isValid: true };
};

/**
 * Validate multiple fields at once
 */
export const validateFields = (
  data: Record<string, string>,
  rules: Record<string, ValidationRule>
): { isValid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};
  let isValid = true;

  Object.keys(rules).forEach(fieldName => {
    const fieldValue = data[fieldName] || '';
    const fieldRules = rules[fieldName];
    const result = validateField(fieldValue, fieldRules);

    if (!result.isValid) {
      errors[fieldName] = result.error || 'Invalid value';
      isValid = false;
    }
  });

  return { isValid, errors };
};

/**
 * Common validation rules for different field types
 */
export const commonRules = {
  email: {
    required: true,
    pattern: validationPatterns.email,
    message: errorMessages.email
  },
  phone: {
    required: true,
    pattern: validationPatterns.phone,
    message: errorMessages.phone
  },
  phoneUS: {
    required: true,
    pattern: validationPatterns.phoneUS,
    message: errorMessages.phone
  },
  url: {
    required: true,
    pattern: validationPatterns.url,
    message: errorMessages.url
  },
  password: {
    required: true,
    minLength: 8,
    pattern: validationPatterns.strongPassword,
    message: errorMessages.strongPassword
  },
  passwordMedium: {
    required: true,
    minLength: 6,
    pattern: validationPatterns.mediumPassword,
    message: errorMessages.mediumPassword
  },
  username: {
    required: true,
    minLength: 3,
    maxLength: 20,
    pattern: validationPatterns.username,
    message: errorMessages.username
  },
  name: {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: validationPatterns.lettersOnly,
    message: errorMessages.lettersOnly
  },
  zipCode: {
    required: true,
    pattern: validationPatterns.zipCode,
    message: errorMessages.zipCode
  },
  creditCard: {
    required: true,
    pattern: validationPatterns.creditCard,
    message: errorMessages.creditCard
  },
  ssn: {
    required: true,
    pattern: validationPatterns.ssn,
    message: errorMessages.ssn
  }
};

/**
 * Real-time validation hook for form fields
 */
export const useFieldValidation = (
  value: string,
  rules: ValidationRule,
  validateOnChange: boolean = true
) => {
  const [error, setError] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean>(true);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  const validate = useCallback(async () => {
    if (!validateOnChange && !value) return;

    setIsValidating(true);
    
    try {
      const result = validateField(value, rules);
      setError(result.error || '');
      setIsValid(result.isValid);
    } finally {
      setIsValidating(false);
    }
  }, [value, rules, validateOnChange]);

  useEffect(() => {
    if (validateOnChange) {
      validate();
    }
  }, [validate, validateOnChange]);

  return {
    error,
    isValid,
    isValidating,
    validate
  };
};

/**
 * Form validation hook for multiple fields
 */
export const useFormValidation = (
  initialData: Record<string, string>,
  rules: Record<string, ValidationRule>
) => {
  const [data, setData] = useState<Record<string, string>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValid, setIsValid] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  const updateField = useCallback((fieldName: string, value: string) => {
    setData(prev => ({ ...prev, [fieldName]: value }));
    
    // Clear error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  }, [errors]);

  const validateForm = useCallback(async () => {
    setIsValidating(true);
    
    try {
      const result = validateFields(data, rules);
      setErrors(result.errors);
      setIsValid(result.isValid);
      return result;
    } finally {
      setIsValidating(false);
    }
  }, [data, rules]);

  const validateField = useCallback((fieldName: string) => {
    const fieldValue = data[fieldName] || '';
    const fieldRules = rules[fieldName];
    
    if (!fieldRules) return;

    const result = validateField(fieldValue, fieldRules);
    
    if (!result.isValid) {
      setErrors(prev => ({ ...prev, [fieldName]: result.error || 'Invalid value' }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  }, [data, rules]);

  useEffect(() => {
    validateForm();
  }, [validateForm]);

  return {
    data,
    errors,
    isValid,
    isValidating,
    updateField,
    validateForm,
    validateField,
    setData
  };
};

/**
 * Debounced validation for real-time feedback
 */
export const useDebouncedValidation = (
  value: string,
  rules: ValidationRule,
  delay: number = 300
) => {
  const [error, setError] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean>(true);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  const debouncedValidate = useMemo(
    () => debounce(async () => {
      if (!value) {
        setError('');
        setIsValid(true);
        return;
      }

      setIsValidating(true);
      
      try {
        const result = validateField(value, rules);
        setError(result.error || '');
        setIsValid(result.isValid);
      } finally {
        setIsValidating(false);
      }
    }, delay),
    [value, rules, delay]
  );

  useEffect(() => {
    debouncedValidate();
    
    return () => {
      debouncedValidate.cancel();
    };
  }, [debouncedValidate]);

  return {
    error,
    isValid,
    isValidating
  };
};

/**
 * Utility function to create debounced function
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;

  const debounced = ((...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}

/**
 * Sanitize input value for security
 */
export const sanitizeInput = (value: string): string => {
  return value
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
};

/**
 * Format input value based on type
 */
export const formatInput = (value: string, type: string): string => {
  switch (type) {
    case 'phone':
      // Format US phone number
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length >= 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
      }
      return value;
    
    case 'creditCard':
      // Format credit card number with spaces
      const cardCleaned = value.replace(/\D/g, '');
      return cardCleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
    
    case 'ssn':
      // Format SSN
      const ssnCleaned = value.replace(/\D/g, '');
      if (ssnCleaned.length >= 9) {
        return `${ssnCleaned.slice(0, 3)}-${ssnCleaned.slice(3, 5)}-${ssnCleaned.slice(5, 9)}`;
      }
      return value;
    
    case 'zipCode':
      // Format ZIP code
      const zipCleaned = value.replace(/\D/g, '');
      if (zipCleaned.length >= 5) {
        return zipCleaned.length > 5 
          ? `${zipCleaned.slice(0, 5)}-${zipCleaned.slice(5, 9)}`
          : zipCleaned;
      }
      return value;
    
    default:
      return value;
  }
};

// Import React hooks
import { useState, useEffect, useCallback, useMemo } from 'react';





