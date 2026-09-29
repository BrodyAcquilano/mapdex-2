// src/map/tools/GeometryToolWheel.jsx

/*
 * A radial replacement for the old GeometryToolbar (still at
 * ./GeometryToolbar.jsx, untouched, for easy side-by-side comparison
 * or revert - swap the import back in Editor.jsx to go back). Same
 * props contract (geometryTool/setGeometryTool/geometryTypes), so
 * nothing outside Editor.jsx's own JSX needs to change - isEditTool
 * everywhere else in the app derives purely from the geometryTool
 * string, never from any toolbar-open UI state, so it doesn't care
 * which toolbar component is driving that string.
 *
 * One trigger button (sits where the old toolbar used to) opens a
 * single circular "wheel" menu instead of a docked bar plus a
 * second pop-out row for edit tools. Tools are grouped into four
 * quadrant arcs, clockwise from 12 o'clock: edit (move/midpoint/
 * remove - touch geometry only) upper-right, import (importGeometry/
 * importData - bringing outside data in, still coming
 * soon) bottom-right, transform (union/split/intersection/clip/
 * delete - set-theory-style operations across whole data items, most
 * still coming soon) bottom-left, draw (point/line/polygon) upper-
 * left. This grouping matches how isEditTool/EDIT_TOOL_KEYS already
 * treat move/midpoint/remove as their own thing and nothing else
 * (transform/import tools aren't in that list anywhere in the app).
 * Every group's own arc (and every button's spacing within it) is
 * sized proportionally to that group's actual tool count relative to
 * the whole wheel, not fixed equal quarters - see
 * computeGroupArcsDeg/buildWheelLayout for the actual math, and
 * GROUP_ORDER for the fixed clockwise arrangement above. The center
 * button always deselects ("untool"), same effect as passing null to
 * setGeometryTool today.
 *
 * The wheel itself (.tool-wheel in the CSS) is a glassmorphism pane -
 * blue tint, backdrop-filter blur, soft sheen and edge - the whole
 * visible surface the buttons and dividers sit on. It used to sit
 * behind a separate opaque metal "frame" ring around its edge
 * (removed, Brody's own call - see .tool-wheel's own comment in the
 * CSS for why that needed a mask, and why removing the frame made the
 * mask unnecessary too). Each tool button still carries its own
 * group's accent color (via --wheel-button-accent) on its own
 * border/glow when hovered or active; the panel behind them carries
 * no per-group tint at all - an earlier version's color-coded
 * background wedges read as arbitrary on a plain circle, Brody's own
 * call. The center "untool" button got its own silver/chrome
 * treatment, using the same radial-gradient technique as
 * TrackLocationButton.jsx's metallic disc.
 */

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import Tooltip from "../../system/notifications/Tooltip";
import { hasAnyMultiTypeAllowed } from "../../../shared/validation/geometryTypeRules.js";

import "./GeometryToolWheel.css";

/*
 * ─────────────────────────────
 * Icons (mirrored from GeometryToolbar.jsx's icons, not imported -
 * this file is deliberately self-contained so the old toolbar can be
 * deleted or reverted to independently while this one is being
 * tried out).
 * ─────────────────────────────
 */

function PointToolIcon() {
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <circle cx="12" cy="12" r="4" className="wheel-icon-fill" />
    </svg>
  );
}

function LineToolIcon() {
  /*
   * These endpoint coordinates (4,19)-(20,5) are shared with
   * MidpointToolIcon and RemovePointToolIcon below - the same
   * "line with two endpoint nodes" motif appears in all three, so
   * keeping the line/node layout identical across them keeps that
   * motif reading at one consistent scale everywhere it shows up,
   * rather than each icon drifting to its own slightly different
   * size. Sized to leave roughly a 2-unit margin on every side of the
   * 24x24 viewBox (not touching the edges, but no more spare room
   * than that) - Brody's own call on how big these can safely get
   * before edging out of the trigger button's own 24px rendering of
   * this same icon.
   */
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <line x1="4" y1="19" x2="20" y2="5" className="wheel-icon-line" />
      <circle cx="4" cy="19" r="2.2" className="wheel-icon-node" />
      <circle cx="20" cy="5" r="2.2" className="wheel-icon-node" />
    </svg>
  );
}

function PolygonToolIcon() {
  /*
   * Bumping the node radius up to match the other icons' shared node
   * size (tried first) was the wrong lever - it scaled the corner
   * dots, not the actual shape, so the polygon itself never got any
   * bigger. What actually reads as "bigger" here is the shape's own
   * edges getting longer (vertices spread further apart from the
   * polygon's own center) - done here, moving each vertex from its
   * earlier position out to about 1.125x its own distance from
   * center - while the corner nodes themselves go smaller (1.6 to
   * 1.4), not bigger, per Brody's own call: small dots at the corners
   * of a bigger shape, not bigger dots on the same small shape.
   */
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <polygon
        points="12,3 21,9.7 17.6,19.8 6.4,19.8 3,9.7"
        className="wheel-icon-polygon"
      />
      <circle cx="12" cy="3" r="1.4" className="wheel-icon-node" />
      <circle cx="21" cy="9.7" r="1.4" className="wheel-icon-node" />
      <circle cx="17.6" cy="19.8" r="1.4" className="wheel-icon-node" />
      <circle cx="6.4" cy="19.8" r="1.4" className="wheel-icon-node" />
      <circle cx="3" cy="9.7" r="1.4" className="wheel-icon-node" />
    </svg>
  );
}

function MultiPointToolIcon() {
  /*
   * Three plain dots in a triangle, each still smaller than
   * PointToolIcon's own single dot (r 2.8 here vs. r 4 there) -
   * "several points," not one point drawn three times at full size.
   * Spread further apart toward the edges of the viewBox (a
   * wider/taller triangle than an earlier, more tightly-clustered
   * version) so the icon as a whole reads at a comparable size to the
   * rest of the wheel's icons, per Brody's own call - the dots
   * themselves stay the same size, only their spacing changed.
   */
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <circle cx="5" cy="18.5" r="2.8" className="wheel-icon-fill" />
      <circle cx="19" cy="18.5" r="2.8" className="wheel-icon-fill" />
      <circle cx="12" cy="5" r="2.8" className="wheel-icon-fill" />
    </svg>
  );
}

function MultiLineToolIcon() {
  /*
   * Three parallel lines sharing LineToolIcon's own slope (-14/16,
   * i.e. -0.875) - no endpoint nodes, per Brody's own call, since
   * three lines each carrying their own pair of dots would read as
   * cluttered at this size; the lines alone already read clearly as
   * "line" once there are three of them. Longer and spaced further
   * apart than an earlier, more tightly-clustered version (each line
   * ~13.3 units long here vs. ~10.6 before, offset by 5/5 between
   * lines vs. 4/5 before) so the icon as a whole reads at a
   * comparable size to the rest of the wheel's icons - stroke width
   * (set entirely by .wheel-icon-line's own CSS, untouched here) stays
   * the same either way, only the coordinates changed.
   */
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <line x1="2" y1="11.4" x2="12" y2="2.6" className="wheel-icon-line" />
      <line x1="7" y1="16.4" x2="17" y2="7.6" className="wheel-icon-line" />
      <line x1="12" y1="21.4" x2="22" y2="12.6" className="wheel-icon-line" />
    </svg>
  );
}

