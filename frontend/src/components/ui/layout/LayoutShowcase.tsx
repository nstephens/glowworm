import React from 'react';
import { Container, Stack, Inline, Grid, Flex } from './index';
import { Heading, Text } from '../typography';

/**
 * Layout Showcase Component
 * 
 * Demonstrates all available layout components and the 8px grid spacing system.
 * Useful for design system documentation and visual testing.
 */
export const LayoutShowcase: React.FC = () => {
  const SpacingDemo = ({ size }: { size: string }) => (
    <div className="flex items-center gap-4">
      <div className={`w-${size} h-12 bg-primary rounded`} />
      <Text variant="small" className="font-mono">
        {size} = {parseInt(size) * 4}px
      </Text>
    </div>
  );

  const DemoCard = ({ children }: { children: React.ReactNode }) => (
    <div className="p-4 bg-card border border-border rounded-lg">
      {children}
    </div>
  );

  return (
    <Container size="2xl">
      <Stack spacing="12" className="py-8">
        {/* Header */}
        <Stack spacing="2">
          <Heading as="h1">Layout System</Heading>
          <Text variant="lead">
            8px grid-based spacing system for consistent layouts
          </Text>
        </Stack>

        {/* Spacing Scale */}
        <section>
          <Stack spacing="4">
            <Heading as="h2" className="border-b pb-2">
              Spacing Scale (8px Grid)
            </Heading>
            <Text variant="muted">
              All spacing follows an 8px grid system for visual consistency
            </Text>
            <Stack spacing="3">
              <SpacingDemo size="1" />
              <SpacingDemo size="2" />
              <SpacingDemo size="3" />
              <SpacingDemo size="4" />
              <SpacingDemo size="6" />
              <SpacingDemo size="8" />
              <SpacingDemo size="12" />
              <SpacingDemo size="16" />
              <SpacingDemo size="24" />
            </Stack>
          </Stack>
        </section>

        {/* Container */}
        <section>
          <Stack spacing="4">
            <Heading as="h2" className="border-b pb-2">
              Container
            </Heading>
            <Text variant="muted">
              Constrains content width and centers it on the page
            </Text>
            <div className="bg-muted/20 p-4 rounded-lg">
              <Container size="md" className="bg-card border border-border rounded p-4">
                <Text>This content is constrained to medium width (768px)</Text>
              </Container>
            </div>
          </Stack>
        </section>

        {/* Stack */}
        <section>
          <Stack spacing="4">
            <Heading as="h2" className="border-b pb-2">
              Stack (Vertical Spacing)
            </Heading>
            <Text variant="muted">
              Arranges children vertically with consistent spacing
            </Text>
            <Grid cols="2" gap="6">
              <DemoCard>
                <Stack spacing="2">
                  <Text weight="semibold">spacing="2" (8px)</Text>
                  <div className="h-8 bg-primary/20 rounded" />
                  <div className="h-8 bg-primary/20 rounded" />
                  <div className="h-8 bg-primary/20 rounded" />
                </Stack>
              </DemoCard>
              <DemoCard>
                <Stack spacing="6">
                  <Text weight="semibold">spacing="6" (24px)</Text>
                  <div className="h-8 bg-secondary/20 rounded" />
                  <div className="h-8 bg-secondary/20 rounded" />
                  <div className="h-8 bg-secondary/20 rounded" />
                </Stack>
              </DemoCard>
            </Grid>
          </Stack>
        </section>

        {/* Inline */}
        <section>
          <Stack spacing="4">
            <Heading as="h2" className="border-b pb-2">
              Inline (Horizontal Spacing)
            </Heading>
            <Text variant="muted">
              Arranges children horizontally with consistent spacing
            </Text>
            <Grid cols="2" gap="6">
              <DemoCard>
                <Stack spacing="2">
                  <Text weight="semibold">spacing="2" (8px)</Text>
                  <Inline spacing="2">
                    <div className="w-16 h-8 bg-primary/20 rounded" />
                    <div className="w-16 h-8 bg-primary/20 rounded" />
                    <div className="w-16 h-8 bg-primary/20 rounded" />
                  </Inline>
                </Stack>
              </DemoCard>
              <DemoCard>
                <Stack spacing="2">
                  <Text weight="semibold">spacing="6" (24px)</Text>
                  <Inline spacing="6">
                    <div className="w-16 h-8 bg-secondary/20 rounded" />
                    <div className="w-16 h-8 bg-secondary/20 rounded" />
                    <div className="w-16 h-8 bg-secondary/20 rounded" />
                  </Inline>
                </Stack>
              </DemoCard>
            </Grid>
          </Stack>
        </section>

        {/* Grid */}
        <section>
          <Stack spacing="4">
            <Heading as="h2" className="border-b pb-2">
              Grid
            </Heading>
            <Text variant="muted">
              CSS Grid layout with configurable columns and gaps
            </Text>
            <DemoCard>
              <Stack spacing="3">
                <Text weight="semibold">3 columns with 16px gap</Text>
                <Grid cols="3" gap="4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-16 bg-primary/20 rounded flex items-center justify-center">
                      <Text variant="small">{i}</Text>
                    </div>
                  ))}
                </Grid>
              </Stack>
            </DemoCard>
            <DemoCard>
              <Stack spacing="3">
                <Text weight="semibold">Responsive grid (1 → 2 → 3 columns)</Text>
                <Grid
                  cols="1"
                  responsiveCols={{ sm: '2', lg: '3' }}
                  gap="4"
                >
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-secondary/20 rounded flex items-center justify-center">
                      <Text variant="small">Item {i}</Text>
                    </div>
                  ))}
                </Grid>
              </Stack>
            </DemoCard>
          </Stack>
        </section>

        {/* Flex */}
        <section>
          <Stack spacing="4">
            <Heading as="h2" className="border-b pb-2">
              Flex
            </Heading>
            <Text variant="muted">
              Flexbox layout with full control over alignment and distribution
            </Text>
            <Grid cols="2" gap="6">
              <DemoCard>
                <Stack spacing="2">
                  <Text weight="semibold">justify="between"</Text>
                  <Flex justify="between" className="bg-muted/20 p-2 rounded">
                    <div className="w-12 h-8 bg-primary/40 rounded" />
                    <div className="w-12 h-8 bg-primary/40 rounded" />
                    <div className="w-12 h-8 bg-primary/40 rounded" />
                  </Flex>
                </Stack>
              </DemoCard>
              <DemoCard>
                <Stack spacing="2">
                  <Text weight="semibold">justify="center" gap="4"</Text>
                  <Flex justify="center" gap="4" className="bg-muted/20 p-2 rounded">
                    <div className="w-12 h-8 bg-secondary/40 rounded" />
                    <div className="w-12 h-8 bg-secondary/40 rounded" />
                    <div className="w-12 h-8 bg-secondary/40 rounded" />
                  </Flex>
                </Stack>
              </DemoCard>
            </Grid>
          </Stack>
        </section>

        {/* Composition Example */}
        <section>
          <Stack spacing="4">
            <Heading as="h2" className="border-b pb-2">
              Composition Example
            </Heading>
            <Text variant="muted">
              Layout components can be composed together for complex layouts
            </Text>
            <DemoCard>
              <Stack spacing="6">
                <Flex justify="between" align="center">
                  <Heading as="h3">Page Header</Heading>
                  <Inline spacing="2">
                    <div className="px-4 py-2 bg-primary text-primary-foreground rounded">
                      Action
                    </div>
                    <div className="px-4 py-2 bg-secondary text-secondary-foreground rounded">
                      Action
                    </div>
                  </Inline>
                </Flex>
                <Grid cols="3" gap="4">
                  <div className="h-24 bg-muted rounded" />
                  <div className="h-24 bg-muted rounded" />
                  <div className="h-24 bg-muted rounded" />
                </Grid>
              </Stack>
            </DemoCard>
          </Stack>
        </section>
      </Stack>
    </Container>
  );
};

