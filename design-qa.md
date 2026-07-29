# HostLens Ports v0.7.1 UI Fix — Design QA

## Comparison target

- Source visual truth:
  - `/var/folders/qt/p1_jr91x7pd4mlq6nm825v700000gn/T/TemporaryItems/NSIRD_screencaptureui_6n1ob2/スクリーンショット 2026-07-29 12.57.03.png`
  - `/var/folders/qt/p1_jr91x7pd4mlq6nm825v700000gn/T/TemporaryItems/NSIRD_screencaptureui_nua7YA/スクリーンショット 2026-07-29 12.57.11.png`
  - `/var/folders/qt/p1_jr91x7pd4mlq6nm825v700000gn/T/TemporaryItems/NSIRD_screencaptureui_uiGLLa/スクリーンショット 2026-07-29 12.57.21.png`
  - `/var/folders/qt/p1_jr91x7pd4mlq6nm825v700000gn/T/TemporaryItems/NSIRD_screencaptureui_J4oExG/スクリーンショット 2026-07-29 12.57.39.png`
- The source images are defect evidence rather than a replacement visual design. The intended visual truth is the existing HostLens design system without truncation, wrapping, or contradictory filters.
- Final implementation screenshots:
  - Simplified Chinese: `/var/folders/qt/p1_jr91x7pd4mlq6nm825v700000gn/T/com.openai.sky.CUAService/Electron Screenshot 2026-07-29 at 1.05.17 PM.jpeg`
  - Japanese with Python filtering: `/var/folders/qt/p1_jr91x7pd4mlq6nm825v700000gn/T/com.openai.sky.CUAService/Electron Screenshot 2026-07-29 at 1.06.09 PM.jpeg`
  - Japanese with exact Python 3.9.6 runtime filtering: `/var/folders/qt/p1_jr91x7pd4mlq6nm825v700000gn/T/com.openai.sky.CUAService/Electron Screenshot 2026-07-29 at 1.23.43 PM.jpeg`
- Combined comparison evidence:
  - `/private/tmp/hostlens-language-before-after.png`
  - `/private/tmp/hostlens-nav-before-after.png`
  - `/private/tmp/hostlens-runtime-before-after.png`

## Viewport and normalization

- Implementation window: `1224 × 768` pixels, full Electron app mode, light appearance.
- Source crops:
  - Language: `328 × 144`
  - Japanese tabs: `844 × 114`
  - English tabs: `838 × 124`
  - Runtime filters: `2952 × 714`
- Focused comparisons were scaled or cropped to a shared pixel width with FFmpeg. The full runtime comparison was normalized to `1224 × 768` per state.
- Density differences were treated as capture differences; typography and layout were judged by wrapping, truncation, alignment, and relative spacing.

## States and interactions tested

- English, Japanese, and Simplified Chinese language selection.
- Full-window navigation in Japanese and Simplified Chinese.
- Runtime filter order: Runtime → Manager → Sort.
- Runtime selector hierarchy:
  - All runtimes.
  - All versions of a runtime family.
  - Each observed runtime installation, identified by version and source.
- Python selection:
  - Package count changed from 34 to 12.
  - Result list contained only Python packages.
  - Manager selection exposed only observed Python managers.
- Python `pip` selection.
- Python 3.9.6 system-runtime selection:
  - Package count narrowed from 12 Python packages to 7 packages from that installation.
  - Every visible package reported Python 3.9.6.
  - Manager options were derived from packages belonging to that installation.
- Switching from Python/pip to Node.js:
  - Manager reset to “All package managers”.
  - Result count changed to 22.
  - Python packages disappeared.
- Refresh and existing navigation remained available.

## Required fidelity surfaces

- Fonts and typography: Existing Inter/system font stack, weights, sizes, and hierarchy were preserved. Navigation labels now remain on one line in every supported language.
- Spacing and layout rhythm: The full-app tab bar now spans the content width, producing stable equal-width targets instead of a cramped fixed-width group. Panel mode remains compact.
- Colors and visual tokens: Existing green/neutral palette, borders, active state, radii, opacity, and shadows were preserved.
- Image quality and asset fidelity: No image assets were changed or substituted.
- Copy and content: Existing English, Japanese, and Simplified Chinese strings were preserved. Filter labels now appear in the expected Runtime → Manager order.

## Findings and comparison history

### Iteration 1

- [P1] Simplified Chinese language name was truncated.
  - Fix: increased the picker width from 92px to 112px while preserving icon and chevron padding.
  - Post-fix evidence: the complete `简体中文` value is visible and exposed by accessibility as the selected value.
- [P1] Japanese navigation labels wrapped across lines.
  - Fix: prevented tab-label wrapping and removed the full-app fixed-width navigation constraint.
  - Post-fix evidence: all five Japanese labels render on one line in equal-width tabs across the window.
- [P1] Runtime filters had the wrong dependency order and contradictory options.
  - Fix: reordered controls to Runtime → Manager → Sort, derived managers from the selected runtime, and reset an incompatible manager when the runtime changes.
  - Post-fix evidence: Python shows 12 pip packages with no npm entries; switching to Node.js resets Manager and shows 22 Node.js packages with no pip entries.
- [P1] Runtime filtering stopped at the Node.js/Python family level despite the inventory identifying individual installations.
  - Fix: added grouped family and version/source options backed by each runtime installation ID.
  - Post-fix evidence: selecting `Python 3.9.6 · system` narrows the list to the 7 packages associated with that exact runtime.

## Focused-region comparison

- Required because the defects were concentrated in small controls.
- Language picker comparison confirms the selected Chinese label is no longer clipped.
- Navigation comparison confirms Japanese labels no longer wrap and the group no longer crowds the left edge.
- Runtime comparison confirms both the visual control order and the semantic dependency.

## Residual test gaps

- Native macOS select menus do not expose every unopened option through the Electron accessibility tree. The option derivation is therefore also covered by four deterministic unit tests.
- Linux desktop visual rendering was not exercised in this macOS-only UI correction; the CSS and React behavior are platform-neutral.

## Final result

final result: passed