function MultiPolygonToolIcon() {
  /*
   * Two smaller copies of PolygonToolIcon's own pentagon, offset
   * diagonally so they overlap in the middle - bottom-left and
   * top-right, per Brody's own layout call. Both use
   * .wheel-icon-polygon's own translucent fill, so - the same trick
   * IntersectionToolIcon's overlapping circles use - the overlap
   * region doubles up and reads naturally darker with no extra markup
   * needed for it. Scaled up from an earlier ~60%-scale version to
   * ~70% (border/stroke width stays whatever .wheel-icon-polygon's
   * own CSS already sets, untouched here - only the shapes
   * themselves got bigger), and the line between the two pentagons'
   * own centers was steepened from 45deg to 60deg from horizontal per
   * Brody's own call, so the pair reads as more diagonal/vertical
   * rather than a plain corner-to-corner 45deg line.
   */
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <polygon
        points="9.5,10.4 15.1,15.3 13,21.6 6,21.6 3.9,15.3"
        className="wheel-icon-polygon"
      />
      <polygon
        points="14.5,1.8 20.1,6.7 18,13 11,13 8.9,6.7"
        className="wheel-icon-polygon"
      />
    </svg>
  );
}

function MovePointToolIcon() {
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <circle cx="12" cy="12" r="3" className="wheel-icon-fill" />
      <path
        d="M12 2 V7 M12 17 V22 M2 12 H7 M17 12 H22"
        className="wheel-icon-line"
      />
      <path d="M9 4 L12 1 L15 4 M9 20 L12 23 L15 20" className="wheel-icon-line" />
      <path d="M4 9 L1 12 L4 15 M20 9 L23 12 L20 15" className="wheel-icon-line" />
    </svg>
  );
}

function MoveGeometryToolIcon() {
  /*
   * MovePointToolIcon's own 4-way "move" arrows, unchanged, with its
   * center circle (which reads as "the single point/vertex being
   * moved") swapped for a small polygon (PolygonToolIcon's own shape,
   * scaled down to fit the same footprint the circle had) - "reads as
   * moving a whole shape" instead, the same "keep the shared action
   * glyph, swap what's being acted on" pairing RemoveSubgeometryToolIcon
   * already uses relative to RemovePointToolIcon. This is Move
   * Vertex's own alt tool - moves an entire geometry (or, for a
   * MultiPoint/MultiLineString/MultiPolygon, the whole group at once,
   * since there's no per-sub-geometry centroid to grab individually)
   * by dragging a handle at its own stored centroid, rather than one
   * vertex at a time.
   */
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <polygon
        points="12,8 16,10.98 14.49,15.47 9.51,15.47 8,10.98"
        className="wheel-icon-polygon"
      />
      <path
        d="M12 2 V7 M12 17 V22 M2 12 H7 M17 12 H22"
        className="wheel-icon-line"
      />
      <path d="M9 4 L12 1 L15 4 M9 20 L12 23 L15 20" className="wheel-icon-line" />
      <path d="M4 9 L1 12 L4 15 M20 9 L23 12 L20 15" className="wheel-icon-line" />
    </svg>
  );
}

function MidpointToolIcon() {
  /*
   * Same (4,19)-(20,5) endpoint line/nodes as LineToolIcon above -
   * see its own comment for why. A longer line than an earlier
   * version (which matched a tighter (4,17)-(20,7) span) - Brody's
   * own call, made specifically to leave more room between the
   * endpoint nodes and the center ring so that ring could be bigger
   * too (r 3.5 to 4.5) without crowding them. The plus's arms are
   * rotated to lie along this same line's own angle (atan2(-14, 16),
   * in degrees) rather than staying screen-horizontal, so the plus
   * reads as sitting ON the line rather than at an arbitrary angle to
   * it.
   */
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <line x1="4" y1="19" x2="20" y2="5" className="wheel-icon-line" />
      <circle cx="4" cy="19" r="2.2" className="wheel-icon-node" />
      <circle cx="20" cy="5" r="2.2" className="wheel-icon-node" />
      <circle cx="12" cy="12" r="4.5" className="wheel-icon-midpoint-circle" />
      <g transform="rotate(-41.19 12 12)">
        <line x1="9.2" y1="12" x2="14.8" y2="12" className="wheel-icon-midpoint-plus" />
        <line x1="12" y1="9.2" x2="12" y2="14.8" className="wheel-icon-midpoint-plus" />
      </g>
    </svg>
  );
}

function RemovePointToolIcon() {
  /*
   * Same (4,19)-(20,5) endpoint line/nodes as LineToolIcon/
   * MidpointToolIcon above, for the same reason - and the same
   * bigger-ring, longer-line treatment as MidpointToolIcon's own
   * comment describes (ring r 4 to 5 here). The minus's bar is
   * rotated to lie along this line's own angle (atan2(-14, 16), in
   * degrees, the same rotation MidpointToolIcon's plus uses, since
   * both icons now share the same underlying line) rather than
   * staying screen-horizontal.
   */
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <line x1="4" y1="19" x2="20" y2="5" className="wheel-icon-line" />
      <circle cx="4" cy="19" r="2.2" className="wheel-icon-node" />
      <circle cx="20" cy="5" r="2.2" className="wheel-icon-node" />
      <circle cx="12" cy="12" r="5" className="wheel-icon-remove-circle" />
      <line
        x1="8.9"
        y1="12"
        x2="15.1"
        y2="12"
        className="wheel-icon-remove-line"
        transform="rotate(-41.19 12 12)"
      />
    </svg>
  );
}

function RemoveSubgeometryToolIcon() {
  /*
   * PolygonToolIcon's own shape (no corner nodes - this is about the
   * shape as a whole, not any one vertex of it), crossed out with a
   * single minus bar, reusing the same wheel-icon-remove-line class
   * RemovePointToolIcon's own minus does - a deliberately different
   * read from that icon's own "ring with a minus sitting on a line,"
   * per Brody's own call: this removes an entire point/line/polygon
   * out of a MultiPoint/MultiLineString/MultiPolygon, not one vertex
   * within it.
   */
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <polygon
        points="12,3 21,9.7 17.6,19.8 6.4,19.8 3,9.7"
        className="wheel-icon-polygon"
      />
      <line x1="6" y1="11.4" x2="18" y2="11.4" className="wheel-icon-remove-line" />
    </svg>
  );
}

function AddSubgeometryToolIcon() {
  /*
   * RemoveSubgeometryToolIcon's own polygon shape, crossed with a plus
   * instead of its minus - two perpendicular wheel-icon-remove-line
   * bars centered the same way that icon's single bar is, so the two
   * read as an obvious paired opposite of each other on the wheel.
   * This adds a whole new point/line/polygon onto an existing
   * MultiPoint/MultiLineString/MultiPolygon (or promotes a plain
   * Point/LineString/Polygon into one), the inverse of Remove
   * Sub-Geometry taking one back out.
   */
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <polygon
        points="12,3 21,9.7 17.6,19.8 6.4,19.8 3,9.7"
        className="wheel-icon-polygon"
      />
      <line x1="6" y1="11.4" x2="18" y2="11.4" className="wheel-icon-remove-line" />
      <line x1="12" y1="5.4" x2="12" y2="17.4" className="wheel-icon-remove-line" />
    </svg>
  );
}

