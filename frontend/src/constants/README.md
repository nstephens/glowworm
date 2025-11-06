# Constants Documentation

## Breakpoints

The breakpoint constants provide a single source of truth for all responsive design breakpoints in the application.

### Usage

```typescript
import { MOBILE_BREAKPOINT, isMobileWidth } from '@/constants/breakpoints';

// Check if current width is mobile
if (isMobileWidth(window.innerWidth)) {
  // Mobile layout
}
```

### Breakpoint Values

- **Mobile**: < 768px
- **Tablet**: 768px - 1023px
- **Desktop**: >= 1024px

### Constants

- `MOBILE_BREAKPOINT`: 768px (below this is mobile)
- `TABLET_BREAKPOINT`: 1024px (below this and above mobile is tablet)
- `DESKTOP_BREAKPOINT`: 1024px (above this is desktop)

### Helper Functions

- `isMobileWidth(width: number)`: Returns true if width < 768px
- `isTabletWidth(width: number)`: Returns true if width is 768px-1023px
- `isDesktopWidth(width: number)`: Returns true if width >= 1024px

### Integration with Tailwind

These constants match the Tailwind default breakpoints:
- `sm`: 640px
- `md`: 768px (MOBILE_BREAKPOINT)
- `lg`: 1024px (TABLET/DESKTOP_BREAKPOINT)
- `xl`: 1280px
- `2xl`: 1536px

### Best Practices

1. Always use these constants instead of hardcoding breakpoint values
2. Use the hook `useResponsiveLayout` for dynamic detection
3. Pair with CSS media queries for optimal performance
4. Test at exact breakpoint boundaries (767px, 768px, 1023px, 1024px)







