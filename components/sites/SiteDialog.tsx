"use client";

import { useState } from "react";
import { Site } from "@/types/site";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import SiteForm from "./SiteForm";

interface SiteDialogProps {
  site?: Site;
  trigger?: React.ReactElement;
}

export default function SiteDialog({ site, trigger }: SiteDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button type="button">Add Site</Button>} />

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{site ? "Edit Site" : "Add Site"}</DialogTitle>
        </DialogHeader>

        <SiteForm site={site} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
