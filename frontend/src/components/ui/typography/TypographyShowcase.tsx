import React from 'react';
import { Heading, Text, Code } from './index';

/**
 * Typography Showcase Component
 * 
 * Demonstrates all available typography components and variants.
 * Useful for design system documentation and visual testing.
 */
export const TypographyShowcase: React.FC = () => {
  return (
    <div className="space-y-12 p-8 max-w-4xl">
      {/* Headings */}
      <section className="space-y-4">
        <Heading as="h2" size="3xl" className="border-b pb-2">
          Headings
        </Heading>
        <div className="space-y-3">
          <Heading as="h1">Heading 1 (4xl/bold)</Heading>
          <Heading as="h2">Heading 2 (3xl/bold)</Heading>
          <Heading as="h3">Heading 3 (2xl/semibold)</Heading>
          <Heading as="h4">Heading 4 (xl/semibold)</Heading>
          <Heading as="h5">Heading 5 (lg/medium)</Heading>
          <Heading as="h6">Heading 6 (base/medium)</Heading>
        </div>
      </section>

      {/* Heading Variations */}
      <section className="space-y-4">
        <Heading as="h2" size="3xl" className="border-b pb-2">
          Heading Variations
        </Heading>
        <div className="space-y-3">
          <Heading as="h2" weight="light">Light Weight Heading</Heading>
          <Heading as="h2" weight="extrabold">Extra Bold Heading</Heading>
          <Heading as="h3" size="4xl">Custom Size Heading</Heading>
          <Heading as="h3" color="text-primary">Colored Heading</Heading>
        </div>
      </section>

      {/* Text Variants */}
      <section className="space-y-4">
        <Heading as="h2" size="3xl" className="border-b pb-2">
          Text Variants
        </Heading>
        <div className="space-y-4">
          <div>
            <Text variant="lead">
              This is lead text. It's larger and more prominent, perfect for introductory paragraphs.
              It uses a relaxed line height for better readability.
            </Text>
          </div>
          <div>
            <Text variant="body">
              This is body text. It's the default text style used for most content throughout the application.
              It has a comfortable line height and font size for extended reading.
            </Text>
          </div>
          <div>
            <Text variant="large">
              This is large text. It's slightly bigger and medium weight, useful for emphasis without being a heading.
            </Text>
          </div>
          <div>
            <Text variant="small">
              This is small text. It's used for less important information or in constrained spaces.
            </Text>
          </div>
          <div>
            <Text variant="muted">
              This is muted text. It uses a muted color for secondary or less important information.
            </Text>
          </div>
          <div>
            <Text variant="caption">
              This is caption text. It's the smallest variant, perfect for image captions or fine print.
            </Text>
          </div>
        </div>
      </section>

      {/* Custom Text */}
      <section className="space-y-4">
        <Heading as="h2" size="3xl" className="border-b pb-2">
          Custom Text Styling
        </Heading>
        <div className="space-y-3">
          <Text size="lg" weight="bold">
            Large, bold text with custom properties
          </Text>
          <Text as="span" size="sm" weight="semibold" color="text-primary">
            Inline text with custom color
          </Text>
        </div>
      </section>

      {/* Code */}
      <section className="space-y-4">
        <Heading as="h2" size="3xl" className="border-b pb-2">
          Code
        </Heading>
        <div className="space-y-4">
          <div>
            <Text variant="small" className="mb-2">Inline code:</Text>
            <Text>
              Use the <Code>useState</Code> hook to manage component state in React.
            </Text>
          </div>
          <div>
            <Text variant="small" className="mb-2">Block code:</Text>
            <Code variant="block" language="typescript">
{`const greeting = "Hello, World!";
console.log(greeting);`}
            </Code>
          </div>
        </div>
      </section>

      {/* Font Families */}
      <section className="space-y-4">
        <Heading as="h2" size="3xl" className="border-b pb-2">
          Font Families
        </Heading>
        <div className="space-y-3">
          <Text className="font-sans">
            This text uses Inter (Sans-serif) - the primary font family for the application.
          </Text>
          <Text className="font-mono">
            This text uses JetBrains Mono - the monospace font family for code and technical content.
          </Text>
        </div>
      </section>

      {/* Responsive Typography */}
      <section className="space-y-4">
        <Heading as="h2" size="3xl" className="border-b pb-2">
          Responsive Typography
        </Heading>
        <Text variant="muted" className="mb-4">
          All typography components are responsive and scale appropriately across different screen sizes.
          They also respect user font size preferences.
        </Text>
        <Heading as="h3" className="text-2xl md:text-3xl lg:text-4xl">
          This heading scales up on larger screens
        </Heading>
      </section>
    </div>
  );
};

