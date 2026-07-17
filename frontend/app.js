const { useState, useEffect, useContext, createContext, useMemo, useRef, useCallback } = React;

// ---------- API CLIENT ----------
const api = axios.create({ baseURL: "/api" });

const AuthContext = createContext(null);
const ToastContext = createContext(null);

function useAuth() { return useContext(AuthContext); }
function useToast() { return useContext(ToastContext); }

function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(true);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common["Authorization"] = "Bearer " + token;
    } else {
      delete api.defaults.headers.common["Authorization"];
    }
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    setToken(res.data.token);
    setUser(res.data.user);
  };
  const register = async (name, email, password, role) => {
    const res = await api.post("/auth/register", { name, email, password, role });
    setToken(res.data.token);
    setUser(res.data.user);
  };
  const logout = () => { setToken(null); setUser(null); };

  return (
    <AuthContext.Provider value={{ token, user, login, register, logout, ready }}>
      {children}
    </AuthContext.Provider>
  );
}

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div>
        {toasts.map(t => (
          <div key={t.id} className={"toast-tl " + t.type}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function apiErrorMessage(err) {
  return (err && err.response && err.response.data && err.response.data.error) || "Something went wrong. Please try again.";
}

// ---------- SMALL HELPERS ----------
function formatMoney(n) {
  const v = Number(n || 0);
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}
function formatNum(n, dec = 0) {
  return Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: dec, minimumFractionDigits: dec });
}
function todayStr() { return new Date().toISOString().slice(0, 10); }

// ---------- SHARED UI ----------
function Spinner() { return <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}><div className="spinner"></div></div>; }

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-backdrop-tl" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={wide ? { maxWidth: 720 } : {}}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h5 className="font-display" style={{ margin: 0, fontWeight: 600 }}>{title}</h5>
          <button className="btn-outline btn-sm" onClick={onClose} style={{ padding: "4px 10px" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p style={{ color: "var(--text-muted)" }}>{message}</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn-danger" style={{ padding: "9px 16px" }} onClick={onConfirm}>Delete</button>
      </div>
    </Modal>
  );
}

function StatCard({ label, value, color, sub }) {
  return (
    <div className="stat-card">
      <div className="accent-bar" style={{ background: color || "var(--accent-teal)" }}></div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub ? <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <input className="form-control-tl" style={{ maxWidth: 280 }} value={value}
      onChange={e => onChange(e.target.value)} placeholder={placeholder || "Search..."} />
  );
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}