function UnionToolIcon() {
  /*
   * Scaled up ~13% from center (12,12) compared to an earlier,
   * smaller version - this icon had a lot of unused margin on the
   * original 24x24 grid (its own boxes only reached x:[3,21], y:
   * [6,18]) compared to the other tool icons, so there was real room
   * to grow it before it'd start crowding the viewBox's own edges -
   * per Brody's own call to bring the coming-soon merge/split icons
   * up to the same enlarged scale as the rest.
   */
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <polygon points="1.8,5.2 8.6,5.2 8.6,12 1.8,12" className="wheel-icon-polygon" />
      <polygon points="15.4,12 22.2,12 22.2,18.8 15.4,18.8" className="wheel-icon-polygon" />
      <path d="M8.6 8.6 L13.1 12" className="wheel-icon-line" />
      <path d="M15.4 15.4 L13.1 12" className="wheel-icon-line" />
      <polygon points="10.3,9.7 16,12 10.3,14.3" className="wheel-icon-merge-arrow" />
    </svg>
  );
}

function SplitToolIcon() {
  /*
   * The diagonal line/node pairs (unchanged below) already reach
   * almost to the 24x24 viewBox's own edges (x:[3,21] plus each
   * node's own 1.8 radius leaves barely over a 1-unit margin) -
   * there's no real room to grow those further without the nodes
   * starting to crowd the edge. The two chevron "flying apart" marks
   * above/below them had real slack by comparison (they only reached
   * y:4/20), so those are what got extended (to y:3/21) to bring this
   * icon's overall size up to match the rest, per Brody's own call -
   * safer than pushing the already-tight diagonal segments out
   * further.
   */
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <line x1="3" y1="18" x2="9" y2="12" className="wheel-icon-line" />
      <line x1="15" y1="12" x2="21" y2="6" className="wheel-icon-line" />
      <circle cx="3" cy="18" r="1.8" className="wheel-icon-node" />
      <circle cx="9" cy="12" r="1.8" className="wheel-icon-node" />
      <circle cx="15" cy="12" r="1.8" className="wheel-icon-node" />
      <circle cx="21" cy="6" r="1.8" className="wheel-icon-node" />
      <path d="M9 7 L9 3 M15 17 L15 21" className="wheel-icon-line" />
      <path d="M7 5 L9 3 L11 5 M13 19 L15 21 L17 19" className="wheel-icon-line" />
    </svg>
  );
}

function DeleteToolIcon() {
  /*
   * A trash bin, built from the same simple-primitives approach as
   * every other icon here (filled bars for the lid/handle, a stroked
   * rounded rect for the body, two plain vertical lines for the
   * ridges) rather than a hand-drawn path.
   */
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <rect x="9" y="3" width="6" height="2.6" rx="1.3" className="wheel-icon-fill" />
      <rect x="4" y="6" width="16" height="2" rx="1" className="wheel-icon-fill" />
      <rect x="5.5" y="8" width="13" height="13" rx="2" className="wheel-icon-line" />
      <line x1="9.5" y1="11" x2="9.5" y2="18" className="wheel-icon-line" />
      <line x1="14.5" y1="11" x2="14.5" y2="18" className="wheel-icon-line" />
    </svg>
  );
}

function IntersectionToolIcon() {
  /*
   * Two overlapping circles, each filled with the same translucent
   * currentColor tint (.wheel-icon-venn) - rather than hand-computing
   * the lens-shaped overlap as its own path, stacking two identical
   * translucent fills does that for free: wherever the circles
   * overlap, the tint doubles up and reads visibly darker than either
   * circle alone, the classic Venn-diagram "intersection" read, built
   * from nothing but two plain circles.
   */
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <circle cx="9.5" cy="12" r="7" className="wheel-icon-line" />
      <circle cx="9.5" cy="12" r="7" className="wheel-icon-venn" />
      <circle cx="14.5" cy="12" r="7" className="wheel-icon-line" />
      <circle cx="14.5" cy="12" r="7" className="wheel-icon-venn" />
    </svg>
  );
}

function ClipToolIcon() {
  /*
   * Scissors - two loop "handles" (plain circles) and two crossing
   * blades (plain lines) meeting at a point, the everyday symbol for
   * "cut," reused here for "clip away everything outside a boundary."
   */
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <circle cx="6" cy="6" r="2.6" className="wheel-icon-line" />
      <circle cx="6" cy="18" r="2.6" className="wheel-icon-line" />
      <line x1="8" y1="7.5" x2="20" y2="17" className="wheel-icon-line" />
      <line x1="8" y1="16.5" x2="20" y2="7" className="wheel-icon-line" />
    </svg>
  );
}

function ImportGeometryToolIcon() {
  /*
   * A download-style arrow feeding into a small triangle (a plain
   * polygon, the same "geometry" shorthand PolygonToolIcon's own
   * outline uses) sitting at the bottom - "a shape coming in," as
   * opposed to ImportDataToolIcon's own arrow-into-a-record-card
   * below.
   */
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <line x1="12" y1="2.5" x2="12" y2="12.5" className="wheel-icon-line" />
      <path d="M7.5 8 L12 12.5 L16.5 8" className="wheel-icon-line" />
      <polygon points="12,14.5 17,20 7,20" className="wheel-icon-polygon" />
    </svg>
  );
}

function ImportDataToolIcon() {
  /*
   * The same download-style arrow ImportGeometryToolIcon uses above,
   * but feeding into a small record card (a stroked rect with two
   * divider lines standing in for rows of fields) instead of a
   * geometry shape - "a whole item's worth of data coming in," not
   * just its outline.
   */
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <line x1="12" y1="2.5" x2="12" y2="10.5" className="wheel-icon-line" />
      <path d="M7.5 6 L12 10.5 L16.5 6" className="wheel-icon-line" />
      <rect x="6" y="12.5" width="12" height="8.5" rx="1.5" className="wheel-icon-line" />
      <line x1="6" y1="16" x2="18" y2="16" className="wheel-icon-line" />
      <line x1="6" y1="19" x2="18" y2="19" className="wheel-icon-line" />
    </svg>
  );
}

/*
 * Center "untool" icon - a simple open-hand silhouette, reading as
 * "pan/plain map interaction, no tool active" rather than the earlier
 * park-sign "not permitted" circle (dropped - Brody's own call, this
 * button no longer needs to look like a warning). Built from plain
 * rects (rounded palm base, four fingers of slightly different
 * heights, a thumb rotated outward) rather than one intricate path,
 * matching this file's existing preference for simple primitives over
 * hand-tuned curves.
 */
function HandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="wheel-tool-icon" aria-hidden="true">
      <rect x="6" y="13" width="12" height="8" rx="4" className="wheel-icon-hand" />
      <rect x="6.5" y="6" width="2.6" height="9" rx="1.3" className="wheel-icon-hand" />
      <rect x="10.2" y="3.5" width="2.6" height="11.5" rx="1.3" className="wheel-icon-hand" />
      <rect x="13.9" y="4" width="2.6" height="11" rx="1.3" className="wheel-icon-hand" />
      <rect x="17.6" y="7" width="2.4" height="8" rx="1.2" className="wheel-icon-hand" />
      <rect
        x="3"
        y="12"
        width="2.4"
        height="6.5"
        rx="1.2"
        transform="rotate(-30 4.2 15.25)"
        className="wheel-icon-hand"
      />
    </svg>
  );
}

/*
 * Every tool's own tooltip/ariaLabel is just its name (capitalized
 * per word), not a usage instruction - a disabled, coming-soon look
 * (see .tool-wheel-button.coming-soon in the CSS) already says "not
 * available yet" without needing the tooltip to spell that out in
 * words too, and an active tool's own purpose is meant to be learned
 * by trying it, the same as any other icon-only toolbar. There's no
 * separate `label` field kept alongside these - it had no consumer
 * anywhere in this file, so tooltip/ariaLabel are the only names each
 * tool actually needs.
 */
/*
 * Each entry is an array, not a plain tool - the geometry types
 * GeoJSON itself supports come in singular/multi pairs (Point/
 * MultiPoint, LineString/MultiLineString, Polygon/MultiPolygon), and
 * the wheel now shows that pairing directly: buildWheelLayout below
 * positions an entry's first tool on the wheel's own outer ring (the
 * same ring every other tool sits on) and, if a second tool exists,
 * places it radially inward from the first, at the same angle - not
 * its own separate position on the circumference, so adding a second
 * tool per pair doesn't cost any extra room around the wheel's own
 * edge. `comingSoon: false` here is only each alt tool's OWN default -
 * a project's schema has to separately opt into a Multi* type (via
 * the Schema Builder's own geometry type list) for it to actually be
 * usable there, so the component below re-derives each alt tool's
 * real comingSoon state per render from the current schema's own
 * allowed geometry types, same as visibleDrawTools already filters
 * the primary tools.
 */
const DRAW_TOOLS = [
  [
    { key: "point", geometryType: "Point", ariaLabel: "Point", tooltip: "Point", icon: <PointToolIcon /> },
    { key: "multipoint", geometryType: "MultiPoint", ariaLabel: "Multipoint", tooltip: "Multipoint", comingSoon: false, icon: <MultiPointToolIcon /> },
  ],
  [
    { key: "line", geometryType: "LineString", ariaLabel: "Line", tooltip: "Line", icon: <LineToolIcon /> },
    { key: "multiline", geometryType: "MultiLineString", ariaLabel: "Multiline", tooltip: "Multiline", comingSoon: false, icon: <MultiLineToolIcon /> },
  ],
  [
    { key: "polygon", geometryType: "Polygon", ariaLabel: "Polygon", tooltip: "Polygon", icon: <PolygonToolIcon /> },
    { key: "multipolygon", geometryType: "MultiPolygon", ariaLabel: "Multipolygon", tooltip: "Multipolygon", comingSoon: false, icon: <MultiPolygonToolIcon /> },
  ],
];

/*
 * "midpoint" and "remove" each pair with their own alt tool the same
 * way DRAW_TOOLS' own pairs do (see that array's own comment). Add
 * Midpoint works within a single point/line/polygon (or one part of a
 * multi- one), inserting one new vertex between two existing ones;
 * Add Sub-Geometry instead adds a whole new point/line/polygon onto
 * the item - re-entering a draw-like workflow that clones the
 * existing geometry into the draft (converting a plain Point/
 * LineString/Polygon to its Multi- equivalent the first time it's
 * used this way) and lets new points/parts be clicked in on top of
 * it, never touching what was already there. Remove Vertex/Remove
 * Sub-Geometry are that same split in reverse - Remove Vertex takes
 * one vertex off; Remove Sub-Geometry takes a whole point/line/polygon
 * out of the group. Every pair keeps two clearly-scoped tools rather
 * than one tool trying to do both, per Brody's own call - and unlike
 * Remove Sub-Geometry (which never selects a plain Point/LineString/
 * Polygon), Add Sub-Geometry selects any type at all, since any single
 * type is a valid starting point to grow into a multi- one.
 *
 * "move" pairs with Move Geometry the same way - Move Vertex only ever
 * moves one vertex at a time (slow for repositioning an entire shape,
 * since every one of its points has to be dragged individually); Move
 * Geometry instead drags a single handle at the whole item's own
 * stored centroid (a saved item's own centroid, present on every type
 * but Point, which is moved by its own one coordinate directly
 * instead) and rigidly translates every coordinate in the draft by the
 * same amount - the whole shape (or, for a MultiPoint/MultiLineString/
 * MultiPolygon, the whole group at once, since there's no per-sub-
 * geometry centroid to grab individually) moves together. Selects any
 * type at all, same as Add Sub-Geometry, since there's no type this
 * doesn't make sense for.
 *
 * Delete sits as its own plain 4th slot (not paired with anything) -
 * moved here from TRANSFORM_TOOLS per Brody's own call: even though
 * it's destructive like the set-theory tools, it reads as "edit the
 * geometry because it's the wrong one" rather than "split or merge
 * data," so it fits the edit group's own goal better. This also
 * brings the edit group's own tool count to 4, matching draw's and
 * import's eventual 4 once circle draw and an import-project tool are
 * added later.
 */
const EDIT_TOOLS = [
  [
    { key: "move", ariaLabel: "Move Vertex", tooltip: "Move Vertex", comingSoon: false, icon: <MovePointToolIcon /> },
    { key: "moveGeometry", ariaLabel: "Move Geometry", tooltip: "Move Geometry", comingSoon: false, icon: <MoveGeometryToolIcon /> },
  ],
  [
    { key: "midpoint", ariaLabel: "Add Midpoint", tooltip: "Add Midpoint", comingSoon: false, icon: <MidpointToolIcon /> },
    { key: "addSubgeometry", ariaLabel: "Add Sub-Geometry", tooltip: "Add Sub-Geometry", comingSoon: false, icon: <AddSubgeometryToolIcon /> },
  ],
  [
    { key: "remove", ariaLabel: "Remove Vertex", tooltip: "Remove Vertex", comingSoon: false, icon: <RemovePointToolIcon /> },
    { key: "removeSubgeometry", ariaLabel: "Remove Sub-Geometry", tooltip: "Remove Sub-Geometry", comingSoon: false, icon: <RemoveSubgeometryToolIcon /> },
  ],
  { key: "delete", ariaLabel: "Delete Data", tooltip: "Delete Data", comingSoon: false, icon: <DeleteToolIcon /> },
];

/*
 * Kept as its own group, not folded into EDIT_TOOLS: union/split/
 * intersection/clip are set-theory-style operations (union, split/
 * divide, intersect, subtract-via-clip) across whole data items -
 * they change how many data items exist, not just a geometry's own
 * points. Delete used to sit here too as the simplest case of "fewer
 * items exist afterward," but has since moved into EDIT_TOOLS (see
 * that array's own comment) since it fits "edit the geometry" better
 * than "split or merge data." "Merge" was renamed to "Union" - Brody's
 * own call: "merge" doesn't say how two items combine, and union
 * already has an unambiguous, well-known meaning.
 */
