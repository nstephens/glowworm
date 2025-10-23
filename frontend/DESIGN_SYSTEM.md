# GlowWorm Design System

Complete reference for the GlowWorm frontend design system, including colors, typography, spacing, and layout components.

---

## Table of Contents

1. [Color Palette](#color-palette)
2. [Typography](#typography)
3. [Spacing System](#spacing-system)
4. [Layout Components](#layout-components)
5. [Best Practices](#best-practices)

---

## Color Palette

### Light Mode

**Primary Colors:**
- **Primary (Indigo):** `#4f46e5` - Trust, professionalism
- **Secondary (Amber):** `#b45309` - Warmth, creativity
- **Accent (Pink):** `#db2777` - Highlights, CTAs

**Semantic Colors:**
- **Success (Emerald):** `#059669` - Success states
- **Warning (Amber):** `#b45309` - Warning states
- **Destructive (Red):** `#dc2626` - Errors, deletions

**Neutral Colors:**
- **Background:** `#fafafa` - Warm white
- **Foreground:** `#1f2937` - Charcoal
- **Muted:** `#f3f4f6` - Light gray
- **Muted Foreground:** `#6b7280` - Medium gray

### Dark Mode

**Primary Colors:**
- **Primary (Indigo):** `#818cf8` - Lighter for dark backgrounds
- **Secondary (Amber):** `#fbbf24` - Lighter for dark backgrounds
- **Accent (Pink):** `#f472b6` - Lighter for dark backgrounds

**Neutral Colors:**
- **Background:** `#0f172a` - Deep navy
- **Foreground:** `#f1f5f9` - Soft white
- **Muted:** `#1e293b` - Slate
- **Muted Foreground:** `#94a3b8` - Light slate

### Usage

```tsx
// Using Tailwind color classes
<div className="bg-primary text-primary-foreground">Primary Button</div>
<p className="text-muted-foreground">Muted text</p>

// Using CSS variables
const myStyle = {
  backgroundColor: 'var(--primary)',
  color: 'var(--primary-foreground)'
};
```

### Accessibility

✅ **All color combinations meet WCAG 2.1 AA standards** (4.5:1 contrast ratio for normal text)

Test coverage includes 27 automated tests verifying contrast ratios for all critical combinations.

---

## Typography

### Fonts

**Sans-serif (Body Text):** Inter
- Weights: 300 (light), 400 (normal), 500 (medium), 600 (semibold), 700 (bold)

**Monospace (Code):** JetBrains Mono
- Used for code snippets and technical content

### Font Sizes

| Size | Pixels | Line Height | Usage |
|------|--------|-------------|-------|
| `xs` | 12px | 16px | Fine print, captions |
| `sm` | 14px | 20px | Secondary text, small UI elements |
| `base` | 16px | 24px | Body text (default) |
| `lg` | 18px | 28px | Emphasized text |
| `xl` | 20px | 28px | Small headings |
| `2xl` | 24px | 32px | Section headings |
| `3xl` | 30px | 36px | Page headings |
| `4xl` | 36px | 40px | Large page headings |
| `5xl` | 48px | 1 | Hero text |
| `6xl` | 60px | 1 | Marketing headers |

### Components

```tsx
import { Heading, Text, Code } from '@/components/ui/typography';

// Headings
<Heading as="h1">Page Title</Heading>
<Heading as="h2" size="4xl" weight="extrabold">Custom Heading</Heading>

// Text
<Text>Body text</Text>
<Text variant="lead">Lead paragraph</Text>
<Text variant="muted">Secondary info</Text>
<Text variant="small">Small text</Text>

// Code
<Code>inline code</Code>
<Code variant="block" language="typescript">
  const code = "block";
</Code>
```

---

## Spacing System

### 8px Grid System

All spacing follows an **8px base grid** for visual consistency and harmony.

| Class | Value | Pixels | Usage |
|-------|-------|--------|-------|
| `1` | 0.25rem | 4px | Minimal spacing |
| `2` | 0.5rem | 8px | Base grid unit |
| `3` | 0.75rem | 12px | Compact spacing |
| `4` | 1rem | 16px | Default spacing |
| `6` | 1.5rem | 24px | Medium spacing |
| `8` | 2rem | 32px | Large spacing |
| `12` | 3rem | 48px | Section spacing |
| `16` | 4rem | 64px | Large section spacing |
| `24` | 6rem | 96px | Major section spacing |
| `32` | 8rem | 128px | Page-level spacing |

### Direct Usage

```tsx
// Margin
<div className="mt-4 mb-8">Content with margin</div>

// Padding
<div className="p-6">Padded content</div>
<div className="px-4 py-2">Button padding</div>

// Gap (for flex/grid)
<div className="flex gap-4">Items with gap</div>
<div className="grid grid-cols-3 gap-6">Grid with gap</div>
```

### Best Practices

✅ **DO:**
- Use spacing scale values (1, 2, 3, 4, 6, 8, 12, 16, 24, 32)
- Use layout components for complex spacing needs
- Be consistent - same spacing for similar elements
- Use larger spacing to create visual hierarchy

❌ **DON'T:**
- Use arbitrary values like `p-[13px]` or `mt-[27px]`
- Mix different spacing scales
- Use odd spacing values not on the grid

---

## Layout Components

### Container

Constrains content width and centers it on the page.

```tsx
import { Container } from '@/components/ui/layout';

<Container size="lg">
  <h1>Page Content</h1>
</Container>

// Custom padding
<Container size="xl" px="px-8" py="py-12">
  <p>Content with custom padding</p>
</Container>
```

**Sizes:**
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px (default)
- `2xl`: 1536px
- `full`: No max-width

### Stack

Arranges children vertically with consistent spacing.

```tsx
import { Stack } from '@/components/ui/layout';

<Stack spacing="4">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</Stack>

// With alignment
<Stack spacing="8" align="center">
  <Button>Centered Button 1</Button>
  <Button>Centered Button 2</Button>
</Stack>
```

### Inline

Arranges children horizontally with consistent spacing.

```tsx
import { Inline } from '@/components/ui/layout';

<Inline spacing="2">
  <Button>Action 1</Button>
  <Button>Action 2</Button>
</Inline>

// With wrapping
<Inline spacing="3" wrap justify="center">
  <Chip>Tag 1</Chip>
  <Chip>Tag 2</Chip>
  <Chip>Tag 3</Chip>
</Inline>
```

### Grid

CSS Grid layout with configurable columns and gaps.

```tsx
import { Grid } from '@/components/ui/layout';

// Fixed columns
<Grid cols="3" gap="6">
  <Card />
  <Card />
  <Card />
</Grid>

// Responsive columns
<Grid 
  cols="1" 
  responsiveCols={{ sm: '2', md: '3', lg: '4' }} 
  gap="8"
>
  <ImageCard />
  <ImageCard />
  <ImageCard />
</Grid>

// Asymmetric spacing
<Grid cols="4" gapX="8" gapY="4">
  <div>Item</div>
</Grid>
```

### Flex

Flexbox layout with full control over alignment.

```tsx
import { Flex } from '@/components/ui/layout';

// Horizontal layout
<Flex justify="between" align="center" gap="4">
  <Logo />
  <Navigation />
  <UserMenu />
</Flex>

// Vertical layout
<Flex direction="col" gap="6">
  <Section />
  <Section />
</Flex>

// Wrapping grid-like layout
<Flex wrap="wrap" gap="6" justify="center">
  <Card />
  <Card />
  <Card />
</Flex>
```

---

## Best Practices

### Composition

Layout components are designed to be composed together:

```tsx
<Container size="lg">
  <Stack spacing="12">
    <Flex justify="between" align="center">
      <Heading as="h1">Dashboard</Heading>
      <Inline spacing="2">
        <Button>Action 1</Button>
        <Button>Action 2</Button>
      </Inline>
    </Flex>
    
    <Grid cols="3" gap="6">
      <StatCard />
      <StatCard />
      <StatCard />
    </Grid>
  </Stack>
</Container>
```

### Responsive Design

Use responsive props and Tailwind breakpoints:

```tsx
// Responsive grid
<Grid 
  cols="1"
  responsiveCols={{ sm: '2', lg: '3', xl: '4' }}
  gap="4"
/>

// Responsive spacing with Tailwind
<div className="space-y-4 md:space-y-8 lg:space-y-12">
  {/* Spacing increases on larger screens */}
</div>
```

### Visual Hierarchy

Use spacing to create clear visual hierarchy:

```tsx
// Page-level spacing (large)
<Stack spacing="16">
  
  {/* Section-level spacing (medium) */}
  <Stack spacing="8">
    <Heading>Section Title</Heading>
    
    {/* Component-level spacing (small) */}
    <Stack spacing="4">
      <Text>Paragraph 1</Text>
      <Text>Paragraph 2</Text>
    </Stack>
  </Stack>
  
</Stack>
```

### Common Patterns

**Page Layout:**
```tsx
<Container size="xl">
  <Stack spacing="12" className="py-8">
    {/* Page header */}
    <Stack spacing="2">
      <Heading as="h1">Page Title</Heading>
      <Text variant="muted">Page description</Text>
    </Stack>
    
    {/* Page content */}
    <Grid cols="3" gap="6">
      <Card />
      <Card />
      <Card />
    </Grid>
  </Stack>
</Container>
```

**Form Layout:**
```tsx
<form>
  <Stack spacing="6">
    <Stack spacing="2">
      <Label>Email</Label>
      <Input type="email" />
    </Stack>
    
    <Stack spacing="2">
      <Label>Password</Label>
      <Input type="password" />
    </Stack>
    
    <Inline spacing="3" justify="end">
      <Button variant="outline">Cancel</Button>
      <Button>Submit</Button>
    </Inline>
  </Stack>
</form>
```

**Dashboard Cards:**
```tsx
<Grid cols="1" responsiveCols={{ md: '2', xl: '3' }} gap="6">
  <Card>
    <Stack spacing="4">
      <Heading as="h3">Card Title</Heading>
      <Text>Card content</Text>
    </Stack>
  </Card>
</Grid>
```

---

## Testing

### Accessibility Tests

Run color contrast tests:
```bash
npm run test -- colorContrast.test.ts
```

All color combinations are tested for WCAG 2.1 AA compliance.

### Visual Testing

Use the showcase components to verify visual consistency:

1. **Typography:** `/src/components/ui/typography/TypographyShowcase.tsx`
2. **Layout:** `/src/components/ui/layout/LayoutShowcase.tsx`

Import these in your routes for visual inspection during development.

---

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [8-Point Grid System](https://spec.fm/specifics/8-pt-grid)

