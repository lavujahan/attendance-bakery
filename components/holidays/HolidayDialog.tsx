"use client";

import { useState } from "react";
import { HolidayEntry } from "@/types/holiday";
import { Site } from "@/types/site";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import HolidayForm from "./HolidayForm";

interface HolidayDialogProps {
  siteId: string;
  sites: Site[];
  holiday?: HolidayEntry;
  trigger?: React.ReactElement;
}

export default function HolidayDialog({ siteId, sites, holiday, trigger }: HolidayDialogProps) {
  const [open, setOpen] = useState(false);
  const isEditing = Boolean(holiday?.dbId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button type="button">Add Holiday</Button>} />

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Holiday" : "Add Holiday"}</DialogTitle>
        </DialogHeader>

        <HolidayForm siteId={siteId} sites={sites} holiday={holiday} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
