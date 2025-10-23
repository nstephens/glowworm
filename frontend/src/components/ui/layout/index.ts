/**
 * Layout Components
 * 
 * Reusable layout components using the 8px grid spacing system.
 * 
 * @example
 * ```tsx
 * import { Container, Stack, Inline, Grid, Flex } from '@/components/ui/layout';
 * 
 * <Container size="lg">
 *   <Stack spacing="8">
 *     <Heading>Page Title</Heading>
 *     <Grid cols="3" gap="6">
 *       <Card />
 *       <Card />
 *       <Card />
 *     </Grid>
 *   </Stack>
 * </Container>
 * ```
 */

export { Container } from './Container';
export type { ContainerSize } from './Container';

export { Stack } from './Stack';
export type { StackSpacing, StackAlign } from './Stack';

export { Inline } from './Inline';
export type { InlineSpacing, InlineAlign, InlineJustify } from './Inline';

export { Grid } from './Grid';
export type { GridCols, GridGap } from './Grid';

export { Flex } from './Flex';
export type { FlexDirection, FlexAlign, FlexJustify, FlexWrap, FlexGap } from './Flex';

