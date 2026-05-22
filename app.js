let incomeCategories = loadDirectory("cezar-finance-income-categories", {
  "Продажи": ["Услуги и товары", "Прочие"],
  "Финансовые": ["Возврат", "Прочие доходы"]
});

let expenseCategories = loadDirectory("cezar-finance-expense-categories", {
  "1. Переменные": ["Закуп товаров", "Зарплата"],
  "2. Постоянные": ["Зарплата", "Питание сотрудников", "Связь и интернет", "Программное обеспечение", "Профессиональные услуги", "Аренда помещения", "Комунальные услуги"],
  "3. Коммерческие": ["Реклама", "Зарплата"],
  "4. Финансовые": ["Комиссии", "Прочие расходы"],
  "5. Инвестиционные": ["Оборудование", "Ремонт"],
  "Дивиденды": ["Дивиденды"]
});

let startingAccounts = loadDirectory("cezar-finance-accounts", [
  { name: "Kaspi Pay", balance: 1645345 },
  { name: "Kaspi Gold", balance: 0 },
  { name: "Наличные А", balance: 12020 },
  { name: "Halyk", balance: 0 },
  { name: "Депозит", balance: 0 },
  { name: "Наличные Б", balance: 0 },
  { name: "Доп", balance: 0 }
]);

const departments = loadDirectory("cezar-finance-departments", ["Игровые приставки", "Бар", "Кальян", "Общие"]);
const kaspiPayAccount = "Kaspi Pay";
const kaspiAcquiringRate = 0.0095;
const kaspiTaxRate = 0.02;

const seedOperations = [
  { id: 1, date: "2026-05-01", type: "income", department: "Игровые приставки", category: "Продажи", subcategory: "Услуги и товары", account: "Kaspi Pay", amount: 1211225, description: "Выручка клуба" },
  { id: 2, date: "2026-05-01", type: "income", department: "Бар", category: "Продажи", subcategory: "Услуги и товары", account: "Kaspi Pay", amount: 1091300, description: "Выручка бара" },
  { id: 3, date: "2026-05-04", type: "expense", department: "Бар", category: "1. Переменные", subcategory: "Закуп товаров", account: "Наличные А", amount: 933195, description: "Закуп товаров" },
  { id: 4, date: "2026-05-08", type: "expense", department: "Общие", category: "2. Постоянные", subcategory: "Зарплата", account: "Kaspi Gold", amount: 464000, description: "Зарплата" },
  { id: 5, date: "2026-05-09", type: "expense", department: "Общие", category: "2. Постоянные", subcategory: "Питание сотрудников", account: "Kaspi Pay", amount: 42600, description: "Питание сотрудников" },
  { id: 6, date: "2026-05-10", type: "expense", department: "Общие", category: "2. Постоянные", subcategory: "Прочие расходы", account: "Kaspi Pay", amount: 1500, description: "Прочие расходы" },
  { id: 7, date: "2026-05-12", type: "expense", department: "Общие", category: "2. Постоянные", subcategory: "Профессиональные услуги", account: "Kaspi Pay", amount: 21000, description: "Профессиональные услуги" },
  { id: 8, date: "2026-05-15", type: "expense", department: "Общие", category: "2. Постоянные", subcategory: "Аренда помещения", account: "Kaspi Pay", amount: 500000, description: "Аренда помещения" },
  { id: 9, date: "2026-04-20", type: "income", department: "Игровые приставки", category: "Продажи", subcategory: "Услуги и товары", account: "Kaspi Pay", amount: 1435000, description: "Выручка клуба" },
  { id: 10, date: "2026-04-24", type: "expense", department: "Общие", category: "3. Коммерческие", subcategory: "Реклама", account: "Kaspi Pay", amount: 120000, description: "Реклама" }
];

const formatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

const initialOperations = loadOperations();

const state = {
  operations: initialOperations,
  period: latestPeriod(initialOperations),
  opuPeriod: latestPeriod(initialOperations),
  typeFilter: "all",
  search: "",
  chartRange: "month"
};

const views = document.querySelectorAll(".view");
const navButtons = document.querySelectorAll(".nav-item");
const periodFilter = document.querySelector("#periodFilter");
const opuPeriodFilter = document.querySelector("#opuPeriodFilter");
const operationDialog = document.querySelector("#operationDialog");
const operationForm = document.querySelector("#operationForm");
const typeInput = document.querySelector("#typeInput");
const departmentInput = document.querySelector("#departmentInput");
const categoryInput = document.querySelector("#categoryInput");
const subcategoryInput = document.querySelector("#subcategoryInput");
const accountInput = document.querySelector("#accountInput");
const searchInput = document.querySelector("#searchInput");

function loadOperations() {
  const saved = localStorage.getItem("cezar-finance-operations");
  return normalizeOperations(saved ? JSON.parse(saved) : seedOperations);
}

function loadDirectory(key, fallback) {
  const saved = localStorage.getItem(key);
  if (!saved) return JSON.parse(JSON.stringify(fallback));
  try {
    return JSON.parse(saved);
  } catch (error) {
    return JSON.parse(JSON.stringify(fallback));
  }
}

