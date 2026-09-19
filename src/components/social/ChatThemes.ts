export interface ChatTheme {
  id: string;
  name: string;
  badge: string;
  isPremium: boolean;
  developerExclusive?: boolean;
  containerBg: string;
  headerBg: string;
  inputBg: string;
  myBubble: string;
  theirBubble: string;
  accentText: string;
  glowColor: string;
}

export const CHAT_THEMES: Record<string, ChatTheme> = {
  emerald: {
    id: 'emerald',
    name: 'Emerald Matrix',
    badge: 'Free',
    isPremium: false,
    containerBg: 'bg-zinc-950/40 backdrop-blur-md',
    headerBg: 'bg-zinc-900/80 border-b border-emerald-900/30',
    inputBg: 'bg-zinc-950/80 border-t border-zinc-800/80',
    myBubble: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white',
    theirBubble: 'bg-zinc-800/90 border border-zinc-700/50 text-zinc-100',
    accentText: 'text-emerald-400',
    glowColor: 'shadow-emerald-500/10'
  },
  slate: {
    id: 'slate',
    name: 'Stealth Obsidian',
    badge: 'Free',
    isPremium: false,
    containerBg: 'bg-black/70 backdrop-blur-md',
    headerBg: 'bg-zinc-950/90 border-b border-zinc-800',
    inputBg: 'bg-black/90 border-t border-zinc-800',
    myBubble: 'bg-zinc-100 text-zinc-950 font-medium',
    theirBubble: 'bg-zinc-900 border border-zinc-800 text-zinc-200',
    accentText: 'text-zinc-300',
    glowColor: 'shadow-zinc-700/10'
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Breeze',
    badge: 'Free',
    isPremium: false,
    containerBg: 'bg-[#091524]/60 backdrop-blur-md',
    headerBg: 'bg-[#0c1e34]/90 border-b border-sky-900/40',
    inputBg: 'bg-[#0a1727]/90 border-t border-sky-950/60',
    myBubble: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20',
    theirBubble: 'bg-zinc-900/90 border border-sky-900/30 text-sky-100',
    accentText: 'text-sky-400',
    glowColor: 'shadow-sky-500/10'
  },
  gold: {
    id: 'gold',
    name: 'Royal Gold',
    badge: 'VIP Developer',
    isPremium: true,
    developerExclusive: true,
    containerBg: 'bg-[#120f08]/60 backdrop-blur-md',
    headerBg: 'bg-[#1a150b]/90 border-b border-amber-500/30',
    inputBg: 'bg-[#141009]/90 border-t border-amber-900/40',
    myBubble: 'bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600 text-black font-semibold shadow-md shadow-amber-500/25',
    theirBubble: 'bg-zinc-900/90 border border-amber-900/50 text-amber-100',
    accentText: 'text-amber-400',
    glowColor: 'shadow-amber-500/20'
  },
  neon: {
    id: 'neon',
    name: 'Cyber Neon',
    badge: 'Premium',
    isPremium: true,
    containerBg: 'bg-[#080d1a]/60 backdrop-blur-md',
    headerBg: 'bg-[#0c1426]/90 border-b border-cyan-500/30',
    inputBg: 'bg-[#09101d]/90 border-t border-cyan-950/50',
    myBubble: 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20',
    theirBubble: 'bg-zinc-900/90 border border-cyan-900/40 text-cyan-50',
    accentText: 'text-cyan-400',
    glowColor: 'shadow-cyan-500/20'
  },
  amethyst: {
    id: 'amethyst',
    name: 'Midnight Amethyst',
    badge: 'Premium',
    isPremium: true,
    containerBg: 'bg-[#11091a]/60 backdrop-blur-md',
    headerBg: 'bg-[#180e26]/90 border-b border-purple-500/30',
    inputBg: 'bg-[#120b1e]/90 border-t border-purple-950/60',
    myBubble: 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/20',
    theirBubble: 'bg-zinc-900/90 border border-purple-900/40 text-purple-100',
    accentText: 'text-purple-400',
    glowColor: 'shadow-purple-500/20'
  },
  crimson: {
    id: 'crimson',
    name: 'Sunset Rose',
    badge: 'Premium',
    isPremium: true,
    containerBg: 'bg-[#17090b]/60 backdrop-blur-md',
    headerBg: 'bg-[#220e11]/90 border-b border-rose-500/30',
    inputBg: 'bg-[#180b0e]/90 border-t border-rose-950/60',
    myBubble: 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/20',
    theirBubble: 'bg-zinc-900/90 border border-rose-900/40 text-rose-100',
    accentText: 'text-rose-400',
    glowColor: 'shadow-rose-500/20'
  }
};
