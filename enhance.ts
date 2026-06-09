/**
 * Shared SVG enhancement for Mermaid diagrams.
 * Injects Fabric item icons, gradient fills, drop shadows, and styled edges.
 *
 * Adapted from microsoft/fabric-jumpstart (MIT license).
 * This file runs inside a Puppeteer page context — it uses the DOM API.
 */

declare const itemIcons: Record<string, string>;
declare const itemDisplayNames: Record<string, string>;

/** Case-insensitive lookup map: lowercase key → original key. */
function buildCiIndex(map: Record<string, unknown>): Map<string, string> {
  const index = new Map<string, string>();
  for (const key of Object.keys(map)) index.set(key.toLowerCase(), key);
  return index;
}

const ciIcons = buildCiIndex(itemIcons);
const ciDisplayNames = buildCiIndex(itemDisplayNames);

/** Case-insensitive lookup. Tries exact match first, then lowercase. */
function ciGet<T>(map: Record<string, T>, ci: Map<string, string>, key: string): T | undefined {
  return map[key] ?? map[ci.get(key.toLowerCase()) ?? ''];
}

interface NodeInfo {
  nodeId: string;
  label: string;
  itemType: string;
  itemIcon: string | null;
  emoji: string | null;
}

// Consistent Fabric-themed node styling
const NODE_STROKE = { dark: 'rgba(255,255,255,0.25)', light: 'rgba(0,0,0,0.18)' };
const NODE_FILL_RGB = { dark: '255,255,255', light: '0,0,0' };

const UNICODE_CP_RE = /^U([0-9A-Fa-f]{4,6})$/;
const EMOJI_RE = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u;

function extractNodeInfo(chart: string): Map<string, NodeInfo> {
  const nodes = new Map<string, NodeInfo>();
  const regex = /([A-Za-z_]\w*)\[([^\]]*)\]:::([^\s;]+)/g;

  let m: RegExpExecArray | null;
  while ((m = regex.exec(chart)) !== null) {
    const [, nodeId, label, itemType] = m;
    const itemIcon = ciGet(itemIcons, ciIcons, itemType) || null;
    if (itemIcon) {
      nodes.set(nodeId, { nodeId, label: label.trim(), itemType, itemIcon, emoji: null });
    } else {
      let emoji: string | null = null;
      const cpMatch = itemType.match(UNICODE_CP_RE);
      if (cpMatch) {
        emoji = String.fromCodePoint(parseInt(cpMatch[1], 16));
      } else {
        const emojiMatch = itemType.match(EMOJI_RE);
        emoji = emojiMatch ? emojiMatch[0] : null;
      }
      nodes.set(nodeId, { nodeId, label: label.trim(), itemType, itemIcon: null, emoji });
    }
  }
  return nodes;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export interface EnhanceOptions {
  /** Icon size in px (default 32). */
  iconSize?: number;
  /** Show item-type label below each node (default true). */
  showSubtitles?: boolean;
  /** Expand SVG viewBox to prevent clipping (default true). */
  expandViewBox?: boolean;
}

/**
 * Post-process a Mermaid SVG in the real DOM.
 * Must be called after mounting (requires getBBox).
 */
