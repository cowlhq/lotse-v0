import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// SettingsSheet holds what can be set for a customer, a project or a
// thing, at the side of its page: watching and changing are apart, and the
// page itself shows only how things stand (decision 0027).
export function SettingsSheet({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto bg-background data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="space-y-8 px-6 pt-4 pb-10">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

// Section is one part of the settings: a quiet heading and what it holds.
export function Section({ title, hint, children }: { title: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-mini font-medium text-muted-foreground">{title}</h3>
        {hint && <p className="text-mini text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
