# Design QA · En su lugar

final result: passed

## Visual truth and scope

- Source visual truth: `public/plano-original.jpg` (945 × 713 pixels).
- The user requested a modern React app based on the reception layout, rather than a pixel copy of the raster photo. The source governs furniture grouping, relative positions, fixed zones and guest names; app chrome, colors, type and interactive seat controls are intentional adaptations.
- The 10 tables, central empty table, bar between the two upper tables, two W.C. zones, five columns, central cake, couple table at the right, and bottom-left entry are preserved. Table capacity is interpreted as 10 each, plus 2 for the couple (102 total); 89 transcribed names and one unnamed guest make 90 records. Transcription is explicitly marked approximate and editable.

## Evidence

- Desktop initial: `qa/desktop-first.png`, 1280 × 720 CSS/pixel viewport, scale 1.
- Desktop final full view: `qa/desktop-final.png`, 1280 × 720 CSS/pixel viewport, scale 1, overview 100%, 89 seated and 1 unassigned.
- Focused desktop detail: `qa/desktop-detail.png`, 1280 × 720 CSS/pixel viewport, app zoom 175%. Shows the bar, two terrace tables and four middle tables, including empty table 04. The canvas intentionally scrolls at this zoom while the toolbar and zoom controls remain visible.
- Responsive: `qa/mobile-plan.png`, `qa/mobile-guests.png`, `qa/mobile-dialog.png`, 390 × 844 CSS/pixel viewport, scale 1.
- Full source and full implementation were emitted together in one comparison input after fixes. A second combined input placed the source and the 175% detail capture together. This is a semantic floor-plan comparison, not a pixel-font or photographic texture comparison; no false pixel-level fidelity is claimed.
- The responsive viewport override was reset before handoff.

## Findings and comparison history

1. **P2, initial canvas / app height:** initial fixed minimum panel height pushed the bottom tables and controls below the viewport (`desktop-first.png`). Fixed with a compact header, explicit viewport-relative workspace sizing, and fit based on both available width and height. The final capture exposes every table and the persistent controls.
2. **P2, text hierarchy:** early overview table text and secondary list labels were too faint/small. Enlarged table numbers/counts and seat initials, shortened table labels to their number, increased guest names and metadata size, strengthened foreground colors, retained readable full names in the list and edit dialog, and verified detail at 175% zoom.
3. **P1, drag interaction:** initial native HTML drag did not change assignments under the in-app browser test. Replaced activation with thresholded pointer movement and explicit drop hit testing. Verified actual row-to-table drag and seat-to-seat swap visually through the changed accessible labels and counts. Added a floating name preview and drop highlighting. Touch users use the verified tap-and-select flow; the guest list retains native touch scrolling.
4. **P2, dialog fit on small screens:** added viewport-bound dialog maximum height and scrolling to keep editing usable in shorter viewports. Mobile list and edit controls were captured at 390 × 844. Close buttons are labeled in Spanish.

No actionable P0/P1/P2 findings remain in the tested states.

## Required fidelity surfaces

- **Fonts / typography:** clean system sans serif for the interface. Legible hierarchy in the list and form; small initials are an overview marker, with full accessible names, tooltips, list details and zoom. The photo's rotated name tags are intentionally represented as interactive seat initials.
- **Spacing / layout:** source spatial grouping retained; tabletops and fixed zones do not overlap. Whole-room fit, scrollable zoomed canvas, and fixed plan controls verified. The mobile list opens as a full-screen panel to keep names readable.
- **Color / tokens:** intentional ciruela/lilac interface theme with semantic occupied/available/selected states, warmer cake/bar and couple accents. The photograph's brown furniture and gray tiles are not treated as a mandatory UI palette.
- **Image quality / assets:** the supplied original JPG is reused without alteration and renders in the reference dialog. Furniture/seat controls are a functional editable diagram, not a replacement raster illustration. Interface icons use the installed Lucide library.
- **Copy / content:** Spanish labels; 90 guests; names editable and transcription caveat visible in the reference. No invented date or venue name. Local-only saving clearly described in the header/help.

## Interaction verification

- Filter to the single unassigned guest, open editor, select table 04, save: 90 seated / 0 unassigned and the empty-list success state shown.
- Undo: original 89 seated / 1 unassigned restored.
- Search Vicente: one matching guest and highlighted seat.
- Pointer drag Samuel from list to table 04: origin 9/10, target 1/10 verified.
- Pointer swap Samuel with Camilo: both reciprocal seat labels verified.
- Reload: the swapped assignments remained, proving device-local persistence.
- Restore the source assignments through inverse pointer actions.
- Mobile: open/close guest list, open edit form, rename a guest, save, and undo; source name restored.
- Zoom and fit controls changed view scale and reset it.
- Original-photo dialog opens and displays the correct supplied image.
- Browser console error check: empty error list in the final run.
- TypeScript check and final production build passed.
- Core logic assertions passed: 90 unique valid guests, 102 places, assignment, occupied-seat swap, full-table rejection, unassign, invalid guest/seat rejection, duplicate draft rejection.

## Remaining limits / P3 follow-up

- Test coverage used the Codex in-app browser; no claim of physical mobile Safari/Android device testing or a full accessibility audit.
- The whole-room overview is intentionally compact. Use zoom, the full-name guest list or table selection for detailed placement.
- No cross-device collaboration: drafts remain in the current browser. History is session-only.
- Guest name spelling and any implied seating capacity should be confirmed against the event's actual guest list.

## Implementation checklist

- [x] Source layout preserved and photo available.
- [x] Primary assignment journey verified through actual UI interaction.
- [x] Responsive list and edit dialog checked.
- [x] P0/P1/P2 findings corrected and visual evidence captured again.
- [x] Local preview retained for the user.
