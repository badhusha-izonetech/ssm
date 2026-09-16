import { useState } from 'react'
import { Modal, Field, inputCls, Pill } from './Primitives'
import { useApp } from '../../store/AppStore'
import type { Product } from '../../types/models'
import { formatINR } from '../../lib/utils'

export function ProductCatalogModal({ onClose, initialAdd = false }: { onClose: () => void; initialAdd?: boolean }) {
  const { products, addProduct, updateProduct, deleteProduct } = useApp()
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isAdding, setIsAdding] = useState(initialAdd)

  // Form states
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Solar Power Plant')
  const [unit, setUnit] = useState('Kilowatt')
  const [unitPrice, setUnitPrice] = useState<number>(0)
  const [gstPercent, setGstPercent] = useState<number>(18)
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const CATEGORIES = [
    'Solar Power Plant',
    'Solar Systems',
    'Solar Heating',
    'Solar Lighting',
    'Solar Pumps',
    'Accessories',
    'General',
  ]

  const openAdd = () => {
    setEditingProduct(null)
    setName('')
    setCategory('Solar Power Plant')
    setUnit('Kilowatt')
    setUnitPrice(0)
    setGstPercent(18)
    setDescription('')
    setError(null)
    setIsAdding(true)
  }

  const openEdit = (p: Product) => {
    setIsAdding(false)
    setEditingProduct(p)
    setName(p.name)
    setCategory(p.category || 'Solar Power Plant')
    setUnit(p.unit || 'Kilowatt')
    setUnitPrice(p.unitPrice || 0)
    setGstPercent(p.gstPercent ?? 18)
    setDescription(p.description || '')
    setError(null)
  }

  const resetForm = () => {
    setIsAdding(false)
    setEditingProduct(null)
    setError(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Product name is required.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name: name.trim(),
          category: category.trim(),
          unit: unit.trim(),
          unitPrice,
          gstPercent,
          description: description.trim(),
        })
      } else {
        await addProduct({
          name: name.trim(),
          category: category.trim(),
          unit: unit.trim(),
          unitPrice,
          gstPercent,
          description: description.trim(),
        })
      }
      resetForm()
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to save product.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (p: Product) => {
    if (!window.confirm(`Are you sure you want to delete "${p.name}" from the product catalog?`)) {
      return
    }
    try {
      await deleteProduct(p.id)
      if (editingProduct?.id === p.id) {
        resetForm()
      }
    } catch (err: any) {
      alert(err?.response?.data?.detail || err?.message || 'Failed to delete product.')
    }
  }

  return (
    <Modal title="Product Catalog Management" onClose={onClose} wide>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <h3 className="text-sm font-semibold text-text">Quotation Products Master</h3>
            <p className="text-xs text-text-dim">
              Manage system packages, standard pricing, and bulleted technical specifications for quotations.
            </p>
          </div>
          {!isAdding && !editingProduct && (
            <button
              type="button"
              onClick={openAdd}
              className="px-3 py-1.5 bg-sun text-ink font-semibold rounded-md text-xs hover:bg-sun/90 transition-colors flex items-center gap-1.5"
            >
              <span>+</span> Add New Product
            </button>
          )}
        </div>

        {/* Add / Edit Form */}
        {(isAdding || editingProduct) && (
          <form onSubmit={handleSave} className="bg-panel-raised border border-border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-sun">
                {editingProduct ? `Edit Product: ${editingProduct.name}` : 'New Product'}
              </h4>
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-text-dim hover:text-text"
              >
                ✕ Cancel
              </button>
            </div>

            {error && (
              <div className="p-2.5 bg-rose/10 border border-rose/30 rounded text-rose text-xs">
                {error}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Product Name *">
                <input
                  required
                  className={inputCls}
                  placeholder="e.g. Power Plant (On-Grid and Off-Grid)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>

              <Field label="Category">
                <div className="space-y-1">
                  <select
                    className={inputCls}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </Field>

              <Field label="Default Unit">
                <input
                  required
                  className={inputCls}
                  placeholder="e.g. Kilowatt, Unit, Set, LPD"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Default Price (₹)">
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    value={unitPrice || ''}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                  />
                </Field>
                <Field label="GST %">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={inputCls}
                    value={gstPercent || ''}
                    onChange={(e) => setGstPercent(Number(e.target.value))}
                  />
                </Field>
              </div>
            </div>

            <Field label="Bullet Specifications / Description">
              <textarea
                rows={5}
                className={`${inputCls} font-sans text-xs leading-relaxed`}
                placeholder=""
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 bg-panel border border-border text-text rounded text-xs hover:bg-panel/80"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 bg-sun text-ink font-semibold rounded text-xs hover:bg-sun/90 disabled:opacity-50"
              >
                {loading ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
              </button>
            </div>
          </form>
        )}

        {/* Product List */}
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-text-dim font-bold">
            Catalog Products ({products.length})
          </div>

          <div className="grid gap-3 max-h-[420px] overflow-y-auto pr-1">
            {products.map((p) => (
              <div
                key={p.id}
                className="bg-panel-raised border border-border rounded-lg p-3 hover:border-border/80 transition-colors flex flex-col justify-between gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-text">{p.name}</span>
                      <Pill status={p.category} />
                    </div>
                    <div className="text-xs text-text-dim mt-0.5">
                      Base Rate: <span className="font-medium text-text">{formatINR(p.unitPrice)}</span> / {p.unit} • GST: {p.gstPercent}%
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="px-2.5 py-1 text-xs bg-panel border border-border rounded text-text hover:border-sun hover:text-sun transition-colors"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p)}
                      className="px-2.5 py-1 text-xs bg-rose/10 border border-rose/30 rounded text-rose hover:bg-rose/20 transition-colors"
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>

                {p.description && (
                  <div className="mt-1 bg-panel/60 p-2 rounded text-xs text-text-dim whitespace-pre-line font-mono text-[11px] leading-relaxed border border-border/40">
                    {p.description}
                  </div>
                )}
              </div>
            ))}

            {products.length === 0 && (
              <div className="text-center py-8 text-text-dim text-xs">
                No products found in catalog. Click "+ Add New Product" to create one.
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
