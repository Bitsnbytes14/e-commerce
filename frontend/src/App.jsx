import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import './App.css'
import './quality.css'

const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const chartColors = ['#14b8a6', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#64748b']
const savedFilters = new URLSearchParams(window.location.search)

function downloadCsv(rows, filename) {
  const header = 'month,payment_revenue,completed_orders'
  const values = rows.map(row => `${row.month},${row.revenue},${row.orders}`)
  const url = URL.createObjectURL(new Blob([[header, ...values].join('\n')], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function Card({ label, value, hint, tone = 'teal' }) {
  return <article className={`metric-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>
}
function Panel({ title, subtitle, children, className = '' }) {
  return <section className={`panel ${className}`}><div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><span className="more">•••</span></div>{children}</section>
}

function App() {
  const [data, setData] = useState(null)
  const [page, setPage] = useState('Overview')
  const [category, setCategory] = useState(savedFilters.get('category') ?? 'All categories')
  const [seller, setSeller] = useState(savedFilters.get('seller') ?? 'All sellers')
  const [paymentType, setPaymentType] = useState(savedFilters.get('payment_type') ?? 'All payments')
  const [reviewBand, setReviewBand] = useState(savedFilters.get('review_band') ?? 'All ratings')
  const [deliveryStatus, setDeliveryStatus] = useState(savedFilters.get('delivery_status') ?? 'All delivery states')
  const [startDate, setStartDate] = useState(savedFilters.get('start') ?? '')
  const [endDate, setEndDate] = useState(savedFilters.get('end') ?? '')
  const [loadError, setLoadError] = useState('')
  const [details, setDetails] = useState([])
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? ''
    const query = new URLSearchParams()
    if (startDate) query.set('start', startDate)
    if (endDate) query.set('end', endDate)
    if (category !== 'All categories') query.set('category', category)
    if (seller !== 'All sellers') query.set('seller', seller)
    if (paymentType !== 'All payments') query.set('payment_type', paymentType)
    if (reviewBand !== 'All ratings') query.set('review_band', reviewBand)
    if (deliveryStatus !== 'All delivery states') query.set('delivery_status', deliveryStatus)
    const overviewUrl = `${apiBase}/api/overview${query.size ? `?${query}` : ''}`
    let cancelled = false
    Promise.all([
      fetch('/dashboard-data.json').then(r => r.ok ? r.json() : Promise.reject(new Error('Validated dashboard data is unavailable.'))),
      fetch(overviewUrl).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${apiBase}/api/quality`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([staticData, overview, quality]) => {
      if (!cancelled) {
        setLoadError('')
        setData({ ...staticData, ...(overview ? { kpis: overview.kpis, monthly: overview.monthly } : {}), ...(quality ? { data_quality: quality.data_quality } : {}) })
      }
    }).catch(error => {
      if (!cancelled) setLoadError(error.message)
    })
    return () => { cancelled = true }
  }, [startDate, endDate, category, seller, paymentType, reviewBand, deliveryStatus])
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? ''
    const query = new URLSearchParams({ limit: '8' })
    if (category !== 'All categories') query.set('category', category)
    if (seller !== 'All sellers') query.set('seller', seller)
    fetch(`${apiBase}/api/order-details?${query}`).then(r => r.ok ? r.json() : []).then(setDetails).catch(() => setDetails([]))
  }, [category, seller])
  useEffect(() => {
    const query = new URLSearchParams()
    if (startDate) query.set('start', startDate)
    if (endDate) query.set('end', endDate)
    if (category !== 'All categories') query.set('category', category)
    if (seller !== 'All sellers') query.set('seller', seller)
    if (paymentType !== 'All payments') query.set('payment_type', paymentType)
    if (reviewBand !== 'All ratings') query.set('review_band', reviewBand)
    if (deliveryStatus !== 'All delivery states') query.set('delivery_status', deliveryStatus)
    window.history.replaceState(null, '', `${window.location.pathname}${query.size ? `?${query}` : ''}`)
  }, [startDate, endDate, category, seller, paymentType, reviewBand, deliveryStatus])
  const categories = useMemo(() => data?.categories ?? [], [data])
  if (loadError) return <main className="loading"><div><b>Dashboard data could not load.</b><p>{loadError}</p><button onClick={() => window.location.reload()}>Retry</button></div></main>
  if (!data) return <main className="loading">Loading validated marketplace analytics…</main>
  const k = data.kpis
  const visibleCategories = category === 'All categories' ? categories : categories.filter(c => c.category === category)
  const pageFocus = {
    Customers: { title: 'Customer retention', value: `${data.customer_behavior.repeat_customer_rate_pct}%`, text: 'repeat-customer rate across delivered-order customers. Use this view to evaluate acquisition and second-purchase opportunities.' },
    Products: { title: 'Product performance', value: money.format(categories[0]?.revenue ?? 0), text: `item revenue from ${categories[0]?.category?.replaceAll('_', ' ') ?? 'the leading category'}. Review category ratings alongside volume before action.` },
    Sellers: { title: 'Seller quality', value: `${decimal.format(data.sellers[0]?.avg_rating ?? 0)} / 5`, text: 'average rating for the leading seller by item revenue. Use the scorecard and drill-down to investigate performance.' },
  }[page]

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">↗</span><div>commerce<span>IQ</span></div></div>
      <p className="workspace">MARKETPLACE INTELLIGENCE</p>
      <nav>{['Overview', 'Customers', 'Products', 'Sellers'].map(item => <button key={item} className={page === item ? 'nav-active' : ''} onClick={() => setPage(item)}><span>{item === 'Overview' ? '⌂' : item === 'Customers' ? '◌' : item === 'Products' ? '◇' : '◫'}</span>{item}</button>)}</nav>
      <div className="sidebar-footer"><div className="avatar">CA</div><div><strong>CA3 Project</strong><small>Data analytics</small></div></div>
    </aside>
    <main className="content">
      <header className="topbar"><div><p className="eyebrow">PUBLIC E-COMMERCE MARKETPLACE</p><h1>{page} <span>Analytics</span></h1></div><div className="period"><span>◷</span><div><b>Data snapshot</b><small>Sep 2016 — Oct 2018</small></div></div></header>
      <div className="notice"><span>ⓘ</span> Completed-order dashboard. Location values are source-defined labels, not verified geography.</div>
      <section className="controls"><div className="scope-controls"><span className="chip selected">Delivered orders with selected filters</span><label>From<input type="date" value={startDate} min="2016-09-04" max="2018-10-17" onChange={e => setStartDate(e.target.value)} /></label><label>To<input type="date" value={endDate} min="2016-09-04" max="2018-10-17" onChange={e => setEndDate(e.target.value)} /></label><button className="reset-filter" onClick={() => { setStartDate(''); setEndDate(''); setCategory('All categories'); setSeller('All sellers'); setPaymentType('All payments'); setReviewBand('All ratings'); setDeliveryStatus('All delivery states') }}>Reset filters</button></div><div className="dimension-selects"><select value={category} onChange={e => setCategory(e.target.value)}><option>All categories</option>{categories.map(c => <option key={c.category}>{c.category}</option>)}</select><select value={seller} onChange={e => setSeller(e.target.value)}><option>All sellers</option>{data.sellers.map(s => <option key={s.seller_id} value={s.seller_id}>Seller {s.seller_id.slice(0, 8)}…</option>)}</select><select value={paymentType} onChange={e => setPaymentType(e.target.value)}><option>All payments</option>{data.payments.map(p => <option key={p.payment_type} value={p.payment_type}>{p.payment_type}</option>)}</select><select value={reviewBand} onChange={e => setReviewBand(e.target.value)}><option>All ratings</option><option value="low">Low (1–2)</option><option value="neutral">Neutral (3)</option><option value="high">High (4–5)</option></select><select value={deliveryStatus} onChange={e => setDeliveryStatus(e.target.value)}><option>All delivery states</option><option value="on_time">On / before estimate</option><option value="late">Late</option></select></div></section>
      <section className="metrics">
        <Card label="Payment revenue" value={money.format(k.payment_revenue)} hint="Delivered orders only" />
        <Card label="Completed orders" value={money.format(k.orders)} hint={`${money.format(k.unique_customers)} unique customers`} tone="blue" />
        <Card label="Average order value" value={decimal.format(k.average_order_value)} hint="Payment revenue ÷ orders" tone="violet" />
        <Card label="Customer rating" value={`${decimal.format(k.average_review_score)} / 5`} hint="Mean order-level review" tone="amber" />
      </section>
      {pageFocus && <section className="page-focus"><p>{pageFocus.title}</p><strong>{pageFocus.value}</strong><span>{pageFocus.text}</span></section>}
      <section className="dashboard-grid">
        <Panel title="Revenue movement" subtitle="Monthly payment revenue and delivered orders" className="trend-panel"><button className="export-button" onClick={() => downloadCsv(data.monthly, 'commerceiq-monthly-performance.csv')}>↓ Export CSV</button><ResponsiveContainer width="100%" height={270}><LineChart data={data.monthly} margin={{ top: 18, right: 8, left: 0 }}><CartesianGrid vertical={false} stroke="#e8edf4"/><XAxis dataKey="month" tick={{ fontSize: 11 }} interval="preserveStartEnd"/><YAxis yAxisId="left" tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11 }}/><YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }}/><Tooltip formatter={(v, n) => [money.format(v), n]}/><Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="#14b8a6" strokeWidth={3} dot={false}/><Line yAxisId="right" type="monotone" dataKey="orders" name="Orders" stroke="#3b82f6" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></Panel>
        <Panel title="Payment mix" subtitle="Raw payment-component revenue share"><div className="donut-wrap"><ResponsiveContainer width="50%" height={205}><PieChart><Pie data={data.payments} dataKey="revenue" nameKey="payment_type" innerRadius={54} outerRadius={78} paddingAngle={3}>{data.payments.map((x, i) => <Cell key={x.payment_type} fill={chartColors[i]} />)}</Pie><Tooltip formatter={v => money.format(v)} /></PieChart></ResponsiveContainer><div className="legend">{data.payments.slice(0, 4).map((x, i) => <div key={x.payment_type}><i style={{ background: chartColors[i] }}></i><span>{x.payment_type.replace('_', ' ')}</span><b>{x.share_pct}%</b></div>)}</div></div></Panel>
        <Panel title="Category performance" subtitle="Item revenue; filterable category snapshot"><ResponsiveContainer width="100%" height={290}><BarChart data={visibleCategories.slice(0, 7)} layout="vertical" margin={{ left: 10, right: 35 }}><XAxis type="number" hide/><YAxis type="category" dataKey="category" width={130} tick={{ fontSize: 11 }}/><Tooltip formatter={v => money.format(v)} /><Bar dataKey="revenue" name="Item revenue" radius={[0, 6, 6, 0]} fill="#3b82f6"><LabelList dataKey="revenue" position="right" formatter={v => `${Math.round(v / 1000)}k`} style={{ fontSize: 11, fill: '#64748b' }}/></Bar></BarChart></ResponsiveContainer></Panel>
        <Panel title="Delivery experience" subtitle="Satisfaction falls sharply as delivery becomes late"><div className="delivery-bars">{data.delivery_rating.map((x, i) => <div className="delivery-row" key={x.band}><div><b>{x.band}</b><small>{money.format(x.orders)} orders</small></div><div className="rating-track"><span style={{ width: `${x.rating * 20}%`, background: chartColors[i === 2 ? 4 : i] }}></span></div><strong>{x.rating}</strong></div>)}</div><div className="delivery-kpis"><div><b>{decimal.format(k.average_delivery_days)} days</b><span>Average delivery time</span></div><div><b>{k.on_or_before_estimated_delivery_pct}%</b><span>On / before estimate</span></div></div></Panel>
        <Panel title="Cross-sell opportunities" subtitle="Distinct category pairs in the same delivered order"><ol>{data.cross_sell.slice(0, 5).map((x, i) => <li key={`${x.category_1}-${x.category_2}`}><em>{String(i + 1).padStart(2, '0')}</em><div><b>{x.category_1.replaceAll('_', ' ')} <span>+</span> {x.category_2.replaceAll('_', ' ')}</b><small>Observed together in completed orders</small></div><strong>{x.orders}</strong></li>)}</ol></Panel>
        <Panel title="Seller scorecard" subtitle="Top sellers by item revenue and average rating"><div className="seller-table"><div className="seller-head"><span>Seller ID</span><span>Orders</span><span>Rating</span><span>Revenue</span></div>{data.sellers.slice(0, 5).map(s => <div className="seller-row" key={s.seller_id}><span title={s.seller_id}>{s.seller_id.slice(0, 8)}…</span><span>{money.format(s.orders)}</span><span className={s.avg_rating < 4 ? 'low-rating' : ''}>{s.avg_rating}</span><b>{money.format(s.revenue)}</b></div>)}</div></Panel>
        <Panel title="Data integrity" subtitle="Documented source quality checks; raw records remain preserved"><div className="quality-grid"><div><b>{money.format(data.data_quality.orders_without_items)}</b><span>Orders without items</span></div><div><b>{money.format(data.data_quality.orders_without_payment)}</b><span>Orders without payment</span></div><div><b>{money.format(data.data_quality.duplicate_payment_order_rows)}</b><span>Extra payment rows aggregated</span></div><div><b>{money.format(data.data_quality.duplicate_review_order_rows)}</b><span>Extra review rows aggregated</span></div><div><b>{money.format(data.data_quality.uncategorized_products)}</b><span>Unclassified products</span></div><div><b>{money.format(data.data_quality.sellers_without_location)}</b><span>Sellers with unknown label</span></div></div></Panel>
        <Panel title="Order drill-down" subtitle="Latest matching item records for the selected category or seller"><div className="seller-table"><div className="seller-head"><span>Order</span><span>Category</span><span>Rating</span><span>Item value</span></div>{details.map(row => <div className="seller-row" key={`${row.order_id}-${row.item_revenue}`}><span title={row.order_id}>{row.order_id.slice(0, 8)}…</span><span>{row.category.replaceAll('_', ' ').slice(0, 14)}</span><span>{row.review_score}</span><b>{money.format(row.item_revenue)}</b></div>)}</div></Panel>
      </section>
      <footer>Built from reproducible project extracts · <span>Payment revenue and item revenue are intentionally labelled separately.</span></footer>
    </main>
  </div>
}
export default App
