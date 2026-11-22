const paths: Record<string, string> = {
  focus:
    'M6 1h4v2H6zM5 4h6v1h2v2h1v5h-1v2h-2v1H5v-1H3v-2H2V7h1V5h2zm0 2v2H4v3h1v2h6v-2h1V8h-1V6zM7 7h2v3h2v2H7z',
  clipboard:
    'M5 1h6v2h3v12H2V3h3zm0 4H4v8h8V5h-1v1H5zm2-2v1h2V3zM6 8h4v1H6zm0 2h3v1H6z',
  agents:
    'M7 1h2v4h4v2h2v6h-2v2H3v-2H1V7h2V5h4zM3 8v4h2v1h6v-1h2V8h-2V7H5v1zm2 1h2v2H5zm4 0h2v2H9z',
  style: 'M4 2h2v2h4V2h2v2h2v2h2v3h-4v6H4V9H0V6h2V4h2zm0 4v1h2v6h4V7h2V6z',
  close:
    'M3 3h2v2h2v2h2V5h2V3h2v2h-2v2H9v2h2v2h2v2h-2v-2H9V9H7v2H5v2H3v-2h2V9h2V7H5V5H3z',
  pocket:
    'M1 2h14v9h-2v2h-2v2H5v-2H3v-2H1zm2 2v2h2v2h2v1h2V8h2V6h2V4zm10 4h-2v2H9v1H7v-1H5V8H3v2h2v2h2v1h2v-1h2v-2h2z',
  heart: 'M0 4h2V2h4v2h4V2h4v2h2v4h-2v2h-2v2h-2v2H6v-2H4v-2H2V8H0z',
  water:
    'M7 1h2v2h1v2h1v2h1v2h1v4h-1v1h-2v1H6v-1H4v-1H3V9h1V7h1V5h1V3h1zm-2 9v2h2v-1H6v-1z',
};

export function icon(name: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', paths[name] ?? paths.pocket);
  path.setAttribute('fill-rule', 'evenodd');
  svg.append(path);
  return svg;
}
