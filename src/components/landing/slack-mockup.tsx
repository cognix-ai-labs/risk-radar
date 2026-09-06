import { cn } from '@/lib/utils/cn';

export interface MockMessage {
  name: string;
  color: string;
  text: string;
  time: string;
}

const AVATAR_COLORS: Record<string, string> = {
  indigo: 'bg-indigo-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
};

export function SlackMockup({ channel, messages, className }: { channel: string; messages: MockMessage[]; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-border bg-card shadow-lg', className)}>
      <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-3">
        <span className="text-muted-foreground">#</span>
        <span className="text-sm font-semibold">{channel}</span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        {messages.map((m, i) => (
          <div key={i} className="flex gap-3">
            <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white', AVATAR_COLORS[m.color] ?? 'bg-slate-500')}>
              {m.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold">{m.name}</span>
                <span className="text-xs text-muted-foreground">{m.time}</span>
              </div>
              <p className="text-sm leading-snug">{m.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
