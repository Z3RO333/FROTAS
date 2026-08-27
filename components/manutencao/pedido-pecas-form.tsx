"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Mail, PackagePlus, Plus, Send, Trash2, Truck, UserPlus } from "lucide-react";
import type {
  PedidoPecasActionState,
  PedidoPecasFormValues,
  PedidoPecasGrupoValues,
} from "@/app/(app)/manutencao/pecas/_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  VehicleSearchSelect,
  type VehicleOption,
} from "@/components/vehicles/vehicle-search-select";

type PedidoVehicleOption = VehicleOption & {
  chassi: string | null;
  ano: number | null;
};

export type FornecedorPecasOption = {
  id: number;
  nome: string;
  email: string;
};

type ItemForm = {
  key: string;
  descricao: string;
  quantidade: number;
};

/** id != null: fornecedor já cadastrado. id == null: adicionado nesta sessão, ainda não salvo. */
type FornecedorEntry = {
  key: string;
  id: number | null;
  nome: string;
  email: string;
};

type GrupoForm = {
  key: string;
  tokenIdempotencia: string;
  frotaId: number | null;
  itens: ItemForm[];
  fornecedorKeys: Set<string>;
};

const INITIAL_STATE: PedidoPecasActionState = {
  error: null,
  values: null,
  attempt: 0,
};

const MAX_FROTAS = 10;
const MAX_PECAS_POR_FROTA = 25;

function itemKey(token: string, index: number): string {
  return `${token}-item-${index + 1}`;
}

function fornecedorKeyFor(entry: { id: number | null; email: string }): string {
  return entry.id != null ? `id-${entry.id}` : `novo-${entry.email.trim().toLowerCase()}`;
}

function newGroup(allKeys: string[], token = crypto.randomUUID()): GrupoForm {
  return {
    key: token,
    tokenIdempotencia: token,
    frotaId: null,
    itens: [{ key: itemKey(token, 0), descricao: "", quantidade: 1 }],
    fornecedorKeys: new Set(allKeys),
  };
}

export function PedidoPecasForm({
  vehicles,
  fornecedores,
  initialToken,
  action,
}: {
  vehicles: PedidoVehicleOption[];
  fornecedores: FornecedorPecasOption[];
  initialToken: string;
  action: (
    state: PedidoPecasActionState,
    formData: FormData
  ) => Promise<PedidoPecasActionState>;
}) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const values: PedidoPecasFormValues = state.values ?? {
    grupos: [{
      tokenIdempotencia: initialToken,
      frotaId: null,
      itens: [{ descricao: "", quantidade: 1 }],
      fornecedorIds: fornecedores.map((f) => f.id),
      novosFornecedores: [],
    }],
  };

  return (
    <PedidoPecasFields
      key={state.attempt}
      vehicles={vehicles}
      fornecedoresIniciais={fornecedores}
      action={formAction}
      values={values}
      error={state.error}
    />
  );
}

function fromValues(grupo: PedidoPecasGrupoValues): GrupoForm {
  const itens = grupo.itens.length > 0
    ? grupo.itens
    : [{ descricao: "", quantidade: 1 }];
  const keys = new Set<string>();
  for (const id of grupo.fornecedorIds) keys.add(fornecedorKeyFor({ id, email: "" }));
  for (const novo of grupo.novosFornecedores) keys.add(fornecedorKeyFor({ id: null, email: novo.email }));
  return {
    key: grupo.tokenIdempotencia,
    tokenIdempotencia: grupo.tokenIdempotencia,
    frotaId: grupo.frotaId,
    itens: itens.map((item, index) => ({ ...item, key: itemKey(grupo.tokenIdempotencia, index) })),
    fornecedorKeys: keys,
  };
}

