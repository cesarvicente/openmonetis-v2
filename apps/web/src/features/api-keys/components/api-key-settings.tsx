import {
  CreateApiKeyInputSchema,
  type CreatedApiKeyOutput,
} from "@openmonetis/validators/api-keys";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Clipboard, KeyRound, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
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
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { useCreateApiKeyMutation, useRevokeApiKeyMutation } from "../api-keys.mutations";
import {
  apiKeyLifetimeSelectOptions,
  formatApiKeyExpiration,
  formatApiKeyLastUsed,
  formatApiKeyUsageExample,
  parseApiKeyLifetime,
} from "../api-keys.presentation";
import { apiKeysQueryOptions } from "../api-keys.queries";

export function ApiKeySettings() {
  const query = useQuery(apiKeysQueryOptions());
  const createMutation = useCreateApiKeyMutation();
  const revokeMutation = useRevokeApiKeyMutation();
  const [createOpen, setCreateOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedApiKeyOutput | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const nameId = useId();
  const lifetimeId = useId();
  const form = useForm({
    defaultValues: { name: "", lifetime: "90" },
    onSubmitInvalid: showInvalidFormToast,
    validators: {
      onSubmit: ({ value }) =>
        CreateApiKeyInputSchema.safeParse({
          name: value.name,
          expiresInDays: parseApiKeyLifetime(value.lifetime),
        }).success
          ? undefined
          : { fields: { name: "Informe um nome com até 80 caracteres." } },
    },
    onSubmit: async ({ value }) => {
      try {
        const created = await createMutation.mutateAsync(
          CreateApiKeyInputSchema.parse({
            name: value.name,
            expiresInDays: parseApiKeyLifetime(value.lifetime),
          }),
        );
        setCreatedKey(created);
        form.reset();
        toast.success("Chave criada");
      } catch {
        toast.error("Não foi possível criar a chave.");
      }
    },
  });

  function changeCreateOpen(open: boolean) {
    if (createMutation.isPending) return;
    if (!open && createdKey) setCreatedKey(null);
    setCreateOpen(open);
    if (!open) form.reset();
  }

  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      toast.success("Chave copiada");
    } catch {
      toast.error("Não foi possível copiar. Selecione a chave manualmente.");
    }
  }

  async function revoke(id: string) {
    try {
      await revokeMutation.mutateAsync(id);
      toast.success("Chave revogada");
      setRevokeId(null);
    } catch {
      toast.error("Não foi possível revogar a chave.");
    }
  }

  return (
    <SettingsSection
      contentClassName="grid gap-5"
      description="Permita que outros programas, como agentes de IA, consultem e alterem seus dados financeiros sem a interface web."
      icon={KeyRound}
      title="Chaves de API"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium text-sm">Chaves ativas</p>
          <p className="mt-1 max-w-xl text-muted-foreground text-sm leading-relaxed">
            Cada chave acessa somente a sua conta. Ela não gerencia senhas, chaves, aparelhos nem
            ações perigosas.
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)} type="button">
          <Plus aria-hidden="true" /> Gerar chave
        </Button>
      </div>

      {query.isLoading ? (
        <div className="grid gap-2" role="status" aria-label="Carregando chaves">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : null}
      {query.isError ? (
        <SettingsQueryError
          message="Não foi possível carregar as chaves."
          isRetrying={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data && !query.isError ? (
        query.data.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {query.data.map((apiKey) => (
              <li className="flex items-center gap-2 p-4 sm:gap-3" key={apiKey.id}>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
                  <KeyRound aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm" title={apiKey.name}>
                    {apiKey.name}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-muted-foreground text-xs">
                    <code className="font-mono">{apiKey.keyPrefix}…</code>
                    <span>{formatApiKeyLastUsed(apiKey.lastUsedAt)}</span>
                    <span>{formatApiKeyExpiration(apiKey.expiresAt)}</span>
                  </div>
                </div>
                <Button
                  aria-label={`Revogar a chave ${apiKey.name}`}
                  className="text-muted-foreground hover:text-destructive"
                  disabled={revokeMutation.isPending}
                  onClick={() => setRevokeId(apiKey.id)}
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
            <KeyRound aria-hidden="true" className="size-5 shrink-0" />
            <p className="text-sm">Você ainda não gerou uma chave de API.</p>
          </div>
        )
      ) : null}

      <p className="text-muted-foreground text-sm leading-relaxed">
        Envie a chave no cabeçalho <code className="font-mono">Authorization: Bearer</code> para os
        endereços em <code className="font-mono">/api-proxy</code>. A documentação dos endpoints
        está em <code className="font-mono">/api-proxy/openapi.json</code>.
      </p>

      <Dialog onOpenChange={changeCreateOpen} open={createOpen}>
        <DialogContent guarded className="max-h-[calc(100svh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{createdKey ? "Copie sua chave" : "Gerar chave de API"}</DialogTitle>
            <DialogDescription>
              {createdKey
                ? "Guarde a chave em local seguro. Ela não será exibida novamente ao fechar esta janela."
                : "Use um nome que ajude a reconhecer quem vai usar a chave."}
            </DialogDescription>
          </DialogHeader>
          {createdKey ? (
            <div className="grid gap-3">
              <p className="text-center font-medium text-sm">{createdKey.name}</p>
              <div className="rounded-lg border bg-muted/40 p-3">
                <code className="block break-all font-mono text-xs select-all">
                  {createdKey.key}
                </code>
              </div>
              <Button onClick={() => void copyKey(createdKey.key)} type="button">
                <Clipboard aria-hidden="true" /> Copiar chave
              </Button>
              <div className="grid gap-1.5">
                <p className="text-muted-foreground text-sm">Exemplo de uso:</p>
                <code className="block break-all rounded-lg border bg-muted/40 p-3 font-mono text-xs">
                  {formatApiKeyUsageExample(window.location.origin, createdKey.key)}
                </code>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => changeCreateOpen(false)}>
                  Concluir
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              data-mobile-page-form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit();
              }}
            >
              <form.Subscribe
                selector={(state) => ({
                  isDirty: !state.isDefaultValue,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {(state) => <MobileFormState {...state} />}
              </form.Subscribe>
              <form.Field name="name">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={nameId}>Nome da chave</Label>
                    <Input
                      aria-invalid={field.state.meta.errors.length > 0}
                      aria-describedby={
                        field.state.meta.errors.length ? `${nameId}-error` : undefined
                      }
                      disabled={createMutation.isPending}
                      autoComplete="off"
                      id={nameId}
                      maxLength={80}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="Ex.: Agente de IA"
                      value={field.state.value}
                    />
                    {field.state.meta.errors.length ? (
                      <p className="text-destructive text-sm" id={`${nameId}-error`} role="alert">
                        Informe um nome com até 80 caracteres.
                      </p>
                    ) : null}
                  </div>
                )}
              </form.Field>
              <form.Field name="lifetime">
                {(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={lifetimeId}>Validade</Label>
                    <Select
                      onValueChange={(lifetime) => {
                        if (lifetime) field.handleChange(lifetime);
                      }}
                      value={field.state.value}
                    >
                      <SelectTrigger
                        className="w-full"
                        disabled={createMutation.isPending}
                        id={lifetimeId}
                      >
                        <SelectValue>
                          {
                            apiKeyLifetimeSelectOptions.find(
                              (option) => option.value === field.state.value,
                            )?.label
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {apiKeyLifetimeSelectOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>
              <DialogFooter>
                <Button
                  data-mobile-cancel
                  disabled={createMutation.isPending}
                  onClick={() => changeCreateOpen(false)}
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
                <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                  {([canSubmit, isSubmitting]) => (
                    <Button disabled={!canSubmit || isSubmitting} type="submit">
                      {isSubmitting ? "Gerando…" : "Gerar chave"}
                    </Button>
                  )}
                </form.Subscribe>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !revokeMutation.isPending) setRevokeId(null);
        }}
        open={Boolean(revokeId)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar esta chave?</AlertDialogTitle>
            <AlertDialogDescription>
              Programas que usam a chave{" "}
              {query.data?.find((apiKey) => apiKey.id === revokeId)?.name} perderão o acesso
              imediatamente. Os dados já criados por eles serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={revokeMutation.isPending}
              onClick={() => {
                if (revokeId) void revoke(revokeId);
              }}
              variant="destructive"
            >
              {revokeMutation.isPending ? "Revogando…" : "Revogar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
}
