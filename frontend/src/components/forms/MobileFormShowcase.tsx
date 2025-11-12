import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MobileInput, 
  MobileTextarea, 
  MobileSelect, 
  MobileForm,
  FormField 
} from './';
import { 
  validationPatterns, 
  commonRules, 
  useFormValidation 
} from '@/utils/formValidation';
import { 
  Mail, 
  Phone, 
  Lock, 
  User, 
  MapPin, 
  CreditCard, 
  Calendar,
  MessageSquare,
  Settings,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

/**
 * Comprehensive showcase of mobile-optimized form controls
 * Demonstrates all form components with various configurations
 */
export const MobileFormShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = useState('inputs');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState<string>('');

  // Form validation
  const {
    data,
    errors,
    isValid,
    isValidating,
    updateField,
    validateForm
  } = useFormValidation(
    {
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      name: '',
      message: '',
      country: '',
      newsletter: '',
      terms: ''
    },
    {
      email: commonRules.email,
      phone: commonRules.phoneUS,
      password: commonRules.password,
      confirmPassword: {
        required: true,
        custom: (value) => {
          const password = data.password;
          return value === password || 'Passwords do not match';
        }
      },
      name: commonRules.name,
      message: {
        required: true,
        minLength: 10,
        maxLength: 500
      },
      country: {
        required: true
      },
      newsletter: {
        required: false
      },
      terms: {
        required: true,
        custom: (value) => value === 'true' || 'You must accept the terms and conditions'
      }
    }
  );

  // Handle form submission
  const handleSubmit = async (formData: Record<string, string>) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Form submitted:', formData);
      setFormSuccess(true);
      setFormError('');
    } catch (error) {
      setFormError('Failed to submit form. Please try again.');
      setFormSuccess(false);
    }
  };

  // Sample data for selects
  const countryOptions = [
    { value: 'us', label: 'United States', icon: '🇺🇸' },
    { value: 'ca', label: 'Canada', icon: '🇨🇦' },
    { value: 'uk', label: 'United Kingdom', icon: '🇬🇧' },
    { value: 'de', label: 'Germany', icon: '🇩🇪' },
    { value: 'fr', label: 'France', icon: '🇫🇷' },
    { value: 'jp', label: 'Japan', icon: '🇯🇵' },
    { value: 'au', label: 'Australia', icon: '🇦🇺' }
  ];

  const newsletterOptions = [
    { value: 'daily', label: 'Daily Newsletter' },
    { value: 'weekly', label: 'Weekly Newsletter' },
    { value: 'monthly', label: 'Monthly Newsletter' },
    { value: 'none', label: 'No Newsletter' }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Mobile Form Controls Showcase</h1>
        <p className="text-muted-foreground">
          Comprehensive demonstration of mobile-optimized form components with touch-friendly interactions
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="inputs">Inputs</TabsTrigger>
          <TabsTrigger value="textarea">Textarea</TabsTrigger>
          <TabsTrigger value="selects">Selects</TabsTrigger>
          <TabsTrigger value="forms">Complete Forms</TabsTrigger>
        </TabsList>

        {/* Input Examples */}
        <TabsContent value="inputs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Mobile Input Components</CardTitle>
              <CardDescription>
                Various input types with validation, icons, and mobile-optimized interactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MobileInput
                  label="Email Address"
                  type="email"
                  placeholder="Enter your email"
                  leftIcon={<Mail className="h-4 w-4" />}
                  validation={commonRules.email}
                  value={data.email}
                  onChange={(e) => updateField('email', e.target.value)}
                />

                <MobileInput
                  label="Phone Number"
                  type="tel"
                  placeholder="(555) 123-4567"
                  leftIcon={<Phone className="h-4 w-4" />}
                  validation={commonRules.phoneUS}
                  value={data.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                />

                <MobileInput
                  label="Password"
                  type="password"
                  placeholder="Enter your password"
                  leftIcon={<Lock className="h-4 w-4" />}
                  showPasswordToggle
                  validation={commonRules.password}
                  value={data.password}
                  onChange={(e) => updateField('password', e.target.value)}
                />

                <MobileInput
                  label="Full Name"
                  type="text"
                  placeholder="Enter your full name"
                  leftIcon={<User className="h-4 w-4" />}
                  validation={commonRules.name}
                  value={data.name}
                  onChange={(e) => updateField('name', e.target.value)}
                />
              </div>

              {/* Input Variants */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Input Variants</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <MobileInput
                    label="Default Variant"
                    placeholder="Default style"
                    variant="default"
                  />
                  <MobileInput
                    label="Filled Variant"
                    placeholder="Filled style"
                    variant="filled"
                  />
                  <MobileInput
                    label="Outlined Variant"
                    placeholder="Outlined style"
                    variant="outlined"
                  />
                </div>
              </div>

              {/* Input Sizes */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Input Sizes</h3>
                <div className="space-y-4">
                  <MobileInput
                    label="Small Size"
                    placeholder="Small input"
                    size="sm"
                  />
                  <MobileInput
                    label="Medium Size (Default)"
                    placeholder="Medium input"
                    size="md"
                  />
                  <MobileInput
                    label="Large Size"
                    placeholder="Large input"
                    size="lg"
                  />
                </div>
              </div>

              {/* Input States */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Input States</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MobileInput
                    label="Success State"
                    placeholder="Success input"
                    success
                    value="Valid input"
                  />
                  <MobileInput
                    label="Error State"
                    placeholder="Error input"
                    error="This field has an error"
                    value="Invalid input"
                  />
                  <MobileInput
                    label="Disabled State"
                    placeholder="Disabled input"
                    disabled
                    value="Disabled input"
                  />
                  <MobileInput
                    label="With Helper Text"
                    placeholder="Helper text input"
                    helperText="This is helpful information about the input"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Textarea Examples */}
        <TabsContent value="textarea" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Mobile Textarea Components</CardTitle>
              <CardDescription>
                Auto-resizing textarea with expand toggle and validation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <MobileTextarea
                label="Message"
                placeholder="Enter your message here..."
                leftIcon={<MessageSquare className="h-4 w-4" />}
                autoResize
                minRows={3}
                maxRows={8}
                showExpandToggle
                validation={{
                  required: true,
                  minLength: 10,
                  maxLength: 500
                }}
                value={data.message}
                onChange={(e) => updateField('message', e.target.value)}
                helperText="Please provide detailed information about your inquiry"
              />

              {/* Textarea Variants */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Textarea Variants</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <MobileTextarea
                    label="Default Variant"
                    placeholder="Default textarea"
                    variant="default"
                    minRows={2}
                  />
                  <MobileTextarea
                    label="Filled Variant"
                    placeholder="Filled textarea"
                    variant="filled"
                    minRows={2}
                  />
                  <MobileTextarea
                    label="Outlined Variant"
                    placeholder="Outlined textarea"
                    variant="outlined"
                    minRows={2}
                  />
                </div>
              </div>

              {/* Textarea Sizes */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Textarea Sizes</h3>
                <div className="space-y-4">
                  <MobileTextarea
                    label="Small Size"
                    placeholder="Small textarea"
                    size="sm"
                    minRows={2}
                  />
                  <MobileTextarea
                    label="Medium Size (Default)"
                    placeholder="Medium textarea"
                    size="md"
                    minRows={3}
                  />
                  <MobileTextarea
                    label="Large Size"
                    placeholder="Large textarea"
                    size="lg"
                    minRows={4}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Select Examples */}
        <TabsContent value="selects" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Mobile Select Components</CardTitle>
              <CardDescription>
                Touch-friendly select dropdowns with search and clear functionality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <MobileSelect
                label="Country"
                placeholder="Select your country"
                options={countryOptions}
                searchable
                clearable
                validation={{
                  required: true
                }}
                value={data.country}
                onChange={(value) => updateField('country', value)}
                helperText="Choose your country of residence"
              />

              <MobileSelect
                label="Newsletter Preference"
                placeholder="Select newsletter frequency"
                options={newsletterOptions}
                validation={{
                  required: false
                }}
                value={data.newsletter}
                onChange={(value) => updateField('newsletter', value)}
                helperText="Choose how often you'd like to receive updates"
              />

              {/* Select Variants */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Select Variants</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <MobileSelect
                    label="Default Variant"
                    placeholder="Default select"
                    options={countryOptions.slice(0, 3)}
                    variant="default"
                  />
                  <MobileSelect
                    label="Filled Variant"
                    placeholder="Filled select"
                    options={countryOptions.slice(0, 3)}
                    variant="filled"
                  />
                  <MobileSelect
                    label="Outlined Variant"
                    placeholder="Outlined select"
                    options={countryOptions.slice(0, 3)}
                    variant="outlined"
                  />
                </div>
              </div>

              {/* Select Sizes */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Select Sizes</h3>
                <div className="space-y-4">
                  <MobileSelect
                    label="Small Size"
                    placeholder="Small select"
                    options={countryOptions.slice(0, 3)}
                    size="sm"
                  />
                  <MobileSelect
                    label="Medium Size (Default)"
                    placeholder="Medium select"
                    options={countryOptions.slice(0, 3)}
                    size="md"
                  />
                  <MobileSelect
                    label="Large Size"
                    placeholder="Large select"
                    options={countryOptions.slice(0, 3)}
                    size="lg"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Complete Form Examples */}
        <TabsContent value="forms" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Complete Mobile Forms</CardTitle>
              <CardDescription>
                Full form examples with validation and submission handling
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MobileForm
                fields={[
                  {
                    name: 'name',
                    label: 'Full Name',
                    type: 'text',
                    placeholder: 'Enter your full name',
                    required: true,
                    validation: commonRules.name
                  },
                  {
                    name: 'email',
                    label: 'Email Address',
                    type: 'email',
                    placeholder: 'Enter your email',
                    required: true,
                    validation: commonRules.email
                  },
                  {
                    name: 'phone',
                    label: 'Phone Number',
                    type: 'tel',
                    placeholder: '(555) 123-4567',
                    required: true,
                    validation: commonRules.phoneUS
                  },
                  {
                    name: 'country',
                    label: 'Country',
                    type: 'select',
                    placeholder: 'Select your country',
                    required: true,
                    options: countryOptions
                  },
                  {
                    name: 'message',
                    label: 'Message',
                    type: 'textarea',
                    placeholder: 'Tell us about your inquiry...',
                    required: true,
                    validation: {
                      required: true,
                      minLength: 10,
                      maxLength: 500
                    }
                  }
                ]}
                onSubmit={handleSubmit}
                submitLabel="Send Message"
                showCancel
                onCancel={() => console.log('Form cancelled')}
                loading={isValidating}
                success={formSuccess}
                error={formError}
                successMessage="Thank you! Your message has been sent successfully."
                variant="card"
              />
            </CardContent>
          </Card>

          {/* Form Features */}
          <Card>
            <CardHeader>
              <CardTitle>Form Features</CardTitle>
              <CardDescription>
                Key features and capabilities of mobile form controls
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Accessibility Features</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      WCAG 2.1 AA compliant
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Screen reader support
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Keyboard navigation
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      High contrast mode
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Focus management
                    </li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Mobile Features</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      44px minimum touch targets
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Haptic feedback
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Touch-optimized interactions
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Auto-resize textareas
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Mobile keyboard types
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};








