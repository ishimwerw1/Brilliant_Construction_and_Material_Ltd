import { useCallback, useEffect, useState } from 'react'
import { Card, Button, Form, Badge, Alert } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import ProductForm from './ProductForm'
import { useAuth } from '../../context/AuthContext'

export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [stockState, setStockState] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [sort, setSort] = useState('-createdAt')
  const [categories, setCategories] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deactivating, setDeactivating] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState(null)
  const { hasPermission } = useAuth()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 15, sort }
      if (search) params.search = search
      if (category) params.category = category
      if (stockState) params.stockState = stockState
      if (status) params.status = status
      const { data } = await api.get('/products', { params })
      setProducts(data.data.products)
      setPages(data.data.pages)
      setTotal(data.data.total)
    } catch (err) {
      setToast({ type: 'danger', msg: getError(err) })
    } finally {
      setLoading(false)
    }
  }, [page, search, category, stockState, status, sort])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get('/categories').then((r) => setCategories(r.data.data.categories)).catch(() => {})
  }, [])

  const deactivate = async () => {
    setDeleting(true)
    try {
      const { data } = await api.delete(`/products/${deactivating._id}`)
      setDeactivating(null)
      setToast({ type: 'success', msg: data.message })
      load()
    } catch (err) {
      setToast({ type: 'danger', msg: getError(err) })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-box-seam me-2" />Products{' '}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '2.6rem',
              height: '2.2rem',
              padding: '0 0.9rem',
              fontSize: '1.5rem',
              fontWeight: 800,
              lineHeight: 1,
              borderRadius: '999px',
              background: '#1a6fb5',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(13,59,102,0.35)',
              marginLeft: '0.5rem',
              verticalAlign: 'middle'
            }}
          >
            {total}
          </span>
        </h4>
        {hasPermission('products.create') && (
          <Button onClick={() => { setEditing(null); setShowForm(true) }}>
            <i className="bi bi-plus-lg me-1" />Add Product
          </Button>
        )}
      </div>

      {toast && <Alert variant={toast.type} dismissible onClose={() => setToast(null)} className="py-2 small">{toast.msg}</Alert>}

      <Card body>
        <DataTable
          columns={[
            { key: 'image', label: '', render: (p) => p.image ? <img src={p.image} alt="" style={{ width: 42, height: 42, objectFit: 'contain', borderRadius: 6, background: '#f6f8fa' }} /> : <span className="d-inline-flex align-items-center justify-content-center" style={{ width: 42, height: 42, background: '#eef2f7', borderRadius: 6 }}><i className="bi bi-box text-secondary" /></span> },
            { key: 'name', label: 'Product', render: (p) => (
              <Link to={`/products/${p._id}`} className="text-decoration-none fw-semibold" style={{ color: '#0d3b66' }}>{p.name}</Link>
            )},
            { key: 'sku', label: 'SKU', render: (p) => <code className="small">{p.sku}</code> },
            { key: 'category', label: 'Category', render: (p) => <span className="small">{p.category?.parent ? `${p.category.parent.name} → ${p.category.name}` : p.category?.name || '-'}</span> },
            { key: 'buyingPrice', label: 'Buy', render: (p) => `${Number(p.buyingPrice).toLocaleString()} RWF` },
            { key: 'sellingPrice', label: 'Sell', render: (p) => `${Number(p.sellingPrice).toLocaleString()} RWF` },
            { key: 'quantity', label: 'Stock', render: (p) => (
              <Badge
                bg=""
                className={`rounded-pill badge-soft-${p.quantity === 0 ? 'danger' : p.quantity <= p.minStockLevel ? 'warning' : 'success'} px-2 py-1`}
                title={`In stock: ${p.quantity} ${p.unit}(s)${p.quantity <= p.minStockLevel ? ` · low stock (min ${p.minStockLevel})` : ''}`}
              >
                <span className="fw-bold">{p.quantity}</span> <small className="fw-normal">{p.unit}(s)</small>
              </Badge>
            )},
            { key: 'state', label: 'Status', render: (p) => <StatusBadge value={p.stockState} /> },
            { key: 'actions', label: 'Actions', render: (p) => (
              <div className="d-flex gap-1">
                <Link to={`/products/${p._id}`} className="btn btn-sm btn-light border"><i className="bi bi-eye" /></Link>
                {hasPermission('products.update') && (
                  <Button size="sm" variant="light" className="border" onClick={() => { setEditing(p); setShowForm(true) }}>
                    <i className="bi bi-pencil" />
                  </Button>
                )}
                {hasPermission('products.delete') && p.status === 'ACTIVE' && (
                  <Button size="sm" variant="light" className="border text-danger" onClick={() => setDeactivating(p)}>
                    <i className="bi bi-trash" />
                  </Button>
                )}
              </div>
            )}
          ]}
          data={products}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Search name, SKU, barcode..."
          toolbar={
            <>
              <Form.Select size="sm" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} style={{ width: 190 }}>
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.parent ? `— ${c.name}` : c.name}</option>
                ))}
              </Form.Select>
              <Form.Select size="sm" value={stockState} onChange={(e) => { setStockState(e.target.value); setPage(1) }} style={{ width: 150 }}>
                <option value="">All Stock</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
              </Form.Select>
              <Form.Select size="sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} style={{ width: 150 }}>
                <option value="ACTIVE">Active only</option>
                <option value="">All (incl. deactivated)</option>
                <option value="INACTIVE">Deactivated only</option>
              </Form.Select>
              <Form.Select size="sm" value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 160 }}>
                <option value="-createdAt">Newest first</option>
                <option value="name">Name A-Z</option>
                <option value="-quantity">Highest stock</option>
                <option value="quantity">Lowest stock</option>
                <option value="-price">Highest price</option>
              </Form.Select>
            </>
          }
        />
      </Card>

      <ProductForm show={showForm} product={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />

      <ConfirmDialog
        show={Boolean(deactivating)}
        title="Delete Product"
        message={`Delete "${deactivating?.name}"? If it has transaction history (sales, purchases, stock, orders) it will be permanently deactivated and hidden everywhere instead. Otherwise it is removed from the database entirely.`}
        confirmLabel="Delete"
        loading={deleting}
        onClose={() => setDeactivating(null)}
        onConfirm={deactivate}
      />
    </div>
  )
}
