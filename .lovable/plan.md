

# Fix: Broken unit level + working fade-out for children

## Root Cause

The `fadingOut` mechanism relies on `animationType` which is **persistent state** -- it stays `'navigate-up'` until the next user action. This means children permanently have `opacity: 0` after zoom-out completes, producing the solid color block shown in the screenshot.

## New Approach: Transient `isFadingOut` state in TreemapContainer

Instead of deriving fade-out from `animationType` (which never resets), add a dedicated boolean state `isFadingOut` that:
1. Turns ON when zoom-out starts
2. Automatically turns OFF after 250ms (the fade duration)

This is clean, predictable, and doesn't interfere with any other animation logic.

## Changes

### 1. `src/components/treemap/TreemapContainer.tsx`

- Add state: `const [isFadingOut, setIsFadingOut] = useState(false)`
- In the `handleNavigateBack` callback, set `setIsFadingOut(true)` before updating `focusedPath`
- Add a `useEffect` that resets it: when `isFadingOut` is true, set a 250ms timeout to set it back to false
- Pass `fadingOut={isFadingOut}` to each top-level `TreemapNode` in the render

### 2. `src/components/treemap/TreemapNode.tsx`

- Simplify the recursive `fadingOut` prop: just pass through the parent's value as-is
- Change line 202 from:
  ```
  fadingOut={fadingOut || (animationType.includes('navigate-up') && node.depth >= 0)}
  ```
  to simply:
  ```
  fadingOut={fadingOut}
  ```
- The `animate` variant logic stays the same (opacity 0 when fadingOut, 1 otherwise, with 0.25s duration)

## Why This Works

- `isFadingOut` is true for exactly 250ms during zoom-out
- ALL children at every depth receive `fadingOut=true` and animate to opacity 0
- After 250ms, `isFadingOut` resets to false, children animate back to opacity 1
- But by then, `renderDepth` has decreased (600ms delay), so collapsed children are already unmounted
- No more permanent invisible state

## What Doesn't Change

- Zoom-in (drilldown) animations
- Filter animations
- renderDepth delay logic
- animationType detection logic
- Component structure
