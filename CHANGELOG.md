# Changelog — Smart Waste Management System

All notable fixes, edge-case hardening, and correctness improvements from the comprehensive system audit.

---

## [Audit Fixes & Correctness Hardening] — 2026-09-20

### 1. Route Optimizer (< 2 Bins & Duplicate Network Calls)
- **Fixed Missing Response Keys on 0 Bins**: When zero bins exceeded the threshold, `optimize_routes()` omitted `threshold` and `km_saved`, causing `undefined`/`None` values on the frontend. Both keys are now consistently populated (`km_saved: 0.0`, `threshold`).
- **Fixed Trivial Single-Bin Handling**: Single-bin routes (Depot $\to$ Bin $\to$ Depot) now bypass the OR-Tools VRP solver and query the OSRM road graph once instead of twice for identical paths, setting `km_saved = 0.0`, `fuel_saved_l = 0.0`, and `time_saved_min = 0.0`.
- **Fixed Road vs. Haversine Distance Mismatches**: When one OSRM request succeeded while the other timed out, road network distance was compared directly against Euclidean haversine distance. Normalization and safety guards now guarantee $D_{\text{opt}} \le D_{\text{naive}}$ across all network fallback scenarios.
- **Fixed Stale Truck Marker on Empty Route**: When route optimization returned zero bins, the truck marker remained stranded on the map. The map polylines and truck marker are now cleanly cleared and reset.

### 2. Deep Learning Classifier & File Handling
- **Enforced File Size Limit (HTTP 413)**: Enforced a 10 MB maximum upload limit (`MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024`) on `/classify`, preventing server memory exhaustion from oversized files.
- **Sanitized Error Messages**: Corrupted image uploads previously exposed internal Python memory addresses (e.g. `cannot identify image file <_io.BytesIO object at 0x149...>`). Error responses are now sanitized into user-friendly messages.
- **Validated Unsupported Formats (SVG / Non-Raster)**: Explicitly rejected vector image formats (SVG) and non-raster files with HTTP 400 and clear actionable guidance (`"Unsupported image format (SVG). Please upload a raster image (JPEG, PNG, WEBP)."`).
- **Eliminated Frontend Silent Drop Failures**: Dropping a non-image file or oversized file onto the dropzone previously failed silently with zero feedback. The dropzone now validates files client-side and displays immediate error feedback in the result card.

### 3. Frontend Resiliency & Race Condition Elimination
- **Fixed Disappearing Map Popups**: The 8-second polling interval previously called `markersLayer.clearLayers()`, destroying all Leaflet markers and closing open popups in the user's face. Replaced with `updateMarkers()`, which updates existing marker coordinates, icons, and popup content without closing open popups.
- **Eliminated Unhandled Fetch Rejections**: Wrapped all API calls (`refresh()`, `refreshChart()`, `refreshReports()`, sample chip loading, and simulation controls) in `try...catch` blocks with visible error states instead of silent console rejections.
- **Fixed Report Select Dropdown Flickering**: Prevented rebuilding `<select id="report-bin">` on every poll if the bin list has not changed, preserving user selection and preventing UI flicker.
- **Fixed CORS & Cross-Origin Port Resolution**: `API` now dynamically detects if the frontend is hosted on another port (e.g. VS Code Live Server on port 5500 or port 3000) or via `file://`, automatically targeting `http://127.0.0.1:8000`. `CORSMiddleware` now also exposes all headers.
- **Guarded WebRTC Camera Context**: Added capability detection for `navigator.mediaDevices && navigator.mediaDevices.getUserMedia` to prevent unhandled `TypeError` in insecure or unsupported browser contexts.
- **Prevented Map Grey Tiles (Sizing Race Condition)**: Added `map.invalidateSize()` listeners on window resize and after DOM initialization to ensure map tiles render completely without layout clipping.

### 4. Automated & End-to-End Test Suite
- Added automated pytest test cases in `backend/tests/test_api.py`:
  - `test_optimize_route_zero_bins`: Verifies 0-bin response shape, geometry, and `km_saved`.
  - `test_optimize_route_single_bin`: Verifies 1-bin route shape, stop count, and metrics.
  - `test_classify_invalid_image`: Verifies HTTP 413 for oversized files (>10MB), HTTP 400 for SVG formats, and sanitized error messages for corrupted files.
- All 15 unit/integration tests and all 14 end-to-end feature checks pass cleanly.

### 5. Single-Page Application Architecture
- Transformed single long-scrolling page into 5 dedicated hash-routed views (`#/overview`, `#/bins`, `#/classifier`, `#/optimizer`, `#/analytics`) with zero full page reloads.
- Built a persistent header mast with responsive view navigation, live connection indicator, and hardware sensor telemetry badge.
- Maintained automatic Leaflet map resizing (`map.invalidateSize()`) and Chart.js resizing upon tab switching.

### 6. Design System & Light-Theme Implementation
- **CSS Custom Properties**: Defined unified light-theme color tokens (`--color-primary`, `--color-primary-hover`, `--color-bg`, `--color-surface`, `--color-border`), semantic fill status tokens (`--color-safe`, `--color-warning`, `--color-critical`, `--color-info`), and shadow tokens.
- **Strict Single-Theme**: Exclusively light-themed — clean, high-contrast, professional municipal software styling with zero dark-theme variables or toggles.
- **Type Scale**: Standardized 5-tier type scale (`--text-xs`, `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`, `--text-2xl`) with zero one-off scattered font sizes.
- **Spacing Scale**: Enforced 4px/8px incremental spacing scale (`--space-1` through `--space-10`) across all cards, containers, buttons, and layouts.
- **Component Primitives**: Standardized `.card`, `.btn` (primary, secondary, ghost, accent, sm), `.input`, `.select`, and `.badge` components uniformly used across all 5 views.
- **Vector Icons**: Replaced all raw emojis with Lucide SVG vector icons (`<i data-lucide="..."></i>`) loaded via CDN with dynamic re-rendering on DOM mutation.
- **Map Tile Modernization**: Replaced dark tiles with CartoDB Positron high-resolution light vector tiles for both Live Bins and Route Optimizer maps.
