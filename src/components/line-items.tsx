"use client";
import * as React from "react";
import { ChevronDown, ChevronUp, GripVertical, List, Plus, X } from "lucide-react";
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { Field } from "@/components/field";
import { CurrencyInput } from "@/components/currency-input";
import { Beacon } from "@/components/ui/beacon";
import { useStore } from "@/lib/store";
import { useCatalog } from "@/lib/catalog-store";
import { useI18n } from "@/lib/i18n";
import { useEditorActions } from "@/lib/editor-actions";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Currency, LineItem } from "@/lib/types";


function OverlayCard({ item, currency }: { item: LineItem; currency: Currency }) {
  const { t } = useI18n();
  const qty = Math.max(0, item.qty);
  const price = Math.max(0, item.price);
  return (
    <div className="bg-item rounded-xl p-3.5 shadow-xl ring-1 ring-border cursor-grabbing">
      <div className="flex items-center gap-2.5 mb-1.5">
        <GripVertical className="size-4 text-muted-foreground/50" />
        <span className="text-xs text-muted-foreground">{t("f.desc")}</span>
      </div>
      <div className="text-sm font-medium truncate mb-1.5">
        {item.desc || t("ph.itemDesc")}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {qty} × {formatCurrency(price, currency)}
        </span>
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {formatCurrency(qty * price, currency)}
        </span>
      </div>
    </div>
  );
}

function SortableLineItem({
  item,
  showRemove,
  index,
  total,
}: {
  item: LineItem;
  showRemove: boolean;
  index: number;
  total: number;
}) {
  const { settings, removeItem, updateItem, moveItem, focusItemId, clearFocusItem } = useStore();
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const descRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (focusItemId === item.id) {
      descRef.current?.focus();
      clearFocusItem();
    }
  }, [focusItemId, item.id, clearFocusItem]);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Split the currency symbol from the digits so the symbol can be dimmed.
  const amountText = formatCurrency(Math.max(0, item.qty) * Math.max(0, item.price), settings.currency);
  const amtMatch = amountText.match(/^(\D*)(.*)$/);
  const amtSym = amtMatch?.[1]?.trim() ?? "";
  const amtNum = amtMatch?.[2] || amountText;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-item border border-item-border rounded-xl p-3.5 relative",
        isDragging && "outline-2 outline-dashed outline-primary/40 -outline-offset-2 bg-primary/5"
      )}
    >
      <div className={cn(isDragging && "invisible")}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2.5">
            {showRemove && (
              <>
                {/* Desktop: drag handle */}
                <button
                  type="button"
                  {...attributes}
                  {...listeners}
                  title={t("f.drag")}
                  className="max-lg:hidden cursor-grab active:cursor-grabbing touch-none text-muted-foreground/50 hover:text-muted-foreground -ml-1"
                >
                  <GripVertical className="size-4" />
                </button>
                {/* Mobile: up/down reorder (drag is fiddly on touch) */}
                <div className="lg:hidden flex items-center -ml-1.5">
                  <button
                    type="button"
                    onClick={() => moveItem(item.id, -1)}
                    disabled={index === 0}
                    title={t("f.moveUp")}
                    aria-label={t("f.moveUp")}
                    className="p-1 text-muted-foreground/60 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(item.id, 1)}
                    disabled={index === total - 1}
                    title={t("f.moveDown")}
                    aria-label={t("f.moveDown")}
                    className="p-1 text-muted-foreground/60 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>
              </>
            )}
            <Label className="text-xs font-normal text-muted-foreground">{t("f.desc")}</Label>
          </div>
        </div>
        {showRemove && (
          <button
            type="button"
            onClick={() => removeItem(item.id)}
            title={t("f.delItem")}
            className="absolute right-3.5 top-3 flex size-4 items-center justify-center cursor-pointer text-muted-foreground/60 hover:text-destructive transition-colors"
          >
            <X className="size-4" />
          </button>
        )}
        <Input
          ref={descRef}
          value={item.desc}
          placeholder={t("ph.itemDesc")}
          className="mb-3 bg-card"
          onChange={(e) => updateItem(item.id, { desc: e.target.value })}
        />
        <div className="flex items-end gap-2">
          <Field label={t("f.qty")} className="w-14">
            <Input
              type="number"
              min={1}
              value={item.qty}
              aria-label={t("f.qty")}
              className="bg-card"
              onChange={(e) => updateItem(item.id, { qty: Math.max(1, parseFloat(e.target.value) || 1) })}
            />
          </Field>
          <Field label={t("f.price")} className="min-w-0 flex-1">
            <CurrencyInput
              currency={settings.currency}
              className="bg-card"
              value={item.price}
              onValueChange={(n) => updateItem(item.id, { price: n })}
            />
          </Field>
          <Field label={t("inv.amount")} className="min-w-0 flex-1" labelClassName="text-right">
            <div className="flex h-9 w-full items-center justify-end gap-1 overflow-hidden rounded-md bg-muted-foreground/[0.06] px-3 text-[13px] tabular-nums">
              {amtSym && <span className="font-normal text-muted-foreground">{amtSym}</span>}
              <span className="font-semibold text-foreground">{amtNum}</span>
            </div>
          </Field>
        </div>
      </div>
    </div>
  );
}

export function LineItems() {
  const { invoice, settings, addItem, addItemWith, updateItem, reorderItems } = useStore();
  const { items: catalogItems } = useCatalog();
  const { t } = useI18n();
  // First-invoice walkthrough: once a client is set, beacon the add-item row
  // until a real item (with a description) exists.
  const coach = useEditorActions()?.coach ?? false;
  const itemBeacon =
    coach && !!invoice.client.name.trim() && !invoice.items.some((it) => it.desc.trim());
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const showRemove = invoice.items.length > 1;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const activeItem = activeId ? invoice.items.find((i) => i.id === activeId) ?? null : null;


  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      reorderItems(String(active.id), String(over.id));
    }
    setActiveId(null);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={invoice.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2.5">
            {invoice.items.map((item, idx) => (
              <SortableLineItem
                key={item.id}
                item={item}
                showRemove={showRemove}
                index={idx}
                total={invoice.items.length}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeItem ? <OverlayCard item={activeItem} currency={settings.currency} /> : null}
        </DragOverlay>
      </DndContext>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={addItem}
          className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-primary/30 bg-accent py-2.5 text-xs font-medium text-accent-foreground transition-colors hover:bg-secondary"
        >
          <Plus className="size-3.5" /> {t("f.addItem")}
        </button>
        <div className="relative shrink-0 rounded-md">
          {itemBeacon && <Beacon />}
          <Select
            value=""
            onValueChange={(id) => {
              const c = catalogItems.find((x) => x.id === id);
              if (!c) return;
              // If there's an empty item (blank desc + no price), fill THAT one
              // instead of appending a new card.
              const empty = invoice.items.find((it) => !it.desc.trim() && !it.price);
              if (empty) updateItem(empty.id, { desc: c.desc, price: c.price });
              else addItemWith(c.desc, c.price);
            }}
          >
            <SelectTrigger
              className="w-auto shrink-0 gap-1.5 bg-card text-xs font-medium text-foreground"
              aria-label={t("f.fromCatalog")}
            >
              <List className="size-3.5" />
              <span className="max-lg:hidden">{t("f.fromCatalog")}</span>
            </SelectTrigger>
            <SelectContent position="popper" align="end" className="max-h-72">
              {catalogItems.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">{t("f.catalogEmpty")}</div>
              ) : (
                catalogItems.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.desc} — {formatCurrency(c.price, settings.currency)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