function saveDirectories() {
  localStorage.setItem("cezar-finance-income-categories", JSON.stringify(incomeCategories));
  localStorage.setItem("cezar-finance-expense-categories", JSON.stringify(expenseCategories));
  localStorage.setItem("cezar-finance-accounts", JSON.stringify(startingAccounts));
  localStorage.setItem("cezar-finance-departments", JSON.stringify(departments));
}

function normalizeOperations(items) {
  return items.map(item => ({ ...item, department: item.department || guessDepartment(item) }));
}

function guessDepartment(item) {
  const text = `${item.category} ${item.subcategory} ${item.description}`.toLowerCase();
  if (text.includes("бар") || text.includes("закуп")) return "Бар";
  if (text.includes("кальян")) return "Кальян";
  if (item.type === "expense" && !text.includes("продаж")) return "Общие";
  return "Игровые приставки";
}

function saveOperations() {
  localStorage.setItem("cezar-finance-operations", JSON.stringify(state.operations));
}

function money(value) {
  return `${formatter.format(value)} тг`;
}

function monthKey(date) {
  return date.slice(0, 7);
}

function monthName(key) {
  const [year, month] = key.split("-").map(Number);
  const label = monthFormatter.format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function weekKey(dateValue) {
  const date = new Date(dateValue);
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const pastDays = Math.floor((date - firstDay) / 86400000);
  const week = Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function shortPeriodLabel(key) {
  if (key.includes("-W")) return key.replace("-W", " нед. ");
  const [year, month] = key.split("-");
  return `${String(month).padStart(2, "0")}.${year.slice(2)}`;
}

function getPeriods() {
  const periods = [...new Set(state.operations.map(item => monthKey(item.date)))].sort().reverse();
  return ["all", ...periods];
}

function latestPeriod(items) {
  return [...new Set(items.map(item => monthKey(item.date)))].sort().reverse()[0] || "all";
}

function filteredOperations() {
  return state.operations.filter(item => {
    const periodOk = state.period === "all" || monthKey(item.date) === state.period;
    const typeOk = state.typeFilter === "all" || item.type === state.typeFilter;
    const haystack = `${item.department} ${item.category} ${item.subcategory} ${item.account} ${item.description}`.toLowerCase();
    const searchOk = !state.search || haystack.includes(state.search.toLowerCase());
    return periodOk && typeOk && searchOk;
  });
}

function sumBy(items, type) {
  return items.filter(item => item.type === type).reduce((total, item) => total + item.amount, 0);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, symbol => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[symbol]));
}

function kaspiPayIncome(items) {
  return items.filter(item => item.type === "income" && item.account === kaspiPayAccount).reduce((total, item) => total + item.amount, 0);
}

function kaspiCharges(items) {
  const income = kaspiPayIncome(items);
  return {
    acquiring: Math.round(income * kaspiAcquiringRate),
    tax: Math.round(income * kaspiTaxRate)
  };
}

function accountBalances() {
  return startingAccounts.map(account => {
    const delta = state.operations.reduce((total, item) => {
      if (item.account !== account.name) return total;
      return total + (item.type === "income" ? item.amount : -item.amount);
    }, 0);
    const charges = account.name === kaspiPayAccount ? kaspiCharges(state.operations) : { acquiring: 0, tax: 0 };
    return { ...account, current: account.balance + delta - charges.acquiring, charges };
  });
}

function operationsForPeriod(period) {
  return state.operations.filter(item => period === "all" || monthKey(item.date) === period);
}

function emptyDepartmentTotals() {
  return Object.fromEntries(departments.map(name => [name, 0]));
}

function sumDepartments(items, predicate) {
  const totals = emptyDepartmentTotals();
  items.filter(predicate).forEach(item => {
    totals[item.department] = (totals[item.department] || 0) + item.amount;
  });
  return totals;
}

function totalDepartments(totals) {
  return departments.reduce((sum, department) => sum + (totals[department] || 0), 0);
}

function subtractDepartments(left, right) {
  const result = emptyDepartmentTotals();
  departments.forEach(department => {
    result[department] = (left[department] || 0) - (right[department] || 0);
  });
  return result;
}

function opuPercent(value, base) {
  if (!base) return "0%";
  return `${Math.round(value / base * 100)}%`;
}

function renderPeriodFilter() {
  const periods = getPeriods();
  periodFilter.innerHTML = periods.map(period => {
    const label = period === "all" ? "Все периоды" : monthName(period);
    return `<option value="${period}">${label}</option>`;
  }).join("");
  periodFilter.value = state.period;
}

function renderOpuPeriodFilter() {
  if (!opuPeriodFilter) return;
  const periods = getPeriods();
  if (!periods.includes(state.opuPeriod)) state.opuPeriod = periods[1] || "all";
  opuPeriodFilter.innerHTML = periods.map(period => {
    const label = period === "all" ? "Все периоды" : monthName(period);
    return `<option value="${period}">${label}</option>`;
  }).join("");
  opuPeriodFilter.value = state.opuPeriod;
}

