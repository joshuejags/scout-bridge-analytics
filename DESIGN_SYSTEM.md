# Scout Bridge Analytics Design System

## Purpose

This is the shared UI contract for Scout Bridge Analytics. The product is a professional sports analytics workspace used to upload footage, review computer-vision results, compare players, inspect teams, manage scouting targets, and read recruitment reports.

The design language should make dense analytical information easy to scan while keeping actions predictable across admin, scout, team, and player workspaces.

## Principles

### Analytical clarity

Prioritize hierarchy, legibility, data density, and clear comparison over decoration.

### Evidence before emphasis

Metrics, charts, heatmaps, detected events, and recommendations should show their source/context where practical. AI/CV outputs must be visually distinguishable from human-verified corrections.

### Consistency

Use shared components and patterns. New UI should fit existing navigation, workspace layout, loading, error, modal, notification, and role-guard patterns.

### Progressive disclosure

Show the most important metric or decision first; reveal detailed events, raw evidence, and secondary controls deeper in the interface.

### Safe actions

Destructive, irreversible, billing, account, export, and administrative actions require clear scope, confirmation, and error feedback.

## Information hierarchy

A typical analytics page should follow:

1. Page title and context
2. Primary KPI/summary strip
3. Main visual analysis
4. Evidence/detail tables
5. Secondary insights/actions

Do not present a dashboard as a wall of equal-weight cards.

## Layout

Use the existing workspace shell and responsive grid system.

Recommended structure:

- Full-width page container.
- Clear title/action row.
- Responsive grid for summary metrics.
- Main visualization area with sufficient height for trend/positional charts.
- Tables with sticky or clear headers where long datasets are present.
- Mobile layouts should collapse secondary controls rather than create horizontal overflow.

## Components

Prefer existing shared components in `client/src/components/` before creating a new component.

Core patterns include:

- navigation/workspace shell
- protected/role-guarded views
- cards
- tables
- filters
- command palette
- upload modal
- loading spinner
- error boundary
- banners
- notifications
- empty states
- dialogs
- form controls
- chart wrappers

New components should be composable and domain-neutral unless the behavior is genuinely specific to one analytics surface.

## Typography

Use the repository's existing typography tokens/styles rather than introducing a second font stack.

Recommended hierarchy:

- Page title: strong visual anchor.
- Section title: clear grouping.
- Metric value: high emphasis.
- Supporting label: quieter than the value.
- Body: comfortable reading size.
- Helper/error text: concise and explicit.

Avoid all-caps paragraph text and excessive font-weight changes.

## Colour semantics

Use semantic colors, not arbitrary per-component colors.

| Semantic | Usage |
|---|---|
| Primary | Main navigation/action and product identity |
| Success | Completed/healthy/verified states |
| Warning | Uncertainty, degraded state, attention needed |
| Danger | Failure, destructive action, security issue |
| Info | Neutral explanatory or processing state |
| Neutral | Surfaces, borders, secondary text |

For charts and heatmaps, maintain sufficient contrast and distinguish series with more than color alone (labels, shape, stroke, or position).

## Data visualization

Chart.js is the current client charting library.

Rules:

- Label axes and units.
- Make time ranges explicit.
- Use consistent number formatting.
- Preserve tooltip precision appropriate to the metric.
- Do not imply false accuracy.
- Use comparison baselines where meaningful.
- Make missing/insufficient data obvious.
- Provide accessible text summaries for important visuals when practical.

For player comparisons, keep metric definitions and time windows aligned before comparing values.

## Computer-vision confidence and human review

CV-derived detections should communicate uncertainty.

Use clear states such as:

- Detected
- Low confidence / Needs review
- Human verified
- Corrected

Human corrections should not look identical to raw model output. Maintain an audit trail in data where the existing domain supports it.

## Tables

Tables are for structured comparison and investigation.

Use:

- stable columns
- sortable headers where useful
- concise cell content
- right alignment for numeric measures
- explicit empty/loading/error states

Avoid putting every possible field into one table. Let users drill into a player, team, match, or report.

## Forms

Forms should:

- group related fields
- show required fields clearly
- validate close to the input
- preserve entered values after recoverable errors
- disable duplicate submissions while a request is in flight
- provide clear success/failure confirmation

## Loading and errors

Use the existing loading spinner and error boundary patterns.

For asynchronous analysis:

- communicate queued/processing/completed/failed states
- expose progress when available
- explain what the user can do next after failure
- avoid fake progress

## Accessibility

Target WCAG 2.1 AA practices:

- keyboard reachable controls
- visible focus states
- adequate contrast
- labels for form controls
- semantic headings
- non-color state indicators
- useful alt text for meaningful images
- charts accompanied by textual context where practical

## Responsive behavior

Desktop analytics views may be dense, but the mobile experience must remain usable.

At narrow widths:

- collapse multi-column cards
- stack action controls
- allow horizontal scrolling only for genuinely tabular content
- keep primary actions visible
- avoid hover-only information
- keep dialogs within the viewport

## Design-system governance

Before introducing a new pattern, search for an existing implementation. Update shared components when the pattern is truly global.

Any global design change should be checked against:

- landing/auth surfaces
- dashboards
- analytics pages
- player/team pages
- admin pages
- forms/modals
- mobile layouts
