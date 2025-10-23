/**
 * Typography Components
 * 
 * Reusable components for consistent text styling throughout the application.
 * 
 * @example
 * ```tsx
 * import { Heading, Text, Code } from '@/components/ui/typography';
 * 
 * <Heading as="h1">Page Title</Heading>
 * <Text variant="lead">Introduction paragraph</Text>
 * <Text>Regular body text</Text>
 * <Code>inline code</Code>
 * ```
 */

export { Heading } from './Heading';
export type { HeadingLevel, HeadingSize, HeadingWeight } from './Heading';

export { Text } from './Text';
export type { TextVariant, TextSize, TextWeight } from './Text';

export { Code } from './Code';
export type { CodeVariant, CodeSize } from './Code';