function renderMetrics(items) {
  const income = sumBy(items, "income");
  const expense = sumBy(items, "expense");
  const balance = accountBalances().reduce((total, account) => total + account.current, 0);
  document.querySelector("#incomeMetric").textContent = money(income);
  document.querySelector("#expenseMetric").textContent = money(expense);
  document.querySelector("#profitMetric").textContent = money(income - expense);
  document.querySelector("#balanceMetric").textContent = money(balance);
  document.querySelector("#selectedPeriodLabel").textContent = state.period === "all" ? "Все периоды" : monthName(state.period);
}

function renderCharts() {
  const keyGetter = state.chartRange === "week" ? weekKey : monthKey;
  const groups = new Map();
  state.operations.forEach(item => {
    const key = keyGetter(item.date);
    const current = groups.get(key) || { income: 0, expense: 0 };
    current[item.type] += item.amount;
    groups.set(key, current);
  });

  const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const rows = sorted.slice(-8).map(([key, value]) => ({ key, ...value }));
  renderLineChart("#incomeChart", rows, "income");
  renderLineChart("#expenseChart", rows, "expense");
  renderTrendLabel("#incomeTrendLabel", rows, "income");
  renderTrendLabel("#expenseTrendLabel", rows, "expense");
}

function renderTrendLabel(selector, rows, type) {
  const label = document.querySelector(selector);
  if (rows.length < 2) {
    label.textContent = "Нет сравнения";
    label.className = "";
    return;
  }
  const previous = rows[rows.length - 2][type];
  const current = rows[rows.length - 1][type];
  const diff = current - previous;
  const percent = previous ? Math.round(diff / previous * 100) : 0;
  label.textContent = `${diff >= 0 ? "Рост" : "Падение"} ${Math.abs(percent)}%`;
  label.className = diff >= 0 ? "trend-up" : "trend-down";
}

