# Mobile Navigation Guide

This guide documents the mobile navigation architecture for the Glowworm admin interface.

## Overview

The mobile navigation system provides a consistent, app-like experience on mobile devices with a fixed bottom navigation bar and constrained content width.

## Breakpoints

- **Mobile**: < 768px
- **Desktop**: >= 768px

The breakpoint is defined in `src/constants/breakpoints.ts` as a single source of truth.

## Key Components

### Navigation Architecture

```
Navigation.tsx
├── Sidebar (desktop only, hidden on mobile)
├── TopBar (desktop only, hidden on mobile)
├── Main Content Area
│   ├── Breadcrumb (desktop only, hidden on mobile)
│   ├── Page Header
│   └── Page Content (320px max-width on mobile)
└── MobileBottomNav (mobile only)
```

### Core Components

1. **`Navigation.tsx`**: Main wrapper for all admin pages
   - Conditional rendering based on `isMobile` state
   - Applies 320px width constraint on mobile
   - Hides desktop elements (sidebar, topbar, breadcrumbs) on mobile

2. **`MobileBottomNav.tsx`**: Portal-based bottom navigation
   - Rendered via `createPortal` to `document.body`
   - Fixed positioning with highest z-index (2147483647)
   - Includes SSR safety checks
   - Handles iOS safe area insets

3. **`useResponsiveLayout` Hook**: Device detection
   - Returns `isMobile`, `isTablet`, `isDesktop` flags
   - Includes `isHydrated` for SSR safety
   - Uses consistent 768px breakpoint

## CSS Utilities

### Utility Classes

- `.desktop-only`: Hidden on mobile devices
- `.mobile-only`: Hidden on desktop devices

These classes are defined in `src/index.css` and include `!important` flags to ensure they work as defensive safeguards.

### Safe Area Handling

The mobile navigation handles iOS safe areas with:

```css
padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px) + constant(safe-area-inset-bottom, 0px));
```

This ensures the bottom navigation stays above the iOS home indicator.

## CSS Safeguards

Defensive CSS rules in `src/index.css` ensure mobile layout consistency even if JavaScript fails:

```css
@media (max-width: 767px) {
  /* Force hide sidebar on mobile */
  .sidebar,
  [role="complementary"],
  aside {
    display: none !important;
    visibility: hidden !important;
  }

  /* Force mobile bottom nav visibility */
  .mobile-bottom-nav {
    display: flex !important;
    visibility: visible !important;
  }

  /* Mobile width constraint */
  #main-content > div {
    max-width: 320px !important;
    width: 100% !important;
    margin-left: auto !important;
    margin-right: auto !important;
    overflow-x: hidden !important;
  }

  /* Prevent horizontal scrolling */
  body {
    overflow-x: hidden !important;
  }

  /* Ensure bottom nav stays at bottom */
  .mobile-bottom-nav {
    position: fixed !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    z-index: 2147483647 !important;
  }
}
```

## Best Practices

### 1. Always Use the Navigation Wrapper

All admin pages should be wrapped in the `Navigation` component:

```tsx
<Navigation>
  {/* Page content */}
</Navigation>
```

### 2. Never Override Max-Width on Mobile

Do not add custom width constraints to page content. The Navigation component handles this automatically.

### 3. Use Responsive Layout Hook for Conditional Rendering

```tsx
const { isMobile, isHydrated } = useResponsiveLayout();

// Wait for hydration before making layout decisions
if (!isHydrated) return null;

// Conditionally render based on device
{isMobile ? <MobileComponent /> : <DesktopComponent />}
```

### 4. Apply Defensive CSS Classes

Add `.desktop-only` or `.mobile-only` classes as backup:

```tsx
<div className="desktop-only">
  <DesktopOnlyComponent />
</div>

<div className="mobile-only">
  <MobileOnlyComponent />
</div>
```

### 5. Test at Exact Breakpoints

Always test mobile layouts at these widths:
- 320px (minimum mobile width)
- 375px (iPhone standard)
- 414px (iPhone Plus/Max)
- 767px (just below breakpoint)
- 768px (exact breakpoint)

### 6. Use Portal for Fixed Elements

If you need a fixed bottom element on mobile:

```tsx
const MyFixedElement = () => {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted || typeof document === 'undefined') return null;
  
  return createPortal(
    <div className="fixed bottom-0">...</div>,
    document.body
  );
};
```

## Z-Index Strategy

- **MobileBottomNav**: 2147483647 (maximum)
- **Modals**: 50
- **Dropdowns**: 10
- **Regular content**: 0

## Troubleshooting

### Sidebar Visible on Mobile

- Check that `Navigation.tsx` conditionally renders sidebar: `{(!isMobile && isHydrated) && <Sidebar />}`
- Verify CSS safeguard is in place: `.sidebar { display: none !important; }`

### Content Not Constrained to 320px

- Verify `Navigation.tsx` applies `max-w-[320px] w-full mx-auto` on mobile
- Check CSS safeguard targets `#main-content > div`
- Look for conflicting width constraints in page components

### Bottom Nav Not Visible

- Ensure `MobileBottomNav` is rendered when `isMobile` is true
- Verify portal is created: `createPortal(navEl, document.body)`
- Check z-index is set to maximum value
- Confirm `mounted` state is true before rendering portal

### Layout Flickering on Load

- Use `isHydrated` check before making layout decisions
- Ensure all conditional renders wait for hydration
- Consider adding loading states during initial render

## Implementation Details

### SSR Safety

All components that use `window` or `document` should:
1. Check for mounted state before accessing DOM APIs
2. Use `useEffect` to set mounted state after hydration
3. Return null or a safe fallback during SSR

Example:

```tsx
const MyComponent = () => {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) return null;
  
  return <div>Client-only content</div>;
};
```

### iOS Safari Specific

The mobile navigation includes special handling for iOS Safari:

1. **Visual Viewport API**: Adjusts position when Safari toolbar appears/disappears
2. **Safe Area Insets**: Adds padding for devices with home indicators
3. **Fixed Positioning**: Uses portal to avoid CSS transform issues

## Testing Checklist

- [ ] Bottom nav visible on ALL admin pages
- [ ] Sidebar NEVER visible on mobile
- [ ] TopBar NEVER visible on mobile
- [ ] Width constrained to 320px on all mobile views
- [ ] No horizontal scrolling on any page
- [ ] Safe area handling works on iOS devices
- [ ] Portal renders consistently across route changes
- [ ] SSR/CSR hydration works without flickering
- [ ] All touch targets are at least 44x44px

## Related Files

- `src/components/layout/Navigation.tsx` - Main navigation wrapper
- `src/components/layout/MobileBottomNav.tsx` - Bottom navigation
- `src/hooks/useResponsiveLayout.ts` - Device detection
- `src/constants/breakpoints.ts` - Breakpoint constants
- `src/index.css` - Defensive CSS safeguards

## Future Improvements

- [ ] Add visual regression tests for mobile layouts
- [ ] Create Storybook stories for mobile components
- [ ] Implement automated cross-browser testing
- [ ] Add performance monitoring for mobile devices
- [ ] Optimize bundle size for mobile-first delivery








