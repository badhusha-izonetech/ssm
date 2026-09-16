import { useMemo, useState } from 'react'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Card, SectionHeading, KpiCard, Modal, Field, inputCls } from '../../components/shared/Primitives'
import { DataTable, type Column } from '../../components/shared/DataTable'
import { Pagination } from '../../components/shared/Pagination'
import type { StockItem } from '../../types/models'
import { formatINR, formatDate } from '../../lib/utils'
import { AlertTriangle, Plus } from 'lucide-react'

const UNITS = ['Nos', 'Sets', 'Meters', 'Pairs', 'Kg', 'Rolls']

export default function ProductMaster() {
  const { stockItems, addStockItem, updateStockItem, receiveStock } = useApp()
  const { employee } = useAuth()
  const [category, setCategory] = useState('All Categories')
  const [addOpen, setAddOpen] = useState(false)
  const [manageFor, setManageFor] = useState<StockItem | null>(null)

  const availableCategories = useMemo(() => Array.from(new Set(stockItems.map((s) => s.category).filter(Boolean))) as string[], [stockItems])
  const categoryOptions = useMemo(() => ['All Categories', ...availableCategories], [availableCategories])
  const filtered = useMemo(() => stockItems.filter((s) => category === 'All Categories' || s.category === category), [stockItems, category])
  const [currentPage, setCurrentPage] = useState(1)
  const paginatedFiltered = useMemo(() => filtered.slice((currentPage - 1) * 25, currentPage * 25), [filtered, currentPage])
  const totalValue = stockItems.reduce((s, i) => s + i.currentQuantity * i.costPerUnit, 0)
  const lowStockCount = stockItems.filter((s) => s.availableQuantity <= s.minimumLevel).length

  const columns: Column<StockItem>[] = [
    { header: 'Product', cell: (s) => (
      <div>
        <div className="font-medium text-text">{s.productName}</div>
        <div className="text-xs text-text-dim">{s.brand} · {s.model}</div>
      </div>
    ) },
    { header: 'Category', cell: (s) => s.category },
    { header: 'Current', cell: (s) => `${s.currentQuantity} ${s.unit}` },
    { header: 'Reserved', cell: (s) => <span className="text-sun">{s.reservedQuantity} {s.unit}</span> },
    { header: 'Available', cell: (s) => (
      <span className={s.availableQuantity <= s.minimumLevel ? 'text-rose font-medium flex items-center gap-1' : 'text-teal'}>
        {s.availableQuantity <= s.minimumLevel && <AlertTriangle size={12} />}
        {s.availableQuantity} {s.unit}
      </span>
    ) },
    { header: 'Min Level', cell: (s) => `${s.minimumLevel} ${s.unit}` },
    { header: 'Cost / Unit', cell: (s) => formatINR(s.costPerUnit) },
    { header: 'Last Receipt', cell: (s) => formatDate(s.lastReceiptDate ?? '—') },
    { header: '', cell: (s) => (
      <div className="flex items-center gap-2">
        <button onClick={(e) => { e.stopPropagation(); setManageFor(s) }} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors whitespace-nowrap">
          Manage
        </button>
      </div>
    ) },
  ]

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="Warehouse → Product Master"
        title="Product Master"
        action={
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition">
            <Plus size={15} /> New Product
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard label="Total Inventory Value" value={formatINR(totalValue)} accent="sun" />
        <KpiCard label="Product Lines" value={String(stockItems.length)} accent="teal" />
        <KpiCard label="Low Stock Items" value={String(lowStockCount)} accent="rose" />
      </div>

      <Card className="p-3">
        <div className="flex gap-1.5 flex-wrap">
          {categoryOptions.map((c) => (
            <button key={c} onClick={() => { setCategory(c); setCurrentPage(1); }} className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all ${category === c ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs' : 'text-text-dim hover:text-text hover:bg-slate-100'}`}>
              {c}
            </button>
          ))}
        </div>
      </Card>

      <div className="flex flex-col drop-shadow-xs">
        <DataTable
          columns={columns}
          rows={paginatedFiltered}
          keyFn={(s) => s.id}
          mobileCard={(s) => (
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-sm text-text">{s.productName}</div>
                  <div className="text-xs text-text-dim">{s.brand} · {s.model} · {s.category}</div>
                </div>
                <div className="text-xs font-medium">{formatINR(s.costPerUnit)}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div><div className="text-text-dim">Current</div><div className="font-medium">{s.currentQuantity} {s.unit}</div></div>
                <div><div className="text-text-dim">Reserved</div><div className="font-medium text-sun">{s.reservedQuantity} {s.unit}</div></div>
                <div><div className="text-text-dim">Available</div><div className={`font-medium ${s.availableQuantity <= s.minimumLevel ? 'text-rose' : 'text-teal'}`}>{s.availableQuantity} {s.unit}</div></div>
              </div>
              <button onClick={() => setManageFor(s)} className="w-full mt-3 text-xs font-medium px-3 py-2 rounded-lg bg-teal/10 text-teal border border-teal/30">Manage</button>
            </Card>
          )}
        />
        <Pagination currentPage={currentPage} totalItems={filtered.length} onPageChange={setCurrentPage} />
      </div>

      {addOpen && <AddProductModal onClose={() => setAddOpen(false)} onCreate={addStockItem} categories={availableCategories} />}
      {manageFor && (
        <ManageProductModal
          item={manageFor}
          onClose={() => setManageFor(null)}
          onUpdate={updateStockItem}
          categories={availableCategories}
          onReceive={(quantity, supplier, notes) => {
            receiveStock({ itemId: manageFor.id, quantity, performedBy: employee?.name ?? 'Warehouse', supplier, notes })
          }}
        />
      )}
    </div>
  )
}

function AddProductModal({ onClose, onCreate, categories }: { onClose: () => void; onCreate: ReturnType<typeof useApp>['addStockItem']; categories: string[] }) {
  const allCats = useMemo(() => {
    const cats = categories.filter((c) => c !== 'Other')
    cats.push('Other')
    return cats.length > 1 ? cats : ['Panels', 'Inverters', 'Other']
  }, [categories])

  const [productName, setProductName] = useState('')
  const [categorySelect, setCategorySelect] = useState(allCats[0])
  const [customCategory, setCustomCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [unit, setUnit] = useState(UNITS[0])
  const [opening, setOpening] = useState('0')
  const [minLevel, setMinLevel] = useState('')
  const [cost, setCost] = useState('')
  const [supplier, setSupplier] = useState('')

  const finalCategory = categorySelect === 'Other' ? customCategory.trim() : categorySelect
  const valid = productName.trim() && brand.trim() && model.trim() && finalCategory && Number(minLevel) >= 0 && Number(cost) > 0

  function handleCreate() {
    if (!valid) return
    onCreate({
      productName: productName.trim(), category: finalCategory, brand: brand.trim(), model: model.trim(), unit,
      minimumLevel: Number(minLevel) || 0, costPerUnit: Number(cost) || 0, supplier: supplier.trim() || undefined,
      openingQuantity: Number(opening) || 0,
    })
    onClose()
  }

  return (
    <Modal title="New Product" onClose={onClose} wide>
      <div className="space-y-4">
        <Field label="Product Name">
          <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g. Monocrystalline Solar Panel 550W" className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <div className="flex flex-col gap-2">
              <select value={categorySelect} onChange={(e) => setCategorySelect(e.target.value)} className={inputCls}>
                {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {categorySelect === 'Other' && (
                <input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Enter new category" className={inputCls} autoFocus />
              )}
            </div>
          </Field>
          <Field label="Unit">
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="Brand"><input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Waaree" className={inputCls} /></Field>
          <Field label="Model"><input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. WSM-550" className={inputCls} /></Field>
          <Field label="Opening Quantity"><input type="number" min="0" value={opening} onChange={(e) => setOpening(e.target.value)} className={inputCls} /></Field>
          <Field label="Minimum Level"><input type="number" min="0" value={minLevel} onChange={(e) => setMinLevel(e.target.value)} className={inputCls} /></Field>
          <Field label="Cost per Unit (₹)"><input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} className={inputCls} /></Field>
          <Field label="Supplier (optional)"><input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Waaree Energies Ltd" className={inputCls} /></Field>
        </div>
        <button disabled={!valid} onClick={handleCreate} className="w-full bg-emerald-600 text-white font-semibold text-sm rounded-xl py-2.5 hover:bg-emerald-700 shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed">
          Add to Product Master
        </button>
      </div>
    </Modal>
  )
}

function ManageProductModal({ item, onClose, onUpdate, onReceive, categories }: { item: StockItem; onClose: () => void; onUpdate: (id: string, payload: Partial<StockItem>) => void; onReceive: (quantity: number, supplier?: string, notes?: string) => void; categories: string[] }) {
  const [quantity, setQuantity] = useState('')
  const [receiveSupplier, setReceiveSupplier] = useState(item.supplier ?? '')
  const [notes, setNotes] = useState('')
  const qty = Number(quantity)

  const allCats = useMemo(() => {
    const cats = categories.filter((c) => c !== 'Other')
    cats.push('Other')
    return cats.length > 1 ? cats : ['Panels', 'Inverters', 'Other']
  }, [categories])

  const initialCat = item.category && allCats.includes(item.category) ? item.category : 'Other'

  const [productName, setProductName] = useState(item.productName)
  const [categorySelect, setCategorySelect] = useState(initialCat)
  const [customCategory, setCustomCategory] = useState(initialCat === 'Other' && item.category ? item.category : '')
  const [brand, setBrand] = useState(item.brand || '')
  const [model, setModel] = useState(item.model || '')
  const [unit, setUnit] = useState(item.unit || UNITS[0])
  const [minLevel, setMinLevel] = useState(String(item.minimumLevel))
  const [cost, setCost] = useState(String(item.costPerUnit))
  const [supplier, setSupplier] = useState(item.supplier || '')

  const finalCategory = categorySelect === 'Other' ? customCategory.trim() : categorySelect
  const editValid = productName.trim() && brand.trim() && model.trim() && finalCategory && Number(minLevel) >= 0 && Number(cost) >= 0

  function handleUpdate() {
    if (!editValid) return
    onUpdate(item.id, {
      productName: productName.trim(), category: finalCategory, brand: brand.trim(), model: model.trim(), unit,
      minimumLevel: Number(minLevel) || 0, costPerUnit: Number(cost) || 0, supplier: supplier.trim() || undefined
    })
    onClose()
  }

  function handleReceive() {
    onReceive(qty, receiveSupplier.trim() || undefined, notes.trim() || undefined)
    setQuantity('')
    setNotes('')
  }

  return (
    <Modal title={`Product Master — ${item.productName}`} onClose={onClose} wide>
      <div className="space-y-8">
        
        {/* RECEIVE STOCK SECTION */}
        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-2">Receive Stock</div>
          <div className="text-xs text-text-dim bg-panel-raised border border-border rounded-lg p-3 flex gap-4">
            <div>Current: <span className="font-medium text-text">{item.currentQuantity} {item.unit}</span></div>
            <div>Available: <span className="font-medium text-text">{item.availableQuantity} {item.unit}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Quantity Received (${item.unit})`}>
              <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Supplier / Purchase Reference">
              <input value={receiveSupplier} onChange={(e) => setReceiveSupplier(e.target.value)} className={inputCls} />
            </Field>
            <div className="col-span-2">
              <Field label="Notes (optional)">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
              </Field>
            </div>
          </div>
          <button disabled={!(qty > 0)} onClick={handleReceive} className="w-full bg-teal text-ink font-semibold text-sm rounded-lg py-2.5 hover:brightness-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            Confirm Stock Receipt
          </button>
        </div>

        <div className="border-t border-border"></div>

        {/* EDIT PRODUCT SECTION */}
        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-2">Edit Product</div>
          <Field label="Product Name">
            <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g. Monocrystalline Solar Panel 550W" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <div className="flex flex-col gap-2">
                <select value={categorySelect} onChange={(e) => setCategorySelect(e.target.value)} className={inputCls}>
                  {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {categorySelect === 'Other' && (
                  <input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Enter new category" className={inputCls} />
                )}
              </div>
            </Field>
            <Field label="Unit">
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Brand"><input value={brand} onChange={(e) => setBrand(e.target.value)} className={inputCls} /></Field>
            <Field label="Model"><input value={model} onChange={(e) => setModel(e.target.value)} className={inputCls} /></Field>
            <Field label="Minimum Level"><input type="number" min="0" value={minLevel} onChange={(e) => setMinLevel(e.target.value)} className={inputCls} /></Field>
            <Field label="Cost per Unit (₹)"><input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} className={inputCls} /></Field>
            <Field label="Supplier"><input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputCls} /></Field>
          </div>
          <button disabled={!editValid} onClick={handleUpdate} className="w-full bg-emerald-600 text-white font-semibold text-sm rounded-xl py-2.5 hover:bg-emerald-700 shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed">
            Save Changes
          </button>
        </div>

      </div>
    </Modal>
  )
}
