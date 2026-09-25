import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import './App.css'
import './quality.css'
import './premium.css'

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
  const [darkMode, setDarkMode] = useState(localStorage.getItem('commerceiq-theme') === 'dark')
  const [commandOpen, setCommandOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(localStorage.getItem('commerceiq-tour-seen') !== 'yes')
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
    localStorage.setItem('commerceiq-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])
  useEffect(() => {
    const onKeyDown = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(true) }
      if (event.key === 'Escape') setCommandOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
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
  if (!data) return <main className="loading"><div className="loader-card" aria-live="polite"><div className="loader-brand"><span>↗</span> commerce<span>IQ</span></div><div className="loader-chart"><i></i><i></i><i></i><i></i><i></i></div><div className="loader-track"><b></b></div><strong>Building your marketplace view</strong><p>Validating orders, customers, sellers, and product insights…</p></div></main>
  const k = data.kpis
  const visibleCategories = category === 'All categories' ? categories : categories.filter(c => c.category === category)
  const navigate = target => { setPage(target); window.scrollTo({ top: 0, behavior: 'smooth' }); setCommandOpen(false) }
  const shareDashboard = async () => { await navigator.clipboard.writeText(window.location.href); window.alert('Dashboard link copied to clipboard.') }
  const pageFocus = {
    Customers: { title: 'Customer retention', value: `${data.customer_behavior.repeat_customer_rate_pct}%`, text: 'repeat-customer rate across delivered-order customers. Use this view to evaluate acquisition and second-purchase opportunities.' },
    Products: { title: 'Product performance', value: money.format(categories[0]?.revenue ?? 0), text: `item revenue from ${categories[0]?.category?.replaceAll('_', ' ') ?? 'the leading category'}. Review category ratings alongside volume before action.` },
    Sellers: { title: 'Seller quality', value: `${decimal.format(data.sellers[0]?.avg_rating ?? 0)} / 5`, text: 'average rating for the leading seller by item revenue. Use the scorecard and drill-down to investigate performance.' },
  }[page]
  const downloadPdfReport = async () => {
    const { jsPDF } = await import('jspdf')
    const report = new jsPDF({ unit: 'pt', format: 'a4' })
    const filters = [startDate && `From ${startDate}`, endDate && `To ${endDate}`, category !== 'All categories' && category, seller !== 'All sellers' && `Seller ${seller.slice(0, 8)}…`, paymentType !== 'All payments' && paymentType, reviewBand !== 'All ratings' && reviewBand, deliveryStatus !== 'All delivery states' && deliveryStatus].filter(Boolean).join(' · ') || 'All delivered orders'
    report.setFillColor(18, 48, 78); report.rect(0, 0, 595, 94, 'F')
    report.setTextColor(255, 255, 255); report.setFont('helvetica', 'bold'); report.setFontSize(24); report.text('CommerceIQ', 42, 48)
    report.setFontSize(11); report.setFont('helvetica', 'normal'); report.text('E-Commerce Business Performance Report', 42, 69)
    report.setTextColor(25, 49, 75); report.setFont('helvetica', 'bold'); report.setFontSize(18); report.text('Executive summary', 42, 133)
    report.setFont('helvetica', 'normal'); report.setFontSize(10); report.text(`Scope: ${filters}`, 42, 153, { maxWidth: 510 })
    const metrics = [['Payment revenue', money.format(k.payment_revenue)], ['Completed orders', money.format(k.orders)], ['Average order value', decimal.format(k.average_order_value)], ['Customer rating', `${decimal.format(k.average_review_score)} / 5`], ['Average delivery time', `${decimal.format(k.average_delivery_days)} days`], ['On / before estimate', `${k.on_or_before_estimated_delivery_pct}%`]]
    metrics.forEach(([label, value], index) => { const x = 42 + (index % 2) * 255; const y = 198 + Math.floor(index / 2) * 56; report.setFillColor(241, 248, 250); report.roundedRect(x, y, 235, 43, 6, 6, 'F'); report.setTextColor(83, 105, 125); report.setFontSize(9); report.text(label, x + 12, y + 16); report.setTextColor(20, 55, 83); report.setFont('helvetica', 'bold'); report.setFontSize(15); report.text(value, x + 12, y + 33); report.setFont('helvetica', 'normal') })
    report.setFont('helvetica', 'bold'); report.setFontSize(14); report.text('Evidence-backed insight', 42, 397)
    report.setFont('helvetica', 'normal'); report.setFontSize(10); report.setTextColor(61, 85, 105); report.text('Orders delivered on or before estimate average 4.28 rating; orders delivered 8+ days late average 1.72.', 42, 417, { maxWidth: 510 })
    report.setFont('helvetica', 'bold'); report.setTextColor(20, 55, 83); report.text('Recommended next step', 42, 465)
    report.setFont('helvetica', 'normal'); report.text('Monitor late-delivery exceptions and test proactive customer communication. This is a recommendation based on descriptive evidence, not a causal conclusion.', 42, 485, { maxWidth: 510 })
    report.setTextColor(112, 128, 145); report.setFontSize(8); report.text('Source-defined location labels only; not verified geography. Generated from the current CommerceIQ dashboard filter scope.', 42, 780, { maxWidth: 510 })
    report.save('commerceiq-executive-report.pdf')
  }

  return <div className={`app-shell ${darkMode ? 'dark' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">↗</span><div>commerce<span>IQ</span></div></div>
      <p className="workspace">MARKETPLACE INTELLIGENCE</p>
      <nav>{['Overview', 'Customers', 'Products', 'Sellers'].map(item => <button key={item} className={page === item ? 'nav-active' : ''} onClick={() => navigate(item)}><span>{item === 'Overview' ? '⌂' : item === 'Customers' ? '◌' : item === 'Products' ? '◇' : '◫'}</span>{item}</button>)}</nav>
      <div className="sidebar-footer"><div className="avatar">CA</div><div><strong>CA3 Project</strong><small>Data analytics</small></div></div>
    </aside>
    <main className="content">
      <header className="topbar"><div><p className="eyebrow">PUBLIC E-COMMERCE MARKETPLACE</p><h1>{page} <span>Analytics</span></h1></div><div className="top-actions"><button onClick={() => setCommandOpen(true)}>⌘ Quick actions</button><button onClick={downloadPdfReport}>⇩ PDF report</button><button onClick={shareDashboard}>↗ Share</button><button onClick={() => setDarkMode(!darkMode)}>{darkMode ? '☀ Light' : '◐ Dark'}</button><div className="period"><span>●</span><div><b>Data verified</b><small>Snapshot Sep 2016 — Oct 2018</small></div></div></div></header>
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
        <Panel title="Category performance" subtitle="Click a bar to cross-filter the dashboard"><ResponsiveContainer width="100%" height={290}><BarChart data={visibleCategories.slice(0, 7)} layout="vertical" margin={{ left: 10, right: 35 }}><XAxis type="number" hide/><YAxis type="category" dataKey="category" width={130} tick={{ fontSize: 11 }}/><Tooltip formatter={v => money.format(v)} /><Bar dataKey="revenue" name="Item revenue" radius={[0, 6, 6, 0]} fill="#3b82f6" onClick={entry => setCategory(entry.category)}><LabelList dataKey="revenue" position="right" formatter={v => `${Math.round(v / 1000)}k`} style={{ fontSize: 11, fill: '#64748b' }}/></Bar></BarChart></ResponsiveContainer></Panel>
        <Panel title="Delivery experience" subtitle="Satisfaction falls sharply as delivery becomes late"><div className="delivery-bars">{data.delivery_rating.map((x, i) => <div className="delivery-row" key={x.band}><div><b>{x.band}</b><small>{money.format(x.orders)} orders</small></div><div className="rating-track"><span style={{ width: `${x.rating * 20}%`, background: chartColors[i === 2 ? 4 : i] }}></span></div><strong>{x.rating}</strong></div>)}</div><div className="delivery-kpis"><div><b>{decimal.format(k.average_delivery_days)} days</b><span>Average delivery time</span></div><div><b>{k.on_or_before_estimated_delivery_pct}%</b><span>On / before estimate</span></div></div></Panel>
        <Panel title="Cross-sell opportunities" subtitle="Distinct category pairs in the same delivered order"><ol>{data.cross_sell.slice(0, 5).map((x, i) => <li key={`${x.category_1}-${x.category_2}`}><em>{String(i + 1).padStart(2, '0')}</em><div><b>{x.category_1.replaceAll('_', ' ')} <span>+</span> {x.category_2.replaceAll('_', ' ')}</b><small>Observed together in completed orders</small></div><strong>{x.orders}</strong></li>)}</ol></Panel>
        <Panel title="Seller scorecard" subtitle="Top sellers by item revenue and average rating"><div className="seller-table"><div className="seller-head"><span>Seller ID</span><span>Orders</span><span>Rating</span><span>Revenue</span></div>{data.sellers.slice(0, 5).map(s => <div className="seller-row" key={s.seller_id}><span title={s.seller_id}>{s.seller_id.slice(0, 8)}…</span><span>{money.format(s.orders)}</span><span className={s.avg_rating < 4 ? 'low-rating' : ''}>{s.avg_rating}</span><b>{money.format(s.revenue)}</b></div>)}</div></Panel>
        <Panel title="Data integrity" subtitle="Documented source quality checks; raw records remain preserved"><div className="quality-grid"><div><b>{money.format(data.data_quality.orders_without_items)}</b><span>Orders without items</span></div><div><b>{money.format(data.data_quality.orders_without_payment)}</b><span>Orders without payment</span></div><div><b>{money.format(data.data_quality.duplicate_payment_order_rows)}</b><span>Extra payment rows aggregated</span></div><div><b>{money.format(data.data_quality.duplicate_review_order_rows)}</b><span>Extra review rows aggregated</span></div><div><b>{money.format(data.data_quality.uncategorized_products)}</b><span>Unclassified products</span></div><div><b>{money.format(data.data_quality.sellers_without_location)}</b><span>Sellers with unknown label</span></div></div></Panel>
        <Panel title="Order drill-down" subtitle="Latest matching item records for the selected category or seller"><div className="seller-table"><div className="seller-head"><span>Order</span><span>Category</span><span>Rating</span><span>Item value</span></div>{details.map(row => <div className="seller-row" key={`${row.order_id}-${row.item_revenue}`}><span title={row.order_id}>{row.order_id.slice(0, 8)}…</span><span>{row.category.replaceAll('_', ' ').slice(0, 14)}</span><span>{row.review_score}</span><b>{money.format(row.item_revenue)}</b></div>)}</div></Panel>
        <Panel title="Decision lens" subtitle="Descriptive insight and recommended next step"><div className="decision-card"><strong>Delivery is the clearest service lever.</strong><p>Orders delivered on/before estimate average 4.28 rating; orders 8+ days late average 1.72.</p><span>Recommendation: monitor late-delivery exceptions and test proactive customer communication. This is an action hypothesis, not a causal claim.</span></div></Panel>
      </section>
      <footer>Built from reproducible project extracts · <span>Payment revenue and item revenue are intentionally labelled separately.</span></footer>
    </main>
    {commandOpen && <div className="command-backdrop" onClick={() => setCommandOpen(false)}><div className="command-menu" onClick={e => e.stopPropagation()}><b>Quick actions</b><small>Navigate or reset filters · Esc to close</small>{['Overview', 'Customers', 'Products', 'Sellers'].map(item => <button key={item} onClick={() => navigate(item)}>Go to {item}</button>)}<button onClick={() => { setStartDate(''); setEndDate(''); setCategory('All categories'); setSeller('All sellers'); setPaymentType('All payments'); setReviewBand('All ratings'); setDeliveryStatus('All delivery states'); setCommandOpen(false) }}>Reset all filters</button></div></div>}
    {tourOpen && <div className="tour"><button onClick={() => { localStorage.setItem('commerceiq-tour-seen', 'yes'); setTourOpen(false) }}>×</button><b>Welcome to CommerceIQ</b><span>Use filters to narrow the KPI scope, click a category bar to cross-filter, then export or share the resulting view.</span></div>}
  </div>
}
export default App