export function enhanceDiagram(
  root: SVGSVGElement,
  chart: string,
  isDark: boolean,
  opts: EnhanceOptions = {},
): void {
  const { iconSize: ICON = 32, showSubtitles = true, expandViewBox = true } = opts;
  const nodeMap = extractNodeInfo(chart);
  if (nodeMap.size === 0) return;

  let defs = root.querySelector('defs');
  if (!defs) {
    defs = svgEl('defs', {}) as SVGDefsElement;
    root.insertBefore(defs, root.firstChild);
  }

  // Move marker elements into <defs> so marker-end references resolve correctly
  root.querySelectorAll(':scope > g > marker, :scope > marker').forEach(m => {
    defs!.appendChild(m);
  });

  // Drop-shadow filter
  const SH = 'mermaid-node-shadow';
  if (!defs.querySelector(`#${SH}`)) {
    const f = svgEl('filter', { id: SH, x: '-20%', y: '-20%', width: '150%', height: '160%' });
    f.appendChild(svgEl('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: '4', result: 'blur' }));
    f.appendChild(svgEl('feOffset', { in: 'blur', dx: '0', dy: '3', result: 'shifted' }));
    f.appendChild(svgEl('feFlood', {
      'flood-color': '#000',
      'flood-opacity': isDark ? '0.45' : '0.12',
      result: 'color',
    }));
    f.appendChild(svgEl('feComposite', { in: 'color', in2: 'shifted', operator: 'in', result: 'shadow' }));
    const mg = svgEl('feMerge', {});
    mg.appendChild(svgEl('feMergeNode', { in: 'shadow' }));
    mg.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
    f.appendChild(mg);
    defs.appendChild(f);
  }

  let gi = 0;
  const PAD = Math.round(ICON * 0.46) + 2;
  const EXTRA_W = ICON + PAD + 2;
  const EXTRA_H = 4;
  const TYPE_COLOR = isDark ? 'rgba(180,190,200,0.7)' : 'rgba(80,90,100,0.75)';

  for (const g of root.querySelectorAll('g.node')) {
    const gId = g.getAttribute('id') ?? '';
    const idMatch = gId.match(/flowchart-(.+)-\d+$/);
    const info = idMatch ? nodeMap.get(idMatch[1]) : undefined;
    if (!info) continue;

    const label = info.label;
    const sp = g.querySelector('span.nodeLabel, span');
    const rgb = NODE_FILL_RGB[isDark ? 'dark' : 'light'];

    const shape = g.querySelector('rect, polygon') as SVGGraphicsElement | null;
    if (!shape) continue;

    // Gradient fill
    const gid = `wl-g-${gi++}`;
    const gr = svgEl('linearGradient', { id: gid, x1: '0', y1: '0', x2: '0', y2: '1' });
    const s1 = svgEl('stop', { offset: '0%' });
    const s2 = svgEl('stop', { offset: '100%' });
    s1.setAttribute('stop-color', `rgba(${rgb},${isDark ? 0.12 : 0.06})`);
    s2.setAttribute('stop-color', `rgba(${rgb},${isDark ? 0.04 : 0.02})`);
    gr.appendChild(s1);
    gr.appendChild(s2);
    defs.appendChild(gr);

    shape.setAttribute('fill', `url(#${gid})`);
    shape.setAttribute('stroke', NODE_STROKE[isDark ? 'dark' : 'light']);
    shape.setAttribute('stroke-width', '2');
    shape.setAttribute('rx', '6');
    shape.setAttribute('ry', '6');
    shape.style.filter = `url(#${SH})`;

    const box = shape.getBBox();

    const hasVisual = !!(info.emoji || info.itemIcon);
    const extraW = hasVisual ? EXTRA_W : 0;

    // Widen for icon
    if (extraW > 0) {
      shape.setAttribute('width', String(box.width + extraW));
      shape.setAttribute('x', String(box.x - extraW / 2));
    }
    if (showSubtitles) {
      shape.setAttribute('height', String(box.height + EXTRA_H));
      shape.setAttribute('y', String(box.y - EXTRA_H / 2));
    }

    // Icon — vertically centered
    const nodeH = showSubtitles ? box.height + EXTRA_H : box.height;
    const nodeY = showSubtitles ? box.y - EXTRA_H / 2 : box.y;
    const cx = box.x - extraW / 2 + PAD + ICON / 2;
    const cy = nodeY + nodeH / 2;
    if (info.emoji) {
      const emojiEl = document.createElementNS(SVG_NS, 'text');
      emojiEl.setAttribute('x', String(cx));
      emojiEl.setAttribute('y', String(cy));
      emojiEl.setAttribute('text-anchor', 'middle');
      emojiEl.setAttribute('dominant-baseline', 'central');
      emojiEl.setAttribute('font-size', String(ICON - 4));
      emojiEl.textContent = info.emoji;
      g.appendChild(emojiEl);
    } else if (info.itemIcon) {
      g.appendChild(svgEl('image', {
        href: info.itemIcon,
        width: String(ICON), height: String(ICON),
        x: String(cx - ICON / 2), y: String(cy - ICON / 2),
      }));
    }

    // Replace label layout
    const labelGrp = g.querySelector('g.label');
    const fo = labelGrp?.querySelector('foreignObject');
    if (fo && sp) {
      const nodeLeft = box.x - extraW / 2;
      const nodeRight = nodeLeft + box.width + extraW;
      const textLeftX = hasVisual ? cx + ICON / 2 + 12 : nodeLeft + 10;
      const textWidth = nodeRight - textLeftX - 2;

      const showType = showSubtitles && !info.emoji && !!info.itemIcon;
      const typeName = showType
        ? (ciGet(itemDisplayNames, ciDisplayNames, info.itemType) ?? info.itemType)
        : '';

      fo.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="
        display:flex;flex-direction:column;justify-content:center;
        height:100%;width:100%;padding:0 4px;box-sizing:border-box;
        text-align:left;
      ">
        <div style="font-family:Consolas,'Courier New',monospace;font-weight:600;font-size:14px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${isDark ? '#e0e0e0' : '#242424'}">${label}</div>
        ${showType ? `<div style="font-weight:500;font-size:11px;line-height:1.2;color:${TYPE_COLOR}">${typeName}</div>` : ''}
      </div>`;

      fo.setAttribute('width', String(textWidth));
      fo.setAttribute('height', String(nodeH));
      fo.setAttribute('x', '0');
      fo.setAttribute('y', '0');
      labelGrp!.setAttribute('transform', `translate(${textLeftX},${nodeY})`);
    } else if (labelGrp) {
      const tf = labelGrp.getAttribute('transform') || '';
      const tm = /translate\(\s*([^,)]+)[,\s]+([^)]*)\)/.exec(tf);
      if (tm) {
        labelGrp.setAttribute('transform',
          `translate(${parseFloat(tm[1]) + extraW / 2},${parseFloat(tm[2] || '0')})`);
      }
    }

    if (sp) {
      (sp as HTMLElement).style.fontWeight = '600';
      (sp as HTMLElement).style.fontSize = '13px';
    }
  }

  // Trim edge paths so endpoints reach widened node boundaries
  const HALF_W = EXTRA_W / 2;
  const HALF_H = EXTRA_H / 2;
  root.querySelectorAll('.edgePaths path, .edgePath path').forEach(p => {
    const el = p as SVGPathElement;
    const totalLen = el.getTotalLength();
    if (totalLen <= EXTRA_W) return;

    function trimForEndpoint(dx: number, dy: number): number {
      const adx = Math.abs(dx), ady = Math.abs(dy);
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return 0;
      if (adx >= ady) {
        return HALF_W / (adx / len);
      } else {
        return HALF_H / (ady / len);
      }
    }

    const p0 = el.getPointAtLength(0);
    const p0n = el.getPointAtLength(Math.min(2, totalLen));
    const trimStart = trimForEndpoint(p0n.x - p0.x, p0n.y - p0.y);

    const pe = el.getPointAtLength(totalLen);
    const pe1 = el.getPointAtLength(Math.max(0, totalLen - 2));
    const trimEnd = trimForEndpoint(pe.x - pe1.x, pe.y - pe1.y);

    const startAt = Math.min(trimStart, totalLen * 0.4);
    const endAt = Math.max(totalLen - trimEnd, totalLen * 0.6);
    if (startAt >= endAt) return;

    const span = endAt - startAt;
    const steps = Math.max(24, Math.round(span / 4));
    let newD = '';
    for (let i = 0; i <= steps; i++) {
      const t = startAt + (i / steps) * span;
      const pt = el.getPointAtLength(t);
      newD += (i === 0 ? 'M' : 'L') + pt.x.toFixed(2) + ',' + pt.y.toFixed(2);
    }
    el.setAttribute('d', newD);
  });

  // Edge styling
  const ec = isDark ? 'rgba(106,164,188,0.55)' : 'rgba(33,149,128,0.45)';
  const arrowColor = isDark ? 'rgba(106,164,188,0.8)' : 'rgba(33,149,128,0.7)';
  root.querySelectorAll('.edgePaths path, .edgePath path').forEach(p => {
    const el = p as SVGElement;
    const isDotted = el.classList.contains('edge-pattern-dotted');
    const isThick = el.classList.contains('edge-thickness-thick');
    el.style.stroke = ec;
    el.style.strokeWidth = isThick ? '3.5px' : '2.5px';
    el.style.strokeLinecap = 'round';
    if (isDotted) {
      el.style.strokeDasharray = '8,5';
    }
  });
  root.querySelectorAll('marker').forEach(m => {
    const marker = m as SVGMarkerElement;
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    if (marker.id.includes('pointEnd')) {
      marker.setAttribute('refX', '6');
      marker.setAttribute('refY', '5');
    }
  });
  root.querySelectorAll('marker path, .arrowheadPath').forEach(p => {
    (p as SVGElement).style.fill = arrowColor;
  });
  root.querySelectorAll('.edgeLabel').forEach(edgeLbl => {
    const t = edgeLbl.querySelector('text, span');
    if (t) {
      (t as HTMLElement).style.fontSize = '11px';
      (t as HTMLElement).style.fontWeight = '500';
    }
  });

  // ── Subgraph / cluster styling ──────────────────────────────────────
  interface SubgraphInfo { title: string; itemType: string | null; }
  const subgraphMap = new Map<string, SubgraphInfo>();
  const sgRegex = /subgraph\s+(.+)/g;
  let sgMatch: RegExpExecArray | null;
  while ((sgMatch = sgRegex.exec(chart)) !== null) {
    const raw = sgMatch[1].trim();
    // Handle: subgraph ID[Label]:::Class
    const bracketClassMatch = raw.match(/^(\w+)\[([^\]]*)\]:::(\w+)$/);
    if (bracketClassMatch) {
      const [, id, label, itemType] = bracketClassMatch;
      const displayTitle = label.trim() || id;
      const info: SubgraphInfo = { title: displayTitle, itemType };
      subgraphMap.set(id.toLowerCase(), info);
      if (label.trim()) subgraphMap.set(label.trim().toLowerCase(), info);
    } else {
      // Handle: subgraph ID:::Class  or  subgraph Title
      const typeMatch = raw.match(/^(.+?):::(\w+)$/);
      if (typeMatch) {
        const title = typeMatch[1].trim();
        subgraphMap.set(title.toLowerCase(), { title, itemType: typeMatch[2] });
      } else {
        // Handle: subgraph ID[Label]
        const bracketMatch = raw.match(/^(\w+)\[([^\]]*)\]$/);
        if (bracketMatch) {
          const [, id, label] = bracketMatch;
          const displayTitle = label.trim() || id;
          const info: SubgraphInfo = { title: displayTitle, itemType: null };
          subgraphMap.set(id.toLowerCase(), info);
          if (label.trim()) subgraphMap.set(label.trim().toLowerCase(), info);
        } else {
          subgraphMap.set(raw.toLowerCase(), { title: raw, itemType: null });
        }
      }
    }
  }

  const SG_ICON = 26;
  const SG_HEADER_H = 54;

  // Determine nesting depth of each subgraph from the source chart.
  // Parse subgraph open/close to figure out which are parents.
  const sgNestDepth = new Map<string, number>();
  {
    let depth = 0;
    const lines = chart.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'end') {
        depth--;
      } else {
        const sgLine = trimmed.match(/^subgraph\s+(.+)/);
        if (sgLine) {
          const raw = sgLine[1].trim();
          const typeM = raw.match(/^(.+?):::(\w+)$/);
          const name = typeM ? typeM[1].trim() : raw;
          sgNestDepth.set(name.toLowerCase(), depth);
          depth++;
        }
      }
    }
  }

  // All g.cluster elements are siblings in Mermaid's output (not DOM-nested).
  const clusters = Array.from(root.querySelectorAll('g.cluster'));

  // Two-pass approach:
  // Pass 1: Clear labels, style rects, expand rects upward for header space.
  // Pass 2: Position labels above expanded rects.
  interface ClusterWork {
    clusterG: Element;
    sgInfo: SubgraphInfo | undefined;
    isCapacity: boolean;
    rectEl: SVGRectElement;
    labelG: SVGGElement | null;
  }
  const work: ClusterWork[] = [];

  // Pass 1: expand rects
  clusters.forEach((clusterG) => {
    // Get the direct rect child (not rects in nested clusters)
    const allRects = clusterG.querySelectorAll('rect');
    let rectEl: SVGRectElement | null = null;
    for (let i = 0; i < allRects.length; i++) {
      if (allRects[i].parentElement === clusterG) {
        rectEl = allRects[i] as SVGRectElement;
        break;
      }
    }
    if (!rectEl) return;

    // Match cluster to subgraph definition by its label text or ID
    let sgInfo: SubgraphInfo | undefined;
    const labelEl = clusterG.querySelector('.cluster-label span, .cluster-label text, .cluster-label foreignObject');
    const labelText = labelEl?.textContent?.trim() ?? '';
    if (labelText) {
      sgInfo = subgraphMap.get(labelText.toLowerCase());
    }
    // Fallback: try matching from cluster ID
    if (!sgInfo) {
      const clusterId = clusterG.getAttribute('id') ?? '';
      for (const [key, info] of subgraphMap) {
        if (clusterId.toLowerCase().includes(key)) {
          sgInfo = info;
          break;
        }
      }
    }

    // Clear label content BEFORE measuring (so it doesn't affect bbox)
    let labelG: SVGGElement | null = null;
    const allLabelGs = clusterG.querySelectorAll('.cluster-label');
    for (let i = 0; i < allLabelGs.length; i++) {
      if (allLabelGs[i].parentElement === clusterG) {
        labelG = allLabelGs[i] as SVGGElement;
        break;
      }
    }
    if (labelG) labelG.innerHTML = '';

    rectEl.setAttribute('rx', '10');
    rectEl.setAttribute('ry', '10');
    rectEl.removeAttribute('stroke-dasharray');

    const isCapacity = sgInfo?.itemType?.toLowerCase() === 'capacity';
    const isDomain = sgInfo?.itemType?.toLowerCase() === 'domain';

    let sgStrokeStyle: string;
    if (isCapacity) {
      const sgFill = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)';
      const sgStroke = isDark ? 'rgba(140,180,220,0.35)' : 'rgba(0,80,120,0.20)';
      sgStrokeStyle = `fill:${sgFill};stroke:${sgStroke};stroke-width:2px;stroke-dasharray:8,4`;
    } else if (isDomain) {
      const sgFill = isDark ? 'rgba(180,140,255,0.04)' : 'rgba(100,40,180,0.02)';
      const sgStroke = isDark ? 'rgba(180,140,255,0.40)' : 'rgba(100,40,180,0.25)';
      sgStrokeStyle = `fill:${sgFill};stroke:${sgStroke};stroke-width:2px`;
    } else {
      const sgFill = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.025)';
      const sgStroke = isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.12)';
      sgStrokeStyle = `fill:${sgFill};stroke:${sgStroke};stroke-width:1.5px`;
    }
    rectEl.style.cssText = sgStrokeStyle;

    // Use the rect's original bbox (Mermaid-computed dimensions)
    const box = rectEl.getBBox();

    // Determine how much header space this cluster needs.
    // Parent clusters (depth 0) need extra offset to clear nested cluster headers.
    const sgName = sgInfo?.title?.toLowerCase() ?? '';
    const nestDepth = sgNestDepth.get(sgName) ?? 0;
    // Each nesting level below adds SG_HEADER_H, so parents need extra offset
    // to not overlap with child headers that also expand upward.
    const maxDepth = Math.max(...Array.from(sgNestDepth.values()), 0);
    const levelsBelow = maxDepth - nestDepth;
    const headerOffset = SG_HEADER_H + (levelsBelow * SG_HEADER_H);

    // Expand rect to cover content + header
    rectEl.setAttribute('y', String(box.y - headerOffset));
    rectEl.setAttribute('height', String(box.height + headerOffset));

    work.push({ clusterG, sgInfo, isCapacity, rectEl, labelG });
  });

  // Pass 2: position labels (rects are now final)
  work.forEach(({ clusterG, sgInfo, isCapacity, rectEl, labelG }) => {
    if (!labelG) return;

    const sgTitle = sgInfo?.title ?? '';
    const sgType = sgInfo?.itemType ?? null;

    const iconUri = sgType ? (ciGet(itemIcons, ciIcons, sgType) ?? null) : null;
    const typeName = sgType
      ? (ciGet(itemDisplayNames, ciDisplayNames, sgType) ?? sgType)
      : '';

    // Read the final rect position
    const rx = parseFloat(rectEl.getAttribute('x') || '0');
    const ry = parseFloat(rectEl.getAttribute('y') || '0');
    const rw = parseFloat(rectEl.getAttribute('width') || '0');

    const labelX = rx + 16;
    const labelY = ry;

    labelG.setAttribute('transform', `translate(${labelX},${labelY})`);

    const iconY = Math.round((SG_HEADER_H - SG_ICON) / 2);
    if (iconUri) {
      labelG.appendChild(svgEl('image', {
        href: iconUri,
        width: String(SG_ICON), height: String(SG_ICON),
        x: '0', y: String(iconY),
      }));
    }

    const textLeftX = iconUri ? SG_ICON + 10 : 0;
    const fo = document.createElementNS(SVG_NS, 'foreignObject');
    fo.setAttribute('x', String(textLeftX));
    fo.setAttribute('y', '0');
    fo.setAttribute('width', String(rw - 32 - textLeftX));
    fo.setAttribute('height', String(SG_HEADER_H));

    const titleColor = isDark ? '#e0e0e0' : '#242424';
    const typeHtml = sgType && typeName
      ? `<div style="font-weight:500;font-size:11px;line-height:1;color:${TYPE_COLOR};margin-top:-1px">${typeName}</div>`
      : '';

    fo.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="
      display:flex;flex-direction:column;justify-content:center;
      height:100%;width:100%;box-sizing:border-box;
      text-align:left;
    ">
      <div style="font-family:Consolas,'Courier New',monospace;font-weight:600;font-size:14px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${titleColor}">${sgTitle}</div>
      ${typeHtml}
    </div>`;
    labelG.appendChild(fo);

    // Horizontal divider
    const lineY = SG_HEADER_H;
    labelG.appendChild(svgEl('line', {
      x1: String(-16),
      y1: String(lineY),
      x2: String(rw - 16),
      y2: String(lineY),
      stroke: isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.10)',
      'stroke-width': '1',
    }));
  });

  // Expand viewBox
  const maxNestDepth = sgNestDepth.size > 0 ? Math.max(...Array.from(sgNestDepth.values())) : 0;
  const sgExtra = subgraphMap.size > 0 ? SG_HEADER_H * (maxNestDepth + 1) : 0;
  if (expandViewBox) {
    const vb = root.getAttribute('viewBox');
    if (vb) {
      const p = vb.split(' ').map(Number);
      if (p.length === 4) {
        root.setAttribute('viewBox', `${p[0] - 8} ${p[1] - 8 - sgExtra} ${p[2] + 16} ${p[3] + 20 + sgExtra}`);
      }
    }
  }
}
