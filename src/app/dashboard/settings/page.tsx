import Link from 'next/link';
import { CreditCard, Plug } from 'lucide-react';
import { Topbar } from '@/components/dashboard/topbar';
import { Card, CardContent } from '@/components/ui/card';

const LINKS = [
  { href: '/dashboard/settings/billing', label: 'Billing & plan', description: 'Manage your subscription, upgrade, or view invoices.', icon: CreditCard },
  { href: '/dashboard/settings/integrations', label: 'Integrations', description: 'Connect GitHub and manage your Slack connection.', icon: Plug },
];

export default function SettingsIndexPage() {
  return (
    <>
      <Topbar title="Settings" />
      <div className="grid gap-4 p-6 sm:grid-cols-2">
        {LINKS.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex items-start gap-4 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
