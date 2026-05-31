/* ============================================================
   SPINZY — ICON SET (line icons, 24x24, currentColor)
   ============================================================ */
function Icon({ d, size = 22, stroke = 1.9, fill = 'none', children, vb = 24, style }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill={fill}
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={style} aria-hidden="true">
      {d ? <path d={d} /> : children}
    </svg>
  );
}

const I = {
  home:    (p) => <Icon {...p} children={<><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/></>} />,
  path:    (p) => <Icon {...p} children={<><circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8.4 6H14a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3H10a3 3 0 0 0-3 3v0"/></>} />,
  tutor:   (p) => <Icon {...p} children={<><path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3.5V16H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/><circle cx="9" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="13" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="17" cy="10.5" r="1" fill="currentColor" stroke="none"/></>} />,
  tests:   (p) => <Icon {...p} children={<><path d="M7 3h7l5 5v13a0 0 0 0 1 0 0H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M13 3v5h5"/><path d="M9 13l1.5 1.5L13 12"/><path d="M16 17H9"/></>} />,
  progress:(p) => <Icon {...p} children={<><path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16l4-5 3 3 5-7"/></>} />,
  revise:  (p) => <Icon {...p} children={<><path d="M20 11A8 8 0 1 0 18.5 16"/><path d="M20 5v6h-6"/></>} />,
  flame:   (p) => <Icon {...p} children={<path d="M12 3c.5 3-1.5 4.5-2.5 6S8 13 8 14a4 4 0 0 0 8 0c0-2-1-3.5-2-5 1.5.5 2.5 2 2.5 4a6.5 6.5 0 1 1-9.8-5.6C9 5.5 11 4.5 12 3Z"/>} />,
  bolt:    (p) => <Icon {...p} children={<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>} />,
  bell:    (p) => <Icon {...p} children={<><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 19a2 2 0 0 0 4 0"/></>} />,
  chevR:   (p) => <Icon {...p} children={<path d="M9 5l7 7-7 7"/>} />,
  chevL:   (p) => <Icon {...p} children={<path d="M15 5l-7 7 7 7"/>} />,
  chevDown:(p) => <Icon {...p} children={<path d="M5 9l7 7 7-7"/>} />,
  arrowR:  (p) => <Icon {...p} children={<><path d="M4 12h15"/><path d="M13 6l6 6-6 6"/></>} />,
  check:   (p) => <Icon {...p} children={<path d="M4 12.5l5 5 11-11"/>} />,
  checkCircle: (p) => <Icon {...p} children={<><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></>} />,
  x:       (p) => <Icon {...p} children={<><path d="M6 6l12 12"/><path d="M18 6 6 18"/></>} />,
  lock:    (p) => <Icon {...p} children={<><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>} />,
  unlock:  (p) => <Icon {...p} children={<><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-1.8"/></>} />,
  sparkle: (p) => <Icon {...p} children={<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/>} />,
  crown:   (p) => <Icon {...p} children={<path d="M4 8l3.5 3L12 5l4.5 6L20 8l-1.5 10h-13L4 8Z"/>} />,
  clock:   (p) => <Icon {...p} children={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>} />,
  calendar:(p) => <Icon {...p} children={<><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></>} />,
  user:    (p) => <Icon {...p} children={<><circle cx="12" cy="8" r="4"/><path d="M5 20a7 7 0 0 1 14 0"/></>} />,
  users:   (p) => <Icon {...p} children={<><circle cx="9" cy="8" r="3.4"/><path d="M3 19a6 6 0 0 1 12 0"/><path d="M16 5.5a3.4 3.4 0 0 1 0 6.6M21 19a6 6 0 0 0-4-5.6"/></>} />,
  gear:    (p) => <Icon {...p} children={<><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M22 12h-3M5 12H2M19 5l-2 2M7 17l-2 2M19 19l-2-2M7 7 5 5"/></>} />,
  bookmark:(p) => <Icon {...p} children={<path d="M6 4h12v17l-6-4-6 4V4Z"/>} />,
  target:  (p) => <Icon {...p} children={<><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></>} />,
  brain:   (p) => <Icon {...p} children={<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5 3 3 0 0 0 2 4 3 3 0 0 0 6 .5V5.5A3 3 0 0 0 9 4Zm6 0a3 3 0 0 1 3 3 3 3 0 0 1 1 5 3 3 0 0 1-2 4 3 3 0 0 1-3 .8"/>} />,
  edit:    (p) => <Icon {...p} children={<><path d="M5 19h14"/><path d="M15.5 4.5l4 4L8 20H4v-4L15.5 4.5Z"/></>} />,
  download:(p) => <Icon {...p} children={<><path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/></>} />,
  send:    (p) => <Icon {...p} children={<path d="M4 12 20 4l-6 16-3-7-7-1Z"/>} />,
  mic:     (p) => <Icon {...p} children={<><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></>} />,
  pencil:  (p) => <Icon {...p} children={<path d="M4 20l1-4L16 5l3 3L8 19l-4 1Z"/>} />,
  board:   (p) => <Icon {...p} children={<><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M7 9h6M7 12h4"/></>} />,
  bulb:    (p) => <Icon {...p} children={<><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 1 4 10.5c-.7.7-1 1.3-1 2.5H9c0-1.2-.3-1.8-1-2.5A6 6 0 0 1 12 3Z"/></>} />,
  alert:   (p) => <Icon {...p} children={<><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17v.5"/></>} />,
  info:    (p) => <Icon {...p} children={<><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/></>} />,
  trend:   (p) => <Icon {...p} children={<><path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v5h-5"/></>} />,
  card:    (p) => <Icon {...p} children={<><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18M7 15h3"/></>} />,
  pause:   (p) => <Icon {...p} children={<><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></>} />,
  play:    (p) => <Icon {...p} children={<path d="M7 4l13 8-13 8V4Z"/>} />,
  plus:    (p) => <Icon {...p} children={<><path d="M12 5v14M5 12h14"/></>} />,
  snooze:  (p) => <Icon {...p} children={<><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6l-3 3M9.5 11h5l-5 4h5"/></>} />,
  globe:   (p) => <Icon {...p} children={<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/></>} />,
  phone:   (p) => <Icon {...p} children={<rect x="6" y="2" width="12" height="20" rx="3"/>} />,
  shield:  (p) => <Icon {...p} children={<><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"/><path d="M9 12l2 2 4-4"/></>} />,
  link:    (p) => <Icon {...p} children={<><path d="M9 15l6-6"/><path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1M13 18l-1 1a4 4 0 0 1-6-6l1-1"/></>} />,
  moon:    (p) => <Icon {...p} children={<path d="M20 13A8 8 0 1 1 11 4a6 6 0 0 0 9 9Z"/>} />,
  sun:     (p) => <Icon {...p} children={<><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M22 12h-2M4 12H2M19 5l-1.5 1.5M6.5 17.5 5 19M19 19l-1.5-1.5M6.5 6.5 5 5"/></>} />,
  logout:  (p) => <Icon {...p} children={<><path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M9 12h11M16 8l4 4-4 4"/></>} />,
  whiteboard:(p) => <Icon {...p} children={<><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4M8 21h8"/><path d="M7 11l2.5-3 2 2.5L14 8l3 3.5"/></>} />,
  grad:    (p) => <Icon {...p} children={<><path d="M3 9l9-4 9 4-9 4-9-4Z"/><path d="M7 11v4c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4M21 9v4.5"/></>} />,
  list:    (p) => <Icon {...p} children={<><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none"/></>} />,
  filter:  (p) => <Icon {...p} children={<path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z"/>} />,
  refresh: (p) => <Icon {...p} children={<><path d="M20 11A8 8 0 1 0 18.5 16"/><path d="M20 5v6h-6"/></>} />,
  star:    (p) => <Icon {...p} children={<path d="M12 3l2.7 5.8 6.3.8-4.7 4.3 1.3 6.3L12 17.8 6.4 20.5l1.3-6.3L3 9.9l6.3-.8L12 3Z"/>} />,
  gift:    (p) => <Icon {...p} children={<><rect x="3" y="8" width="18" height="13" rx="1.5"/><path d="M3 12h18M12 8v13"/><path d="M12 8C12 5 10 3 8.5 4.5S9 8 12 8Zm0 0c0-3 2-5 3.5-3.5S15 8 12 8Z"/></>} />,
  doc:     (p) => <Icon {...p} children={<><path d="M7 3h7l5 5v13H7V3Z"/><path d="M13 3v5h5M10 13h6M10 17h6"/></>} />,
};
Object.assign(window, { Icon, I });