const TRANSFORM_TOOLS = [
  { key: "union", ariaLabel: "Union", tooltip: "Union", comingSoon: true, icon: <UnionToolIcon /> },
  { key: "split", ariaLabel: "Split", tooltip: "Split", comingSoon: true, icon: <SplitToolIcon /> },
  { key: "intersection", ariaLabel: "Intersection", tooltip: "Intersection", comingSoon: true, icon: <IntersectionToolIcon /> },
  { key: "clip", ariaLabel: "Clip", tooltip: "Clip", comingSoon: true, icon: <ClipToolIcon /> },
];

/*
 * Bringing outside data into the project, as opposed to every other
 * group here which only ever operates on data already in it.
 * importGeometry (up next) reads a GeoJSON file, keeps only its
 * geometry, and quick-adds each feature the same way manually
 * drawing one does - discarding any of the file's own properties.
 * importData (later) additionally tries to map a GeoJSON feature's
 * own properties onto matching schema fields. Aggregator used to live
 * here too (consolidating data already in the project, e.g. summing a
 * field across every item inside a drawn boundary) - moved out per
 * Brody's own call, first to the Layers page's own tool menu, then out
 * again into its own full page (src/workflows/Aggregates.jsx,
 * src/aggregates/) once it grew boundaries/saved results of its own,
 * well beyond what either this wheel or the Layers page's own tool
 * menu was ever meant to hold.
 */
const IMPORT_TOOLS = [
  { key: "importGeometry", ariaLabel: "Import Geometry", tooltip: "Import Geometry", comingSoon: false, icon: <ImportGeometryToolIcon /> },
  { key: "importData", ariaLabel: "Import Data", tooltip: "Import Data", comingSoon: true, icon: <ImportDataToolIcon /> },
];

/*
 * BUTTON_DIAMETER_PX/CENTER_BUTTON_DIAMETER_PX mirror actual CSS
 * values (.tool-wheel-button's and .tool-wheel-center's width/height)
 * - update them here too if those ever change. Both stay fixed in px
 * regardless of the wheel's own size (Brody's own call to keep button
 * sizes fixed rather than scaling them with the wheel).
 */
const BUTTON_DIAMETER_PX = 60;
const CENTER_BUTTON_DIAMETER_PX = 74;

/*
 * ALT_BUTTON_* govern the second, inner ring a draw-tool pair's
 * second entry (e.g. Multipoint) renders on - see DRAW_TOOLS' own
 * comment. Smaller than the primary ring's own 60px buttons, both to
 * read as visually secondary and, more importantly, because the same
 * physical button width subtends a WIDER angle at a smaller radius -
 * at a small enough wheel size, three full 60px-equivalent buttons on
 * this inner ring would angularly overlap each other even though
 * their primary counterparts (further out, where the same width is a
 * narrower angle) don't. 38px/62% were picked by checking that
 * tradeoff against the draw group's own current tool spacing (~25.7deg
 * between neighboring draw tools, unaffected by wheel size) down to a
 * roughly phone-sized ~320px wheel - not a guarantee for every
 * possible screen, just the realistic range. If Brody's own eye on a
 * genuinely tiny screen finds them still crowding each other, these
 * two numbers are the ones to revisit together (smaller diameter,
 * and/or push the radius fraction outward - there isn't a way to fix
 * this with only one of the two, since either alone runs into the
 * center button or the primary ring on the other side).
 */
const ALT_BUTTON_DIAMETER_PX = 38;
const ALT_BUTTON_RADIUS_PCT = 0.62;

/*
 * Small clearance (as a fraction of the wheel's own radius) left
 * between a button's own outer edge and the disc's own true edge
 * (100%) - there's no metal frame anymore (removed, Brody's own
 * call) to leave room for, just this same small margin so buttons
 * don't sit flush against the glass's own boundary.
 */
const DISC_EDGE_GAP_PCT = 0.02;

/*
 * How far out each divider rail reaches (as % of the wheel's own
 * radius) - short of the disc's own true edge (100%) by
 * DIVIDER_EDGE_GAP_PCT, so it doesn't visually run into the glass's
 * own boundary/border.
 */
const DIVIDER_OUTER_RADIUS_PCT = 0.9;

// The gap the outer end leaves before the disc's true edge - reused
// below so the inner end leaves the exact same size gap before the
// center "untool" button's own outer edge, per Brody's own request (a
// matching gap on both ends, not the rail just running to the true
// center and relying on the center button to cover the rest).
const DIVIDER_EDGE_GAP_PCT = 1 - DIVIDER_OUTER_RADIUS_PCT;

/*
 * Used only until the wheel's real rendered size has actually been
 * measured (see the ResizeObserver in the component below) - the
 * wheel's own on-screen size is responsive (--wheel-size: 92cqmin in
 * the CSS, sized off the map panel's own dimensions), so no fixed
 * number is ever exactly right; this is just a reasonable starting
 * point for the very first render, before layout has happened.
 */
const DEFAULT_WHEEL_DIAMETER_PX = 450;

/*
 * Every other radius/angle constant that depends on the wheel's own
 * pixel size (as opposed to fixed pixel sizes like BUTTON_DIAMETER_PX,
 * or plain fractions like DISC_EDGE_GAP_PCT that don't) has to be
 * recomputed whenever that size changes, rather than calculated once
 * as a module-level constant - a button's FIXED 60px footprint is a
 * DIFFERENT fraction of a small mobile wheel than a large desktop
 * one, so treating it as one constant ratio (an earlier version did,
 * using DEFAULT_WHEEL_DIAMETER_PX for every calculation) meant
 * button spacing was only exactly right at whatever size that
 * constant approximated, and increasingly approximate the further
 * the wheel's real size diverged from it - most noticeably on mobile,
 * where the wheel runs meaningfully smaller. See the ResizeObserver
 * effect below for where wheelDiameterPx actually comes from at
 * render time.
 */
