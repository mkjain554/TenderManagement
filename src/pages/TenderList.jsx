import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage, formatDate, money, useApi } from '../App.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';
import Pagination from '../components/Pagination.jsx';

const PAGE_SIZE = 20;
const emptyData = {
  rows: [],
  total: 0,
  summary: {
    total_value: 0,
    total_received: 0,
    total_hold: 0,
    total_pending: 0,
    total_tender_fee: 0,
    total_emd: 0,
    total_emd_refunded: 0,
  },
  categoryCounts: { allotted: 0, participated: 0 },
  page: 1,
  pageSize: PAGE_SIZE,
};

export default function TenderList() {
  const api = useApi();
  const navigate = useNavigate();
  const [data, setData] = useState(emptyData);
  const [category, setCategory] = useState('allotted');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.tenders.list({ page, pageSize: PAGE_SIZE, search, filter, category }));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [api, category, filter, page, search]);

  useEffect(() => { load(); }, [load]);

  async function remove(tender) {
    if (!window.confirm(`Delete "${tender.tender_name}" and all its bills and documents? This cannot be undone.`)) return;
    try {
      await api.tenders.delete(tender.id);
      await load();
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    }
  }

  function updateSearch(value) {
    setSearch(value);
    setPage(1);
  }

  function updateFilter(value) {
    setFilter(value);
    setPage(1);
  }

  function updateCategory(value) {
    setCategory(value);
    setPage(1);
  }

  const participated = category === 'participated';
  const columnCount = participated ? 12 : 9;
  const noTenders = data.categoryCounts.allotted + data.categoryCounts.participated === 0;

  return (
    <div className="page-wrap">
      <div className="page-heading heading-row">
        <div><p className="eyebrow">WORKSPACE / TENDER</p><h1>Tender list</h1><p className="page-description">Track allotted work and participated tenders, including bid fees and EMD refunds.</p></div>
        <Link to="/tenders/new" className="button button-primary"><span>＋</span> Add tender</Link>
      </div>
      <div className="tender-tabs" role="tablist" aria-label="Tender categories">
        <button className={category === 'allotted' ? 'tender-tab active' : 'tender-tab'} role="tab" aria-selected={category === 'allotted'} onClick={() => updateCategory('allotted')}>
          Allotted <span className="count-pill">{data.categoryCounts.allotted || 0}</span>
        </button>
        <button className={participated ? 'tender-tab active' : 'tender-tab'} role="tab" aria-selected={participated} onClick={() => updateCategory('participated')}>
          Participated <span className="count-pill">{data.categoryCounts.participated || 0}</span>
        </button>
      </div>
      {participated ? (
        <div className="summary-strip">
          <div><span className="summary-icon">▤</span><div><span className="summary-label">TENDERS SHOWN</span><strong>{data.total}</strong><small>participated records</small></div></div>
          <div><span className="summary-icon summary-icon-hold">₹</span><div><span className="summary-label">TENDER FEES SPENT</span><strong>{money(data.summary.total_tender_fee)}</strong><small>non-refundable document fees</small></div></div>
          <div><span className="summary-icon summary-icon-blue">⌑</span><div><span className="summary-label">EMD DEPOSITED</span><strong>{money(data.summary.total_emd)}</strong><small>across matching tenders</small></div></div>
          <div><span className="summary-icon summary-icon-green">↩</span><div><span className="summary-label">EMD REFUNDED</span><strong>{money(data.summary.total_emd_refunded)}</strong><small>refunds received</small></div></div>
          <div><span className="summary-icon summary-icon-pending">◷</span><div><span className="summary-label">EMD NOT REFUNDED</span><strong>{money(Math.max(0, data.summary.total_emd - data.summary.total_emd_refunded))}</strong><small>balance not returned yet</small></div></div>
        </div>
      ) : (
        <div className="summary-strip">
          <div><span className="summary-icon">▤</span><div><span className="summary-label">TENDERS SHOWN</span><strong>{data.total}</strong><small>allotted records</small></div></div>
          <div><span className="summary-icon summary-icon-green">₹</span><div><span className="summary-label">TOTAL VALUE</span><strong>{money(data.summary.total_value)}</strong><small>across matching tenders</small></div></div>
          <div><span className="summary-icon summary-icon-blue">✓</span><div><span className="summary-label">CONSTRUCTION RECEIVED</span><strong>{money(data.summary.total_received)}</strong><small>Construction bill payments</small></div></div>
          <div><span className="summary-icon summary-icon-hold">⌑</span><div><span className="summary-label">CONSTRUCTION HOLD</span><strong>{money(data.summary.total_hold)}</strong><small>Construction bill holds</small></div></div>
          <div><span className="summary-icon summary-icon-pending">◷</span><div><span className="summary-label">CONSTRUCTION PENDING</span><strong>{money(data.summary.total_pending)}</strong><small>contract value less Construction receipts</small></div></div>
        </div>
      )}
      <section className="panel list-panel">
        <div className="list-toolbar">
          <div><h2>{participated ? 'Participated tenders' : 'Allotted tenders'} <span className="count-pill">{data.total}</span></h2><p>Search and filter your tender records</p></div>
          <div className="toolbar-controls">
            <label className="search-field"><span>⌕</span><input value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Search tenders…" aria-label="Search tenders" /></label>
            <select className="filter-select" value={filter} onChange={(event) => updateFilter(event.target.value)} aria-label="Filter tenders">
              <option value="all">All tenders</option><option value="active">Active</option><option value="upcoming">Upcoming</option><option value="completed">Completed</option>
            </select>
          </div>
        </div>
        <ErrorNotice onClose={() => setError('')}>{error}</ErrorNotice>
        <div className="table-scroll">
          <table>
            <thead><tr><th>WORK / TENDER ID</th><th>DEPARTMENT</th><th>STATUS</th><th>SUBMISSION DEADLINE</th><th>CONTRACT AMOUNT</th>{participated && <><th>TENDER FEE</th><th>EMD PAID</th><th>EMD REFUNDED</th></>}<th>BILLS</th><th>CONSTRUCTION RECEIVED</th><th>CONSTRUCTION HOLD</th><th /></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={columnCount} className="table-message">Loading your tenders…</td></tr>
                : data.rows.length === 0 ? <tr><td colSpan={columnCount} className="empty-cell"><div className="empty-state"><span className="empty-icon">▤</span><strong>{search || filter !== 'all' ? 'No matching tenders' : `No ${participated ? 'participated' : 'allotted'} tenders yet`}</strong><p>{search || filter !== 'all' ? 'Try changing your search or filter.' : participated ? 'Tenders not marked Awarded, In progress or Completed appear here.' : 'Tenders marked Awarded, In progress or Completed appear here.'}</p>{noTenders && !search && filter === 'all' && <Link to="/tenders/new" className="button button-primary button-small">Add your first tender</Link>}</div></td></tr>
                : data.rows.map((tender) => (
                  <tr key={tender.id}>
                    <td><Link className="tender-name" to={`/tenders/${tender.id}`}>{tender.tender_name}</Link><span className="table-subtext">{tender.tender_reference ? `Tender ID: ${tender.tender_reference}` : 'Tender ID not entered'} · {tender.id}</span></td>
                    <td className="department-cell"><span>{tender.department || '—'}</span><small>{tender.work_location || 'Location not entered'}</small></td>
                    <td><span className={`status-badge status-${tender.status.toLowerCase().replaceAll(' ', '-')}`}>{tender.status}</span></td>
                    <td>{formatDate(tender.submission_deadline)}</td>
                    <td className="amount-cell">{money(tender.bidding_amount)}</td>
                    {participated && <><td className="amount-cell">{money(tender.tender_fee)}</td><td className="amount-cell">{money(tender.emd_amount)}</td><td className="amount-cell">{money(tender.emd_refunded_amount)}</td></>}
                    <td><span className="bill-count">{tender.bill_count}</span></td>
                    <td className="amount-cell">{money(tender.total_received)}</td><td className="amount-cell">{money(tender.total_hold)}</td>
                    <td><div className="row-actions"><button onClick={() => navigate(`/tenders/${tender.id}`)} title="View tender">View</button><button onClick={() => navigate(`/tenders/${tender.id}/edit`)} title="Edit tender">Edit</button><button className="delete-action" onClick={() => remove(tender)} title="Delete tender">Delete</button></div></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
      </section>
      <div className="data-footnote"><span className="status-dot" /> Data stored locally on this computer</div>
    </div>
  );
}