function renderLineChart(selector, rows, type) {
  const node = document.querySelector(selector);
  if (!rows.length) {
    node.innerHTML = `<div class="empty-state">Нет данных</div>`;
    return;
  }

  const width = 640;
  const height = 210;
  const padding = 28;
  const values = rows.map(row => row[type]);
  const max = Math.max(...values, 1);
  const points = rows.map((row, index) => {
    const x = padding + (rows.length === 1 ? 0 : index * ((width - padding * 2) / (rows.length - 1)));
    const y = height - padding - (row[type] / max) * (height - padding * 2);
    return { ...row, x, y };
  });
  const polyline = points.map(point => `${point.x},${point.y}`).join(" ");
  const area = `${padding},${height - padding} ${polyline} ${points[points.length - 1].x},${height - padding}`;

  node.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${type === "income" ? "График выручки" : "График расходов"}">
      <polygon class="chart-area" points="${area}"></polygon>
      <polyline class="chart-line" points="${polyline}"></polyline>
      ${points.map(point => `<circle class="chart-dot" cx="${point.x}" cy="${point.y}" r="4"></circle>`).join("")}
      ${points.map(point => `<text class="chart-label" x="${point.x}" y="${height - 8}" text-anchor="middle">${shortPeriodLabel(point.key)}</text>`).join("")}
      ${points.map(point => `<text class="chart-value" x="${point.x}" y="${Math.max(18, point.y - 10)}" text-anchor="middle">${formatter.format(point[type] / 1000)}k</text>`).join("")}
    </svg>
  `;
}

function renderCategoryBars(items) {
  const groups = new Map();
  items.forEach(item => {
    const key = `${item.type}:${item.category}`;
    groups.set(key, (groups.get(key) || 0) + item.amount);
  });

  const rows = [...groups.entries()]
    .map(([key, amount]) => {
      const [type, category] = key.split(":");
      return { type, category, amount };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const max = Math.max(...rows.map(row => row.amount), 1);
  document.querySelector("#categoryBars").innerHTML = rows.length ? rows.map(row => `
    <div class="bar-row">
      <div class="bar-label">${row.category}</div>
      <div class="bar-track"><div class="bar-fill ${row.type}" style="width:${Math.max(5, row.amount / max * 100)}%"></div></div>
      <div class="money">${money(row.amount)}</div>
    </div>
  `).join("") : `<div class="empty-state">Нет операций за выбранный период</div>`;
}

function renderRecent(items) {
  const recent = [...items].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  document.querySelector("#recentList").innerHTML = recent.length ? recent.map(item => `
    <div class="list-item">
      <div>
        <strong>${item.description || item.subcategory}</strong>
        <span>${dateFormatter.format(new Date(item.date))} · ${item.account} · ${item.subcategory}</span>
      </div>
      <strong class="amount-${item.type}">${item.type === "income" ? "+" : "-"}${money(item.amount)}</strong>
    </div>
  `).join("") : `<div class="empty-state">Нет операций</div>`;
}

function renderOperationsTable(items) {
  const rows = [...items].sort((a, b) => b.date.localeCompare(a.date));
  document.querySelector("#operationsTable").innerHTML = rows.map(item => `
    <tr>
      <td>${dateFormatter.format(new Date(item.date))}</td>
      <td><span class="badge ${item.type}">${item.type === "income" ? "Доход" : "Расход"}</span></td>
      <td>${item.department}</td>
      <td>${item.category}</td>
      <td>${item.subcategory}</td>
      <td>${item.account}</td>
      <td class="amount-${item.type}">${item.type === "income" ? "+" : "-"}${money(item.amount)}</td>
      <td>${item.description || ""}</td>
      <td><button class="danger-button" data-delete-operation="${item.id}" type="button">Отменить</button></td>
    </tr>
  `).join("");
}

function renderAccounts() {
  const periodItems = operationsForPeriod(state.period);
  const periodCharges = kaspiCharges(periodItems);
  document.querySelector("#accountsGrid").innerHTML = accountBalances().map(account => `
    <article class="account-card">
      <span>${account.name}</span>
      <strong>${money(account.current)}</strong>
      ${account.name === kaspiPayAccount ? `
        <div class="account-details">
          <div>
            <span>Эквайринг за период</span>
            <strong>${money(periodCharges.acquiring)}</strong>
          </div>
          <div>
            <span>Налог к оплате за период</span>
            <strong>${money(periodCharges.tax)}</strong>
          </div>
        </div>
      ` : ""}
    </article>
  `).join("");
}

function renderReports() {
  const periodItems = operationsForPeriod(state.opuPeriod);
  const ddsPeriodItems = operationsForPeriod(state.period);
  const income = sumBy(periodItems, "income");
  const expense = sumBy(periodItems, "expense");
  const profit = income - expense;
  const periodLabel = state.opuPeriod === "all" ? "Все периоды" : monthName(state.opuPeriod);
  const ddsPeriodLabel = state.period === "all" ? "Все периоды" : monthName(state.period);

  document.querySelector("#opuIncome").textContent = money(income);
  document.querySelector("#opuExpense").textContent = money(expense);
  document.querySelector("#opuProfit").textContent = money(profit);
  document.querySelector("#opuPeriodLabel").textContent = periodLabel;
  document.querySelector("#ddsPeriodLabel").textContent = ddsPeriodLabel;

  const allIncome = sumDepartments(periodItems, item => item.type === "income");
  const allExpense = sumDepartments(periodItems, item => item.type === "expense");
  const revenue = sumDepartments(periodItems, item => item.type === "income" && item.category === "Продажи");
  const services = sumDepartments(periodItems, item => item.type === "income" && item.subcategory === "Услуги и товары");
  const otherIncome = sumDepartments(periodItems, item => item.type === "income" && item.subcategory !== "Услуги и товары");
  const cost = sumDepartments(periodItems, item => item.type === "expense" && item.category === "1. Переменные");
  const goodsCost = sumDepartments(periodItems, item => item.type === "expense" && item.subcategory === "Закуп товаров");
  const grossProfit = subtractDepartments(revenue, cost);
  const fixed = sumDepartments(periodItems, item => item.type === "expense" && item.category === "2. Постоянные");
  const commercial = sumDepartments(periodItems, item => item.type === "expense" && item.category === "3. Коммерческие");
  const operatingProfit = subtractDepartments(subtractDepartments(grossProfit, fixed), commercial);
  const netProfit = subtractDepartments(allIncome, allExpense);

  const subcategoryRows = [
    "Зарплата",
    "Питание сотрудников",
    "Прочие расходы",
    "Связь и интернет",
    "Программное обеспечение",
    "Профессиональные услуги",
    "Аренда помещения",
    "Комунальные услуги"
  ].map(name => ({
    title: name,
    totals: sumDepartments(periodItems, item => item.type === "expense" && item.category === "2. Постоянные" && item.subcategory === name),
    base: revenue
  }));

  const opuRows = [
    { title: "Выручка", totals: revenue, base: revenue, section: true },
    { title: "Услуги и товары", totals: services, base: revenue },
    { title: "Прочие", totals: otherIncome, base: revenue },
    { title: "Себестоимость", totals: cost, base: revenue, section: true },
    { title: "Закуп товаров", totals: goodsCost, base: revenue },
    { title: "Валовая прибыль", totals: grossProfit, base: revenue, highlight: true },
    { title: "Рентабельность, %", totals: grossProfit, base: revenue, percentOnly: true },
    { title: "2. Постоянные", totals: fixed, base: revenue, section: true },
    ...subcategoryRows,
    { title: "3. Коммерческие", totals: commercial, base: revenue, section: true },
    { title: "Зарплата", totals: sumDepartments(periodItems, item => item.type === "expense" && item.category === "3. Коммерческие" && item.subcategory === "Зарплата"), base: revenue },
    { title: "Реклама", totals: sumDepartments(periodItems, item => item.type === "expense" && item.category === "3. Коммерческие" && item.subcategory === "Реклама"), base: revenue },
    { title: "Операционная прибыль", totals: operatingProfit, base: revenue, highlight: true },
    { title: "Рентабельность, %", totals: operatingProfit, base: revenue, percentOnly: true },
    { title: "Всего расходов", totals: allExpense, base: allIncome, section: true },
    { title: "Чистая прибыль", totals: netProfit, base: allIncome, highlight: true, net: true },
    { title: "Чистая рентабельность, %", totals: netProfit, base: allIncome, percentOnly: true }
  ];

  document.querySelector("#opuTable").innerHTML = opuRows.map(row => renderOpuRow(row)).join("");

  const ddsRows = startingAccounts.map(account => {
    const before = state.period === "all" ? account.balance : state.operations.reduce((total, item) => {
      if (item.account !== account.name || monthKey(item.date) >= state.period) return total;
      return total + (item.type === "income" ? item.amount : -item.amount);
    }, account.balance);
    const accountItems = ddsPeriodItems.filter(item => item.account === account.name);
    const inflow = sumBy(accountItems, "income");
    const outflow = sumBy(accountItems, "expense");
    const after = before + inflow - outflow;

    return { name: account.name, before, inflow, outflow, after };
  });

  const ddsTotals = ddsRows.reduce((totals, row) => ({
    before: totals.before + row.before,
    inflow: totals.inflow + row.inflow,
    outflow: totals.outflow + row.outflow,
    after: totals.after + row.after
  }), { before: 0, inflow: 0, outflow: 0, after: 0 });

  document.querySelector("#ddsSummary").innerHTML = `
    <article class="dds-total-card">
      <span>На начало</span>
      <strong>${money(ddsTotals.before)}</strong>
    </article>
    <article class="dds-total-card income">
      <span>Приход</span>
      <strong>${money(ddsTotals.inflow)}</strong>
    </article>
    <article class="dds-total-card expense">
      <span>Расход</span>
      <strong>${money(ddsTotals.outflow)}</strong>
    </article>
    <article class="dds-total-card">
      <span>На конец</span>
      <strong>${money(ddsTotals.after)}</strong>
    </article>
  `;

  document.querySelector("#ddsTable").innerHTML = ddsRows.map(row => `
    <article class="dds-account-card">
      <div class="dds-account-head">
        <strong>${row.name}</strong>
        <span>${money(row.after)}</span>
      </div>
      <div class="dds-flow">
        <div>
          <span>Начало</span>
          <strong>${money(row.before)}</strong>
        </div>
        <div>
          <span>Приход</span>
          <strong class="amount-income">${money(row.inflow)}</strong>
        </div>
        <div>
          <span>Расход</span>
          <strong class="amount-expense">${money(row.outflow)}</strong>
        </div>
      </div>
    </article>
  `).join("");
}

function renderOpuRow(row) {
  const total = totalDepartments(row.totals);
  const totalBase = totalDepartments(row.base || emptyDepartmentTotals());
  const rowClass = row.net ? "opu-net-profit" : row.section ? "opu-section" : row.highlight ? "opu-highlight" : row.percentOnly ? "opu-percent-row" : "";
  const cells = departments.map(department => {
    const amount = row.totals[department] || 0;
    const base = row.base ? row.base[department] || 0 : 0;
    if (row.percentOnly) {
      return `<td colspan="2" class="opu-percent-only">${opuPercent(amount, base)}</td>`;
    }
    return `<td class="${row.highlight ? "key-value" : ""}">${money(amount)}</td><td>${opuPercent(amount, base)}</td>`;
  }).join("");

  const totalCells = row.percentOnly
    ? `<td colspan="2" class="opu-percent-only">${opuPercent(total, totalBase)}</td>`
    : `<td class="key-value"><strong>${money(total)}</strong></td><td>${opuPercent(total, totalBase)}</td>`;

  return `<tr class="${rowClass}"><td>${row.title}</td>${cells}${totalCells}</tr>`;
}

function renderTags() {
  document.querySelector("#incomeTags").innerHTML = renderCategorySettings("income", incomeCategories);
  document.querySelector("#expenseTags").innerHTML = renderCategorySettings("expense", expenseCategories);
  document.querySelector("#accountTags").innerHTML = startingAccounts.map(account => renderSimpleSettingsItem("account", account.name)).join("");
  document.querySelector("#openingBalances").innerHTML = renderOpeningBalances();
  document.querySelector("#departmentTags").innerHTML = departments.map(department => renderSimpleSettingsItem("department", department)).join("");
}

function renderOpeningBalances() {
  return startingAccounts.map(account => `
    <label class="balance-row">
      <span>${escapeHtml(account.name)}</span>
      <input data-opening-balance="${escapeHtml(account.name)}" type="number" step="1" value="${Number(account.balance) || 0}">
    </label>
  `).join("");
}

function renderSimpleSettingsItem(type, name) {
  return `
    <div class="settings-item">
      <strong>${escapeHtml(name)}</strong>
      <div class="settings-actions">
        <button class="settings-action-button" data-settings-action="rename-${type}" data-name="${escapeHtml(name)}" type="button" aria-label="Переименовать">Изм.</button>
        <button class="settings-action-button danger" data-settings-action="delete-${type}" data-name="${escapeHtml(name)}" type="button" aria-label="Удалить">×</button>
      </div>
    </div>
  `;
}

function renderCategorySettings(kind, categories) {
  return Object.entries(categories).map(([category, subcategories]) => `
    <div class="settings-group">
      <div class="settings-item">
        <strong>${escapeHtml(category)}</strong>
        <div class="settings-actions">
          <button class="settings-action-button" data-settings-action="add-subcategory" data-kind="${kind}" data-category="${escapeHtml(category)}" type="button" aria-label="Добавить подкатегорию">+</button>
          <button class="settings-action-button" data-settings-action="rename-category" data-kind="${kind}" data-category="${escapeHtml(category)}" type="button" aria-label="Переименовать">Изм.</button>
          <button class="settings-action-button danger" data-settings-action="delete-category" data-kind="${kind}" data-category="${escapeHtml(category)}" type="button" aria-label="Удалить">×</button>
        </div>
      </div>
      <div class="subcategory-list">
        ${subcategories.map(subcategory => `
          <div class="settings-item subcategory-item">
            <span>${escapeHtml(subcategory)}</span>
            <div class="settings-actions">
              <button class="settings-action-button" data-settings-action="rename-subcategory" data-kind="${kind}" data-category="${escapeHtml(category)}" data-name="${escapeHtml(subcategory)}" type="button" aria-label="Переименовать">Изм.</button>
              <button class="settings-action-button danger" data-settings-action="delete-subcategory" data-kind="${kind}" data-category="${escapeHtml(category)}" data-name="${escapeHtml(subcategory)}" type="button" aria-label="Удалить">×</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function renderFormOptions() {
  accountInput.innerHTML = startingAccounts.map(account => `<option>${account.name}</option>`).join("");
  departmentInput.innerHTML = departments.map(department => `<option>${department}</option>`).join("");
  const categories = typeInput.value === "income" ? incomeCategories : expenseCategories;
  categoryInput.innerHTML = Object.keys(categories).map(category => `<option>${category}</option>`).join("");
  renderSubcategories();
}

function renderSubcategories() {
  const categories = typeInput.value === "income" ? incomeCategories : expenseCategories;
  const values = categories[categoryInput.value] || [];
  subcategoryInput.innerHTML = values.map(value => `<option>${value}</option>`).join("");
}

function render() {
  renderPeriodFilter();
  renderOpuPeriodFilter();
  const items = filteredOperations();
  renderMetrics(items);
  renderCharts();
  renderCategoryBars(items);
  renderRecent(items);
  renderOperationsTable(items);
  renderAccounts();
  renderReports();
  renderTags();
}

function switchView(viewId) {
  views.forEach(view => view.classList.toggle("active", view.id === viewId));
  navButtons.forEach(button => button.classList.toggle("active", button.dataset.view === viewId));
}

document.querySelectorAll("[data-open-form]").forEach(button => {
  button.addEventListener("click", () => {
    operationForm.reset();
    operationForm.elements.date.value = new Date().toISOString().slice(0, 10);
    renderFormOptions();
    operationDialog.showModal();
  });
});

document.querySelectorAll("[data-close-operation]").forEach(button => {
  button.addEventListener("click", () => {
    operationDialog.close();
  });
});

navButtons.forEach(button => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

document.querySelectorAll("[data-view-link]").forEach(button => {
  button.addEventListener("click", () => switchView(button.dataset.viewLink));
});

periodFilter.addEventListener("change", () => {
  state.period = periodFilter.value;
  render();
});

opuPeriodFilter?.addEventListener("change", () => {
  state.opuPeriod = opuPeriodFilter.value;
  renderReports();
});

document.querySelectorAll("[data-type-filter]").forEach(button => {
  button.addEventListener("click", () => {
    state.typeFilter = button.dataset.typeFilter;
    document.querySelectorAll("[data-type-filter]").forEach(item => item.classList.toggle("active", item === button));
    render();
  });
});

document.querySelectorAll("[data-chart-range]").forEach(button => {
  button.addEventListener("click", () => {
    state.chartRange = button.dataset.chartRange;
    document.querySelectorAll("[data-chart-range]").forEach(item => item.classList.toggle("active", item === button));
    renderCharts();
  });
});

document.querySelectorAll("[data-report-tab]").forEach(button => {
  button.addEventListener("click", () => {
    const report = button.dataset.reportTab;
    document.querySelectorAll("[data-report-tab]").forEach(item => item.classList.toggle("active", item === button));
    document.querySelector("#opuReportPanel").classList.toggle("active", report === "opu");
    document.querySelector("#ddsReportPanel").classList.toggle("active", report === "dds");
  });
});

document.querySelector("#settings").addEventListener("click", event => {
  const button = event.target.closest("[data-settings-action]");
  if (!button) return;
  handleSettingsAction(button.dataset);
});

document.querySelector("#settings").addEventListener("change", event => {
  const input = event.target.closest("[data-opening-balance]");
  if (!input) return;
  updateOpeningBalance(input.dataset.openingBalance, input.value);
});

function updateOpeningBalance(name, value) {
  const account = startingAccounts.find(item => item.name === name);
  if (!account) return;
  account.balance = Number(value) || 0;
  saveDirectories();
  renderMetrics(filteredOperations());
  renderAccounts();
  renderReports();
}

function handleSettingsAction(data) {
  const action = data.settingsAction;
  if (action === "add-account") addAccount();
  if (action === "rename-account") renameAccount(data.name);
  if (action === "delete-account") deleteAccount(data.name);
  if (action === "add-department") addDepartment();
  if (action === "rename-department") renameDepartment(data.name);
  if (action === "delete-department") deleteDepartment(data.name);
  if (action === "add-category") addCategory(data.kind);
  if (action === "rename-category") renameCategory(data.kind, data.category);
  if (action === "delete-category") deleteCategory(data.kind, data.category);
  if (action === "add-subcategory") addSubcategory(data.kind, data.category);
  if (action === "rename-subcategory") renameSubcategory(data.kind, data.category, data.name);
  if (action === "delete-subcategory") deleteSubcategory(data.kind, data.category, data.name);
}

function categoryMap(kind) {
  return kind === "income" ? incomeCategories : expenseCategories;
}

function categoryTitle(kind) {
  return kind === "income" ? "доходов" : "расходов";
}

function askName(title, current = "") {
  const value = prompt(title, current);
  return value ? value.trim() : "";
}

function saveSettingsAndRender() {
  saveDirectories();
  saveOperations();
  render();
}

function isUsed(field, value, predicate = () => true) {
  return state.operations.some(item => item[field] === value && predicate(item));
}

function addAccount() {
  const name = askName("Название нового счета");
  if (!name) return;
  if (startingAccounts.some(account => account.name === name)) {
    alert("Такой счет уже есть.");
    return;
  }
  startingAccounts.push({ name, balance: 0 });
  saveSettingsAndRender();
}

function renameAccount(oldName) {
  const name = askName("Новое название счета", oldName);
  if (!name || name === oldName) return;
  if (startingAccounts.some(account => account.name === name)) {
    alert("Такой счет уже есть.");
    return;
  }
  const account = startingAccounts.find(item => item.name === oldName);
  if (!account) return;
  account.name = name;
  state.operations.forEach(item => {
    if (item.account === oldName) item.account = name;
  });
  saveSettingsAndRender();
}

function deleteAccount(name) {
  if (isUsed("account", name)) {
    alert("Счет уже используется в операциях. Сначала переименуйте его или удалите связанные операции.");
    return;
  }
  if (!confirm(`Удалить счет "${name}"?`)) return;
  startingAccounts = startingAccounts.filter(account => account.name !== name);
  saveSettingsAndRender();
}

function addDepartment() {
  const name = askName("Название нового направления");
  if (!name) return;
  if (departments.includes(name)) {
    alert("Такое направление уже есть.");
    return;
  }
  departments.push(name);
  saveSettingsAndRender();
}

function renameDepartment(oldName) {
  const name = askName("Новое название направления", oldName);
  if (!name || name === oldName) return;
  if (departments.includes(name)) {
    alert("Такое направление уже есть.");
    return;
  }
  const index = departments.indexOf(oldName);
  if (index === -1) return;
  departments[index] = name;
  state.operations.forEach(item => {
    if (item.department === oldName) item.department = name;
  });
  saveSettingsAndRender();
}

function deleteDepartment(name) {
  if (isUsed("department", name)) {
    alert("Направление уже используется в операциях. Сначала переименуйте его или удалите связанные операции.");
    return;
  }
  if (!confirm(`Удалить направление "${name}"?`)) return;
  departments.splice(departments.indexOf(name), 1);
  saveSettingsAndRender();
}

function addCategory(kind) {
  const categories = categoryMap(kind);
  const name = askName(`Название новой категории ${categoryTitle(kind)}`);
  if (!name) return;
  if (categories[name]) {
    alert("Такая категория уже есть.");
    return;
  }
  categories[name] = [];
  saveSettingsAndRender();
}

function renameCategory(kind, oldName) {
  const categories = categoryMap(kind);
  const name = askName("Новое название категории", oldName);
  if (!name || name === oldName) return;
  if (categories[name]) {
    alert("Такая категория уже есть.");
    return;
  }
  const next = {};
  Object.entries(categories).forEach(([category, values]) => {
    next[category === oldName ? name : category] = values;
  });
  if (kind === "income") incomeCategories = next;
  else expenseCategories = next;
  state.operations.forEach(item => {
    if (item.type === kind && item.category === oldName) item.category = name;
  });
  saveSettingsAndRender();
}

function deleteCategory(kind, name) {
  if (isUsed("category", name, item => item.type === kind)) {
    alert("Категория уже используется в операциях. Сначала переименуйте ее или удалите связанные операции.");
    return;
  }
  if (!confirm(`Удалить категорию "${name}"?`)) return;
  delete categoryMap(kind)[name];
  saveSettingsAndRender();
}

function addSubcategory(kind, category) {
  const categories = categoryMap(kind);
  const name = askName("Название новой подкатегории");
  if (!name) return;
  if (categories[category].includes(name)) {
    alert("Такая подкатегория уже есть.");
    return;
  }
  categories[category].push(name);
  saveSettingsAndRender();
}

function renameSubcategory(kind, category, oldName) {
  const categories = categoryMap(kind);
  const name = askName("Новое название подкатегории", oldName);
  if (!name || name === oldName) return;
  if (categories[category].includes(name)) {
    alert("Такая подкатегория уже есть.");
    return;
  }
  const index = categories[category].indexOf(oldName);
  if (index === -1) return;
  categories[category][index] = name;
  state.operations.forEach(item => {
    if (item.type === kind && item.category === category && item.subcategory === oldName) item.subcategory = name;
  });
  saveSettingsAndRender();
}

function deleteSubcategory(kind, category, name) {
  if (isUsed("subcategory", name, item => item.type === kind && item.category === category)) {
    alert("Подкатегория уже используется в операциях. Сначала переименуйте ее или удалите связанные операции.");
    return;
  }
  if (!confirm(`Удалить подкатегорию "${name}"?`)) return;
  const values = categoryMap(kind)[category];
  values.splice(values.indexOf(name), 1);
  saveSettingsAndRender();
}

document.querySelector("#operationsTable").addEventListener("click", event => {
  const button = event.target.closest("[data-delete-operation]");
  if (!button) return;
  const id = Number(button.dataset.deleteOperation);
  const operation = state.operations.find(item => item.id === id);
  if (!operation) return;

  const ok = confirm(`Отменить операцию: ${operation.description || operation.subcategory}, ${money(operation.amount)}?`);
  if (!ok) return;

  state.operations = state.operations.filter(item => item.id !== id);
  saveOperations();
  render();
});

searchInput.addEventListener("input", () => {
  state.search = searchInput.value.trim();
  render();
});

typeInput.addEventListener("change", renderFormOptions);
categoryInput.addEventListener("change", renderSubcategories);

operationForm.addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(operationForm);
  state.operations.push({
    id: Date.now(),
    type: data.get("type"),
    date: data.get("date"),
    amount: Number(data.get("amount")),
    account: data.get("account"),
    department: data.get("department"),
    category: data.get("category"),
    subcategory: data.get("subcategory"),
    description: data.get("description").trim()
  });
  saveOperations();
  operationDialog.close();
  state.period = monthKey(data.get("date"));
  render();
});

function escapeExcel(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function excelRow(cells, heading = false) {
  const tag = heading ? "th" : "td";
  return `<tr>${cells.map(cell => `<${tag}>${escapeExcel(cell)}</${tag}>`).join("")}</tr>`;
}

document.querySelector("#exportExcelBtn").addEventListener("click", () => {
  const operations = filteredOperations();
  const income = sumBy(operations, "income");
  const expense = sumBy(operations, "expense");
  const periodLabel = state.period === "all" ? "Все периоды" : monthName(state.period);
  const typeLabel = state.typeFilter === "all" ? "Доходы и расходы" : state.typeFilter === "income" ? "Доходы" : "Расходы";
  const rows = [
    excelRow(["Дата", "Тип", "Направление", "Категория", "Подкатегория", "Счет", "Сумма", "Описание"], true),
    ...operations.map(item => excelRow([
      dateFormatter.format(new Date(item.date)),
      item.type === "income" ? "Доход" : "Расход",
      item.department,
      item.category,
      item.subcategory,
      item.account,
      item.amount,
      item.description || ""
    ]))
  ].join("");
  const emptyRow = `<tr><td colspan="8">Нет операций для выбранных фильтров</td></tr>`;
  const html = `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; }
          h1 { font-size: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; }
          th { background: #0f172a; color: #ffffff; font-weight: 700; }
          .summary td { background: #f8fafc; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>CEZAR - Финансовый отчет</h1>
        <p>${escapeExcel(periodLabel)} · ${escapeExcel(typeLabel)} · ${new Date().toLocaleDateString("ru-RU")}</p>
        <table>
          <tr class="summary">
            <td>Доходы</td><td>${escapeExcel(money(income))}</td>
            <td>Расходы</td><td>${escapeExcel(money(expense))}</td>
            <td>Итог</td><td colspan="3">${escapeExcel(money(income - expense))}</td>
          </tr>
        </table>
        <br>
        <table>${operations.length ? rows : emptyRow}</table>
      </body>
    </html>
  `;
  const blob = new Blob([`\uFEFF${html}`], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cezar-finance.xls";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});

renderFormOptions();
render();
