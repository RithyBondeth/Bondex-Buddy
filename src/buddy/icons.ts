const paths: Record<string, string> = {
  focus: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2M9 2h6"/>',
  clipboard:
    '<rect x="5" y="4" width="14" height="17" rx="3"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 11h6m-6 4h4"/>',
  agents:
    '<rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4M8 12h.01M16 12h.01M9 16h6"/>',
  style: '<path d="m8 4 4 3 4-3 5 5-4 3v8H7v-8L3 9Z"/>',
  close: '<path d="m7 7 10 10M17 7 7 17"/>',
  pocket: '<path d="M5 6h14v8a7 7 0 0 1-14 0Z"/><path d="m5 10 7 4 7-4"/>',
};

export function icon(name: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = paths[name] ?? paths.pocket;
  return svg;
}
