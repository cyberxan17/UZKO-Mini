import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Barcode,
  Plus,
  Minus,
  Check,
} from "lucide-react";
import {
  MOCK_PRODUCTS,
  MOCK_RATES,
  MOCK_PRODUCT_HISTORY,
  MOCK_SUPPLIER_REPORTS,
  formatSom,
  costInSom,
} from "@/lib/mock-data";
import type { Currency, Product } from "@/lib/mock-data";
import { toast } from "sonner";
import { useApp } from "@/lib/app-context";
import { dispatchSupplierReceipt } from "@/lib/data-actions";
import type { ProductCreateMode } from "@/routes/tovarlar";
import { formatNumberInput, parseNumberInput } from "@/lib/utils";

type NewProductRow = {
  id: string;
  existingProductId?: string;
  name: string;
  barcode: string;
  qty: string;
  costCurrency: Currency;
  costPrice: string;
  price: string;
  wholesalePrice: string;
  unit: string;
  warehouse: string;
  shelfLocation: string;
};

type SupplierSource = {
  enabled: boolean;
  agentId: string;
  agentName: string;
  agentPhone: string;
  paidAmount: string;
  note: string;
  sendBotUpdate: boolean;
};

const makeNewProductRow = (unit = "dona", warehouse = "Asosiy ombor"): NewProductRow => ({
  id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: "",
  barcode: "",
  qty: "",
  costCurrency: "UZS",
  costPrice: "",
  price: "",
  wholesalePrice: "",
  unit,
  warehouse,
  shelfLocation: "",
});

function toNumber(value: unknown) {
  const cleaned = String(value ?? "")
    .replace(/\s/g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function currencyRate(currency: Currency) {
  return MOCK_RATES[currency] ?? 1;
}

function moneyInputToSom(value: string | number, currency: Currency) {
  return Math.round(Math.max(0, toNumber(value)) * currencyRate(currency));
}

function somToMoneyInput(value: number | undefined, currency: Currency) {
  const amount = Math.max(0, value ?? 0) / currencyRate(currency);
  if (!Number.isFinite(amount)) return "";
  return String(Number(amount.toFixed(currency === "UZS" ? 0 : 2)));
}

function makeProductCode(name: string) {
  return (
    name
      .trim()
      .slice(0, 4)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "") + Math.floor(Math.random() * 99)
  );
}

function makeBarcode() {
  return "8690" + String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, "0");
}

function makeUniqueBarcode(used: Iterable<string> = []) {
  const usedSet = new Set(
    [
      ...MOCK_PRODUCTS.flatMap((product) => splitBarcodes(product.barcode)),
      ...Array.from(used).flatMap((value) => splitBarcodes(value)),
    ].filter(Boolean),
  );
  let barcode = makeBarcode();
  while (usedSet.has(barcode)) barcode = makeBarcode();
  return barcode;
}