function PedidoPecasFields({
  vehicles,
  fornecedoresIniciais,
  action,
  values,
  error,
}: {
  vehicles: PedidoVehicleOption[];
  fornecedoresIniciais: FornecedorPecasOption[];
  action: (formData: FormData) => void;
  values: PedidoPecasFormValues;
  error: string | null;
}) {
  const [fornecedoresDisponiveis, setFornecedoresDisponiveis] = useState<FornecedorEntry[]>(() => {
    const base: FornecedorEntry[] = fornecedoresIniciais.map((f) => ({
      key: fornecedorKeyFor(f),
      id: f.id,
      nome: f.nome,
      email: f.email,
    }));
    const emails = new Set(base.map((f) => f.email.toLowerCase()));
    for (const grupo of values.grupos) {
      for (const novo of grupo.novosFornecedores) {
        if (emails.has(novo.email.toLowerCase())) continue;
        emails.add(novo.email.toLowerCase());
        base.push({ key: fornecedorKeyFor({ id: null, email: novo.email }), id: null, nome: novo.nome, email: novo.email });
      }
    }
    return base;
  });
  const [grupos, setGrupos] = useState<GrupoForm[]>(() => values.grupos.map((g) => fromValues(g)));
  const selectedIds = new Set(grupos.flatMap((grupo) => grupo.frotaId == null ? [] : [grupo.frotaId]));

  const fornecedorByKey = new Map(fornecedoresDisponiveis.map((f) => [f.key, f]));
  const payload = grupos.map((grupo) => {
    const fornecedorIds: number[] = [];
    const novosFornecedores: Array<{ nome: string; email: string }> = [];
    for (const key of grupo.fornecedorKeys) {
      const entry = fornecedorByKey.get(key);
      if (!entry) continue;
      if (entry.id != null) fornecedorIds.push(entry.id);
      else novosFornecedores.push({ nome: entry.nome, email: entry.email });
    }
    return {
      tokenIdempotencia: grupo.tokenIdempotencia,
      frotaId: grupo.frotaId,
      itens: grupo.itens.map(({ descricao, quantidade }) => ({ descricao, quantidade })),
      fornecedorIds,
      novosFornecedores,
    };
  });

  function addGroup() {
    setGrupos((current) => current.length >= MAX_FROTAS
      ? current
      : [...current, newGroup(fornecedoresDisponiveis.map((f) => f.key))]);
  }

  function removeGroup(key: string) {
    setGrupos((current) => current.length === 1 ? current : current.filter((grupo) => grupo.key !== key));
  }

  function selectVehicle(key: string, frotaId: number | null) {
    setGrupos((current) => current.map((grupo) => grupo.key === key ? { ...grupo, frotaId } : grupo));
  }

  function addItem(groupKey: string) {
    setGrupos((current) => current.map((grupo) => {
      if (grupo.key !== groupKey || grupo.itens.length >= MAX_PECAS_POR_FROTA) return grupo;
      return {
        ...grupo,
        itens: [
          ...grupo.itens,
          {
            key: `${grupo.tokenIdempotencia}-item-${crypto.randomUUID()}`,
            descricao: "",
            quantidade: 1,
          },
        ],
      };
    }));
  }

  function updateItem(groupKey: string, itemKeyValue: string, field: "descricao" | "quantidade", value: string) {
    setGrupos((current) => current.map((grupo) => {
      if (grupo.key !== groupKey) return grupo;
      return {
        ...grupo,
        itens: grupo.itens.map((item) => item.key === itemKeyValue
          ? { ...item, [field]: field === "quantidade" ? Number(value) || 1 : value }
          : item),
      };
    }));
  }

  function removeItem(groupKey: string, itemKeyValue: string) {
    setGrupos((current) => current.map((grupo) => {
      if (grupo.key !== groupKey || grupo.itens.length === 1) return grupo;
      return { ...grupo, itens: grupo.itens.filter((item) => item.key !== itemKeyValue) };
    }));
  }

  function toggleFornecedor(groupKey: string, fornecedorKey: string, checked: boolean) {
    setGrupos((current) => current.map((grupo) => {
      if (grupo.key !== groupKey) return grupo;
      const fornecedorKeys = new Set(grupo.fornecedorKeys);
      if (checked) fornecedorKeys.add(fornecedorKey);
      else fornecedorKeys.delete(fornecedorKey);
      return { ...grupo, fornecedorKeys };
    }));
  }

  function addFornecedor(groupKey: string, nome: string, email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!nome.trim() || !normalizedEmail) return;
    const key = fornecedorKeyFor({ id: null, email: normalizedEmail });
    setFornecedoresDisponiveis((current) => {
      if (current.some((f) => f.key === key)) return current;
      return [...current, { key, id: null, nome: nome.trim(), email: normalizedEmail }];
    });
    setGrupos((current) => current.map((grupo) => {
      if (grupo.key !== groupKey) return grupo;
      const fornecedorKeys = new Set(grupo.fornecedorKeys);
      fornecedorKeys.add(key);
      return { ...grupo, fornecedorKeys };
    }));
  }

  const incomplete = grupos.some((grupo) => grupo.frotaId == null || grupo.fornecedorKeys.size === 0);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="grupos" value={JSON.stringify(payload)} />

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Não foi possível criar o lote</p>
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Frotas do lote</p>
          <p className="text-xs text-slate-500">{grupos.length} de {MAX_FROTAS} frotas</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addGroup} disabled={grupos.length >= MAX_FROTAS}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Adicionar frota
        </Button>
      </div>

      <div className="divide-y divide-slate-200 border-y border-slate-200">
        {grupos.map((grupo, groupIndex) => {
          const selected = vehicles.find((vehicle) => vehicle.id === grupo.frotaId) ?? null;
          const availableVehicles = vehicles.filter((vehicle) => vehicle.id === grupo.frotaId || !selectedIds.has(vehicle.id));

          return (
            <section key={grupo.key} className="space-y-5 py-5 first:pt-4 last:pb-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-blue-700" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-slate-900">Frota {groupIndex + 1}</h2>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeGroup(grupo.key)}
                  disabled={grupos.length === 1}
                  aria-label={`Remover frota ${groupIndex + 1} do lote`}
                  title="Remover frota"
                  className="text-slate-500 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`pedido-frota-${grupo.key}`}>Frota, placa ou modelo</Label>
                <VehicleSearchSelect
                  id={`pedido-frota-${grupo.key}`}
                  vehicles={availableVehicles}
                  value={grupo.frotaId}
                  onChange={(vehicle) => selectVehicle(grupo.key, vehicle?.id ?? null)}
                  placeholder="Selecione a frota"
                  maxResults={80}
                  invalid={Boolean(error && !grupo.frotaId)}
                />
              </div>

              {selected ? (
                <div className="grid gap-px overflow-hidden rounded-md border bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
                  <VehicleDetail label="Frota" value={selected.codigo} />
                  <VehicleDetail label="Placa" value={selected.placa} />
                  <VehicleDetail label="Modelo / Marca" value={selected.modelo} />
                  <VehicleDetail label="Ano" value={selected.ano} />
                  <VehicleDetail label="Chassi" value={selected.chassi} className="sm:col-span-2 lg:col-span-4" />
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <PackagePlus className="h-4 w-4 text-blue-700" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-slate-900">Peças da frota {groupIndex + 1}</h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addItem(grupo.key)}
                    disabled={grupo.itens.length >= MAX_PECAS_POR_FROTA}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Adicionar peça
                  </Button>
                </div>

                <div className="space-y-2">
                  {grupo.itens.map((item, itemIndex) => (
                    <div key={item.key} className="grid grid-cols-[minmax(0,1fr)_88px_44px] items-end gap-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`descricao-${item.key}`}>
                          {itemIndex === 0 ? "Descrição da peça" : `Peça ${itemIndex + 1}`}
                        </Label>
                        <Input
                          id={`descricao-${item.key}`}
                          value={item.descricao}
                          onChange={(event) => updateItem(grupo.key, item.key, "descricao", event.target.value)}
                          placeholder="Ex.: Lanterna de delimitação branca LED"
                          maxLength={300}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`quantidade-${item.key}`}>Qtd.</Label>
                        <Input
                          id={`quantidade-${item.key}`}
                          type="number"
                          min={1}
                          max={999}
                          value={item.quantidade}
                          onChange={(event) => updateItem(grupo.key, item.key, "quantidade", event.target.value)}
                          required
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(grupo.key, item.key)}
                        disabled={grupo.itens.length === 1}
                        aria-label={`Remover peça ${itemIndex + 1} da frota ${groupIndex + 1}`}
                        title="Remover peça"
                        className="text-slate-500 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <FornecedoresPicker
                groupKey={grupo.key}
                groupIndex={groupIndex}
                fornecedores={fornecedoresDisponiveis}
                selectedKeys={grupo.fornecedorKeys}
                invalid={Boolean(error && grupo.fornecedorKeys.size === 0)}
                onToggle={toggleFornecedor}
                onAdd={addFornecedor}
              />
            </section>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">Cópia de todos os e-mails: manutencaocd_orcamentos@bemol.com.br</p>
        <SubmitButton disabled={incomplete} totalFrotas={grupos.length} />
      </div>
    </form>
  );
}

function FornecedoresPicker({
  groupKey,
  groupIndex,
  fornecedores,
  selectedKeys,
  invalid,
  onToggle,
  onAdd,
}: {
  groupKey: string;
  groupIndex: number;
  fornecedores: FornecedorEntry[];
  selectedKeys: Set<string>;
  invalid: boolean;
  onToggle: (groupKey: string, fornecedorKey: string, checked: boolean) => void;
  onAdd: (groupKey: string, nome: string, email: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");

  function confirmAdd() {
    onAdd(groupKey, nome, email);
    setNome("");
    setEmail("");
    setAdding(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-blue-700" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-slate-900">Fornecedores para cotação da frota {groupIndex + 1}</h3>
      </div>

      <div className={`flex flex-wrap gap-2 rounded-md border p-3 ${invalid ? "border-red-300 bg-red-50/40" : "border-slate-200 bg-slate-50"}`}>
        {fornecedores.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum fornecedor cadastrado ainda.</p>
        ) : (
          fornecedores.map((fornecedor) => (
            <label
              key={fornecedor.key}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={selectedKeys.has(fornecedor.key)}
                onChange={(event) => onToggle(groupKey, fornecedor.key, event.target.checked)}
                className="h-4 w-4 accent-blue-700"
              />
              <span className="font-medium text-slate-900">{fornecedor.nome}</span>
              {fornecedor.id == null ? (
                <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                  Novo
                </span>
              ) : null}
            </label>
          ))
        )}
      </div>

      {invalid ? (
        <p className="text-xs font-medium text-red-700">Selecione ao menos um fornecedor para esta frota.</p>
      ) : null}

      {adding ? (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-white p-3">
          <div className="min-w-[180px] flex-1 space-y-1.5">
            <Label htmlFor={`fornecedor-nome-${groupKey}`}>Nome do fornecedor</Label>
            <Input
              id={`fornecedor-nome-${groupKey}`}
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Ex.: Peças Rio"
              maxLength={120}
            />
          </div>
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <Label htmlFor={`fornecedor-email-${groupKey}`}>E-mail</Label>
            <Input
              id={`fornecedor-email-${groupKey}`}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="vendas@fornecedor.com.br"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={confirmAdd} disabled={!nome.trim() || !email.trim()}>
              Adicionar
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Adicionar fornecedor
        </Button>
      )}
    </div>
  );
}

function VehicleDetail({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string | number | null;
  className?: string;
}) {
  return (
    <div className={`min-w-0 bg-white px-3 py-2.5 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{value ?? "-"}</p>
    </div>
  );
}

function SubmitButton({ disabled, totalFrotas }: { disabled: boolean; totalFrotas: number }) {
  const { pending } = useFormStatus();
  const label = totalFrotas > 1 ? `Enviar lote (${totalFrotas} frotas)` : "Enviar para cotação";
  return (
    <Button type="submit" disabled={disabled || pending} className="shrink-0">
      <Send className="h-4 w-4" aria-hidden="true" />
      {pending ? "Enviando cotações..." : label}
    </Button>
  );
}
