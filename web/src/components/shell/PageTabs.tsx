import { TabsList, TabsTrigger } from "@/components/ui/tabs";

// PageTabs are the views of a page: plain words on a line, the one shown
// underlined.
export function PageTabs({ tabs }: { tabs: { value: string; label: string; count?: number }[] }) {
  return (
    <TabsList variant="line" className="flex h-9 w-full max-w-full min-w-0 flex-1 justify-start gap-5 overflow-x-auto rounded-none border-b p-0 [scrollbar-width:none]">
      {tabs.map((tab) => (
        <TabsTrigger
          key={tab.value}
          value={tab.value}
          className="h-9 flex-none rounded-none border-0 px-0 text-ui! font-normal text-muted-foreground after:bottom-[-1px]! hover:text-foreground data-active:font-medium data-active:text-foreground!"
        >
          {tab.label}
          {tab.count ? <span className="-ml-1 text-mini font-normal tabular-nums text-muted-foreground">{tab.count}</span> : null}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
