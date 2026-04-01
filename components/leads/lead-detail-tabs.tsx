'use client';

import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type LeadDetailTabItem = {
  value: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
  badge?: number;
  content: React.ReactNode;
};

type LeadDetailTabsProps = {
  activeTab: string;
  items: LeadDetailTabItem[];
};

export function LeadDetailTabs({ activeTab, items }: LeadDetailTabsProps) {
  const router = useRouter();

  return (
    <Tabs
      value={activeTab}
      onValueChange={(nextTab) => {
        const nextItem = items.find((item) => item.value === nextTab);
        if (nextItem) {
          router.push(nextItem.href);
        }
      }}
    >
      <TabsList className="w-full justify-start">
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className="gap-1.5"
          >
            {item.icon}
            {item.label}
            {typeof item.badge === 'number' && item.badge > 0 && (
              <Badge
                variant="secondary"
                className="ml-0.5 h-4 min-w-4 px-1 text-[10px] leading-none"
              >
                {item.badge}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {items.map((item) => (
        <TabsContent key={item.value} value={item.value} className="mt-6">
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
