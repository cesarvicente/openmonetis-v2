import type { CreateTagInput, TagOutput } from "@openmonetis/validators/tags";
import { MobileFormContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog } from "@/components/forms/mobile-form-dialog";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TagForm } from "./tag-form";
export function TagDialog({
  open,
  onOpenChange,
  tag = null,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  tag?: TagOutput | null;
  onSubmit: (input: CreateTagInput) => Promise<void>;
}) {
  return (
    <MobileFormDialog open={open} onOpenChange={onOpenChange}>
      <MobileFormContent guarded>
        <DialogHeader>
          <DialogTitle>{tag ? "Editar etiqueta" : "Nova etiqueta"}</DialogTitle>
          <DialogDescription>
            Organize lançamentos por assuntos, projetos ou atividades.
          </DialogDescription>
        </DialogHeader>
        <TagForm
          key={tag?.id ?? "new-tag"}
          tag={tag}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </MobileFormContent>
    </MobileFormDialog>
  );
}