function computeGeometry(wheelDiameterPx) {
  const centerButtonRadiusPct = CENTER_BUTTON_DIAMETER_PX / wheelDiameterPx;

  /*
   * Radius (as % of the wheel's own half-width) that tool buttons sit
   * on. Not the midpoint between the center button and the edge
   * (tried that - Brody's own call was that it wasted the extra room
   * a bigger wheel provides, since a bigger circumference could fit
   * more buttons if they actually used it) - this instead pushes
   * buttons out to just inside the disc's own true edge, leaving only
   * DISC_EDGE_GAP_PCT of clearance.
   */
  const buttonOwnRadiusPct = BUTTON_DIAMETER_PX / wheelDiameterPx;
  const buttonRadiusPct = 1 - buttonOwnRadiusPct - DISC_EDGE_GAP_PCT;

  /*
   * Each group occupies an exact even third of the circle (matching
   * the three dividers 120deg apart), and within that 120deg arc,
   * buttons are spaced so every gap is the same size - the arc-length
   * version of that: for n buttons there are (n+1) gaps (one before
   * the first button, one after each button including the last), so
   *   gap = (arc for one group - n * (one button's own arc width)) / (n + 1)
   * Done here in degrees rather than raw arc length/pixels since
   * that's what every other angle in this file is expressed in - a
   * button's own arc width in degrees is just its diameter divided by
   * its own radius (in the same units), converted from radians.
   */
  const wheelRadiusPx = wheelDiameterPx / 2;
  const buttonCenterRadiusPx = buttonRadiusPct * wheelRadiusPx;
  const buttonArcWidthDeg = (BUTTON_DIAMETER_PX / buttonCenterRadiusPx) * (180 / Math.PI);

  /*
   * Each divider <div> is rendered as one continuous element spanning
   * r=0 to r=DIVIDER_OUTER_RADIUS_PCT (see the translate/rotate
   * transform where it's used) - masking off its own innermost
   * segment is simpler than trying to reposition a shorter element
   * while still rotating correctly around the true center. This mask
   * fraction is what falls below the inner radius (a matching gap to
   * the center "untool" button's own outer edge, the same size as the
   * gap left between the outer end and the disc's true edge).
   */
  const dividerInnerRadiusPct = centerButtonRadiusPct + DIVIDER_EDGE_GAP_PCT;
  const dividerInnerMaskFraction = dividerInnerRadiusPct / DIVIDER_OUTER_RADIUS_PCT;
  const dividerMaskImage = `linear-gradient(to top, transparent 0%, transparent ${
    dividerInnerMaskFraction * 100
  }%, black ${dividerInnerMaskFraction * 100}%, black 100%)`;

  return { buttonRadiusPct, buttonArcWidthDeg, dividerMaskImage };
}

function normalizeAngle(angleDeg) {
  return ((angleDeg % 360) + 360) % 360;
}

/*
 * Fixed clockwise arrangement of every group around the wheel,
 * starting from the top seam (0deg/12 o'clock) - edit upper-right,
 * import bottom-right, transform bottom-left, draw upper-left,
 * wrapping back to edit. This is the one place that ordering is
 * defined; computeGroupArcsDeg/buildWheelLayout below just walk this
 * list in order, so adding, removing, or reordering a group only ever
 * means editing this array.
 */
const GROUP_ORDER = ["edit", "import", "transform", "draw"];

/*
 * Each group's own share of the circle is proportional to how many
 * tools it actually holds, not a fixed equal quarter - Brody's own
 * call, originally made back when there were only three groups: with
 * fixed equal thirds, the two-button transform group ended up with
 * visibly bigger gaps between (and around) its buttons than the
 * three-button draw/edit groups, since the same even-gap math
 * (buildWheelLayout below) was dividing the same-size arc among fewer
 * buttons. Sizing each group's arc to its own button count first
 * means every button everywhere on the wheel ends up spaced the same,
 * not just spaced evenly within its own group - and generalizing that
 * same idea to however many groups GROUP_ORDER lists (rather than
 * hardcoding three groups' worth of math, one of them a fixed 180deg
 * anchor) is what let a fourth group (import) join without rewriting
 * this function's actual approach, just its shape: walk
 * GROUP_ORDER in order, hand each group (arc count / total count) *
 * 360deg, and place it right after wherever the previous group left
 * off. Since every group's arc is defined this way, they always tile
 * the whole circle exactly with no gaps or overlaps, regardless of
 * how many groups there are or how their tool counts compare.
 */
function computeGroupArcsDeg(groupsByKey) {
  const counts = GROUP_ORDER.map((key) => groupsByKey[key]?.tools.length || 0);
  const totalCount = counts.reduce((sum, count) => sum + count, 0);

  if (totalCount === 0) {
    return { arcDeg: {}, centerDeg: {} };
  }

  const arcDeg = {};
  const centerDeg = {};

  let cursorDeg = 0;

  GROUP_ORDER.forEach((key, index) => {
    const groupArcDeg = (counts[index] / totalCount) * 360;

    arcDeg[key] = groupArcDeg;
    centerDeg[key] = cursorDeg + groupArcDeg / 2;

    cursorDeg += groupArcDeg;
  });

  return { arcDeg, centerDeg };
}

function buildWheelLayout(groups, buttonArcWidthDeg) {
  const slots = [];

  const groupsByKey = Object.fromEntries(groups.map((group) => [group.key, group]));
  const { arcDeg, centerDeg: groupCenterDeg } = computeGroupArcsDeg(groupsByKey);

  /*
   * One divider per group (not one per group minus one) - the wrap-
   * around seam between the LAST group in GROUP_ORDER and the first
   * (edit) is still a real divider, it just happens to land back at
   * 0deg, which is already the first entry here.
   */
  let dividerCursorDeg = 0;
  const dividerAngles = GROUP_ORDER.map((key) => {
    const boundaryDeg = dividerCursorDeg;
    dividerCursorDeg += arcDeg[key] || 0;
    return boundaryDeg;
  });

  for (const group of groups) {
    const n = group.tools.length;
    if (n === 0) continue;

    const centerDeg = groupCenterDeg[group.key];
    const groupArcDeg = arcDeg[group.key];

    /*
     * The gap on either outer edge of the group (divider to nearest
     * button) is half the gap between buttons, not the same size -
     * per Brody's own call: a divider sits at the boundary between
     * two groups, so an "outer" gap of the same size as an "inner"
     * one would visually double up there (one full gap contributed by
     * each of the two neighboring groups), making the gap at every
     * divider look twice as wide as the gaps between buttons within
     * a group. Halving the outer gaps means the two halves meeting at
     * a divider add up to exactly one full gap's worth, matching the
     * spacing everywhere else. n buttons have (n-1) inner gaps plus 2
     * half-size outer gaps, i.e. n gaps' worth of space in total.
     */
    const innerGapDeg = (groupArcDeg - n * buttonArcWidthDeg) / n;
    const outerGapDeg = innerGapDeg / 2;

    const angles = group.tools.map((_, index) => {
      const localCenter =
        -groupArcDeg / 2 +
        outerGapDeg +
        buttonArcWidthDeg / 2 +
        index * (buttonArcWidthDeg + innerGapDeg);

      return centerDeg + localCenter;
    });

    /*
     * Every group's own entries are normalized to an array here - most
     * groups only ever hold plain tool objects (one outer-ring spot
     * each), but DRAW_TOOLS' own entries are already [primary, alt]
     * pairs (see its own comment), so this is what lets both shapes
     * share the same spacing math above without that math needing to
     * know or care which kind of group it's laying out: `n` (and
     * hence every gap/angle) is still just "how many entries," not
     * "how many tools," regardless of whether some entries are pairs.
     */
    group.tools.forEach((entry, index) => {
      const tools = Array.isArray(entry) ? entry : [entry];
      slots.push({ tools, group, angleDeg: normalizeAngle(angles[index]) });
    });
  }

  return { slots, dividerAngles: dividerAngles.map(normalizeAngle) };
}

