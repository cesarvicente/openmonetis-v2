import {
  CreateSignupAllowlistEntryInputSchema,
  type UserRole,
} from "@openmonetis/validators/signup-allowlist";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { MailPlus, Trash2, UserCheck, Users } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { SettingsSection } from "@/components/settings-panel";
import { SettingsQueryError } from "@/components/settings-query-error";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { showInvalidFormToast } from "@/lib/form-feedback";
import {
  useCreateSignupAllowlistEntryMutation,
  useRemoveSignupAllowlistEntryMutation,
} from "../signup-allowlist.mutations";
import {
  formatSignupAllowlistDate,
  signupAllowlistCreateErrorMessage,
  userRoleLabels,
} from "../signup-allowlist.presentation";
import { signupAllowlistQueryOptions } from "../signup-allowlist.queries";

export function SignupAllowlistSettings() {
  const query = useQuery(signupAllowlistQueryOptions());
  const createMutation = useCreateSignupAllowlistEntryMutation();
  const removeMutation = useRemoveSignupAllowlistEntryMutation();
  const [removeId, setRemoveId] = useState<string | null>(null);
  const id = useId();
  const form = useForm({
    defaultValues: { email: "", role: "member" as UserRole },
    onSubmitInvalid: showInvalidFormToast,
    validators: {
      onSubmit: ({ value }) =>
        CreateSignupAllowlistEntryInputSchema.safeParse(value).success
          ? undefined
          : { fields: { email: "Informe um e-mail válido." } },
    },
    onSubmit: async ({ value }) => {
      try {
        await createMutation.mutateAsync(CreateSignupAllowlistEntryInputSchema.parse(value));
        form.reset();
        toast.success("E-mail autorizado");
      } catch (error) {
        toast.error(signupAllowlistCreateErrorMessage(error));
      }
    },
  });
  const entryToRemove = query.data?.find((entry) => entry.id === removeId);

  async function remove(entryId: string) {
    try {
      await removeMutation.mutateAsync(entryId);
      toast.success("Autorização removida");
      setRemoveId(null);
    } catch {
      toast.error("Não foi possível remover a autorização.");
    }
  }

  return (
    <SettingsSection
      contentClassName="grid gap-5"
      description="Somente os e-mails desta lista podem criar uma conta."
      icon={Users}
      title="E-mails autorizados"
    >
      <form
        className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="email">
          {(field) => (
            <div className="grid gap-2">
              <Label htmlFor={`${id}-email`}>E-mail</Label>
              <Input
                aria-describedby={field.state.meta.errors.length ? `${id}-email-error` : undefined}
                aria-invalid={field.state.meta.errors.length > 0}
                autoComplete="off"
                disabled={createMutation.isPending}
                id={`${id}-email`}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="pessoa@exemplo.com"
                type="email"
                value={field.state.value}
              />
              {field.state.meta.errors.length ? (
                <p className="text-destructive text-xs" id={`${id}-email-error`} role="alert">
                  Informe um e-mail válido.
                </p>
              ) : null}
            </div>
          )}
        </form.Field>
        <form.Field name="role">
          {(field) => (
            <div className="grid gap-2">
              <Label htmlFor={`${id}-role`}>Perfil</Label>
              <Select
                onValueChange={(value) => value && field.handleChange(value as UserRole)}
                value={field.state.value}
              >
                <SelectTrigger className="w-full" id={`${id}-role`}>
                  <SelectValue>{userRoleLabels[field.state.value]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">{userRoleLabels.member}</SelectItem>
                  <SelectItem value="admin">{userRoleLabels.admin}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button disabled={isSubmitting} type="submit">
              <MailPlus aria-hidden="true" />
              {isSubmitting ? "Autorizando…" : "Autorizar"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      {query.isLoading ? (
        <div className="grid gap-2" role="status" aria-label="Carregando e-mails autorizados">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : null}
      {query.isError ? (
        <SettingsQueryError
          message="Não foi possível carregar os e-mails autorizados."
          isRetrying={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data && !query.isError ? (
        query.data.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {query.data.map((entry) => (
              <li className="flex items-center gap-3 p-4" key={entry.id}>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
                  <UserCheck aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm" title={entry.email}>
                    {entry.email}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
                    <Badge variant={entry.role === "admin" ? "default" : "secondary"}>
                      {userRoleLabels[entry.role]}
                    </Badge>
                    <span>{entry.registered ? "Conta criada" : "Aguardando cadastro"}</span>
                    <span>Autorizado em {formatSignupAllowlistDate(entry.createdAt)}</span>
                  </div>
                </div>
                <Button
                  aria-label={`Remover autorização de ${entry.email}`}
                  className="text-muted-foreground hover:text-destructive"
                  disabled={removeMutation.isPending}
                  onClick={() => setRemoveId(entry.id)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-5 text-muted-foreground">
            <Users aria-hidden="true" className="size-5 shrink-0" />
            <p className="text-sm">Nenhum e-mail autorizado. Ninguém consegue criar conta.</p>
          </div>
        )
      ) : null}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !removeMutation.isPending) setRemoveId(null);
        }}
        open={Boolean(removeId)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta autorização?</AlertDialogTitle>
            <AlertDialogDescription>
              {entryToRemove?.email} deixará de poder criar uma conta. Contas já criadas continuam
              ativas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeMutation.isPending}
              onClick={() => {
                if (removeId) void remove(removeId);
              }}
              variant="destructive"
            >
              {removeMutation.isPending ? "Removendo…" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
}