// ---------- AUTH PAGES ----------
function AuthPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login, register } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.password, "owner");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div className="brand-mark">TL</div>
          <div>
            <div className="font-display" style={{ fontWeight: 700, fontSize: 18 }}>TradeLedger ERP</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Wholesale rice &amp; grain trading</div>
          </div>
        </div>
        <div className="grain-rule"></div>
        <div className="tabs-tl">
          <div className={"tab-tl " + (mode === "login" ? "active" : "")} onClick={() => setMode("login")}>Log in</div>
          <div className={"tab-tl " + (mode === "register" ? "active" : "")} onClick={() => setMode("register")}>Create account</div>
        </div>
        <form onSubmit={submit}>
          {mode === "register" && (
            <div className="form-group">
              <label className="form-label">Full name</label>
              <input className="form-control-tl" required value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-control-tl" required value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@business.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-control-tl" required value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
          </div>
          {error && <div style={{ color: "var(--accent-rose)", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <button className="btn-teal" style={{ width: "100%", marginTop: 4 }} disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account & business"}
          </button>
        </form>
        {mode === "register" && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
            The first account created becomes the Owner with full access. Staff accounts can be added later.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- NAVIGATION / LAYOUT ----------
const NAV_ITEMS = [
  { section: "Overview", items: [{ key: "dashboard", label: "Dashboard", icon: "◆" }] },
  {
    section: "Trading", items: [
      { key: "billing", label: "New Bill", icon: "✎" },
      { key: "bills", label: "Bill History", icon: "▤" },
      { key: "customers", label: "Customers", icon: "◐" },
      { key: "products", label: "Products", icon: "▣" },
      { key: "ledger", label: "Ledger", icon: "☰" },
    ]
  },
  {
    section: "Finance", items: [
      { key: "expenses", label: "Expenses", icon: "◈" },
      { key: "reports", label: "Reports", icon: "▦" },
    ]
  },
  {
    section: "System", items: [
      { key: "profile", label: "Business Profile", icon: "◉" },
      { key: "settings", label: "Settings", icon: "⚙" },
      { key: "backup", label: "Backup", icon: "⇩" },
    ]
  },
];

function Sidebar({ page, setPage, mobileOpen, setMobileOpen }) {
  return (
    <div className={"sidebar" + (mobileOpen ? " open" : "")}>
      <div className="brand">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="brand-mark">TL</div>
          <div>
            <div className="font-display" style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.1 }}>TradeLedger</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>ERP for grain traders</div>
          </div>
        </div>
      </div>
      <div className="nav-section">
        {NAV_ITEMS.map(sec => (
          <div key={sec.section}>
            <div className="nav-label">{sec.section}</div>
            {sec.items.map(item => (
              <div key={item.key} className={"nav-link" + (page === item.key ? " active" : "")}
                onClick={() => { setPage(item.key); setMobileOpen(false); }}>
                <span className="nav-icon">{item.icon}</span>{item.label}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const PAGE_TITLES = {
  dashboard: "Dashboard", billing: "New Bill", bills: "Bill History", customers: "Customers",
  products: "Product Master", ledger: "Ledger", expenses: "Expense Management", reports: "Reports",
  profile: "Business Profile", settings: "Settings", backup: "Backup & Restore",
};

function TopBar({ page, setMobileOpen }) {
  const { user, logout } = useAuth();
  return (
    <div className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn-outline btn-sm" style={{ display: "none" }} id="mobile-menu-btn"
          onClick={() => setMobileOpen(o => !o)}>☰</button>
        <h5 className="font-display" style={{ margin: 0, fontWeight: 600 }}>{PAGE_TITLES[page]}</h5>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{user && user.name}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "capitalize" }}>{user && user.role}</div>
        </div>
        <button className="btn-outline btn-sm" onClick={logout}>Log out</button>
      </div>
    </div>
  );
}

// ---------- DASHBOARD ----------
function ChartCanvas({ id, type, data, options, height }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current.getContext("2d"), { type, data, options: options || {} });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [JSON.stringify(data), type]);
  return <canvas ref={canvasRef} height={height || 220}></canvas>;
}

const CHART_BASE_OPTS = {
  responsive: true,
  plugins: { legend: { labels: { color: "#8AA0B8" } } },
  scales: {
    x: { ticks: { color: "#8AA0B8" }, grid: { color: "rgba(34,51,73,0.5)" } },
    y: { ticks: { color: "#8AA0B8" }, grid: { color: "rgba(34,51,73,0.5)" } },
  },
};

function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [charts, setCharts] = useState(null);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get("/dashboard/summary"), api.get("/dashboard/charts"), api.get("/dashboard/recent-activity"),
    ]).then(([s, c, a]) => {
      if (!mounted) return;
      setSummary(s.data); setCharts(c.data); setActivity(a.data);
    }).catch(err => toast(apiErrorMessage(err), "error")).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  if (loading || !summary) return <Spinner />;

  return (
    <div>
      <div className="grid-3" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}>
        <StatCard label="Today's Sales" value={formatMoney(summary.today_sales)} color="var(--accent-teal)" />
        <StatCard label="Today's Profit" value={formatMoney(summary.today_profit)} color="var(--accent-green)" />
        <StatCard label="Monthly Sales" value={formatMoney(summary.monthly_sales)} color="var(--accent-teal)" />
        <StatCard label="Monthly Profit" value={formatMoney(summary.monthly_profit)} color="var(--accent-green)" />
      </div>
      <div className="grid-3" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 24 }}>
        <StatCard label="Outstanding Balance" value={formatMoney(summary.outstanding_balance)} color="var(--accent-amber)" />
        <StatCard label="Total Customers" value={formatNum(summary.total_customers)} color="var(--accent-teal)" />
        <StatCard label="Total Bills" value={formatNum(summary.total_bills)} color="var(--accent-teal)" />
        <StatCard label="Expenses (Month)" value={formatMoney(summary.total_expenses_this_month)} color="var(--accent-rose)" />
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card card-pad">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Daily Sales (30 days)</div>
          {charts && charts.daily_sales.length ? (
            <ChartCanvas type="line" data={{
              labels: charts.daily_sales.map(d => d.bill_date),
              datasets: [{ label: "Sales", data: charts.daily_sales.map(d => d.sales), borderColor: "#14B8A6", backgroundColor: "rgba(20,184,166,0.15)", tension: 0.3, fill: true }],
            }} options={CHART_BASE_OPTS} />
          ) : <EmptyState text="No sales recorded yet" />}
        </div>
        <div className="card card-pad">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Monthly Profit</div>
          {charts && charts.monthly_profit.length ? (
            <ChartCanvas type="bar" data={{
              labels: charts.monthly_profit.map(d => d.month),
              datasets: [{ label: "Net Profit", data: charts.monthly_profit.map(d => d.profit), backgroundColor: "#F5A524" }],
            }} options={CHART_BASE_OPTS} />
          ) : <EmptyState text="No profit data yet" />}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card card-pad">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Brand-wise Sales</div>
          {charts && charts.brand_wise_sales.length ? (
            <ChartCanvas type="doughnut" data={{
              labels: charts.brand_wise_sales.map(d => d.name),
              datasets: [{ data: charts.brand_wise_sales.map(d => d.total_sales), backgroundColor: ["#14B8A6", "#F5A524", "#F43F5E", "#22C55E", "#818CF8", "#EAB308"] }],
            }} options={{ plugins: { legend: { labels: { color: "#8AA0B8" } } } }} />
          ) : <EmptyState text="No product sales yet" />}
        </div>
        <div className="card card-pad">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Expense Distribution</div>
          {charts && charts.expense_analysis.length ? (
            <ChartCanvas type="doughnut" data={{
              labels: charts.expense_analysis.map(d => d.category),
              datasets: [{ data: charts.expense_analysis.map(d => d.total), backgroundColor: ["#F43F5E", "#F5A524", "#14B8A6", "#818CF8", "#EAB308", "#22C55E"] }],
            }} options={{ plugins: { legend: { labels: { color: "#8AA0B8" } } } }} />
          ) : <EmptyState text="No expenses recorded yet" />}
        </div>
      </div>

      <div className="grid-3">
        <div className="card card-pad">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Recent Bills</div>
          {activity && activity.bills.length ? activity.bills.map(b => (
            <div key={b.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span>{b.bill_number} · {b.customer_name}</span>
              <span className="font-mono">{formatMoney(b.sales_amount)}</span>
            </div>
          )) : <EmptyState text="No bills yet" />}
        </div>
        <div className="card card-pad">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Recent Payments</div>
          {activity && activity.payments.length ? activity.payments.map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span>{p.customer_name}</span>
              <span className="font-mono" style={{ color: "var(--accent-green)" }}>{formatMoney(Math.abs(p.amount))}</span>
            </div>
          )) : <EmptyState text="No payments yet" />}
        </div>
        <div className="card card-pad">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Recent Expenses</div>
          {activity && activity.expenses.length ? activity.expenses.map(e => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span>{e.category}</span>
              <span className="font-mono" style={{ color: "var(--accent-rose)" }}>{formatMoney(e.amount)}</span>
            </div>
          )) : <EmptyState text="No expenses yet" />}
        </div>
      </div>
    </div>
  );
}

