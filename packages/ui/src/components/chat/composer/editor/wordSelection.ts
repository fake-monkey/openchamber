import { EditorSelection, findClusterBreak, type EditorState } from '@codemirror/state';
import type { EditorView, ViewUpdate } from '@codemirror/view';

/**
 * Classifies one character for double-click word selection.
 *
 * CodeMirror's default classifier treats every `\p{Alphabetic}` code point as
 * one "word" class, so Latin and CJK merge and a double-click on
 * "检查openchamber的配置" selects the whole run. Distinct classes per script
 * make the double-click stop at each script boundary. Classes are only
 * compared for equality, so the numbers are arbitrary.
 */
function wordClass(char: string): number {
    if (/\s/.test(char)) return 0;
    if (/\p{Script=Han}/u.test(char)) return 1;
    if (/[A-Za-z0-9_]/.test(char)) return 2;
    if (/[\p{L}\p{N}]/u.test(char)) return 3;
    return 4;
}

/**
 * The maximal run of same-class characters around `pos`, mirroring
 * CodeMirror's double-click grouping but split at script boundaries. Returns
 * document positions, or null when the line is empty.
 */
export function wordRangeAt(
    state: EditorState,
    pos: number,
    bias: -1 | 1 = 1,
): { from: number; to: number } | null {
    const line = state.doc.lineAt(pos);
    const text = line.text;
    if (text.length === 0) return null;

    const linePos = pos - line.from;
    if (linePos === 0) bias = 1;
    else if (linePos === text.length) bias = -1;

    let from = linePos;
    let to = linePos;
    if (bias < 0) from = findClusterBreak(text, linePos, false);
    else to = findClusterBreak(text, linePos);

    const cls = wordClass(text.slice(from, to));
    while (from > 0) {
        const prev = findClusterBreak(text, from, false);
        if (wordClass(text.slice(prev, from)) !== cls) break;
        from = prev;
    }
    while (to < text.length) {
        const next = findClusterBreak(text, to);
        if (wordClass(text.slice(to, next)) !== cls) break;
        to = next;
    }
    return { from: from + line.from, to: to + line.from };
}

/**
 * A `mouseSelectionStyle` that overrides only double-click word selection.
 * Single and triple clicks fall through to CodeMirror's default handling.
 */
export function scriptAwareMouseSelection(
    view: EditorView,
    event: MouseEvent,
): {
    get: (event: MouseEvent, extend: boolean, multiple: boolean) => EditorSelection;
    update: (update: ViewUpdate) => void;
} | null {
    if (event.detail !== 2) return null;

    const start = view.posAndSideAtCoords({ x: event.clientX, y: event.clientY }, false);
    let startSel = view.state.selection;

    return {
        update(update) {
            if (!update.docChanged) return;
            start.pos = update.changes.mapPos(start.pos);
            startSel = startSel.map(update.changes);
        },
        get(event, extend, multiple) {
            const cur = view.posAndSideAtCoords({ x: event.clientX, y: event.clientY }, false);
            const clicked = wordRangeAt(view.state, cur.pos, cur.assoc);
            let range = clicked
                ? EditorSelection.undirectionalRange(clicked.from, clicked.to)
                : EditorSelection.cursor(cur.pos, cur.assoc);

            if (start.pos !== cur.pos && !extend) {
                const startRange = wordRangeAt(view.state, start.pos, start.assoc);
                const startRangeSel = startRange
                    ? EditorSelection.undirectionalRange(startRange.from, startRange.to)
                    : EditorSelection.cursor(start.pos, start.assoc);
                const from = Math.min(startRangeSel.from, range.from);
                const to = Math.max(startRangeSel.to, range.to);
                range = from < range.from
                    ? EditorSelection.range(from, to, range.assoc)
                    : EditorSelection.range(to, from, range.assoc);
            }

            if (extend) return startSel.replaceRange(startSel.main.extend(range.from, range.to, range.assoc));
            if (multiple) return startSel.addRange(range);
            return EditorSelection.create([range]);
        },
    };
}
