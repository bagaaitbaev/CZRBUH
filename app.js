const incomeCategories = {
  "Продажи": ["Услуги и товары", "Прочие"],
  "Финансовые": ["Возврат", "Прочие доходы"]
};

const expenseCategories = {
  "1. Переменные": ["Закуп товаров", "Зарплата"],
  "2. Постоянные": ["Зарплата", "Питание сотрудников", "Связь и интернет", "Программное обеспечение", "Профессиональные услуги", "Аренда помещения", "Комунальные услуги"],
  "3. Коммерческие": ["Реклама", "Зарплата"],
  "4. Финансовые": ["Комиссии", "Прочие расходы"],
  "5. Инвестиционные": ["Оборудование", "Ремонт"],
  "Дивиденды": ["Дивиденды"]
};

const startingAccounts = [
  { name: "Kaspi Pay", balance: 1645345 },
  { name: "Kaspi Gold", balance: 0 },
  { name: "Наличные А", balance: 12020 },
  { name: "Halyk", balance: 0 },
  { name: "Депозит", balance: 0 },
  { name: "Наличные Б", balance: 0 },
  { name: "Доп", balance: 0 }
];

const departments = ["Игровые приставки", "Бар", "Кальян", "Общие"];

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
  typeFilter: "all",
  search: "",
  chartRange: "month"
};

const views = document.querySelectorAll(".view");
const navButtons = document.querySelectorAll(".nav-item");
const periodFilter = document.querySelector("#periodFilter");
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

function accountBalances() {
  return startingAccounts.map(account => {
    const delta = state.operations.reduce((total, item) => {
      if (item.account !== account.name) return total;
      return total + (item.type === "income" ? item.amount : -item.amount);
    }, 0);
    return { ...account, current: account.balance + delta };
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
  document.querySelector("#accountsGrid").innerHTML = accountBalances().map(account => `
    <article class="account-card">
      <span>${account.name}</span>
      <strong>${money(account.current)}</strong>
    </article>
  `).join("");
}

function renderReports() {
  const periodItems = operationsForPeriod(state.period);
  const income = sumBy(periodItems, "income");
  const expense = sumBy(periodItems, "expense");
  const profit = income - expense;
  const periodLabel = state.period === "all" ? "Все периоды" : monthName(state.period);

  document.querySelector("#opuIncome").textContent = money(income);
  document.querySelector("#opuExpense").textContent = money(expense);
  document.querySelector("#opuProfit").textContent = money(profit);
  document.querySelector("#opuPeriodLabel").textContent = periodLabel;
  document.querySelector("#ddsPeriodLabel").textContent = periodLabel;

  const revenue = sumDepartments(periodItems, item => item.type === "income" && item.category === "Продажи");
  const services = sumDepartments(periodItems, item => item.type === "income" && item.subcategory === "Услуги и товары");
  const otherIncome = sumDepartments(periodItems, item => item.type === "income" && item.subcategory !== "Услуги и товары");
  const cost = sumDepartments(periodItems, item => item.type === "expense" && item.category === "1. Переменные");
  const goodsCost = sumDepartments(periodItems, item => item.type === "expense" && item.subcategory === "Закуп товаров");
  const grossProfit = subtractDepartments(revenue, cost);
  const fixed = sumDepartments(periodItems, item => item.type === "expense" && item.category === "2. Постоянные");
  const commercial = sumDepartments(periodItems, item => item.type === "expense" && item.category === "3. Коммерческие");
  const operatingProfit = subtractDepartments(subtractDepartments(grossProfit, fixed), commercial);

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
    { title: "Рентабельность, %", totals: operatingProfit, base: revenue, percentOnly: true }
  ];

  document.querySelector("#opuTable").innerHTML = opuRows.map(row => renderOpuRow(row)).join("");

  const ddsRows = startingAccounts.map(account => {
    const before = state.period === "all" ? account.balance : state.operations.reduce((total, item) => {
      if (item.account !== account.name || monthKey(item.date) >= state.period) return total;
      return total + (item.type === "income" ? item.amount : -item.amount);
    }, account.balance);
    const accountItems = periodItems.filter(item => item.account === account.name);
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
  const rowClass = row.section ? "opu-section" : row.highlight ? "opu-highlight" : row.percentOnly ? "opu-percent-row" : "";
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
  document.querySelector("#incomeTags").innerHTML = Object.keys(incomeCategories).map(name => `<span class="tag">${name}</span>`).join("");
  document.querySelector("#expenseTags").innerHTML = Object.keys(expenseCategories).map(name => `<span class="tag">${name}</span>`).join("");
  document.querySelector("#accountTags").innerHTML = startingAccounts.map(account => `<span class="tag">${account.name}</span>`).join("");
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

document.querySelector("#exportCsvBtn").addEventListener("click", () => {
  const header = ["Дата", "Тип", "Направление", "Категория", "Подкатегория", "Счет", "Сумма", "Описание"];
  const rows = filteredOperations().map(item => [
    item.date,
    item.type === "income" ? "Доход" : "Расход",
    item.department,
    item.category,
    item.subcategory,
    item.account,
    item.amount,
    item.description
  ]);
  const csv = [header, ...rows].map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cezar-finance.csv";
  link.click();
  URL.revokeObjectURL(url);
});

renderFormOptions();
render();
