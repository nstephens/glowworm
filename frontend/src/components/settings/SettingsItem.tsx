import React from 'react';
import { cn } from '../../lib/utils';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import { Textarea } from '../ui/textarea';

interface SettingsItemProps {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const SettingsItem: React.FC<SettingsItemProps> = ({
  label,
  description,
  error,
  required,
  className,
  children
}) => {
  return (
    <div className={cn("py-4 border-b border-gray-100 last:border-b-0", className)}>
      <div className="mb-2">
        <Label className="text-base font-medium text-gray-900">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>
      <div className="mt-2">
        {children}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

interface SettingsInputProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

const SettingsInput: React.FC<SettingsInputProps> = ({
  label,
  description,
  value,
  onChange,
  type = 'text',
  placeholder,
  error,
  required,
  disabled
}) => {
  return (
    <SettingsItem label={label} description={description} error={error} required={required}>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "h-12 text-base",
          error && "border-red-500 focus:border-red-500"
        )}
      />
    </SettingsItem>
  );
};

interface SettingsTextareaProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
}

const SettingsTextarea: React.FC<SettingsTextareaProps> = ({
  label,
  description,
  value,
  onChange,
  placeholder,
  error,
  required,
  disabled,
  rows = 3
}) => {
  return (
    <SettingsItem label={label} description={description} error={error} required={required}>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={cn(
          "text-base resize-none",
          error && "border-red-500 focus:border-red-500"
        )}
      />
    </SettingsItem>
  );
};

interface SettingsSelectProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const SettingsSelect: React.FC<SettingsSelectProps> = ({
  label,
  description,
  value,
  onChange,
  options,
  error,
  required,
  disabled,
  placeholder
}) => {
  return (
    <SettingsItem label={label} description={description} error={error} required={required}>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className={cn(
          "h-12 text-base",
          error && "border-red-500 focus:border-red-500"
        )}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingsItem>
  );
};

export { SettingsItem, SettingsInput, SettingsTextarea, SettingsSelect };




