import { Menu, X, ArrowLeft, Timer, Heart, RotateCcw, CircleHelp, Minimize, Maximize, Pause, Play, Trophy, ShoppingBag, ChartNoAxesColumn, Gift, UserRound, ArrowUpRight, Leaf, House, Sparkles, Wallet, ShieldCheck, Clock, Scissors, ChevronRight, Settings, Volume2, VolumeX, Check, Layers } from 'lucide-react';
const icons = { menu: Menu, close: X, back: ArrowLeft, timer: Timer, heart: Heart, reset: RotateCcw, help: CircleHelp, shrink: Minimize, expand: Maximize, pause: Pause, play: Play, trophy: Trophy, bag: ShoppingBag, chart: ChartNoAxesColumn, gift: Gift, user: UserRound, arrow: ArrowUpRight, leaf: Leaf, home: House, sparkles: Sparkles, wallet: Wallet, shield: ShieldCheck, clock: Clock, scissors: Scissors, chevron: ChevronRight, settings: Settings, sound: Volume2, muted: VolumeX, check: Check, layers: Layers };
export type IconName = keyof typeof icons;
export function Icon({ name, className = '', size = 22 }: { name: IconName; className?: string; size?: number }) {
  const Component = icons[name];
  return <Component className={className} size={size} strokeWidth={1.8} aria-hidden="true" focusable="false" />;
}
