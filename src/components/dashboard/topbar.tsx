'use client';

import { signOut, useSession } from 'next-auth/react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';

export function Topbar({ title }: { title: string }) {
  const { data: session } = useSession();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {session?.user?.email && (
          <span className="hidden text-sm text-muted-foreground sm:inline">{session.user.email}</span>
        )}
        <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: '/' })}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