function splitBarcodes(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinBarcodes(values: string[]) {
  return values
    .map((item) => item.trim())
    .filter(Boolean)
    .join(" | ");
}

function makeAgentId() {
  const next = MOCK_SUPPLIER_REPORTS.length + 1;
  return `AG-${String(next).padStart(4, "0")}`;
}

function getAgents() {
  const map = new Map<
    string,
    {
      id: string;
      name: string;
      phone: string;
      botEnabled: boolean;
      totalAmount: number;
      paidAmount: number;
      remainingDebt: number;
    }
  >();
  MOCK_SUPPLIER_REPORTS.forEach((row) => {
    if (!row.agentId) return;
    const current = map.get(row.agentId);
    map.set(row.agentId, {
      id: row.agentId,
      name: row.agentName || "Nomsiz agent",
      phone: row.agentPhone || "",
      botEnabled: (current?.botEnabled ?? false) || Boolean(row.botEnabled),
      totalAmount: (current?.totalAmount ?? 0) + row.totalAmount,
      paidAmount: (current?.paidAmount ?? 0) + row.paidAmount,
      remainingDebt: (current?.remainingDebt ?? 0) + row.remainingDebt,
    });
  });
  return Array.from(map.values());
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function latestProductSource(productName: string) {
  const name = normalizeSearchValue(productName);
  return MOCK_PRODUCT_HISTORY.find(
    (row) => normalizeSearchValue(row.productName) === name && Boolean(row.agentName),
  );
}

function recordProductAddition(input: {
  productName: string;
  qty: number;
  unit: string;
  price: number;
  costPrice: number;
  warehouse: string;
  addedBy: string;
  source?: SupplierSource;
}) {
  const sourceEnabled = Boolean(input.source?.enabled && input.source.agentName.trim());
  const totalAmount = input.qty * input.costPrice;
  const paidAmount = sourceEnabled ? Math.max(0, Number(input.source?.paidAmount) || 0) : undefined;
  MOCK_PRODUCT_HISTORY.unshift({
    id: `ph${Date.now()}-${Math.random()}`,
    date: new Date().toISOString(),
    addedBy: input.addedBy,
    productName: input.productName,
    qty: input.qty,
    unit: input.unit,
    price: input.price,
    costPrice: input.costPrice,
    warehouse: input.warehouse,
    agentName: sourceEnabled ? input.source?.agentName.trim() : undefined,
    agentId: sourceEnabled ? input.source?.agentId || makeAgentId() : undefined,
    agentPhone: sourceEnabled ? input.source?.agentPhone.trim() : undefined,
    paidAmount,
    remainingDebt: sourceEnabled ? Math.max(0, totalAmount - (paidAmount ?? 0)) : undefined,
    totalAmount: sourceEnabled ? totalAmount : undefined,
    note: sourceEnabled ? input.source?.note.trim() : undefined,
  });
  if (input.source?.enabled && input.source.agentName.trim()) {
    MOCK_SUPPLIER_REPORTS.unshift({
      id: `sr${Date.now()}-${Math.random()}`,
      date: new Date().toISOString(),
      addedBy: input.addedBy,
      agentId: input.source.agentId || makeAgentId(),
      agentName: input.source.agentName.trim(),
      agentPhone: input.source.agentPhone.trim(),
      botEnabled: input.source.sendBotUpdate,
      items: [
        { productName: input.productName, qty: input.qty, unit: input.unit, amount: totalAmount },
      ],
      totalAmount,
      paidAmount: paidAmount ?? 0,
      remainingDebt: Math.max(0, totalAmount - (paidAmount ?? 0)),
      note: input.source.note.trim(),
    });
  }
}

export function TovarQoshish({ onDone }: { mode: ProductCreateMode; onDone: () => void }) {
  return <CreateNew onDone={onDone} />;
}

function CreateNew({ onDone }: { onDone: () => void }) {
  const { settings } = useApp();
  const defaultWarehouse = settings.warehouses[0] ?? "Asosiy ombor";
  const agents = getAgents();
  const [source, setSource] = React.useState<SupplierSource>({
    enabled: false,
    agentId: makeAgentId(),
    agentName: "",
    agentPhone: "",
    paidAmount: "0",
    note: "",
    sendBotUpdate: true,
  });
  const [rows, setRows] = React.useState<NewProductRow[]>(() => [
    makeNewProductRow(settings.units[0] ?? "dona", defaultWarehouse),
  ]);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deductFromCashbox, setDeductFromCashbox] = React.useState(true);
  const selectedAgent = React.useMemo(
    () => agents.find((agent) => agent.id === source.agentId),
    [agents, source.agentId],
  );

  const productSuggestionsFor = (row: NewProductRow) => {
    const q = normalizeSearchValue(row.name);
    if (q.length < 2) return [];
    return MOCK_PRODUCTS.filter((product) =>
      `${product.name} ${product.customCode} ${product.barcode}`.toLowerCase().includes(q),
    ).slice(0, 6);
  };

  const updateRow = (id: string, patch: Partial<NewProductRow>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    setRows((current) => [...current, makeNewProductRow(settings.units[0] ?? "dona", defaultWarehouse)]);
  };

  const removeRow = (id: string) => {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current));
  };

  const assignBarcode = (id: string) => {
    const row = rows.find((item) => item.id === id);
    const used = rows.filter((item) => item.id !== id).map((item) => item.barcode);
    const nextCode = makeUniqueBarcode(used);
    const currentCodes = splitBarcodes(row?.barcode ?? "");
    updateRow(id, { barcode: joinBarcodes([...currentCodes, nextCode]) });
  };

  const appendBarcodeSlot = (id: string) => {
    const row = rows.find((item) => item.id === id);
    const current = row?.barcode ?? "";
    if (!current.trim()) return;
    if (/\|\s*$/.test(current)) return;
    updateRow(id, { barcode: `${current.trim()} | ` });
  };

  const selectExistingProduct = (rowId: string, product: Product) => {
    const currency = product.costCurrency;
    const sourceInfo = latestProductSource(product.name);
    updateRow(rowId, {
      existingProductId: product.id,
      name: product.name,
      barcode: product.barcode,
      costCurrency: currency,
      costPrice: formatNumberInput(product.costPrice),
      price: somToMoneyInput(product.price, currency),
      wholesalePrice: somToMoneyInput(product.wholesalePrice, currency),
      unit: product.unit,
      warehouse: settings.warehouses.includes(product.warehouse) ? product.warehouse : defaultWarehouse,
      shelfLocation: product.shelfLocation ?? "",
    });
    if (sourceInfo?.agentName) {
      setSource({
        enabled: true,
        agentId: sourceInfo.agentId || makeAgentId(),
        agentName: sourceInfo.agentName,
        agentPhone: sourceInfo.agentPhone || "",
        paidAmount: source.paidAmount || "0",
        note: sourceInfo.note || "",
        sendBotUpdate: true,
      });
      setConfirmOpen(true);
    }
    toast.success("Bazadagi mahsulot tanlandi", {
      description: product.name,
    });
  };

  const validRows = rows
    .map((row) => ({
      ...row,
      name: row.name.trim(),
      warehouseValue: row.warehouse.trim() || defaultWarehouse,
      shelfLocationValue: row.shelfLocation.trim(),
      qtyNumber: Math.max(0, parseNumberInput(row.qty) || 0),
      costNumber: Math.max(0, parseNumberInput(row.costPrice) || 0),
      priceSom: moneyInputToSom(row.price, row.costCurrency),
      wholesalePriceSom: moneyInputToSom(row.wholesalePrice, row.costCurrency),
      unitValue: (row.unit.trim() || settings.units[0]) ?? "dona",
      barcodeValue: joinBarcodes(splitBarcodes(row.barcode)),
    }))
    .filter((row) => row.name && row.qtyNumber > 0);

  const totalCostSom = validRows.reduce(
    (sum, row) => sum + row.qtyNumber * row.costNumber * (MOCK_RATES[row.costCurrency] ?? 1),
    0,
  );
  const openConfirm = () => {
    if (validRows.length === 0) return toast.error("Kamida bitta tovar nomi va sonini kiriting");
    if (!source.enabled) {
      setSource({
        enabled: false,
        agentId: makeAgentId(),
        agentName: "",
        agentPhone: "",
        paidAmount: "0",
        note: "",
        sendBotUpdate: true,
      });
    }
    setConfirmOpen(true);
  };

  const finalizeReceiving = () => {
    const totalPaid = Math.max(0, parseNumberInput(source.paidAmount) || 0);
    const sourceEnabled = Boolean(source.enabled && source.agentName.trim());
    if (source.enabled && !source.agentName.trim()) {
      toast.error("Agent ismini kiriting yoki hech qisi yo'q deb belgilang");
      return;
    }

    const usedBarcodes = new Set(MOCK_PRODUCTS.flatMap((product) => splitBarcodes(product.barcode)));
    rows.forEach((row) => {
      splitBarcodes(row.barcode).forEach((barcode) => usedBarcodes.add(barcode));
    });

    validRows.forEach((row, index) => {
      const rowBarcodes = splitBarcodes(row.barcodeValue);
      const nextBarcodes = rowBarcodes.length > 0 ? rowBarcodes : [makeUniqueBarcode(usedBarcodes)];
      nextBarcodes.forEach((barcode) => usedBarcodes.add(barcode));
      const barcode = joinBarcodes(nextBarcodes);
      const existingProduct = row.existingProductId
        ? MOCK_PRODUCTS.find((product) => product.id === row.existingProductId)
        : undefined;
      const rowWarehouse = row.warehouseValue || defaultWarehouse;
      const newProd: Product = existingProduct ?? {
        id: `p${Date.now()}-${index}`,
        name: row.name,
        price: row.priceSom,
        wholesalePrice: row.wholesalePriceSom,
        costPrice: row.costNumber,
        costCurrency: row.costCurrency,
        barcode,
        customCode: makeProductCode(row.name),
        unit: row.unitValue,
        warehouse: rowWarehouse,
        shelfLocation: "",
        vitrinaQty: 0,
        omborQty: 0,
        salesHistory: [],
      };
      newProd.name = row.name;
      newProd.price = row.priceSom;
      newProd.wholesalePrice = row.wholesalePriceSom;
      newProd.costPrice = row.costNumber;
      newProd.costCurrency = row.costCurrency;
      newProd.barcode = barcode;
      newProd.unit = row.unitValue;
      newProd.warehouse = rowWarehouse;
      newProd.shelfLocation = row.shelfLocationValue;
      newProd.omborQty += row.qtyNumber;
      if (!existingProduct) MOCK_PRODUCTS.push(newProd);

      const rowCostSom = row.qtyNumber * row.costNumber * (MOCK_RATES[row.costCurrency] ?? 1);
      const paidShare =
        sourceEnabled && totalCostSom > 0
          ? Math.round((totalPaid * rowCostSom) / totalCostSom)
          : 0;

      recordProductAddition({
        productName: newProd.name,
        qty: newProd.omborQty,
        unit: newProd.unit,
        price: newProd.price,
        costPrice: costInSom(newProd),
        warehouse: newProd.warehouse,
        shelfLocation: newProd.shelfLocation,
        addedBy: settings.username,
        source: sourceEnabled
          ? {
              ...source,
              paidAmount: String(paidShare),
              note: source.note,
            }
          : {
              enabled: false,
              agentId: "",
              agentName: "",
              agentPhone: "",
              paidAmount: "0",
              note: "",
              sendBotUpdate: false,
            },
      });
    });

    if (
      sourceEnabled &&
      source.sendBotUpdate &&
      source.agentPhone.trim() &&
      source.agentName.trim()
    ) {
      dispatchSupplierReceipt({
        receiptId: `AGENT-${Date.now()}`,
        report: {
          agentId: source.agentId || makeAgentId(),
          agentName: source.agentName.trim(),
          agentPhone: source.agentPhone.trim(),
          totalAmount: totalCostSom,
          paidAmount: totalPaid,
          remainingDebt: Math.max(0, totalCostSom - totalPaid),
        },
        note: source.note.trim() || `${validRows.length} ta tovar bo'yicha prixod`,
      });
    }

    setConfirmOpen(false);
    toast.success("Mahsulotlar qabul qilindi", {
      description: `${validRows.length} xil mahsulot qabul qilindi`,
    });
    onDone();
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <section className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
          <div>
            <div className="text-sm font-semibold">Mahsulot qabul qilish</div>
            <div className="text-[11px] text-muted-foreground">
              Qatorlar ko'payganda faqat shu ro'yxat scroll qiladi.
            </div>
          </div>
          <Button onClick={openConfirm} className="h-8 gap-2 text-xs">
            <Check className="h-4 w-4" />
            Tasdiqlash
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
          <div className="space-y-3">
            {rows.map((row, index) => {
              const tanInSom =
                (parseNumberInput(row.costPrice) || 0) * (MOCK_RATES[row.costCurrency] ?? 1);
              const saleInSom = moneyInputToSom(row.price, row.costCurrency);
              const wholesaleInSom = moneyInputToSom(row.wholesalePrice, row.costCurrency);
              const productSuggestions = productSuggestionsFor(row);
              return (
                <div key={row.id} className="rounded-xl border bg-muted/10 p-2.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="text-[11px] font-semibold text-muted-foreground">
                        Tovar #{index + 1}
                      </div>
                      {row.existingProductId && (
                        <div className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                          Bazadagi mahsulot tanlandi
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-6 w-6"
                        onClick={addRow}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length <= 1}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid items-end gap-2 xl:grid-cols-[minmax(220px,2.2fr)_56px_72px_112px_112px_112px_128px_96px_minmax(160px,1.5fr)_72px]">
                    <Field label="Tovar nomi">
                      <div className="relative">
                        <Input
                          value={row.name}
                          onChange={(e) =>
                            updateRow(row.id, {
                              name: e.target.value,
                              existingProductId: undefined,
                          })
                          }
                          placeholder="Mahsulot nomini kiriting"
                          className="h-5 text-[9px]"
                        />
                        {productSuggestions.length > 0 && !row.existingProductId && (
                          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-44 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">
                            {productSuggestions.map((product) => {
                              const sourceInfo = latestProductSource(product.name);
                              return (
                                <button
                                  key={product.id}
                                  type="button"
                                  onClick={() => selectExistingProduct(row.id, product)}
                                  className="w-full rounded px-2 py-0.5 text-left text-[9px] hover:bg-muted"
                                >
                                  <div className="font-semibold">{product.name}</div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {formatSom(costInSom(product))}
                                    {sourceInfo?.agentName ? ` · ${sourceInfo.agentName}` : ""}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </Field>

                    <Field label="Soni">
                      <Input
                        value={row.qty}
                        onChange={(e) => updateRow(row.id, { qty: formatNumberInput(e.target.value) })}
                        placeholder="0"
                        className="h-8 text-xs"
                        inputMode="decimal"
                      />
                    </Field>

                    <Field label="Birligi">
                      <Select
                        value={row.unit || settings.units[0] || "dona"}
                        onValueChange={(value) => updateRow(row.id, { unit: value })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {settings.units.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label="Tan narxi">
                      <div className="grid grid-cols-[1fr_68px] gap-1">
                        <Input
                          value={row.costPrice}
                          onChange={(e) =>
                            updateRow(row.id, { costPrice: formatNumberInput(e.target.value) })
                          }
                          placeholder="0"
                          className="h-8 text-xs"
                          inputMode="decimal"
                        />
                        <Select
                          value={row.costCurrency || settings.currencies[0] || "UZS"}
                          onValueChange={(value) =>
                            updateRow(row.id, { costCurrency: value as Currency })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs uppercase">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {settings.currencies.map((currency) => (
                              <SelectItem key={currency} value={currency}>
                                {currency}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </Field>

                    <Field label="Sotuv narxi">
                      <Input
                        value={row.price}
                        onChange={(e) =>
                          updateRow(row.id, { price: formatNumberInput(e.target.value) })
                        }
                        placeholder={row.costCurrency}
                        className="h-8 text-xs"
                        inputMode="decimal"
                      />
                    </Field>

                    <Field label="Optom narxi">
                      <Input
                        value={row.wholesalePrice}
                        onChange={(e) =>
                          updateRow(row.id, {
                            wholesalePrice: formatNumberInput(e.target.value),
                          })
                        }
                        placeholder={row.costCurrency}
                        className="h-8 text-xs"
                        inputMode="decimal"
                      />
                    </Field>

                    <Field label="Ombor">
                      <Select
                        value={row.warehouse || defaultWarehouse}
                        onValueChange={(value) => updateRow(row.id, { warehouse: value })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {settings.warehouses.map((w) => (
                            <SelectItem key={w} value={w}>
                              {w}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label="Polka raqami">
                      <Select
                        value={row.shelfLocation || "__empty__"}
                        onValueChange={(value) =>
                          updateRow(row.id, {
                            shelfLocation: value === "__empty__" ? "" : value,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Tanlang" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__empty__">Tanlanmagan</SelectItem>
                          {settings.shelfLocations.map((loc) => (
                            <SelectItem key={loc} value={loc}>
                              {loc}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label="Shtrix kod">
                      <div className="flex gap-1">
                        <Input
                          value={row.barcode}
                          onChange={(e) => updateRow(row.id, { barcode: e.target.value })}
                          className="h-5 min-w-0 flex-1 text-[9px]"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-5 w-5 shrink-0"
                          onClick={() => appendBarcodeSlot(row.id)}
                          title="Yana bir barcode qo'shish"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-5 w-5 shrink-0"
                          onClick={() => assignBarcode(row.id)}
                          title="Avtomatik shtrix kod"
                        >
                          <Barcode className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Field>

                    <div className="flex items-end gap-1.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 shrink-0"
                        onClick={addRow}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Qabul ma'lumotlari</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">Agent tanlash</div>
                  <div className="text-[11px] text-muted-foreground">
                    Agent bo'lsa tanlang, bo'lmasa "hech qisi" holatida davom eting.
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={!source.enabled ? "default" : "outline"}
                  onClick={() =>
                    setSource({
                      enabled: false,
                      agentId: makeAgentId(),
                      agentName: "",
                      agentPhone: "",
                      paidAmount: "0",
                      note: "",
                      sendBotUpdate: true,
                    })
                  }
                >
                  Hech qisi
                </Button>
              </div>

              <div>
                <Label className="mb-1 block text-xs">Agentlar bazasi</Label>
                <Select
                  value={source.enabled ? source.agentId : "__none__"}
                  onValueChange={(value) => {
                    if (value === "__none__") {
                      setSource({
                        enabled: false,
                        agentId: makeAgentId(),
                        agentName: "",
                        agentPhone: "",
                        paidAmount: "0",
                        note: "",
                        sendBotUpdate: true,
                      });
                      return;
                    }
                    const agent = agents.find((item) => item.id === value);
                    if (!agent) return;
                    setSource((current) => ({
                      ...current,
                      enabled: true,
                      agentId: agent.id,
                      agentName: agent.name,
                      agentPhone: agent.phone,
                      sendBotUpdate: agent.botEnabled,
                    }));
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Agent tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Hech qisi yo'q</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name} · {agent.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {source.enabled && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border bg-card p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Agent kodi</div>
                    <div className="text-sm font-semibold">{source.agentId}</div>
                  </div>
                  <div className="rounded-md border bg-card p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Agent ismi</div>
                    <div className="text-sm font-semibold">{source.agentName || "-"}</div>
                  </div>
                  <div className="rounded-md border bg-card p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Telefon</div>
                    <div className="text-sm font-semibold">{source.agentPhone || "-"}</div>
                  </div>
                  <div className="rounded-md border bg-card p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Hozir beriladi</div>
                    <Input
                      type="number"
                      value={source.paidAmount}
                      onChange={(e) => setSource({ ...source, paidAmount: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}

              {source.enabled && (
                <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
                  <Checkbox
                    id="from-main-cashbox"
                    checked={deductFromCashbox}
                    onCheckedChange={(checked) => setDeductFromCashbox(checked === true)}
                  />
                  <Label htmlFor="from-main-cashbox" className="text-xs font-medium">
                    Asosiy kassadan
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    Berilgan summa kassadan chiqadi
                  </span>
                </div>
              )}

              {source.enabled && selectedAgent && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border bg-card p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Jami qarz</div>
                    <div className="text-sm font-semibold">{formatSom(selectedAgent.totalAmount)}</div>
                  </div>
                  <div className="rounded-md border bg-card p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">To'langan</div>
                    <div className="text-sm font-semibold">{formatSom(selectedAgent.paidAmount)}</div>
                  </div>
                  <div className="rounded-md border bg-card p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Qoldiq qarz</div>
                    <div className="text-sm font-semibold">{formatSom(selectedAgent.remainingDebt)}</div>
                  </div>
                  <div className="rounded-md border bg-card p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Bot holati</div>
                    <div className="text-sm font-semibold">
                      {selectedAgent.botEnabled ? "Yoqilgan" : "O'chirilgan"}
                    </div>
                  </div>
                  <div className="rounded-md border bg-card p-2 sm:col-span-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Telefon</div>
                    <div className="text-sm font-semibold">{selectedAgent.phone || "-"}</div>
                  </div>
                </div>
              )}

              <div>
                <Label className="mb-1 block text-xs">Izoh</Label>
                <Input
                  value={source.note}
                  onChange={(e) => setSource({ ...source, note: e.target.value })}
                  placeholder="Ixtiyoriy izoh"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
              <div className="text-sm font-semibold">Qisqa jamlanma</div>
              <div className="grid gap-2">
                <div className="rounded-md border bg-card p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Mahsulotlar</div>
                  <div className="text-base font-bold">{validRows.length} ta qator</div>
                </div>
                <div className="rounded-md border bg-card p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Jami tannarx</div>
                  <div className="text-base font-bold">{formatSom(totalCostSom)}</div>
                </div>
                <div className="rounded-md border bg-card p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Holat</div>
                  <div className="text-sm font-medium">
                    {source.enabled ? "Agent bilan qabul qilinadi" : "Agentsiz qabul qilinadi"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={finalizeReceiving}>Qabul qilish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
