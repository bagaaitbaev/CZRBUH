const supabaseUrl = "https://jxjwvdmiaqwpfhuimtog.supabase.co";
const supabaseKey = "sb_publishable_fgAU_OjRdBG_Kpt4EMYDaQ_6PmkkOUq";
const sessionKey = "cezar-finance-session";
let authSession = null;

try {
  authSession = JSON.parse(localStorage.getItem(sessionKey) || "null");
} catch {
  localStorage.removeItem(sessionKey);
}

const api = {
  async request(path, options = {}) {
    const headers = {
      apikey: supabaseKey,
      "Content-Type": "application/json",
      Prefer: options.prefer || "",
      ...(options.headers || {})
    };
    if (authSession?.access_token) headers.Authorization = `Bearer ${authSession.access_token}`;
    const response = await fetch(`${supabaseUrl}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    if (!response.ok) {
      const text = await response.text();
      const error = new Error(text || response.statusText);
      error.status = response.status;
      error.body = text;
      throw error;
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  },
  table(name) {
    return {
      list: query => api.request(`/rest/v1/${name}?${query}`),
      insert: body => api.request(`/rest/v1/${name}`, { method: "POST", body, prefer: "return=minimal" }),
      update: (query, body) => api.request(`/rest/v1/${name}?${query}`, { method: "PATCH", body, prefer: "return=minimal" }),
      remove: query => api.request(`/rest/v1/${name}?${query}`, { method: "DELETE", prefer: "return=minimal" })
    };
  },
  auth: {
    async getSession() {
      return authSession;
    },
    async getUser() {
      if (!authSession?.access_token) return null;
      return api.request("/auth/v1/user");
    },
    async signInWithPassword({ email, password }) {
      const data = await api.request("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
      authSession = data;
      localStorage.setItem(sessionKey, JSON.stringify(authSession));
      return data;
    },
    async signUp({ email, password, fullName }) {
      const data = await api.request("/auth/v1/signup", {
        method: "POST",
        body: { email, password, data: { full_name: fullName || "" } }
      });
      if (data?.access_token) {
        authSession = data;
        localStorage.setItem(sessionKey, JSON.stringify(authSession));
      }
      return data;
    },
    async signOut() {
      authSession = null;
      localStorage.removeItem(sessionKey);
    }
  }
};

let currentProfile = null;
let staffProfiles = [];

let incomeCategories = {
  "Продажи": ["Услуги и товары", "Прочие"],
  "Финансовые": ["Возврат", "Прочие доходы"]
};

let expenseCategories = {
  "1. Переменные": ["Закуп товаров", "Зарплата"],
  "2. Постоянные": ["Зарплата", "Питание сотрудников", "Связь и интернет", "Программное обеспечение", "Профессиональные услуги", "Аренда помещения", "Комунальные услуги"],
  "3. Коммерческие": ["Реклама", "Зарплата"],
  "4. Финансовые": ["Комиссии", "Прочие расходы"],
  "5. Инвестиционные": ["Оборудование", "Ремонт"],
  "Дивиденды": ["Дивиденды"]
};

let startingAccounts = [
  { name: "Kaspi Pay", balance: 0 },
  { name: "Kaspi Gold", balance: 0 },
  { name: "Наличные А", balance: 0 },
  { name: "Halyk", balance: 0 },
  { name: "Депозит", balance: 0 },
  { name: "Наличные Б", balance: 0 },
  { name: "Доп", balance: 0 }
];

let departments = ["Игровые приставки", "Бар", "Кальян", "Общие"];
const kaspiPayAccount = "Kaspi Pay";
const kaspiAcquiringRate = 0.0095;
const kaspiTaxRate = 0.02;
const bonusBaseRevenue = 3400000;
const bonusTierSize = 200000;
const bonusTierRates = [0.05, 0.07, 0.10, 0.12, 0.15];

const seedOperations = [];

const formatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

const state = {
  operations: [],
  period: "all",
  opuPeriod: "all",
  typeFilter: "all",
  search: "",
  chartRange: "month"
};

const authScreen = document.querySelector("#authScreen");
const appShell = document.querySelector("#appShell");
const authForm = document.querySelector("#authForm");
const authEmail = document.querySelector("#authEmail");
const authPassword = document.querySelector("#authPassword");
const authName = document.querySelector("#authName");
const authTitle = document.querySelector("#authTitle");
const authSubtitle = document.querySelector("#authSubtitle");
const authNameLabel = document.querySelector("#authNameLabel");
const authLoginMode = document.querySelector("#authLoginMode");
const authRegisterMode = document.querySelector("#authRegisterMode");
const authSubmitBtn = document.querySelector("#authSubmitBtn");
const authMessage = document.querySelector("#authMessage");
const signOutBtn = document.querySelector("#signOutBtn");
const currentUserName = document.querySelector("#currentUserName");
const currentUserRole = document.querySelector("#currentUserRole");
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
let authMode = "login";

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

function isAdmin() {
  return currentProfile?.role === "admin";
}

function showAuthMessage(message, error = true) {
  authMessage.textContent = message || "";
  authMessage.style.color = error ? "var(--red)" : "var(--green)";
}

function authValues() {
  return {
    email: authEmail.value.trim(),
    password: authPassword.value,
    fullName: authName.value.trim()
  };
}

function validateAuthFields({ email, password }) {
  if (!email) return "Введите email.";
  if (!password) return "Введите пароль.";
  if (password.length < 6) return "Пароль должен быть не короче 6 символов.";
  return "";
}

function setAuthMode(mode) {
  authMode = mode;
  const isRegister = mode === "register";
  authTitle.textContent = isRegister ? "Регистрация сотрудника" : "Вход в CEZAR Finance";
  authSubtitle.textContent = isRegister
    ? "Создайте аккаунт сотрудника. Первый аккаунт остается админом, остальные будут операторами."
    : "Для сотрудников, у которых уже есть аккаунт.";
  authNameLabel.hidden = !isRegister;
  authName.required = isRegister;
  authPassword.autocomplete = isRegister ? "new-password" : "current-password";
  authSubmitBtn.textContent = isRegister ? "Зарегистрироваться" : "Войти";
  authLoginMode.classList.toggle("active", !isRegister);
  authRegisterMode.classList.toggle("active", isRegister);
  showAuthMessage("");
}

function friendlyAuthError(error) {
  const message = error?.message || "";
  if (message.includes("anonymous_provider_disabled")) return "Введите email и пароль перед регистрацией.";
  if (message.includes("Invalid login credentials")) return "Неверный email или пароль.";
  if (message.includes("User already registered")) return "Такой email уже зарегистрирован. Нажмите «Войти».";
  if (isAuthSessionError(error)) return "Сессия истекла. Войдите заново.";
  return message || "Не удалось выполнить действие.";
}

function isAuthSessionError(error) {
  const message = `${error?.message || ""} ${error?.body || ""}`;
  return error?.status === 401
    || message.includes("bad_jwt")
    || message.includes("invalid JWT")
    || message.includes("token is expired")
    || message.includes("JWT");
}

function requireAdmin() {
  if (isAdmin()) return true;
  alert("Доступно только админу.");
  return false;
}

function eq(field, value) {
  return `${field}=eq.${encodeURIComponent(value)}`;
}

async function getOne(table, query) {
  return (await api.table(table).list(`select=*&${query}&limit=1`))[0];
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
  const periods = [...new Set(activeOperations().map(item => monthKey(item.date)))].sort().reverse();
  return ["all", ...periods];
}

function latestPeriod(items) {
  return [...new Set(items.map(item => monthKey(item.date)))].sort().reverse()[0] || "all";
}

function previousMonthKey(key) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function revenueForMonth(key, dayLimit = Infinity) {
  return activeOperations()
    .filter(item => item.type === "income" && monthKey(item.date) === key && new Date(item.date).getDate() <= dayLimit)
    .reduce((total, item) => total + item.amount, 0);
}

function bonusRateForTier(index) {
  return bonusTierRates[Math.min(index, bonusTierRates.length - 1)];
}

function calculateBonus(revenue) {
  let remaining = Math.max(0, revenue - bonusBaseRevenue);
  let bonus = 0;
  let tierIndex = 0;

  while (remaining > 0) {
    const tierAmount = Math.min(remaining, bonusTierSize);
    bonus += tierAmount * bonusRateForTier(tierIndex);
    remaining -= tierAmount;
    tierIndex += 1;
  }

  return Math.round(bonus);
}

function bonusMilestone(revenue) {
  const current = Math.max(0, revenue);
  const passedTiers = Math.max(0, Math.floor((current - bonusBaseRevenue) / bonusTierSize) + 1);
  const targetTier = current < bonusBaseRevenue ? 1 : passedTiers + 1;
  const target = bonusBaseRevenue + targetTier * bonusTierSize;
  return {
    target,
    remaining: Math.max(0, target - current),
    bonus: calculateBonus(target),
    rate: bonusRateForTier(targetTier - 1)
  };
}

function projectedMonthRevenue(period, currentRevenue) {
  const today = new Date();
  const currentKey = monthKey(today.toISOString().slice(0, 10));
  if (period !== currentKey) return currentRevenue;
  const elapsedDays = Math.max(1, today.getDate());
  return Math.round((currentRevenue / elapsedDays) * daysInMonth(period));
}

function elapsedDaysForForecast(period) {
  const today = new Date();
  const currentKey = monthKey(today.toISOString().slice(0, 10));
  if (period !== currentKey) return daysInMonth(period);
  return Math.max(1, today.getDate());
}

function filteredOperations() {
  return activeOperations().filter(item => {
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

function safeOption(value) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`;
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

function accountBalanceBefore(account, period) {
  if (period === "all") return account.balance;
  const previousItems = activeOperations().filter(item => monthKey(item.date) < period);
  const delta = previousItems.reduce((total, item) => {
    if (item.account !== account.name) return total;
    return total + (item.type === "income" ? item.amount : -item.amount);
  }, 0);
  const charges = account.name === kaspiPayAccount ? kaspiCharges(previousItems) : { acquiring: 0 };
  return account.balance + delta - charges.acquiring;
}

function ddsActivity(item) {
  if (item.category === "5. Инвестиционные") return "investing";
  if (item.category === "Дивиденды") return "financing";
  return "operating";
}

function accountBalances() {
  return startingAccounts.map(account => {
    const delta = activeOperations().reduce((total, item) => {
      if (item.account !== account.name) return total;
      return total + (item.type === "income" ? item.amount : -item.amount);
    }, 0);
    const charges = account.name === kaspiPayAccount ? kaspiCharges(state.operations) : { acquiring: 0, tax: 0 };
    return { ...account, current: account.balance + delta - charges.acquiring, charges };
  });
}

function operationsForPeriod(period) {
  return activeOperations().filter(item => period === "all" || monthKey(item.date) === period);
}

function activeOperations(items = state.operations) {
  return items.filter(item => !item.cancelled);
}

function mapOperation(row) {
  return {
    id: row.id,
    date: row.operation_date,
    type: row.type,
    department: row.department,
    category: row.category,
    subcategory: row.subcategory,
    account: row.account,
    amount: Number(row.amount),
    description: row.description || "",
    cancelled: row.cancelled
  };
}

function categoryObject(rows) {
  return rows.reduce((result, row) => {
    result[row.name] = (row.subcategories || [])
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map(item => item.name);
    return result;
  }, {});
}

async function loadAppData() {
  const user = await api.auth.getUser();
  let profile = null;
  let profileError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      profile = (await api.table("profiles").list(`select=*&id=eq.${encodeURIComponent(user.id)}`))[0];
      profileError = null;
    } catch (error) {
      profileError = error;
    }
    if (profile) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (profileError && !profile) throw profileError;
  currentProfile = profile;

  const [departmentsData, accountsData, categoriesData, subcategoriesData, operationsData, staffData] = await Promise.all([
    api.table("departments").list("select=*&order=sort_order.asc,name.asc"),
    api.table("accounts").list("select=*&order=sort_order.asc,name.asc"),
    api.table("categories").list("select=*&order=sort_order.asc,name.asc"),
    api.table("subcategories").list("select=*&order=sort_order.asc,name.asc"),
    api.table("operations").list("select=*&order=operation_date.desc"),
    isAdmin() ? api.table("profiles").list("select=*&order=created_at.desc") : Promise.resolve([])
  ]);

  const subcategoriesByCategory = subcategoriesData.reduce((result, item) => {
    result[item.category_id] = result[item.category_id] || [];
    result[item.category_id].push(item);
    return result;
  }, {});
  const categoriesWithChildren = categoriesData.map(item => {
    return { ...item, subcategories: subcategoriesByCategory[item.id] || [] };
  });

  departments = departmentsData.map(item => item.name);
  startingAccounts = accountsData.map(item => ({ id: item.id, name: item.name, balance: Number(item.opening_balance) }));
  const categories = categoriesWithChildren || [];
  incomeCategories = categoryObject(categories.filter(item => item.kind === "income"));
  expenseCategories = categoryObject(categories.filter(item => item.kind === "expense"));
  state.operations = normalizeOperations((operationsData || []).map(mapOperation));
  staffProfiles = staffData || [];
  const latest = latestPeriod(activeOperations());
  if (!getPeriods().includes(state.period)) state.period = latest;
  if (!getPeriods().includes(state.opuPeriod)) state.opuPeriod = latest;
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

function addDepartments(...groups) {
  const result = emptyDepartmentTotals();
  groups.forEach(group => {
    departments.forEach(department => {
      result[department] += group[department] || 0;
    });
  });
  return result;
}

function distributeAmount(amount, basis) {
  const result = emptyDepartmentTotals();
  const total = totalDepartments(basis);
  if (!amount || !total) return result;

  let distributed = 0;
  departments.forEach((department, index) => {
    const value = index === departments.length - 1
      ? amount - distributed
      : Math.round(amount * ((basis[department] || 0) / total));
    result[department] = value;
    distributed += value;
  });
  return result;
}

function opuPercent(value, base) {
  if (!base) return "0%";
  return `${Math.round(value / base * 100)}%`;
}

function financialSummary(items) {
  const income = sumBy(items, "income");
  const allIncome = sumDepartments(items, item => item.type === "income");
  const revenue = sumDepartments(items, item => item.type === "income" && item.category === "Продажи");
  const otherIncome = sumDepartments(items, item => item.type === "income" && item.category !== "Продажи");
  const cost = sumDepartments(items, item => item.type === "expense" && item.category === "1. Переменные");
  const fixed = sumDepartments(items, item => item.type === "expense" && item.category === "2. Постоянные");
  const commercial = sumDepartments(items, item => item.type === "expense" && item.category === "3. Коммерческие");
  const financeExpense = sumDepartments(items, item => item.type === "expense" && item.category === "4. Финансовые");
  const charges = kaspiCharges(items);
  const kaspiIncomeByDepartment = sumDepartments(items, item => item.type === "income" && item.account === kaspiPayAccount);
  const acquiring = distributeAmount(charges.acquiring, kaspiIncomeByDepartment);
  const tax = distributeAmount(charges.tax, kaspiIncomeByDepartment);
  const grossProfit = subtractDepartments(revenue, cost);
  const operatingProfit = subtractDepartments(grossProfit, addDepartments(fixed, commercial, acquiring));
  const profitBeforeTax = subtractDepartments(addDepartments(operatingProfit, otherIncome), financeExpense);
  const netProfit = subtractDepartments(profitBeforeTax, tax);
  const expense = totalDepartments(addDepartments(cost, fixed, commercial, acquiring, financeExpense, tax));

  return { income, expense, profit: totalDepartments(netProfit), netProfit, allIncome };
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
  const summary = financialSummary(items);
  const balance = accountBalances().reduce((total, account) => total + account.current, 0);
  document.querySelector("#incomeMetric").textContent = money(summary.income);
  document.querySelector("#expenseMetric").textContent = money(summary.expense);
  document.querySelector("#profitMetric").textContent = money(summary.profit);
  document.querySelector("#balanceMetric").textContent = money(balance);
  document.querySelector("#selectedPeriodLabel").textContent = state.period === "all" ? "Все периоды" : monthName(state.period);
}

function renderRevenueInsight() {
  const insight = document.querySelector("#revenueInsight");
  const title = document.querySelector("#revenueInsightTitle");
  const text = document.querySelector("#revenueInsightText");
  const percentNode = document.querySelector("#revenueInsightPercent");
  const amountNode = document.querySelector("#revenueInsightAmount");
  const bar = document.querySelector("#revenueInsightBar");
  const bonusDailyAverageNode = document.querySelector("#bonusDailyAverage");
  const bonusForecastRevenueNode = document.querySelector("#bonusForecastRevenue");
  const bonusForecastNode = document.querySelector("#bonusForecastAmount");
  const bonusNextTargetNode = document.querySelector("#bonusNextTarget");
  const bonusHelper = document.querySelector("#bonusHelper");
  const period = state.period === "all" ? latestPeriod(activeOperations()) : state.period;

  insight.classList.remove("ahead", "behind", "neutral");
  if (period === "all") {
    insight.classList.add("neutral");
    title.textContent = "Нет данных для сравнения";
    text.textContent = "Добавьте доходы за текущий и прошлый месяц, чтобы видеть темп.";
    percentNode.textContent = "0%";
    amountNode.textContent = money(0);
    bar.style.width = "0%";
    renderBonusInsight({
      period,
      currentRevenue: 0,
      projectedRevenue: 0,
      dailyAverageNode: bonusDailyAverageNode,
      forecastRevenueNode: bonusForecastRevenueNode,
      forecastNode: bonusForecastNode,
      targetNode: bonusNextTargetNode,
      helperNode: bonusHelper
    });
    return;
  }

  const previous = previousMonthKey(period);
  const today = new Date();
  const isCurrentMonth = period === monthKey(today.toISOString().slice(0, 10));
  const dayLimit = isCurrentMonth ? Math.min(today.getDate(), daysInMonth(previous)) : Infinity;
  const currentRevenue = revenueForMonth(period);
  const forecastRevenue = projectedMonthRevenue(period, currentRevenue);
  const previousComparable = revenueForMonth(previous, dayLimit);
  const previousTotal = revenueForMonth(previous);

  if (!previousTotal && !previousComparable) {
    insight.classList.add("neutral");
    title.textContent = "Прошлый месяц пустой";
    text.textContent = `${monthName(period)}: ${money(currentRevenue)}. Для сравнения нужны доходы за ${monthName(previous)}.`;
    percentNode.textContent = "0%";
    amountNode.textContent = money(currentRevenue);
    bar.style.width = currentRevenue ? "100%" : "0%";
    renderBonusInsight({
      period,
      currentRevenue,
      projectedRevenue: forecastRevenue,
      dailyAverageNode: bonusDailyAverageNode,
      forecastRevenueNode: bonusForecastRevenueNode,
      forecastNode: bonusForecastNode,
      targetNode: bonusNextTargetNode,
      helperNode: bonusHelper
    });
    return;
  }

  const benchmark = previousComparable || previousTotal;
  const diff = currentRevenue - benchmark;
  const percent = benchmark ? Math.round((diff / benchmark) * 100) : 0;
  const progress = previousTotal ? Math.min(140, Math.round((currentRevenue / previousTotal) * 100)) : 100;
  const ahead = diff >= 0;

  insight.classList.add(ahead ? "ahead" : "behind");
  title.textContent = ahead ? "Обгоняем прошлый месяц" : "Отстаем от прошлого месяца";
  text.textContent = isCurrentMonth
    ? `Сравнение по ${dayLimit} день месяца: сейчас ${money(currentRevenue)}, было ${money(benchmark)}.`
    : `${monthName(period)} против ${monthName(previous)}: ${money(currentRevenue)} против ${money(benchmark)}.`;
  percentNode.textContent = `${ahead ? "+" : "-"}${Math.abs(percent)}%`;
  amountNode.textContent = `${ahead ? "+" : "-"}${money(Math.abs(diff))}`;
  bar.style.width = `${Math.max(4, Math.min(progress, 100))}%`;
  renderBonusInsight({
    period,
    currentRevenue,
    projectedRevenue: forecastRevenue,
    dailyAverageNode: bonusDailyAverageNode,
    forecastRevenueNode: bonusForecastRevenueNode,
    forecastNode: bonusForecastNode,
    targetNode: bonusNextTargetNode,
    helperNode: bonusHelper
  });
}

function renderBonusInsight({ period, currentRevenue, projectedRevenue, dailyAverageNode, forecastRevenueNode, forecastNode, targetNode, helperNode }) {
  const forecastBonus = calculateBonus(projectedRevenue);
  const next = bonusMilestone(projectedRevenue);
  const isCurrentMonth = period === monthKey(new Date().toISOString().slice(0, 10));
  const elapsedDays = period === "all" ? 0 : elapsedDaysForForecast(period);
  const dailyAverage = elapsedDays ? Math.round(currentRevenue / elapsedDays) : 0;
  const requiredDailyAverage = Math.ceil(bonusBaseRevenue / (period === "all" ? 30 : daysInMonth(period)));

  dailyAverageNode.textContent = money(dailyAverage);
  forecastRevenueNode.textContent = money(projectedRevenue);
  forecastNode.textContent = money(forecastBonus);
  targetNode.textContent = money(next.target);

  if (!currentRevenue) {
    targetNode.textContent = money(bonusBaseRevenue);
    helperNode.textContent = `Бонус пока не прогнозируется. Для базы ${money(bonusBaseRevenue)} нужна средняя выручка примерно ${money(requiredDailyAverage)} в день.`;
    return;
  }

  if (!forecastBonus) {
    const missingToBase = Math.max(0, bonusBaseRevenue - projectedRevenue);
    targetNode.textContent = money(bonusBaseRevenue);
    helperNode.textContent = isCurrentMonth
      ? `Бонус пока не прогнозируется. При текущем темпе прогноз ниже базы на ${money(missingToBase)}. Нужная средняя: ${money(requiredDailyAverage)} в день.`
      : `По выбранному месяцу бонус не начисляется: выручка ниже базы ${money(bonusBaseRevenue)}.`;
    return;
  }

  const forecastText = isCurrentMonth
    ? `Если текущий темп сохранится, прогноз бонуса к концу месяца: ${money(forecastBonus)}.`
    : `По выбранному месяцу расчет идет по фактической выручке.`;

  if (projectedRevenue < next.target) {
    helperNode.textContent = `${forecastText} До следующего уровня по прогнозу осталось ${money(next.remaining)} выручки. На уровне ${money(next.target)} бонус будет ${money(next.bonus)}.`;
    return;
  }

  helperNode.textContent = forecastText;
}

function renderCharts() {
  const keyGetter = state.chartRange === "week" ? weekKey : monthKey;
  const groups = new Map();
  activeOperations().forEach(item => {
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
      <div class="bar-label">${escapeHtml(row.category)}</div>
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
        <strong>${escapeHtml(item.description || item.subcategory)}</strong>
        <span>${dateFormatter.format(new Date(item.date))} · ${escapeHtml(item.account)} · ${escapeHtml(item.subcategory)}</span>
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
      <td>${escapeHtml(item.department)}</td>
      <td>${escapeHtml(item.category)}</td>
      <td>
        <div>${escapeHtml(item.subcategory)}</div>
        ${item.description ? `<span class="operation-note">${escapeHtml(item.description)}</span>` : ""}
      </td>
      <td>${escapeHtml(item.account)}</td>
      <td class="amount-${item.type}">${item.type === "income" ? "+" : "-"}${money(item.amount)}</td>
      <td><button class="danger-button" data-delete-operation="${escapeHtml(item.id)}" type="button">Отменить</button></td>
    </tr>
  `).join("");
}

function renderAccounts() {
  const periodItems = operationsForPeriod(state.period);
  const periodCharges = kaspiCharges(periodItems);
  document.querySelector("#accountsGrid").innerHTML = accountBalances().map(account => `
    <article class="account-card">
      <span>${escapeHtml(account.name)}</span>
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
  const periodLabel = state.opuPeriod === "all" ? "Все периоды" : monthName(state.opuPeriod);
  const ddsPeriodLabel = state.period === "all" ? "Все периоды" : monthName(state.period);

  const allIncome = sumDepartments(periodItems, item => item.type === "income");
  const revenue = sumDepartments(periodItems, item => item.type === "income" && item.category === "Продажи");
  const services = sumDepartments(periodItems, item => item.type === "income" && item.subcategory === "Услуги и товары");
  const otherRevenue = sumDepartments(periodItems, item => item.type === "income" && item.category === "Продажи" && item.subcategory !== "Услуги и товары");
  const otherIncome = sumDepartments(periodItems, item => item.type === "income" && item.category !== "Продажи");
  const cost = sumDepartments(periodItems, item => item.type === "expense" && item.category === "1. Переменные");
  const goodsCost = sumDepartments(periodItems, item => item.type === "expense" && item.subcategory === "Закуп товаров");
  const grossProfit = subtractDepartments(revenue, cost);
  const fixed = sumDepartments(periodItems, item => item.type === "expense" && item.category === "2. Постоянные");
  const commercial = sumDepartments(periodItems, item => item.type === "expense" && item.category === "3. Коммерческие");
  const kaspiPeriodCharges = kaspiCharges(periodItems);
  const kaspiIncomeByDepartment = sumDepartments(periodItems, item => item.type === "income" && item.account === kaspiPayAccount);
  const acquiring = distributeAmount(kaspiPeriodCharges.acquiring, kaspiIncomeByDepartment);
  const tax = distributeAmount(kaspiPeriodCharges.tax, kaspiIncomeByDepartment);
  const operatingExpenses = addDepartments(fixed, commercial, acquiring);
  const operatingProfit = subtractDepartments(grossProfit, operatingExpenses);
  const financeExpense = sumDepartments(periodItems, item => item.type === "expense" && item.category === "4. Финансовые");
  const profitBeforeTax = subtractDepartments(addDepartments(operatingProfit, otherIncome), financeExpense);
  const netProfit = subtractDepartments(profitBeforeTax, tax);
  const opuExpense = totalDepartments(addDepartments(cost, operatingExpenses, financeExpense, tax));

  document.querySelector("#opuIncome").textContent = money(income);
  document.querySelector("#opuExpense").textContent = money(opuExpense);
  document.querySelector("#opuProfit").textContent = money(totalDepartments(netProfit));
  document.querySelector("#opuPeriodLabel").textContent = periodLabel;
  document.querySelector("#ddsPeriodLabel").textContent = ddsPeriodLabel;

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
    { title: "Прочие продажи", totals: otherRevenue, base: revenue },
    { title: "Себестоимость", totals: cost, base: revenue, section: true },
    { title: "Закуп товаров", totals: goodsCost, base: revenue },
    { title: "Валовая прибыль", totals: grossProfit, base: revenue, highlight: true },
    { title: "Рентабельность, %", totals: grossProfit, base: revenue, percentOnly: true },
    { title: "2. Постоянные", totals: fixed, base: revenue, section: true },
    ...subcategoryRows,
    { title: "3. Коммерческие", totals: commercial, base: revenue, section: true },
    { title: "Зарплата", totals: sumDepartments(periodItems, item => item.type === "expense" && item.category === "3. Коммерческие" && item.subcategory === "Зарплата"), base: revenue },
    { title: "Реклама", totals: sumDepartments(periodItems, item => item.type === "expense" && item.category === "3. Коммерческие" && item.subcategory === "Реклама"), base: revenue },
    { title: "Эквайринг Kaspi", totals: acquiring, base: revenue },
    { title: "Операционная прибыль", totals: operatingProfit, base: revenue, highlight: true },
    { title: "Рентабельность, %", totals: operatingProfit, base: revenue, percentOnly: true },
    { title: "Прочие доходы", totals: otherIncome, base: revenue, section: true },
    { title: "Финансовые расходы", totals: financeExpense, base: revenue, section: true },
    { title: "Прибыль до налога", totals: profitBeforeTax, base: allIncome, highlight: true },
    { title: "Налог", totals: tax, base: revenue, section: true },
    { title: "Чистая прибыль", totals: netProfit, base: revenue, highlight: true, net: true },
    { title: "Чистая рентабельность, %", totals: netProfit, base: revenue, percentOnly: true }
  ];

  document.querySelector("#opuTable").innerHTML = opuRows.map(row => renderOpuRow(row)).join("");

  const ddsCharges = kaspiCharges(ddsPeriodItems);
  const ddsItems = [
    ...ddsPeriodItems,
    ...(ddsCharges.acquiring ? [{
      type: "expense",
      account: kaspiPayAccount,
      category: "4. Финансовые",
      subcategory: "Комиссии",
      amount: ddsCharges.acquiring
    }] : [])
  ];
  const ddsRows = startingAccounts.map(account => {
    const before = accountBalanceBefore(account, state.period);
    const accountItems = ddsItems.filter(item => item.account === account.name);
    const inflow = sumBy(accountItems, "income");
    const outflow = sumBy(accountItems, "expense");
    const after = before + inflow - outflow;

    return { name: account.name, before, inflow, outflow, after };
  });

  const ddsActivities = ddsItems.reduce((totals, item) => {
    const activity = ddsActivity(item);
    totals[activity] += item.type === "income" ? item.amount : -item.amount;
    return totals;
  }, { operating: 0, investing: 0, financing: 0 });

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
    <article class="dds-total-card">
      <span>Операционная ДДС</span>
      <strong>${money(ddsActivities.operating)}</strong>
    </article>
    <article class="dds-total-card">
      <span>Инвестиционная ДДС</span>
      <strong>${money(ddsActivities.investing)}</strong>
    </article>
    <article class="dds-total-card">
      <span>Финансовая ДДС</span>
      <strong>${money(ddsActivities.financing)}</strong>
    </article>
  `;

  document.querySelector("#ddsTable").innerHTML = ddsRows.map(row => `
    <article class="dds-account-card">
      <div class="dds-account-head">
        <strong>${escapeHtml(row.name)}</strong>
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

  return `<tr class="${rowClass}"><td>${escapeHtml(row.title)}</td>${cells}${totalCells}</tr>`;
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
  accountInput.innerHTML = startingAccounts.map(account => safeOption(account.name)).join("");
  departmentInput.innerHTML = departments.map(department => safeOption(department)).join("");
  const categories = typeInput.value === "income" ? incomeCategories : expenseCategories;
  categoryInput.innerHTML = Object.keys(categories).map(category => safeOption(category)).join("");
  renderSubcategories();
}

function renderSubcategories() {
  const categories = typeInput.value === "income" ? incomeCategories : expenseCategories;
  const values = categories[categoryInput.value] || [];
  subcategoryInput.innerHTML = values.map(value => safeOption(value)).join("");
}

function render() {
  renderAccess();
  renderPeriodFilter();
  renderOpuPeriodFilter();
  const items = filteredOperations();
  renderMetrics(items);
  renderRevenueInsight();
  renderCharts();
  renderCategoryBars(items);
  renderRecent(items);
  renderOperationsTable(items);
  renderAccounts();
  renderReports();
  renderTags();
  renderStaff();
}

function switchView(viewId) {
  if (viewId === "settings" && !isAdmin()) viewId = "dashboard";
  views.forEach(view => view.classList.toggle("active", view.id === viewId));
  navButtons.forEach(button => button.classList.toggle("active", button.dataset.view === viewId));
}

function renderAccess() {
  currentUserName.textContent = currentProfile?.full_name || currentProfile?.email || "";
  currentUserRole.textContent = isAdmin() ? "Админ" : "Оператор";
  document.querySelectorAll("[data-admin-only]").forEach(node => {
    node.hidden = !isAdmin();
  });
  if (!isAdmin() && document.querySelector("#settings").classList.contains("active")) {
    switchView("dashboard");
  }
}

function renderStaff() {
  const staffTable = document.querySelector("#staffTable");
  if (!staffTable) return;
  staffTable.innerHTML = staffProfiles.length ? staffProfiles.map(profile => `
    <tr>
      <td>${escapeHtml(profile.email)}</td>
      <td>${escapeHtml(profile.full_name || "")}</td>
      <td>${profile.role === "admin" ? "Админ" : "Оператор"}</td>
      <td>${profile.is_active ? "Активен" : "Отключен"}</td>
    </tr>
  `).join("") : `<tr><td colspan="4">Сотрудники появятся после регистрации</td></tr>`;
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

document.querySelector("#settings").addEventListener("click", async event => {
  const button = event.target.closest("[data-settings-action]");
  if (!button) return;
  try {
    await handleSettingsAction(button.dataset);
  } catch (error) {
    alert(error.message);
  }
});

document.querySelector("#settings").addEventListener("change", async event => {
  const input = event.target.closest("[data-opening-balance]");
  if (!input) return;
  try {
    await updateOpeningBalance(input.dataset.openingBalance, input.value);
  } catch (error) {
    alert(error.message);
  }
});

async function updateOpeningBalance(name, value) {
  if (!requireAdmin()) return;
  const account = startingAccounts.find(item => item.name === name);
  if (!account) return;
  await api.table("accounts").update(eq("id", account.id), { opening_balance: Number(value) || 0 });
  await refreshAndRender();
}

async function handleSettingsAction(data) {
  if (!requireAdmin()) return;
  const action = data.settingsAction;
  if (action === "add-account") await addAccount();
  if (action === "rename-account") await renameAccount(data.name);
  if (action === "delete-account") await deleteAccount(data.name);
  if (action === "add-department") await addDepartment();
  if (action === "rename-department") await renameDepartment(data.name);
  if (action === "delete-department") await deleteDepartment(data.name);
  if (action === "add-category") await addCategory(data.kind);
  if (action === "rename-category") await renameCategory(data.kind, data.category);
  if (action === "delete-category") await deleteCategory(data.kind, data.category);
  if (action === "add-subcategory") await addSubcategory(data.kind, data.category);
  if (action === "rename-subcategory") await renameSubcategory(data.kind, data.category, data.name);
  if (action === "delete-subcategory") await deleteSubcategory(data.kind, data.category, data.name);
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

async function refreshAndRender() {
  await loadAppData();
  render();
}

function isUsed(field, value, predicate = () => true) {
  return state.operations.some(item => item[field] === value && predicate(item));
}

async function addAccount() {
  const name = askName("Название нового счета");
  if (!name) return;
  if (startingAccounts.some(account => account.name === name)) {
    alert("Такой счет уже есть.");
    return;
  }
  await api.table("accounts").insert({ name, opening_balance: 0, sort_order: startingAccounts.length + 1 });
  await refreshAndRender();
}

async function renameAccount(oldName) {
  const name = askName("Новое название счета", oldName);
  if (!name || name === oldName) return;
  if (startingAccounts.some(account => account.name === name)) {
    alert("Такой счет уже есть.");
    return;
  }
  const account = startingAccounts.find(item => item.name === oldName);
  if (!account) return;
  await api.table("accounts").update(eq("id", account.id), { name });
  await refreshAndRender();
}

async function deleteAccount(name) {
  if (isUsed("account", name)) {
    alert("Счет уже используется в операциях. Сначала переименуйте его или удалите связанные операции.");
    return;
  }
  if (!confirm(`Удалить счет "${name}"?`)) return;
  const account = startingAccounts.find(item => item.name === name);
  await api.table("accounts").remove(eq("id", account.id));
  await refreshAndRender();
}

async function addDepartment() {
  const name = askName("Название нового направления");
  if (!name) return;
  if (departments.includes(name)) {
    alert("Такое направление уже есть.");
    return;
  }
  await api.table("departments").insert({ name, sort_order: departments.length + 1 });
  await refreshAndRender();
}

async function renameDepartment(oldName) {
  const name = askName("Новое название направления", oldName);
  if (!name || name === oldName) return;
  if (departments.includes(name)) {
    alert("Такое направление уже есть.");
    return;
  }
  const data = await getOne("departments", eq("name", oldName));
  await api.table("departments").update(eq("id", data.id), { name });
  await refreshAndRender();
}

async function deleteDepartment(name) {
  if (isUsed("department", name)) {
    alert("Направление уже используется в операциях. Сначала переименуйте его или удалите связанные операции.");
    return;
  }
  if (!confirm(`Удалить направление "${name}"?`)) return;
  await api.table("departments").remove(eq("name", name));
  await refreshAndRender();
}

async function addCategory(kind) {
  const categories = categoryMap(kind);
  const name = askName(`Название новой категории ${categoryTitle(kind)}`);
  if (!name) return;
  if (categories[name]) {
    alert("Такая категория уже есть.");
    return;
  }
  await api.table("categories").insert({ kind, name, sort_order: Object.keys(categories).length + 1 });
  await refreshAndRender();
}

async function renameCategory(kind, oldName) {
  const categories = categoryMap(kind);
  const name = askName("Новое название категории", oldName);
  if (!name || name === oldName) return;
  if (categories[name]) {
    alert("Такая категория уже есть.");
    return;
  }
  const data = await getOne("categories", `${eq("kind", kind)}&${eq("name", oldName)}`);
  await api.table("categories").update(eq("id", data.id), { name });
  await refreshAndRender();
}

async function deleteCategory(kind, name) {
  if (isUsed("category", name, item => item.type === kind)) {
    alert("Категория уже используется в операциях. Сначала переименуйте ее или удалите связанные операции.");
    return;
  }
  if (!confirm(`Удалить категорию "${name}"?`)) return;
  await api.table("categories").remove(`${eq("kind", kind)}&${eq("name", name)}`);
  await refreshAndRender();
}

async function addSubcategory(kind, category) {
  const categories = categoryMap(kind);
  const name = askName("Название новой подкатегории");
  if (!name) return;
  if (categories[category].includes(name)) {
    alert("Такая подкатегория уже есть.");
    return;
  }
  const data = await getOne("categories", `${eq("kind", kind)}&${eq("name", category)}`);
  await api.table("subcategories").insert({ category_id: data.id, name, sort_order: categories[category].length + 1 });
  await refreshAndRender();
}

async function renameSubcategory(kind, category, oldName) {
  const categories = categoryMap(kind);
  const name = askName("Новое название подкатегории", oldName);
  if (!name || name === oldName) return;
  if (categories[category].includes(name)) {
    alert("Такая подкатегория уже есть.");
    return;
  }
  const categoryRow = await getOne("categories", `${eq("kind", kind)}&${eq("name", category)}`);
  const data = await getOne("subcategories", `${eq("category_id", categoryRow.id)}&${eq("name", oldName)}`);
  await api.table("subcategories").update(eq("id", data.id), { name });
  await refreshAndRender();
}

async function deleteSubcategory(kind, category, name) {
  if (isUsed("subcategory", name, item => item.type === kind && item.category === category)) {
    alert("Подкатегория уже используется в операциях. Сначала переименуйте ее или удалите связанные операции.");
    return;
  }
  if (!confirm(`Удалить подкатегорию "${name}"?`)) return;
  const categoryRow = await getOne("categories", `${eq("kind", kind)}&${eq("name", category)}`);
  const data = await getOne("subcategories", `${eq("category_id", categoryRow.id)}&${eq("name", name)}`);
  await api.table("subcategories").remove(eq("id", data.id));
  await refreshAndRender();
}

document.querySelector("#operationsTable").addEventListener("click", async event => {
  const button = event.target.closest("[data-delete-operation]");
  if (!button) return;
  const id = button.dataset.deleteOperation;
  const operation = state.operations.find(item => item.id === id);
  if (!operation) return;

  const ok = confirm(`Отменить операцию: ${operation.description || operation.subcategory}, ${money(operation.amount)}?`);
  if (!ok) return;

  try {
    await api.table("operations").update(eq("id", id), { cancelled: true, cancelled_by: currentProfile.id, cancelled_at: new Date().toISOString() });
    await refreshAndRender();
  } catch (error) {
    alert(error.message);
  }
});

searchInput.addEventListener("input", () => {
  state.search = searchInput.value.trim();
  render();
});

typeInput.addEventListener("change", renderFormOptions);
categoryInput.addEventListener("change", renderSubcategories);

operationForm.addEventListener("submit", async event => {
  event.preventDefault();
  const data = new FormData(operationForm);
  const operation = {
    type: data.get("type"),
    operation_date: data.get("date"),
    amount: Number(data.get("amount")),
    account: data.get("account"),
    department: data.get("department"),
    category: data.get("category"),
    subcategory: data.get("subcategory"),
    description: data.get("description").trim(),
    created_by: currentProfile.id
  };
  try {
    await api.table("operations").insert(operation);
  } catch (error) {
    alert(error.message);
    return;
  }
  operationDialog.close();
  state.period = monthKey(data.get("date"));
  await refreshAndRender();
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
  const summary = financialSummary(operations);
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
            <td>Доходы</td><td>${escapeExcel(money(summary.income))}</td>
            <td>Расходы ОПиУ</td><td>${escapeExcel(money(summary.expense))}</td>
            <td>Чистая прибыль</td><td colspan="3">${escapeExcel(money(summary.profit))}</td>
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

authLoginMode.addEventListener("click", () => setAuthMode("login"));
authRegisterMode.addEventListener("click", () => setAuthMode("register"));

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  const values = authValues();
  const validationMessage = validateAuthFields(values);
  if (validationMessage) {
    showAuthMessage(validationMessage);
    return;
  }

  try {
    if (authMode === "register") {
      showAuthMessage("Создаем аккаунт...", false);
      await api.auth.signUp({
        email: values.email,
        password: values.password,
        fullName: values.fullName
      });
      showAuthMessage("Аккаунт создан. Если Supabase попросит подтверждение email, подтвердите почту и войдите.", false);
    } else {
      showAuthMessage("Входим...", false);
      await api.auth.signInWithPassword({
        email: values.email,
        password: values.password
      });
    }
  } catch (error) {
    showAuthMessage(friendlyAuthError(error));
    return;
  }
  await initApp();
});

signOutBtn.addEventListener("click", async () => {
  await api.auth.signOut();
  currentProfile = null;
  staffProfiles = [];
  appShell.hidden = true;
  authScreen.hidden = false;
});

async function initApp() {
  const session = await api.auth.getSession();
  if (!session) {
    appShell.hidden = true;
    authScreen.hidden = false;
    return;
  }

  try {
    await loadAppData();
    renderFormOptions();
    authScreen.hidden = true;
    appShell.hidden = false;
    render();
    showAuthMessage("");
  } catch (error) {
    if (isAuthSessionError(error)) {
      await api.auth.signOut();
      currentProfile = null;
      staffProfiles = [];
      showAuthMessage("Сессия истекла. Войдите заново.");
    } else {
      showAuthMessage(friendlyAuthError(error) || "Не удалось загрузить данные");
    }
    appShell.hidden = true;
    authScreen.hidden = false;
  }
}

initApp();

