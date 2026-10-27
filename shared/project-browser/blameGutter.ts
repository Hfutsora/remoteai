import { EditorState, Prec, StateField, type Text } from '@codemirror/state';
import { Chunk } from '@codemirror/merge';
import { gutter, GutterMarker } from '@codemirror/view';
import type { ProjectBlame, ProjectBlameCommit } from './protocol';
import './blameGutter.css';

const DIFF_OPTIONS = { scanLimit: 500, timeout: 50 };

/** Only unchanged complete lines inherit an author; ambiguous diff spans remain uncommitted. */
export function originalBlameLine(source: Text, chunks: readonly Chunk[], position: number): number | null {
  let offset = 0;
  for (const chunk of chunks) {
    if (chunk.fromB > position) break;
    if (chunk.toB > position) return null;
    offset = chunk.toA - chunk.toB;
  }
  const original = position + offset;
  return original < 0 || original > source.length ? null : source.lineAt(original).number;
}

export function blameCommitAt(blame: ProjectBlame, line: number | null) {
  if (line === null) return undefined;
  let low = 0, high = blame.ranges.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (blame.ranges[middle].start <= line) low = middle + 1;
    else high = middle;
  }
  const range = blame.ranges[low - 1];
  return range && line < range.start + range.count && range.commit !== null
    ? blame.commits[range.commit] : undefined;
}

function commitDate(commit: ProjectBlameCommit) {
  const zone = /^([+-])(\d{2})(\d{2})$/.exec(commit.timezone);
  const offset = zone ? (Number(zone[2]) * 60 + Number(zone[3])) * (zone[1] === '-' ? -1 : 1) : 0;
  const date = new Date((commit.time + offset * 60) * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
}

class BlameMarker extends GutterMarker {
  constructor(private commit: ProjectBlameCommit | undefined, private uncommitted: string) { super(); }
  eq(other: BlameMarker) { return this.commit === other.commit && this.uncommitted === other.uncommitted; }
  toDOM() {
    const element = document.createElement('span');
    element.className = 'pf-blame-label';
    const date = this.commit ? commitDate(this.commit) : '';
    const text = this.commit ? `${date}  ${this.commit.author}` : this.uncommitted;
    const label = document.createElement('span');
    label.className = 'pf-blame-text'; label.textContent = text;
    element.append(label);
    element.dataset.commit = this.commit?.hash ?? '';
    const tooltip = document.createElement('span');
    tooltip.className = 'pf-blame-tooltip';
    tooltip.textContent = this.commit ? `${text}\n${this.commit.hash.slice(0, 12)}\n${this.commit.summary}` : text;
    element.append(tooltip);
    element.addEventListener('mouseenter', event => {
      tooltip.style.display = 'block';
      const bounds = tooltip.getBoundingClientRect();
      tooltip.style.left = `${Math.max(8, Math.min(event.clientX, innerWidth - bounds.width - 8))}px`;
      tooltip.style.top = `${Math.max(8, Math.min(event.clientY + 20, innerHeight - bounds.height - 8))}px`;
    });
    element.addEventListener('mouseleave', () => { tooltip.style.display = ''; });
    return element;
  }
}

export function blameGutter(blame: ProjectBlame, baseline: string, uncommitted: string) {
  const source = EditorState.create({ doc: baseline }).doc;
  const chunks = StateField.define({
    create: state => Chunk.build(source, state.doc, DIFF_OPTIONS),
    update: (value, transaction) => transaction.docChanged
      ? Chunk.updateB(value, source, transaction.state.doc, transaction.changes, DIFF_OPTIONS) : value,
  });
  const column = gutter({
    class: 'pf-blame-gutter',
    lineMarker: (view, line) => {
      const current = view.state.doc.lineAt(line.from);
      // Git has no annotation for the extra editor row after a final newline.
      if (current.number === view.state.doc.lines && !current.length) return null;
      const original = originalBlameLine(source, view.state.field(chunks), line.from);
      return new BlameMarker(blameCommitAt(blame, original), uncommitted);
    },
    lineMarkerChange: update => update.docChanged,
  });
  return [chunks, Prec.high(column)];
}
