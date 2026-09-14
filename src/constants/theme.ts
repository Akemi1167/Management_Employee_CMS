/** Palette CMS — luôn dùng hex trực tiếp trong className, không dùng text-foreground/text-muted-foreground */
export const C = {
  bg: '#0e1016',
  fg: '#eef0f6',
  fgMuted: '#b8bfd0',
  fgSubtle: '#9aa3b5',
  card: '#161922',
  cardHover: '#1c2030',
  border: '#2a3040',
  input: '#1a1e28',
  sidebar: '#0a0c10',
  sidebarBorder: '#1e2230',
  primary: '#16a34a',
  primaryLight: '#4ade80',
  primaryFg: '#f0fdf4',
  success: '#34d399',
  warning: '#fbbf24',
  violet: '#a78bfa',
} as const;

export const cardClass = 'rounded-xl border border-[#2a3040] bg-[#161922]';
export const textTitle = 'text-[#eef0f6]';
export const textBody = 'text-[#b8bfd0]';
export const textSubtle = 'text-[#9aa3b5]';
export const textLabel = 'text-[11px] font-semibold uppercase tracking-wider text-[#b8bfd0]';
export const textColumnHeader =
  'text-[11px] font-semibold uppercase tracking-wider text-[#4ade80]';
/** Nhãn trường chi tiết — mờ hơn tiêu đề section */
export const textFieldLabel =
  'text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9aa3b5]';
/** Giá trị trường chi tiết — sáng, đậm hơn nhãn */
export const textFieldValue = 'text-sm font-medium leading-snug text-[#eef0f6]';
export const detailFieldCell =
  'rounded-lg border border-[#2a3040]/70 bg-[#1a1e28]/55 px-3 py-2.5 transition-colors hover:bg-[#1c2030]/70';
export const sectionHeading = 'mb-3 flex items-center gap-2.5 text-sm font-semibold text-[#eef0f6]';
export const sectionAccent = 'h-4 w-1 shrink-0 rounded-full bg-[#4ade80]';