// ---------- CUSTOMERS ----------
function CustomerFormModal({ customer, onClose, onSaved }) {
  const [form, setForm] = useState(customer || { name: "", mobile: "", address: "", gst_number: "", opening_balance: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const isEdit = !!customer;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      if (isEdit) await api.put(`/customers/${customer.id}`, form);
      else await api.post("/customers", form);
      toast(isEdit ? "Customer updated" : "Customer added");
      onSaved();
    } catch (err) { setError(apiErrorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <Modal title={isEdit ? "Edit Customer" : "Add Customer"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-group">
          <label className="form-label">Customer name</label>
          <input className="form-control-tl" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Mobile</label>
            <input className="form-control-tl" value={form.mobile || ""} onChange={e => setForm({ ...form, mobile: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">GST Number (optional)</label>
            <input className="form-control-tl" value={form.gst_number || ""} onChange={e => setForm({ ...form, gst_number: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Address</label>
          <textarea className="form-control-tl" rows="2" value={form.address || ""} onChange={e => setForm({ ...form, address: e.target.value })}></textarea>
        </div>
        {!isEdit && (
          <div className="form-group">
            <label className="form-label">Opening balance (₹)</label>
            <input type="number" step="0.01" className="form-control-tl" value={form.opening_balance}
              onChange={e => setForm({ ...form, opening_balance: e.target.value })} />
          </div>
        )}
        {error && <div style={{ color: "var(--accent-rose)", fontSize: 13, marginBottom: 8 }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-teal" disabled={saving}>{saving ? "Saving..." : "Save Customer"}</button>
        </div>
      </form>
    </Modal>
  );
}

function CustomerLedgerModal({ customerId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [paying, setPaying] = useState(false);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    api.get(`/customers/${customerId}/ledger`).then(res => setData(res.data))
      .catch(err => toast(apiErrorMessage(err), "error")).finally(() => setLoading(false));
  };
  useEffect(load, [customerId]);

  const recordPayment = async (e) => {
    e.preventDefault();
    if (!payAmount || Number(payAmount) <= 0) return;
    setPaying(true);
    try {
      await api.post(`/customers/${customerId}/payments`, { amount: Number(payAmount), note: payNote, date: todayStr() });
      toast("Payment recorded");
      setPayAmount(""); setPayNote("");
      load(); onChanged();
    } catch (err) { toast(apiErrorMessage(err), "error"); } finally { setPaying(false); }
  };

  return (
    <Modal title={data ? `Ledger · ${data.customer.name}` : "Ledger"} onClose={onClose} wide>
      {loading ? <Spinner /> : data && (
        <div>
          <form onSubmit={recordPayment} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <input type="number" step="0.01" placeholder="Payment amount" className="form-control-tl"
              style={{ maxWidth: 160 }} value={payAmount} onChange={e => setPayAmount(e.target.value)} />
            <input placeholder="Note (optional)" className="form-control-tl" style={{ flex: 1, minWidth: 140 }}
              value={payNote} onChange={e => setPayNote(e.target.value)} />
            <button className="btn-teal btn-sm" disabled={paying}>{paying ? "Recording..." : "Record Payment"}</button>
          </form>
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            <table className="tl-table">
              <thead><tr><th>Date</th><th>Type</th><th>Note</th><th>Amount</th><th>Balance</th></tr></thead>
              <tbody>
                {data.transactions.length === 0 && <tr><td colSpan="5"><EmptyState text="No transactions yet" /></td></tr>}
                {data.transactions.map(t => (
                  <tr key={t.id}>
                    <td>{t.txn_date}</td>
                    <td><span className={"badge " + (t.txn_type === "payment" ? "badge-green" : t.txn_type === "bill" ? "badge-teal" : "badge-amber")}>{t.txn_type}</span></td>
                    <td style={{ color: "var(--text-muted)" }}>{t.note}</td>
                    <td className="font-mono" style={{ color: t.amount < 0 ? "var(--accent-green)" : "inherit" }}>{formatMoney(t.amount)}</td>
                    <td className="font-mono">{formatMoney(t.balance_after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [ledgerFor, setLedgerFor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    api.get("/customers", { params: search ? { search } : {} }).then(res => setCustomers(res.data))
      .catch(err => toast(apiErrorMessage(err), "error")).finally(() => setLoading(false));
  };
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [search]);

  const doDelete = async () => {
    try {
      await api.delete(`/customers/${deleting.id}`);
      toast("Customer deleted"); setDeleting(null); load();
    } catch (err) { toast(apiErrorMessage(err), "error"); setDeleting(null); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search customers..." />
        <button className="btn-teal" onClick={() => { setEditing(null); setShowForm(true); }}>+ Add Customer</button>
      </div>
      <div className="card">
        {loading ? <Spinner /> : customers.length === 0 ? <EmptyState text="No customers found. Add your first customer to get started." /> : (
          <table className="tl-table">
            <thead><tr><th>Name</th><th>Mobile</th><th>GST</th><th>Outstanding</th><th></th></tr></thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td>{c.mobile || "-"}</td>
                  <td>{c.gst_number || "-"}</td>
                  <td className="font-mono">
                    <span className={c.outstanding_balance > 0 ? "badge badge-amber" : "badge badge-green"}>
                      {formatMoney(c.outstanding_balance)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn-outline btn-sm" onClick={() => setLedgerFor(c.id)}>Ledger</button>
                      <button className="btn-outline btn-sm" onClick={() => { setEditing(c); setShowForm(true); }}>Edit</button>
                      <button className="btn-danger" onClick={() => setDeleting(c)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showForm && <CustomerFormModal customer={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {ledgerFor && <CustomerLedgerModal customerId={ledgerFor} onClose={() => setLedgerFor(null)} onChanged={load} />}
      {deleting && <ConfirmModal title="Delete Customer" message={`Delete ${deleting.name}? This cannot be undone.`} onConfirm={doDelete} onClose={() => setDeleting(null)} />}
    </div>
  );
}

// ---------- PRODUCTS ----------
function ProductFormModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState(product || { name: "", bag_weight: 50, default_purchase_rate: "", default_selling_rate: "", status: "active" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const isEdit = !!product;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      if (isEdit) await api.put(`/products/${product.id}`, form);
      else await api.post("/products", form);
      toast(isEdit ? "Product updated" : "Product added");
      onSaved();
    } catch (err) { setError(apiErrorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <Modal title={isEdit ? "Edit Product" : "Add Product"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-group">
          <label className="form-label">Product name</label>
          <input className="form-control-tl" required placeholder="e.g. Ponni, IR64, ADT, SMP" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Bag weight (kg)</label>
            <input type="number" step="0.01" className="form-control-tl" value={form.bag_weight}
              onChange={e => setForm({ ...form, bag_weight: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control-tl" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Default purchase rate (₹/kg)</label>
            <input type="number" step="0.01" className="form-control-tl" value={form.default_purchase_rate}
              onChange={e => setForm({ ...form, default_purchase_rate: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Default selling rate (₹/kg)</label>
            <input type="number" step="0.01" className="form-control-tl" value={form.default_selling_rate}
              onChange={e => setForm({ ...form, default_selling_rate: e.target.value })} />
          </div>
        </div>
        {error && <div style={{ color: "var(--accent-rose)", fontSize: 13, marginBottom: 8 }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-teal" disabled={saving}>{saving ? "Saving..." : "Save Product"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    api.get("/products", { params: search ? { search } : {} }).then(res => setProducts(res.data))
      .catch(err => toast(apiErrorMessage(err), "error")).finally(() => setLoading(false));
  };
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [search]);

  const doDelete = async () => {
    try {
      await api.delete(`/products/${deleting.id}`);
      toast("Product deleted"); setDeleting(null); load();
    } catch (err) { toast(apiErrorMessage(err), "error"); setDeleting(null); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search products..." />
        <button className="btn-teal" onClick={() => { setEditing(null); setShowForm(true); }}>+ Add Product</button>
      </div>
      <div className="card">
        {loading ? <Spinner /> : products.length === 0 ? <EmptyState text="No products yet. Add rice/grain varieties like Ponni, IR64, ADT, SMP." /> : (
          <table className="tl-table">
            <thead><tr><th>Name</th><th>Bag Weight</th><th>Purchase Rate</th><th>Selling Rate</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td className="font-mono">{p.bag_weight} kg</td>
                  <td className="font-mono">₹{p.default_purchase_rate}/kg</td>
                  <td className="font-mono">₹{p.default_selling_rate}/kg</td>
                  <td><span className={"badge " + (p.status === "active" ? "badge-teal" : "badge-rose")}>{p.status}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn-outline btn-sm" onClick={() => { setEditing(p); setShowForm(true); }}>Edit</button>
                      <button className="btn-danger" onClick={() => setDeleting(p)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showForm && <ProductFormModal product={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {deleting && <ConfirmModal title="Delete Product" message={`Delete ${deleting.name}? This cannot be undone.`} onConfirm={doDelete} onClose={() => setDeleting(null)} />}
    </div>
  );
}

// ---------- BILLING: NEW BILL ----------
function BillingPage({ navigate }) {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    customer_id: "", product_id: "", bill_date: todayStr(), tons: "", selling_rate: "",
    purchase_rate: "", duty_per_kg: "0", vehicle_number: "", remarks: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastBill, setLastBill] = useState(null);
  const toast = useToast();

  useEffect(() => {
    api.get("/customers").then(res => setCustomers(res.data));
    api.get("/products", { params: { status: "active" } }).then(res => setProducts(res.data));
  }, []);

  const selectedProduct = products.find(p => String(p.id) === String(form.product_id));
  const selectedCustomer = customers.find(c => String(c.id) === String(form.customer_id));

  useEffect(() => {
    if (selectedProduct && !form._touched) {
      setForm(f => ({ ...f, selling_rate: selectedProduct.default_selling_rate, purchase_rate: selectedProduct.default_purchase_rate }));
    }
  }, [form.product_id]);

  const preview = useMemo(() => {
    const tons = parseFloat(form.tons) || 0;
    const sr = parseFloat(form.selling_rate) || 0;
    const pr = parseFloat(form.purchase_rate) || 0;
    const duty = parseFloat(form.duty_per_kg) || 0;
    const bagWeight = (selectedProduct && selectedProduct.bag_weight) || 50;
    const qty = tons * 1000;
    const bags = bagWeight ? Math.round(qty / bagWeight) : 0;
    const sales = qty * sr;
    const purchase = qty * pr;
    const dutyAmt = qty * duty;
    const gross = sales - purchase;
    const net = gross - dutyAmt;
    const prevBal = selectedCustomer ? (selectedCustomer.outstanding_balance || 0) : 0;
    const finalBal = prevBal + sales;
    return { qty, bags, sales, purchase, dutyAmt, gross, net, prevBal, finalBal };
  }, [form, selectedProduct, selectedCustomer]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.customer_id || !form.product_id || !form.tons || !form.selling_rate || !form.purchase_rate) {
      setError("Please fill in customer, product, tons, selling rate and purchase rate.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/bills", form);
      toast(`Bill ${res.data.bill_number} created`);
      setLastBill(res.data);
      setForm({ customer_id: "", product_id: "", bill_date: todayStr(), tons: "", selling_rate: "", purchase_rate: "", duty_per_kg: "0", vehicle_number: "", remarks: "" });
      const refreshed = await api.get("/customers"); setCustomers(refreshed.data);
    } catch (err) { setError(apiErrorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <div className="card card-pad">
        <form onSubmit={submit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Customer</label>
              <select className="form-control-tl" required value={form.customer_id}
                onChange={e => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">Select customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Product</label>
              <select className="form-control-tl" required value={form.product_id}
                onChange={e => setForm({ ...form, product_id: e.target.value, _touched: false })}>
                <option value="">Select product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="form-control-tl" required value={form.bill_date}
                onChange={e => setForm({ ...form, bill_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Tons</label>
              <input type="number" step="0.001" className="form-control-tl" required value={form.tons}
                placeholder="e.g. 5" onChange={e => setForm({ ...form, tons: e.target.value })} />
            </div>
          </div>
          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Selling rate (₹/kg)</label>
              <input type="number" step="0.01" className="form-control-tl" required value={form.selling_rate}
                onChange={e => setForm({ ...form, selling_rate: e.target.value, _touched: true })} />
            </div>
            <div className="form-group">
              <label className="form-label">Purchase rate (₹/kg)</label>
              <input type="number" step="0.01" className="form-control-tl" required value={form.purchase_rate}
                onChange={e => setForm({ ...form, purchase_rate: e.target.value, _touched: true })} />
            </div>
            <div className="form-group">
              <label className="form-label">Duty (₹/kg)</label>
              <input type="number" step="0.01" className="form-control-tl" value={form.duty_per_kg}
                onChange={e => setForm({ ...form, duty_per_kg: e.target.value })} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Vehicle number (optional)</label>
              <input className="form-control-tl" value={form.vehicle_number}
                onChange={e => setForm({ ...form, vehicle_number: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Remarks (optional)</label>
              <input className="form-control-tl" value={form.remarks}
                onChange={e => setForm({ ...form, remarks: e.target.value })} />
            </div>
          </div>
          {error && <div style={{ color: "var(--accent-rose)", fontSize: 13, marginBottom: 8 }}>{error}</div>}
          <button className="btn-teal" style={{ width: "100%", marginTop: 6 }} disabled={saving}>
            {saving ? "Generating bill..." : "Generate Bill"}
          </button>
        </form>

        {lastBill && (
          <div className="grain-rule" style={{ marginTop: 20 }}></div>
        )}
        {lastBill && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span className="badge badge-green">Bill {lastBill.bill_number} created</span>
            <a className="btn-outline btn-sm" href={`/api/bills/${lastBill.id}/pdf`} target="_blank">Download PDF</a>
            <a className="btn-outline btn-sm" href={`/api/bills/${lastBill.id}/excel`} target="_blank">Download Excel</a>
          </div>
        )}
      </div>

      <div className="card card-pad">
        <div style={{ fontWeight: 600, marginBottom: 14 }}>Live Calculation</div>
        {[
          ["Quantity", `${formatNum(preview.qty)} kg`],
          ["Bags", formatNum(preview.bags)],
          ["Sales Amount", formatMoney(preview.sales)],
          ["Purchase Amount", formatMoney(preview.purchase)],
          ["Duty Amount", formatMoney(preview.dutyAmt)],
        ].map(([label, val]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 14 }}>
            <span style={{ color: "var(--text-muted)" }}>{label}</span><span className="font-mono">{val}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 14 }}>
          <span style={{ color: "var(--text-muted)" }}>Gross Profit</span>
          <span className="font-mono" style={{ color: preview.gross >= 0 ? "var(--accent-green)" : "var(--accent-rose)" }}>{formatMoney(preview.gross)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 14 }}>
          <span style={{ color: "var(--text-muted)" }}>Net Profit</span>
          <span className="font-mono" style={{ color: preview.net >= 0 ? "var(--accent-green)" : "var(--accent-rose)" }}>{formatMoney(preview.net)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 14 }}>
          <span style={{ color: "var(--text-muted)" }}>Previous Balance</span><span className="font-mono">{formatMoney(preview.prevBal)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontSize: 15, fontWeight: 700 }}>
          <span>Final Balance</span><span className="font-mono" style={{ color: "var(--accent-amber)" }}>{formatMoney(preview.finalBal)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------- BILL HISTORY ----------
function BillEditModal({ bill, onClose, onSaved }) {
  const [form, setForm] = useState({
    bill_date: bill.bill_date, tons: bill.tons, selling_rate: bill.selling_rate,
    purchase_rate: bill.purchase_rate, duty_per_kg: bill.duty_per_kg,
    vehicle_number: bill.vehicle_number || "", remarks: bill.remarks || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await api.put(`/bills/${bill.id}`, form);
      toast("Bill updated");
      onSaved();
    } catch (err) { setError(apiErrorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <Modal title={`Edit Bill ${bill.bill_number}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" className="form-control-tl" value={form.bill_date} onChange={e => setForm({ ...form, bill_date: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Tons</label>
            <input type="number" step="0.001" className="form-control-tl" value={form.tons} onChange={e => setForm({ ...form, tons: e.target.value })} />
          </div>
        </div>
        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Selling rate</label>
            <input type="number" step="0.01" className="form-control-tl" value={form.selling_rate} onChange={e => setForm({ ...form, selling_rate: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Purchase rate</label>
            <input type="number" step="0.01" className="form-control-tl" value={form.purchase_rate} onChange={e => setForm({ ...form, purchase_rate: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Duty/kg</label>
            <input type="number" step="0.01" className="form-control-tl" value={form.duty_per_kg} onChange={e => setForm({ ...form, duty_per_kg: e.target.value })} />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Vehicle number</label>
            <input className="form-control-tl" value={form.vehicle_number} onChange={e => setForm({ ...form, vehicle_number: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Remarks</label>
            <input className="form-control-tl" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} />
          </div>
        </div>
        {error && <div style={{ color: "var(--accent-rose)", fontSize: 13, marginBottom: 8 }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-teal" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
        </div>
      </form>
    </Modal>
  );
}

function BillsPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    api.get("/bills", { params }).then(res => setBills(res.data))
      .catch(err => toast(apiErrorMessage(err), "error")).finally(() => setLoading(false));
  };
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [search, startDate, endDate]);

  const doDelete = async () => {
    try {
      await api.delete(`/bills/${deleting.id}`);
      toast("Bill deleted"); setDeleting(null); load();
    } catch (err) { toast(apiErrorMessage(err), "error"); setDeleting(null); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search bill # or customer..." />
          <input type="date" className="form-control-tl" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <input type="date" className="form-control-tl" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>
      <div className="card">
        {loading ? <Spinner /> : bills.length === 0 ? <EmptyState text="No bills found for this filter." /> : (
          <div style={{ overflowX: "auto" }}>
            <table className="tl-table">
              <thead><tr><th>Bill No</th><th>Date</th><th>Customer</th><th>Product</th><th>Tons</th><th>Sales</th><th>Net Profit</th><th></th></tr></thead>
              <tbody>
                {bills.map(b => (
                  <tr key={b.id}>
                    <td className="font-mono">{b.bill_number}</td>
                    <td>{b.bill_date}</td>
                    <td>{b.customer_name}</td>
                    <td>{b.product_name}</td>
                    <td className="font-mono">{b.tons}</td>
                    <td className="font-mono">{formatMoney(b.sales_amount)}</td>
                    <td className="font-mono" style={{ color: b.net_profit >= 0 ? "var(--accent-green)" : "var(--accent-rose)" }}>{formatMoney(b.net_profit)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <a className="btn-outline btn-sm" href={`/api/bills/${b.id}/pdf`} target="_blank">PDF</a>
                        <a className="btn-outline btn-sm" href={`/api/bills/${b.id}/excel`} target="_blank">Excel</a>
                        <button className="btn-outline btn-sm" onClick={() => setEditing(b)}>Edit</button>
                        <button className="btn-danger" onClick={() => setDeleting(b)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing && <BillEditModal bill={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {deleting && <ConfirmModal title="Delete Bill" message={`Delete bill ${deleting.bill_number}? This will also remove its ledger entry.`} onConfirm={doDelete} onClose={() => setDeleting(null)} />}
    </div>
  );
}

// ---------- GLOBAL LEDGER ----------
function LedgerPage() {
  const [txns, setTxns] = useState([]);
  const [outstanding, setOutstanding] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    Promise.all([api.get("/ledger/transactions"), api.get("/ledger/outstanding")])
      .then(([t, o]) => { setTxns(t.data); setOutstanding(o.data); })
      .catch(err => toast(apiErrorMessage(err), "error")).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <div className="card card-pad" style={{ gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontWeight: 600 }}>Outstanding Collection</div>
          <div className="font-mono" style={{ fontWeight: 700, color: "var(--accent-amber)" }}>
            Total: {formatMoney(outstanding ? outstanding.total_outstanding : 0)}
          </div>
        </div>
        {outstanding && outstanding.customers.length === 0 ? <EmptyState text="No outstanding balances." /> : (
          <table className="tl-table">
            <thead><tr><th>Customer</th><th>Balance</th></tr></thead>
            <tbody>
              {outstanding && outstanding.customers.map(c => (
                <tr key={c.customer_id}>
                  <td>{c.customer_name}</td>
                  <td className="font-mono"><span className={c.balance > 0 ? "badge badge-amber" : "badge badge-green"}>{formatMoney(c.balance)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card card-pad" style={{ gridColumn: "1 / -1" }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>All Transactions</div>
        {txns.length === 0 ? <EmptyState text="No transactions yet." /> : (
          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            <table className="tl-table">
              <thead><tr><th>Date</th><th>Customer</th><th>Type</th><th>Note</th><th>Amount</th><th>Balance</th></tr></thead>
              <tbody>
                {txns.map(t => (
                  <tr key={t.id}>
                    <td>{t.txn_date}</td>
                    <td>{t.customer_name}</td>
                    <td><span className={"badge " + (t.txn_type === "payment" ? "badge-green" : t.txn_type === "bill" ? "badge-teal" : "badge-amber")}>{t.txn_type}</span></td>
                    <td style={{ color: "var(--text-muted)" }}>{t.note}</td>
                    <td className="font-mono">{formatMoney(t.amount)}</td>
                    <td className="font-mono">{formatMoney(t.balance_after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- EXPENSES ----------
function ExpenseFormModal({ categories, onClose, onSaved }) {
  const [form, setForm] = useState({ category: categories[0] || "Miscellaneous", amount: "", expense_date: todayStr(), note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await api.post("/expenses", form);
      toast("Expense recorded");
      onSaved();
    } catch (err) { setError(apiErrorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <Modal title="Add Expense" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-control-tl" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input type="number" step="0.01" className="form-control-tl" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Date</label>
          <input type="date" className="form-control-tl" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Note (optional)</label>
          <input className="form-control-tl" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
        </div>
        {error && <div style={{ color: "var(--accent-rose)", fontSize: 13, marginBottom: 8 }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-teal" disabled={saving}>{saving ? "Saving..." : "Save Expense"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterCat, setFilterCat] = useState("");
  const [deleting, setDeleting] = useState(null);
  const toast = useToast();

  useEffect(() => { api.get("/expenses/categories").then(res => setCategories(res.data)); }, []);

  const load = () => {
    setLoading(true);
    api.get("/expenses", { params: filterCat ? { category: filterCat } : {} }).then(res => setExpenses(res.data))
      .catch(err => toast(apiErrorMessage(err), "error")).finally(() => setLoading(false));
  };
  useEffect(load, [filterCat]);

  const doDelete = async () => {
    try {
      await api.delete(`/expenses/${deleting.id}`);
      toast("Expense deleted"); setDeleting(null); load();
    } catch (err) { toast(apiErrorMessage(err), "error"); setDeleting(null); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <select className="form-control-tl" style={{ maxWidth: 220 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn-teal" onClick={() => setShowForm(true)}>+ Add Expense</button>
      </div>
      <div className="card">
        {loading ? <Spinner /> : expenses.length === 0 ? <EmptyState text="No expenses recorded." /> : (
          <table className="tl-table">
            <thead><tr><th>Date</th><th>Category</th><th>Note</th><th>Amount</th><th></th></tr></thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id}>
                  <td>{e.expense_date}</td>
                  <td><span className="badge badge-rose">{e.category}</span></td>
                  <td style={{ color: "var(--text-muted)" }}>{e.note}</td>
                  <td className="font-mono">{formatMoney(e.amount)}</td>
                  <td><div style={{ display: "flex", justifyContent: "flex-end" }}><button className="btn-danger" onClick={() => setDeleting(e)}>Delete</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showForm && <ExpenseFormModal categories={categories} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {deleting && <ConfirmModal title="Delete Expense" message="Delete this expense record?" onConfirm={doDelete} onClose={() => setDeleting(null)} />}
    </div>
  );
}

// ---------- REPORTS ----------
function ReportsPage() {
  const [period, setPeriod] = useState("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    const params = { period };
    if (period === "custom") { params.start_date = startDate; params.end_date = endDate; }
    Promise.all([api.get("/reports/sales", { params }), api.get("/dashboard/analytics")])
      .then(([r, a]) => { setData(r.data); setAnalytics(a.data); })
      .catch(err => toast(apiErrorMessage(err), "error")).finally(() => setLoading(false));
  };
  useEffect(load, [period]);

  const exportUrl = (type) => {
    const params = new URLSearchParams({ period });
    if (period === "custom") { params.set("start_date", startDate); params.set("end_date", endDate); }
    return `/api/reports/sales/${type}?${params.toString()}`;
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {["daily", "weekly", "monthly", "yearly", "custom"].map(p => (
          <button key={p} className={period === p ? "btn-teal btn-sm" : "btn-outline btn-sm"} onClick={() => setPeriod(p)} style={{ textTransform: "capitalize" }}>{p}</button>
        ))}
        {period === "custom" && (
          <>
            <input type="date" className="form-control-tl" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <input type="date" className="form-control-tl" value={endDate} onChange={e => setEndDate(e.target.value)} />
            <button className="btn-outline btn-sm" onClick={load}>Apply</button>
          </>
        )}
        <div style={{ flex: 1 }}></div>
        <a className="btn-outline btn-sm" href={exportUrl("pdf")} target="_blank">Export PDF</a>
        <a className="btn-outline btn-sm" href={exportUrl("excel")} target="_blank">Export Excel</a>
      </div>

      {loading || !data ? <Spinner /> : (
        <div>
          <div className="grid-3" style={{ gridTemplateColumns: "repeat(5, 1fr)", marginBottom: 20 }}>
            <StatCard label="Bills" value={formatNum(data.totals.bill_count)} />
            <StatCard label="Sales" value={formatMoney(data.totals.sales)} color="var(--accent-teal)" />
            <StatCard label="Net Profit" value={formatMoney(data.totals.net_profit)} color="var(--accent-green)" />
            <StatCard label="Duty" value={formatMoney(data.totals.duty)} color="var(--accent-amber)" />
            <StatCard label="Expenses" value={formatMoney(data.totals.total_expenses)} color="var(--accent-rose)" />
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            {data.bills.length === 0 ? <EmptyState text="No bills in this period." /> : (
              <div style={{ overflowX: "auto" }}>
                <table className="tl-table">
                  <thead><tr><th>Bill No</th><th>Date</th><th>Customer</th><th>Product</th><th>Tons</th><th>Sales</th><th>Net Profit</th></tr></thead>
                  <tbody>
                    {data.bills.map(b => (
                      <tr key={b.bill_number}>
                        <td className="font-mono">{b.bill_number}</td><td>{b.bill_date}</td><td>{b.customer_name}</td>
                        <td>{b.product_name}</td><td className="font-mono">{b.tons}</td>
                        <td className="font-mono">{formatMoney(b.sales_amount)}</td>
                        <td className="font-mono" style={{ color: b.net_profit >= 0 ? "var(--accent-green)" : "var(--accent-rose)" }}>{formatMoney(b.net_profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {analytics && (
            <div className="grid-2">
              <div className="card card-pad">
                <div style={{ fontWeight: 600, marginBottom: 10 }}>Top 10 Customers by Profit</div>
                {analytics.top_customers_by_profit.length === 0 ? <EmptyState text="No data yet." /> : analytics.top_customers_by_profit.map((c, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                    <span>{i + 1}. {c.name}</span><span className="font-mono" style={{ color: "var(--accent-green)" }}>{formatMoney(c.total_profit)}</span>
                  </div>
                ))}
              </div>
              <div className="card card-pad">
                <div style={{ fontWeight: 600, marginBottom: 10 }}>Product Performance</div>
                {analytics.product_performance.length === 0 ? <EmptyState text="No data yet." /> : analytics.product_performance.map((p, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                    <span>{p.name}</span>
                    <span className="font-mono">{formatMoney(p.total_sales)} · <span style={{ color: "var(--accent-amber)" }}>{p.profit_margin_pct}%</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- BUSINESS PROFILE ----------
function ProfilePage() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get("/business-profile").then(res => setForm({
      business_name: "", business_type: "", gst_number: "", mobile_number: "", email: "",
      address: "", bank_name: "", account_number: "", ifsc: "", branch: "", ...res.data,
    }));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await api.put("/business-profile", form); toast("Business profile saved"); }
    catch (err) { toast(apiErrorMessage(err), "error"); } finally { setSaving(false); }
  };

  if (!form) return <Spinner />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="card card-pad" style={{ maxWidth: 720 }}>
      <form onSubmit={submit}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Business Details</div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">Business name</label><input className="form-control-tl" value={form.business_name} onChange={set("business_name")} /></div>
          <div className="form-group"><label className="form-label">Business type</label><input className="form-control-tl" value={form.business_type} onChange={set("business_type")} /></div>
        </div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">GST number</label><input className="form-control-tl" value={form.gst_number} onChange={set("gst_number")} /></div>
          <div className="form-group"><label className="form-label">Mobile number</label><input className="form-control-tl" value={form.mobile_number} onChange={set("mobile_number")} /></div>
        </div>
        <div className="form-group"><label className="form-label">Email</label><input className="form-control-tl" value={form.email} onChange={set("email")} /></div>
        <div className="form-group"><label className="form-label">Address</label><textarea className="form-control-tl" rows="2" value={form.address} onChange={set("address")}></textarea></div>
        <div className="grain-rule"></div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Bank Details</div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">Bank name</label><input className="form-control-tl" value={form.bank_name} onChange={set("bank_name")} /></div>
          <div className="form-group"><label className="form-label">Account number</label><input className="form-control-tl" value={form.account_number} onChange={set("account_number")} /></div>
        </div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">IFSC</label><input className="form-control-tl" value={form.ifsc} onChange={set("ifsc")} /></div>
          <div className="form-group"><label className="form-label">Branch</label><input className="form-control-tl" value={form.branch} onChange={set("branch")} /></div>
        </div>
        <button className="btn-teal" disabled={saving} style={{ marginTop: 6 }}>{saving ? "Saving..." : "Save Business Profile"}</button>
      </form>
    </div>
  );
}

// ---------- SETTINGS ----------
function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => { api.get("/settings").then(res => setSettings(res.data)); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await api.put("/settings", settings); toast("Settings saved"); }
    catch (err) { toast(apiErrorMessage(err), "error"); } finally { setSaving(false); }
  };

  if (!settings) return <Spinner />;
  const set = (k) => (e) => setSettings({ ...settings, [k]: e.target.value });

  return (
    <div className="card card-pad" style={{ maxWidth: 560 }}>
      <form onSubmit={submit}>
        <div className="form-group">
          <label className="form-label">Default bag weight (kg)</label>
          <input type="number" className="form-control-tl" value={settings.default_bag_weight} onChange={set("default_bag_weight")} />
        </div>
        <div className="form-group">
          <label className="form-label">Theme</label>
          <select className="form-control-tl" value={settings.theme} onChange={set("theme")}>
            <option value="dark">Dark</option>
            <option value="light">Light (not yet implemented)</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Printer</label>
          <input className="form-control-tl" placeholder="Default printer name" value={settings.printer} onChange={set("printer")} />
        </div>
        <div className="form-group">
          <label className="form-label">Backup location</label>
          <input className="form-control-tl" value={settings.backup_location} onChange={set("backup_location")} />
        </div>
        <button className="btn-teal" disabled={saving}>{saving ? "Saving..." : "Save Settings"}</button>
      </form>
    </div>
  );
}

// ---------- BACKUP ----------
function BackupPage() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    api.get("/backup").then(res => setBackups(res.data)).catch(err => toast(apiErrorMessage(err), "error")).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const createBackup = async () => {
    setCreating(true);
    try { await api.post("/backup"); toast("Backup created"); load(); }
    catch (err) { toast(apiErrorMessage(err), "error"); } finally { setCreating(false); }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button className="btn-teal" onClick={createBackup} disabled={creating}>
          {creating ? "Creating backup..." : "⇩ Create One-Click Backup"}
        </button>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 8 }}>
          Backs up the database, bills, and uploaded files into a single .zip file.
        </div>
      </div>
      <div className="card">
        {loading ? <Spinner /> : backups.length === 0 ? <EmptyState text="No backups yet." /> : (
          <table className="tl-table">
            <thead><tr><th>Filename</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {backups.map(b => (
                <tr key={b.id}>
                  <td className="font-mono">{b.filename}</td>
                  <td>{b.created_at}</td>
                  <td><div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <a className="btn-outline btn-sm" href={`/api/backup/${b.filename}/download`} target="_blank">Download</a>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