function polarOffset(angleDeg, radiusPct) {
  const rad = (angleDeg * Math.PI) / 180;

  return {
    x: `${(radiusPct * 50 * Math.sin(rad)).toFixed(3)}%`,
    y: `${(-radiusPct * 50 * Math.cos(rad)).toFixed(3)}%`,
  };
}

export default function GeometryToolWheel({
  geometryTool = null,
  setGeometryTool,
  geometryTypes,
  isMobile,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isTriggerHovered, setIsTriggerHovered] = useState(false);

  /*
   * .tool-wheel's own on-screen size is responsive (--wheel-size:
   * 92cqmin in the CSS, sized off the map panel's own dimensions), so
   * there's no static px value that's ever exactly right for the
   * button/divider radius math below - it has to be measured from the
   * real element once it's actually on the page. wheelRef gets
   * attached to .tool-wheel itself; measuredWheelPx starts at the
   * same fallback used for the very first paint (before the
   * ResizeObserver below has measured anything) and is corrected
   * immediately via useLayoutEffect's synchronous initial read, so
   * there's no visible flash of wrongly-positioned buttons.
   */
  const wheelRef = useRef(null);
  const [measuredWheelPx, setMeasuredWheelPx] = useState(DEFAULT_WHEEL_DIAMETER_PX);

  /*
   * Same hover-only custom tooltip pattern as SettingsToggle.jsx/
   * TrackLocationButton.jsx - suppressed on touch, where there's no
   * hover to trigger it in the first place.
   */
  useEffect(() => {
    if (isMobile && isTriggerHovered) {
      setIsTriggerHovered(false);
    }
  }, [isMobile, isTriggerHovered]);

  /*
   * The wheel overlay is portaled straight into .main-layer (the
   * app shell's persistent, position:relative map-panel frame - see
   * MainApp.css) rather than rendered inline where JSX nesting would
   * put it. It would otherwise land inside .tool-wheel-wrapper below,
   * which is itself position:absolute (and translateX'd) - the
   * nearest positioned ancestor for any position:absolute/fixed
   * descendant is whichever one is closest in the tree, not the
   * outermost one, so the overlay would size and center itself off
   * that small trigger-button box instead of the map panel: it would
   * render up near the trigger button's own spot, and every button's
   * percentage-based position inside the wheel (relative to a
   * container that's collapsed down near 0x0, since flexbox lets a
   * box with no in-flow content shrink well below its own explicit
   * width/height) would come out effectively identical, piling every
   * tool on top of the next instead of spreading them in a circle.
   * Portaling past the wrapper into .main-layer's own box sidesteps
   * that entirely and centers on exactly the visible map area, with
   * no hardcoded header-height offset to keep in sync.
   */
  const portalTarget = useMemo(
    () => document.querySelector(".main-layer") || document.body,
    [],
  );

  const allowedGeometryTypes = Array.isArray(geometryTypes) ? geometryTypes : [];

  /*
   * The single and Multi- tools in a pair are gated independently, not
   * coupled to each other - a schema can allow MultiPolygon without
   * allowing plain Polygon (a project with only multi-part boundaries,
   * say), so the primary (singular) tool is hidden outright when its
   * own type isn't allowed, rather than hiding the whole pair and
   * taking its still-allowed alt tool down with it. The alt tool
   * itself still only lights up (comingSoon: false) if the schema
   * separately opted into ITS OWN geometry type too (added via the
   * Schema Builder's own geometry type list, not on by default) -
   * otherwise it stays disabled even though the tool itself is fully
   * built, since drawing one would just be rejected by the server's
   * own validateGeometryPayload (shared/validation/dataValidation.js),
   * which checks the same schema.geometry.types allow-list.
   */
  const visibleDrawTools = DRAW_TOOLS.filter(
    (pair) =>
      allowedGeometryTypes.includes(pair[0].geometryType) ||
      (pair[1] && allowedGeometryTypes.includes(pair[1].geometryType)),
  ).map(([primaryTool, altTool]) => {
    const isPrimaryAllowed = allowedGeometryTypes.includes(primaryTool.geometryType);

    if (!altTool) {
      // No alt tool exists for this pair - the filter above already guarantees primary is allowed.
      return [primaryTool];
    }

    const isAltAllowed = allowedGeometryTypes.includes(altTool.geometryType);

    if (!isPrimaryAllowed) {
      // Primary type not allowed at all - only the alt (Multi-) tool can show, on its own slot.
      return [altTool];
    }

    return [
      primaryTool,
      isAltAllowed ? altTool : { ...altTool, comingSoon: true },
    ];
  });

  /*
   * Add Sub-Geometry/Remove Sub-Geometry only make sense at all if the
   * schema allows at least one Multi- type - with none allowed, there's
   * nothing for either tool to promote a single into, or remove a part
   * from (a Multi- item could never have been drawn or imported in the
   * first place). Locked the same way an alt draw tool is (comingSoon:
   * true) rather than removed outright, so the wheel's own layout
   * doesn't shift - it just reads as clearly unavailable.
   */
  const canUseSubgeometryTools = hasAnyMultiTypeAllowed(allowedGeometryTypes);

  const visibleEditTools = useMemo(
    () =>
      EDIT_TOOLS.map((entry) => {
        if (!Array.isArray(entry)) return entry;

        return entry.map((tool) =>
          (tool.key === "addSubgeometry" || tool.key === "removeSubgeometry") &&
          !canUseSubgeometryTools
            ? { ...tool, comingSoon: true }
            : tool,
        );
      }),
    [canUseSubgeometryTools],
  );

  const groups = useMemo(
    () => [
      { key: "draw", color: "var(--wheel-draw-color)", tools: visibleDrawTools },
      { key: "edit", color: "var(--wheel-edit-color)", tools: visibleEditTools },
      { key: "transform", color: "var(--wheel-transform-color)", tools: TRANSFORM_TOOLS },
      { key: "import", color: "var(--wheel-import-color)", tools: IMPORT_TOOLS },
    ],
    // visibleDrawTools/visibleEditTools are derived fresh each render from
    // geometryTypes, but only their keys/length/comingSoon flags ever
    // actually change - the schema-level geometryTypes array itself is the
    // real dependency here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geometryTypes],
  );

  /*
   * Only runs while the wheel is actually open (.tool-wheel doesn't
   * exist in the DOM otherwise, so there's nothing yet for wheelRef to
   * point at). useLayoutEffect rather than useEffect so the very
   * first measurement happens synchronously before the browser paints
   * the just-opened wheel - an ordinary useEffect would let one frame
   * render at the stale/default radius first, visible as a brief pop
   * of buttons jumping to their correct spot. The ResizeObserver on
   * top of that first read handles every later change in the wheel's
   * real size (window resize, orientation change) while it's still
   * open.
   */
  useLayoutEffect(() => {
    if (!isOpen) return undefined;

    const wheelEl = wheelRef.current;
    if (!wheelEl) return undefined;

    setMeasuredWheelPx(wheelEl.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setMeasuredWheelPx(entry.contentRect.width);
      }
    });
    observer.observe(wheelEl);

    return () => observer.disconnect();
  }, [isOpen]);

  const geometry = useMemo(() => computeGeometry(measuredWheelPx), [measuredWheelPx]);

  const { slots, dividerAngles } = useMemo(
    () => buildWheelLayout(groups, geometry.buttonArcWidthDeg),
    [groups, geometry.buttonArcWidthDeg],
  );

  const activeTool =
    [...visibleDrawTools.flat(), ...visibleEditTools.flat(), ...TRANSFORM_TOOLS, ...IMPORT_TOOLS].find(
      (tool) => tool.key === geometryTool,
    ) || null;

  const activeGroupColor =
    slots.find((slot) => slot.tools.some((tool) => tool.key === geometryTool))?.group.color ||
    null;

  /*
   * Escape closes the wheel without changing the current tool - same
   * "cancel, not deselect" behavior as clicking the (invisible, but
   * still click-catching) overlay outside the wheel.
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  function handleTriggerClick() {
    setIsOpen((open) => !open);
  }

  function handleUntool() {
    setGeometryTool?.(null);
    setIsOpen(false);
  }

  function handleDrawToolClick(toolKey) {
    /*
     * Not a toggle - carried over from the old GeometryToolbar, which
     * had no dedicated "no tool" button, so re-clicking the active
     * tool there was the only way to deselect it. This wheel has its
     * own center "untool" button for that (see handleUntool above),
     * so re-clicking an already-selected tool here just confirms that
     * choice and closes the menu, the same as clicking any other
     * still-selected tool - it doesn't mean "deselect."
     */
    setGeometryTool?.(toolKey);
    setIsOpen(false);
  }

  function handleEditToolClick(tool) {
    if (tool.comingSoon) return;

    /*
     * Deliberately not a toggle, unlike draw tools: Editor.jsx's
     * handleGeometryToolChange already treats re-selecting the same
     * edit tool while an item is being edited as a no-op (so it
     * doesn't reset the in-progress draft), so re-clicking the active
     * edit tool here should just leave it selected, not deselect it.
     */
    setGeometryTool?.(tool.key);
    setIsOpen(false);
  }

  function handleSlotClick(slot, tool) {
    if (tool.comingSoon) return;

    if (slot.group.key === "draw") {
      handleDrawToolClick(tool.key);
      return;
    }

    handleEditToolClick(tool);
  }

  return (
    <div className="tool-wheel-wrapper">
      <button
        type="button"
        className="tool-wheel-trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Tool menu"
        onClick={handleTriggerClick}
        onMouseEnter={!isMobile ? () => setIsTriggerHovered(true) : undefined}
        onMouseLeave={!isMobile ? () => setIsTriggerHovered(false) : undefined}
        style={activeGroupColor ? { "--wheel-trigger-accent": activeGroupColor } : undefined}
      >
        {activeTool ? activeTool.icon : <HandIcon />}
      </button>

      {!isMobile && isTriggerHovered && (
        <Tooltip text="Tool Menu" position="bottom-60-center" />
      )}

      {isOpen &&
        createPortal(
          <div className="tool-wheel-overlay" onClick={() => setIsOpen(false)}>
            <div
              ref={wheelRef}
              className="tool-wheel"
              role="menu"
              aria-label="Tool menu"
              onClick={(event) => event.stopPropagation()}
            >
              {dividerAngles.map((angleDeg) => (
                <div
                  key={angleDeg}
                  className="tool-wheel-divider"
                  style={{
                    height: `${DIVIDER_OUTER_RADIUS_PCT * 50}%`,
                    transform: `translate(-50%, -100%) rotate(${angleDeg}deg)`,
                    maskImage: geometry.dividerMaskImage,
                    WebkitMaskImage: geometry.dividerMaskImage,
                  }}
                />
              ))}

              {slots.map((slot) => {
                const [primaryTool, altTool] = slot.tools;

                /*
                 * Which way the icon pops on hover - straight outward
                 * along this button's own radial line (the same angle
                 * its position is already computed from), not a fixed
                 * direction shared by every button. A small fixed
                 * pixel distance (not a % of the wheel's radius, like
                 * its actual position) since this is meant to read as
                 * a subtle lift, not an actual change in position.
                 * Shared by both the primary button below and its alt
                 * (if any) - they sit on the same radial line, just at
                 * different radii, so the same outward direction is
                 * correct for both.
                 */
                const popRad = (slot.angleDeg * Math.PI) / 180;
                const popDistancePx = 3;
                const popX = `${(popDistancePx * Math.sin(popRad)).toFixed(2)}px`;
                const popY = `${(-popDistancePx * Math.cos(popRad)).toFixed(2)}px`;

                const isPrimaryActive =
                  !primaryTool.comingSoon && geometryTool === primaryTool.key;

                const primaryOffset = polarOffset(slot.angleDeg, geometry.buttonRadiusPct);

                return (
                  <Fragment key={primaryTool.key}>
                    <button
                      type="button"
                      className={`tool-wheel-button ${isPrimaryActive ? "active" : ""} ${
                        primaryTool.comingSoon ? "coming-soon" : ""
                      }`}
                      style={{
                        left: `calc(50% + ${primaryOffset.x})`,
                        top: `calc(50% + ${primaryOffset.y})`,
                        "--wheel-button-accent": slot.group.color,
                        "--wheel-pop-x": popX,
                        "--wheel-pop-y": popY,
                      }}
                      aria-label={primaryTool.ariaLabel}
                      aria-pressed={isPrimaryActive}
                      aria-disabled={primaryTool.comingSoon}
                      disabled={primaryTool.comingSoon}
                      title={primaryTool.tooltip}
                      data-tooltip={primaryTool.tooltip}
                      onClick={() => handleSlotClick(slot, primaryTool)}
                    >
                      {primaryTool.icon}
                    </button>

                    {altTool &&
                      (() => {
                        const isAltActive =
                          !altTool.comingSoon && geometryTool === altTool.key;

                        const altOffset = polarOffset(slot.angleDeg, ALT_BUTTON_RADIUS_PCT);

                        return (
                          <button
                            type="button"
                            className={`tool-wheel-button tool-wheel-alt-button ${
                              isAltActive ? "active" : ""
                            } ${altTool.comingSoon ? "coming-soon" : ""}`}
                            style={{
                              left: `calc(50% + ${altOffset.x})`,
                              top: `calc(50% + ${altOffset.y})`,
                              "--wheel-button-accent": slot.group.color,
                              "--wheel-pop-x": popX,
                              "--wheel-pop-y": popY,
                            }}
                            aria-label={altTool.ariaLabel}
                            aria-pressed={isAltActive}
                            aria-disabled={altTool.comingSoon}
                            disabled={altTool.comingSoon}
                            title={altTool.tooltip}
                            data-tooltip={altTool.tooltip}
                            onClick={() => handleSlotClick(slot, altTool)}
                          >
                            {altTool.icon}
                          </button>
                        );
                      })()}
                  </Fragment>
                );
              })}

              <button
                type="button"
                className="tool-wheel-center"
                aria-label="Deselect tool"
                title="Deselect tool"
                onClick={handleUntool}
              >
                <HandIcon />
              </button>
            </div>
          </div>,
          portalTarget,
        )}
    </div>
  );
}
