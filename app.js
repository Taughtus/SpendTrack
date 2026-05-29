/* --------------------------------------------------------------
   STEP 1 - Setup
   'transactions' is our data: a list (array) of spending items.
   STORAGE_KEY is the name we save it under in the browser.
   -------------------------------------------------------------- */
const STORAGE_KEY = 'spending-tracker-data';
let transactions = [];

/* A colour for each category - used for the little dot.
   This also sets us up nicely for a pie chart later. */
const COLOURS = {
  'Groceries':             '#1f6a4e',
  'Eating out':            '#c97b2a',
  'Transport':             '#3a6ea5',
  'Rent':                  '#9c6b1f',
  'Utilities':             '#6a8f1f',
  'Telecoms':              '#2f7d8c',
  'Streaming Services':    '#c0398a',
  'Shopping':              '#b23a6b',
  'Entertainment':         '#2a9d8f',
  'Health':                '#5a8f3a',
  'Child Maintenance':     '#d4a017',
  'Loan Repayments':       '#a0522d',
  'Credit Card Repayments':'#b23a3a',
  'Transfer':              '#5a5f6a',
  'Other':                 '#7a7a7a'
};

/* The same category names as a list - used to build the
   category dropdowns in the import preview (Step 11). Keeping
   one source of truth means adding a category here updates
   the importer automatically. */
const CATEGORIES = Object.keys(COLOURS);

/* --------------------------------------------------------------
   STEP 2 - Saving and loading
   The browser's 'localStorage' is a small box of storage that
   survives closing the tab. We can only store text in it, so we
   turn our list into text (JSON.stringify) to save, and back
   into a list (JSON.parse) to load.
   -------------------------------------------------------------- */
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}
function load() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) transactions = JSON.parse(saved);
  migrateOldCategories();
}

/* One-time data tidy: convert old category names to new ones.
   Runs every time, but only does anything on transactions that
   still have the old labels. This keeps existing data working
   after we rename or remove categories. */
function migrateOldCategories() {
  const renames = {
    'Debt repayment': 'Credit Card Repayments'
    // 'Bills' is intentionally NOT renamed - it had mixed contents
    // (some now Utilities, some now Telecoms). Old "Bills" rows
    // stay as is so you can re-categorise them by hand in the list,
    // since we can't safely guess which new category each belongs to.
  };
  let changed = false;
  transactions.forEach(function (t) {
    if (renames[t.category]) {
      t.category = renames[t.category];
      changed = true;
    }
    // Step 7 (dashboard): every transaction now has a 'type' field.
    // Old transactions (before this change) didn't have one. We treat
    // any unmarked transaction as a spend, since previously that's
    // all we tracked.
    if (!t.type) {
      t.type = 'expense';
      changed = true;
    }
  });
  if (changed) save();
}

/* --------------------------------------------------------------
   STEP 3 - Helpers
   -------------------------------------------------------------- */
// Turns 12.5 into "£12.50"
function formatMoney(n) {
  return '£' + n.toFixed(2);
}
// Turns "2026-05-24" into "24 May 2026"
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB',
    { day: 'numeric', month: 'short', year: 'numeric' });
}

/* --------------------------------------------------------------
   STEP 4 - render()
   This is the most important function. It DRAWS the screen from
   our 'transactions' data. We call it every time the data
   changes, so the screen always matches the data.
   -------------------------------------------------------------- */
function render() {
  const list = document.getElementById('list');

  // Walk all transactions, splitting spending from income.
  // 'thisMonth' totals only count rows in the current calendar month.
  let monthSpend = 0;
  let monthIncome = 0;
  const now = new Date();

  transactions.forEach(function (t) {
    const d = new Date(t.date);
    const sameMonth = d.getMonth() === now.getMonth()
                   && d.getFullYear() === now.getFullYear();
    if (t.type === 'income') {
      if (sameMonth) monthIncome += t.amount;
    } else {
      if (sameMonth) monthSpend += t.amount;
    }
  });

  document.getElementById('monthTotal').textContent = formatMoney(monthSpend);
  document.getElementById('monthIncomeTotal').textContent = formatMoney(monthIncome);

  // Empty state - show a friendly message and clear charts
  if (transactions.length === 0) {
    list.innerHTML = '<div class="empty">No transactions yet. Upload a statement or add one above.</div>';
    drawCharts();
    return;
  }

  // Newest first
  const sorted = transactions.slice().sort(function (a, b) {
    return new Date(b.date) - new Date(a.date);
  });

  // Build the list. Income rows get a tinted left edge & "+" prefix.
  list.innerHTML = sorted.map(function (t) {
    const colour = COLOURS[t.category] || '#7a7a7a';
    const note = t.note ? ' · ' + t.note : '';
    const isIncome = t.type === 'income';
    const amountText = (isIncome ? '+' : '') + formatMoney(t.amount);
    return (
      '<div class="txn' + (isIncome ? ' income' : '') + '">' +
        '<span class="dot" style="background:' + colour + '"></span>' +
        '<div class="info">' +
          '<div class="cat">' + t.category + '</div>' +
          '<div class="meta">' + formatDate(t.date) + note + '</div>' +
        '</div>' +
        '<div class="amt">' + amountText + '</div>' +
        '<button class="del" data-id="' + t.id + '">&times;</button>' +
      '</div>'
    );
  }).join('');

  // Wire up delete buttons - scoped to this list so bill buttons
  // (which also use .del) aren't accidentally caught.
  list.querySelectorAll('.del').forEach(function (btn) {
    btn.addEventListener('click', function () {
      deleteTransaction(btn.dataset.id);
    });
  });

  drawCharts();
  if (typeof renderPlan === 'function') renderPlan();
}

/* --------------------------------------------------------------
   STEP 5 - Adding a transaction
   -------------------------------------------------------------- */
function addTransaction() {
  const amountInput = document.getElementById('amount');
  const dateInput   = document.getElementById('date');

  const amount = parseFloat(amountInput.value);
  const date   = dateInput.value;

  // Simple checks before we accept the input
  if (isNaN(amount) || amount <= 0) {
    alert('Please enter an amount greater than zero.');
    return;
  }
  if (!date) {
    alert('Please pick a date.');
    return;
  }

  // Build the new transaction object and add it to our list
  transactions.push({
    id: Date.now().toString(),   // a simple unique id
    amount: amount,
    date: date,
    type: document.getElementById('txnType').value,   // 'expense' or 'income'
    category: document.getElementById('category').value,
    note: document.getElementById('note').value.trim()
  });

  save();     // store the updated list
  render();   // redraw the screen

  // Clear the form for the next entry
  amountInput.value = '';
  document.getElementById('note').value = '';
}

/* --------------------------------------------------------------
   STEP 6 - Deleting a transaction
   Keep every transaction EXCEPT the one with this id.
   -------------------------------------------------------------- */
function deleteTransaction(id) {
  transactions = transactions.filter(function (t) {
    return t.id !== id;
  });
  save();
  render();
}

/* --------------------------------------------------------------
   STEP 7 - Charts  (added in Step 2 of our build)

   Two jobs here:
   (A) "summarise" the data - turn the raw list of transactions
       into totals grouped by category, and by month.
   (B) "drawCharts" - hand those totals to Chart.js.

   We keep references to the chart objects so we can destroy and
   redraw them cleanly each time the data changes.
   -------------------------------------------------------------- */
let categoryChart = null;
/* monthChart removed in Step 7 - the old "Spending by month" chart
   isn't on the new dashboard. Income by month and Top 5 categories
   have their own variables further below. */

/* All totals helpers count EXPENSES only (income excluded), since
   "spending" and "income" are two distinct things from Step 7 on.
   Income has its own helpers below. */

function isExpense(t) { return t.type !== 'income'; }
function isIncome(t)  { return t.type === 'income'; }

/* Group spending by category.
   Returns something like: { Groceries: 84.20, Rent: 1625.00 } */
function totalsByCategory() {
  const totals = {};
  transactions.forEach(function (t) {
    if (!isExpense(t)) return;
    if (!totals[t.category]) totals[t.category] = 0;
    totals[t.category] += t.amount;
  });
  return totals;
}

/* Group spending by category for ONE specific month ("YYYY-MM"). */
function totalsByCategoryForMonth(monthKey) {
  const totals = {};
  transactions.forEach(function (t) {
    if (!isExpense(t)) return;
    if (t.date.slice(0, 7) !== monthKey) return;
    if (!totals[t.category]) totals[t.category] = 0;
    totals[t.category] += t.amount;
  });
  return totals;
}

/* Group spending by month.
   Returns: { "2026-04": 410.50, "2026-05": 220.00 }
   "YYYY-MM" keys sort chronologically as plain text. */
function totalsByMonth() {
  const totals = {};
  transactions.forEach(function (t) {
    if (!isExpense(t)) return;
    const key = t.date.slice(0, 7);
    if (!totals[key]) totals[key] = 0;
    totals[key] += t.amount;
  });
  return totals;
}

/* Group income by month - mirror of totalsByMonth, for the
   "Income by month" chart on the dashboard. */
function incomeByMonth() {
  const totals = {};
  transactions.forEach(function (t) {
    if (!isIncome(t)) return;
    const key = t.date.slice(0, 7);
    if (!totals[key]) totals[key] = 0;
    totals[key] += t.amount;
  });
  return totals;
}

/* The list of months that appear anywhere in the data, sorted.
   Used by the month-picker dropdown on the dashboard. */
function allMonthKeys() {
  const set = {};
  transactions.forEach(function (t) { set[t.date.slice(0, 7)] = true; });
  return Object.keys(set).sort();
}

/* Turn "2026-05" into "May 2026" for a friendly chart label */
function monthLabel(key) {
  const d = new Date(key + '-01');
  return d.toLocaleDateString('en-GB',
    { month: 'short', year: 'numeric' });
}

/* (B) Draw both charts from the current data */
/* ----- Category view switching (added in Step 6) -----
   The category card can be shown three ways: 'pie', 'bar' or
   'list'. We remember the choice in localStorage so it sticks.
   In every view, each category shows its share as a percentage. */
const CATVIEW_KEY = 'spending-tracker-catview';
let categoryView = 'pie';

function loadCatView() {
  const saved = localStorage.getItem(CATVIEW_KEY);
  if (saved) categoryView = saved;
}

/* Highlight whichever toggle button is the active view */
function updateToggleButtons() {
  ['Pie', 'Bar', 'List'].forEach(function (label) {
    const btn = document.getElementById('view' + label);
    btn.classList.toggle('active', categoryView === label.toLowerCase());
  });
}

/* Called when a toggle button is clicked */
function setCatView(view) {
  categoryView = view;
  localStorage.setItem(CATVIEW_KEY, view);
  updateToggleButtons();
  renderCategoryView();
}

/* ----- The "selected month" for the category card -----
   Driven by the month-picker dropdown. We also keep a sentinel
   value 'all' meaning "everything, all time". Stored so it sticks. */
const MONTH_KEY = 'spending-tracker-selected-month';
let selectedMonth = 'all';   // 'all' or a "YYYY-MM" string

function loadSelectedMonth() {
  const saved = localStorage.getItem(MONTH_KEY);
  if (saved) selectedMonth = saved;
}
function setSelectedMonth(monthKey) {
  selectedMonth = monthKey;
  localStorage.setItem(MONTH_KEY, monthKey);
  renderCategoryView();
}

/* Fills the month dropdown with the months that have spending,
   plus an "All time" entry, and selects whatever was saved.
   Re-runs whenever the data changes. */
function populateMonthSelect() {
  const sel = document.getElementById('monthSelect');
  if (!sel) return;
  const keys = allMonthKeys();

  // If our remembered month no longer exists (data deleted),
  // fall back to the latest available month, or 'all'.
  if (selectedMonth !== 'all' && keys.indexOf(selectedMonth) === -1) {
    selectedMonth = keys.length > 0 ? keys[keys.length - 1] : 'all';
  }

  // Newest at the top of the list - more natural
  const newestFirst = keys.slice().reverse();
  let html = '<option value="all">All time</option>';
  newestFirst.forEach(function (k) {
    html += '<option value="' + k + '">' + monthLabel(k) + '</option>';
  });
  sel.innerHTML = html;
  sel.value = selectedMonth;
}

/* Draws the category card in whichever view is selected,
   for whichever month is selected (or all time). */
function renderCategoryView() {
  const catTotals = (selectedMonth === 'all')
    ? totalsByCategory()
    : totalsByCategoryForMonth(selectedMonth);

  const names = Object.keys(catTotals);

  let total = 0;
  names.forEach(function (n) { total += catTotals[n]; });

  // biggest first
  names.sort(function (a, b) { return catTotals[b] - catTotals[a]; });

  function pctOf(name) {
    return total > 0 ? (catTotals[name] / total) * 100 : 0;
  }

  const chartBox = document.getElementById('categoryChartBox');
  const listBox  = document.getElementById('categoryListBox');

  /* LIST view */
  if (categoryView === 'list') {
    chartBox.style.display = 'none';
    listBox.style.display  = 'block';
    if (names.length === 0) {
      listBox.innerHTML = '<div class="empty">No spending in this period.</div>';
      return;
    }
    listBox.innerHTML = names.map(function (name) {
      const colour = COLOURS[name] || '#7a7a7a';
      const pct = pctOf(name);
      return (
        '<div class="cat-row">' +
          '<span class="dot" style="background:' + colour + '"></span>' +
          '<div class="c-info">' +
            '<div class="c-name">' + name + '</div>' +
            '<div class="c-track">' +
              '<div class="c-fill" style="width:' + pct + '%;' +
                   'background:' + colour + '"></div>' +
            '</div>' +
          '</div>' +
          '<div class="c-right">' +
            '<div class="c-pct">' + Math.round(pct) + '%</div>' +
            '<div class="c-amt">' + formatMoney(catTotals[name]) + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
    return;
  }

  /* PIE & BAR */
  listBox.style.display  = 'none';
  chartBox.style.display = 'block';

  const values  = names.map(function (n) { return catTotals[n]; });
  const colours = names.map(function (n) { return COLOURS[n] || '#7a7a7a'; });
  // % baked into the label, shown on both pie and bar
  const labels  = names.map(function (n) {
    return n + '  ' + Math.round(pctOf(n)) + '%';
  });

  if (categoryChart) { categoryChart.destroy(); categoryChart = null; }
  if (names.length === 0) return;

  if (categoryView === 'pie') {
    categoryChart = new Chart(document.getElementById('categoryChart'), {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{ data: values, backgroundColor: colours,
                     borderWidth: 2, borderColor: '#fffdf8' }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom',
                    labels: { font: { family: 'Hanken Grotesk' }, padding: 10 } },
          tooltip: { callbacks: {
            label: function (ctx) { return ' ' + formatMoney(ctx.parsed); }
          }}
        }
      }
    });
  } else {
    categoryChart = new Chart(document.getElementById('categoryChart'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{ data: values, backgroundColor: colours, borderRadius: 6 }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            label: function (ctx) { return ' ' + formatMoney(ctx.parsed.x); }
          }}
        },
        scales: {
          x: { beginAtZero: true,
               ticks: { callback: function (v) { return '£' + v; } } }
        }
      }
    });
  }
}

/* ------------------------------------------------------------------
   DASHBOARD WIDGETS  (added in Step 7)
   Three new charts/rectangles for the Home view.
   ------------------------------------------------------------------ */
let incomeChart = null;
let top5Chart = null;

/* WIDGET 1 - Income by month: a green bar chart, similar shape to
   the old spending-by-month chart but on income transactions. */
function renderIncomeChart() {
  const data = incomeByMonth();
  const keys = Object.keys(data).sort();
  const labels = keys.map(monthLabel);
  const values = keys.map(function (k) { return data[k]; });

  if (incomeChart) { incomeChart.destroy(); incomeChart = null; }

  const canvas = document.getElementById('incomeChart');
  if (!canvas) return;
  if (keys.length === 0) return;   // empty -> just leave the canvas blank

  incomeChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ data: values, backgroundColor: '#1f6a4e', borderRadius: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          label: function (ctx) { return ' ' + formatMoney(ctx.parsed.y); }
        }}
      },
      scales: {
        y: { beginAtZero: true,
             ticks: { callback: function (v) { return '£' + v; } } }
      }
    }
  });
}

/* WIDGET 2 - Top 5 categories by AVERAGE monthly spend.
   Steps: total each category across all data -> divide by number
   of months that have spending -> take the top 5. */
function renderTop5Chart() {
  const totals = totalsByCategory();
  const monthCount = Object.keys(totalsByMonth()).length;

  // average per month, only if we have at least one month of data
  const avgs = {};
  Object.keys(totals).forEach(function (cat) {
    avgs[cat] = monthCount > 0 ? totals[cat] / monthCount : 0;
  });

  // sort categories by average spend, take top 5
  const top = Object.keys(avgs)
    .sort(function (a, b) { return avgs[b] - avgs[a]; })
    .slice(0, 5);

  const labels  = top;
  const values  = top.map(function (c) { return avgs[c]; });
  const colours = top.map(function (c) { return COLOURS[c] || '#7a7a7a'; });

  if (top5Chart) { top5Chart.destroy(); top5Chart = null; }
  const canvas = document.getElementById('top5Chart');
  if (!canvas || top.length === 0) return;

  top5Chart = new Chart(canvas, {
    type: 'bar',
    data: { labels: labels,
            datasets: [{ data: values, backgroundColor: colours, borderRadius: 6 }] },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          label: function (ctx) { return ' avg ' + formatMoney(ctx.parsed.x) + '/mo'; }
        }}
      },
      scales: {
        x: { beginAtZero: true,
             ticks: { callback: function (v) { return '£' + v; } } }
      }
    }
  });
}

/* WIDGET 3 - SaveCap rating
   The "rate of disposable income": share of income that's left
   after spending. We use ALL income & spending across the data.
   A high savings rate is green; squeezed is amber; underwater is red.

   Thresholds (in %) - feel free to adjust:
     >= 20 .... Green  ("Strong")
     5 to 20 .. Amber  ("Moderate")
     < 5 ...... Red    ("Tight")
*/
const SAVECAP_GREEN = 20;
const SAVECAP_AMBER = 5;

function renderSaveCap() {
  const box = document.getElementById('saveCapBox');
  if (!box) return;

  // sum income and spending across the whole history
  let income = 0, spend = 0;
  transactions.forEach(function (t) {
    if (isIncome(t))  income += t.amount;
    if (isExpense(t)) spend  += t.amount;
  });

  // No income recorded yet -> show a friendly no-data state
  if (income === 0) {
    box.innerHTML =
      '<div class="savecap">' +
        '<div class="savecap-circle rag-grey">' +
          '<div class="pct">—</div>' +
          '<div class="lbl">no data</div>' +
        '</div>' +
        '<div class="savecap-text">' +
          '<div class="savecap-status">No income recorded yet</div>' +
          '<div class="savecap-detail">Import a statement to capture ' +
            'income transactions, then this will fill in.</div>' +
        '</div>' +
      '</div>';
    return;
  }

  const disposable = income - spend;
  const pct = (disposable / income) * 100;

  // Choose RAG colour and label based on the thresholds
  let ragClass, status, detail;
  if (pct >= SAVECAP_GREEN) {
    ragClass = 'rag-green';
    status   = 'Strong';
    detail   = 'You keep at least £' + SAVECAP_GREEN + ' of every £100 you earn. Healthy.';
  } else if (pct >= SAVECAP_AMBER) {
    ragClass = 'rag-amber';
    status   = 'Moderate';
    detail   = 'There is some headroom, but room to push your savings rate higher.';
  } else if (pct >= 0) {
    ragClass = 'rag-red';
    status   = 'Tight';
    detail   = 'Spending is close to income. Little is being set aside.';
  } else {
    ragClass = 'rag-red';
    status   = 'Overspending';
    detail   = 'Spending exceeds income across the period shown.';
  }

  box.innerHTML =
    '<div class="savecap">' +
      '<div class="savecap-circle ' + ragClass + '">' +
        '<div class="pct">' + Math.round(pct) + '%</div>' +
        '<div class="lbl">SaveCap</div>' +
      '</div>' +
      '<div class="savecap-text">' +
        '<div class="savecap-status">' + status + '</div>' +
        '<div class="savecap-detail">' + detail + '</div>' +
        '<div class="savecap-detail" style="margin-top:6px">' +
          'Income ' + formatMoney(income) + ' · Spend ' + formatMoney(spend) +
          ' · Disposable ' + formatMoney(disposable) +
        '</div>' +
      '</div>' +
    '</div>';
}

/* The main 'draw everything' function. Called from render() whenever
   data changes. Each widget knows what to do with empty data. */
function drawCharts() {
  populateMonthSelect();
  renderCategoryView();
  renderIncomeChart();
  renderTop5Chart();
  renderSaveCap();
}

/* --------------------------------------------------------------
   STEP 8 - Savings plan  (added in Step 3 of our build)

   The plan is its own small piece of data, separate from the
   transactions list, so it gets its own storage key.
   A plan looks like:
     { name: "Holiday", target: 1200, saved: 300, date: "2026-12-01" }
   -------------------------------------------------------------- */
const PLAN_KEY = 'spending-tracker-plan';
let plan = null;            // null means "no plan set yet"

function savePlan() {
  localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
}
function loadPlan() {
  const saved = localStorage.getItem(PLAN_KEY);
  if (saved) plan = JSON.parse(saved);
}

/* Work out how many whole months lie between today and a date.
   We use this to know how long you have left to save. */
function monthsUntil(isoDate) {
  const now    = new Date();
  const target = new Date(isoDate);
  let months = (target.getFullYear() - now.getFullYear()) * 12
             + (target.getMonth()    - now.getMonth());
  // if the target day this month hasn't passed, count this month too
  if (target.getDate() >= now.getDate()) months += 1;
  return months;
}

/* renderPlan() - draws the savings section from the 'plan' data.
   Same idea as render(): the screen is built from the data. */
function renderPlan() {
  const box = document.getElementById('planResult');

  // No plan yet? Show nothing below the form.
  if (!plan) { box.innerHTML = ''; return; }

  // --- The arithmetic ---
  const remaining = plan.target - plan.saved;
  // percent done, capped between 0 and 100 so the bar behaves
  let percent = (plan.saved / plan.target) * 100;
  if (percent < 0)   percent = 0;
  if (percent > 100) percent = 100;

  const months = monthsUntil(plan.date);
  // how much per month you need; guard against dividing by zero
  let perMonth = 0;
  if (remaining > 0 && months > 0) {
    perMonth = remaining / months;
  }

  // --- Decide on a verdict message and its colour ---
  let verdictClass = 'good';
  let verdictText  = '';

  if (remaining <= 0) {
    // goal already reached
    verdictClass = 'done';
    verdictText  = 'Goal reached. Well done!';
  } else if (months <= 0) {
    // target date is in the past
    verdictClass = 'warn';
    verdictText  = 'Your target date has passed. Pick a new date.';
  } else {
    // average monthly spend, to compare against the saving need
    const monthTotals = totalsByMonth();
    const monthKeys   = Object.keys(monthTotals);
    let avgSpend = 0;
    if (monthKeys.length > 0) {
      let sum = 0;
      monthKeys.forEach(function (k) { sum += monthTotals[k]; });
      avgSpend = sum / monthKeys.length;
    }

    verdictText = 'Save ' + formatMoney(perMonth) + ' a month for '
                + months + ' month' + (months === 1 ? '' : 's')
                + ' to reach your goal.';

    // a gentle reality check against typical spending
    if (avgSpend > 0 && perMonth > avgSpend) {
      verdictClass = 'warn';
      verdictText += ' Heads up - that is more than your average '
                   + 'monthly spend, so it may be a stretch.';
    }
  }

  // --- Build the HTML ---
  box.innerHTML =
    '<div class="card">' +
      '<h2>' + plan.name + '</h2>' +
      '<div class="progress-track">' +
        '<div class="progress-fill" style="width:' + percent + '%"></div>' +
      '</div>' +
      '<div class="progress-label">' +
        percent.toFixed(0) + '% of ' + formatMoney(plan.target) +
      '</div>' +
      '<div class="plan-facts">' +
        '<div><div class="label">Saved</div>' +
          '<div class="num">' + formatMoney(plan.saved) + '</div></div>' +
        '<div><div class="label">Remaining</div>' +
          '<div class="num">' + formatMoney(Math.max(remaining, 0)) +
          '</div></div>' +
        '<div><div class="label">Per month</div>' +
          '<div class="num">' + formatMoney(perMonth) + '</div></div>' +
      '</div>' +
      '<div class="verdict ' + verdictClass + '">' + verdictText + '</div>' +
    '</div>';
}

/* Read the form, build a plan, save and redraw */
function savePlanFromForm() {
  const name   = document.getElementById('goalName').value.trim();
  const target = parseFloat(document.getElementById('goalTarget').value);
  const saved  = parseFloat(document.getElementById('goalSaved').value);
  const date   = document.getElementById('goalDate').value;

  if (!name) {
    alert('Please give your goal a name.');
    return;
  }
  if (isNaN(target) || target <= 0) {
    alert('Please enter a target amount greater than zero.');
    return;
  }
  if (!date) {
    alert('Please pick a target date.');
    return;
  }

  plan = {
    name:   name,
    target: target,
    saved:  isNaN(saved) ? 0 : saved,   // blank "saved" counts as 0
    date:   date
  };
  savePlan();
  renderPlan();
}

/* When a plan already exists, put its values back into the form
   so you can see and edit them. */
function fillPlanForm() {
  if (!plan) return;
  document.getElementById('goalName').value   = plan.name;
  document.getElementById('goalTarget').value = plan.target;
  document.getElementById('goalSaved').value  = plan.saved;
  document.getElementById('goalDate').value   = plan.date;
}

/* --------------------------------------------------------------
   STEP 9 - Payment reminders  (added in Step 4 of our build)

   Bills are recurring, so we don't store a full date - just a
   'day of the month'. A bill looks like:
     { id: "...", name: "Rent", amount: 950, day: 1 }
   Each time the app opens, we work out the NEXT date each bill
   falls on, and how many days away that is.
   -------------------------------------------------------------- */
const BILLS_KEY = 'spending-tracker-bills';
let bills = [];

function saveBills() {
  localStorage.setItem(BILLS_KEY, JSON.stringify(bills));
}
function loadBills() {
  const saved = localStorage.getItem(BILLS_KEY);
  if (saved) bills = JSON.parse(saved);
}

/* Given a day-of-month, return how many days until it next falls.
   If the day this month is still ahead, use this month; otherwise
   roll over to next month. Returns a whole number of days. */
function daysUntilDay(day) {
  const now = new Date();
  const todayMidnight = new Date(
    now.getFullYear(), now.getMonth(), now.getDate());

  // candidate: that day in the CURRENT month
  let next = new Date(now.getFullYear(), now.getMonth(), day);

  // if it has already passed, move to next month
  if (next < todayMidnight) {
    next = new Date(now.getFullYear(), now.getMonth() + 1, day);
  }

  // difference in milliseconds -> days (86,400,000 ms in a day)
  const diff = next - todayMidnight;
  return Math.round(diff / 86400000);
}

/* Turn a day number into a friendly ordinal: 1 -> "1st", 22 -> "22nd" */
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* renderBills() - draws the bill list AND the alert banner.
   'soonThreshold' is how many days ahead counts as "due soon". */
function renderBills() {
  const SOON = 5;   // flag bills due within 5 days
  const list   = document.getElementById('billList');
  const banner = document.getElementById('alertBanner');

  // --- The alert banner ---
  // collect any bills due within the threshold
  const dueSoon = bills.filter(function (b) {
    return daysUntilDay(b.day) <= SOON;
  });

  if (dueSoon.length === 0) {
    banner.innerHTML = '';   // nothing due -> banner disappears
  } else {
    const items = dueSoon.map(function (b) {
      const d = daysUntilDay(b.day);
      const when = d === 0 ? 'today'
                 : d === 1 ? 'tomorrow'
                 : 'in ' + d + ' days';
      return '<li>' + b.name + ' (' + formatMoney(b.amount) +
             ') is due ' + when + '</li>';
    }).join('');
    banner.innerHTML =
      '<div class="alert-banner">' +
        '<h3>Payments coming up</h3>' +
        '<ul>' + items + '</ul>' +
      '</div>';
  }

  // --- The full list of bills ---
  if (bills.length === 0) {
    list.innerHTML =
      '<div class="empty">No reminders yet. Add a bill above.</div>';
    return;
  }

  // sort so the soonest-due bill is first
  const sorted = bills.slice().sort(function (a, b) {
    return daysUntilDay(a.day) - daysUntilDay(b.day);
  });

  list.innerHTML = sorted.map(function (b) {
    const d = daysUntilDay(b.day);

    // pick a badge style and wording based on how soon it is
    let badgeClass, badgeText;
    if (d === 0) {
      badgeClass = 'due';  badgeText = 'Due today';
    } else if (d <= SOON) {
      badgeClass = 'soon'; badgeText = 'In ' + d + ' day' + (d === 1 ? '' : 's');
    } else {
      badgeClass = 'ok';   badgeText = 'In ' + d + ' days';
    }

    return (
      '<div class="bill">' +
        '<div class="info">' +
          '<div class="name">' + b.name + '</div>' +
          '<div class="when">Every month on the ' + ordinal(b.day) + '</div>' +
        '</div>' +
        '<div class="amt">' + formatMoney(b.amount) + '</div>' +
        '<span class="badge ' + badgeClass + '">' + badgeText + '</span>' +
        '<button class="del" data-id="' + b.id + '">&times;</button>' +
      '</div>'
    );
  }).join('');

  // wire up the delete buttons for bills
  list.querySelectorAll('.del').forEach(function (btn) {
    btn.addEventListener('click', function () {
      deleteBill(btn.dataset.id);
    });
  });
}

/* Read the form, add a bill, save and redraw */
function addBill() {
  const name   = document.getElementById('billName').value.trim();
  const amount = parseFloat(document.getElementById('billAmount').value);
  const day    = parseInt(document.getElementById('billDay').value, 10);

  if (!name) {
    alert('Please give the bill a name.');
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    alert('Please enter an amount greater than zero.');
    return;
  }
  if (isNaN(day) || day < 1 || day > 31) {
    alert('Please enter a due day between 1 and 31.');
    return;
  }

  bills.push({
    id: Date.now().toString(),
    name: name,
    amount: amount,
    day: day
  });
  saveBills();
  renderBills();

  // clear the form
  document.getElementById('billName').value   = '';
  document.getElementById('billAmount').value = '';
  document.getElementById('billDay').value    = '';
}

/* Remove a bill by id - same pattern as deleteTransaction */
function deleteBill(id) {
  bills = bills.filter(function (b) { return b.id !== id; });
  saveBills();
  renderBills();
}

/* --------------------------------------------------------------
   STEP 10 - Import from a bank statement  (Step 5 of our build)

   The flow has three stages, each drawn into the #importArea div:
     1. Pick a file        -> we read & parse it
     2. Map the columns    -> tell us which column is which
     3. Preview & confirm  -> check categories, then import

   'importRows' holds the parsed spreadsheet between stages so we
   don't have to read the file again at each step.
   -------------------------------------------------------------- */
let importRows = [];     // the raw rows from the file (incl. header)
let importPreview = [];  // the transactions we propose to import

/* --- Auto-categorisation rules ---
   For each category, a list of keywords. If a transaction's text
   contains a keyword, it gets that category. Rules are checked
   top to bottom, so put more specific categories first - e.g.
   'petrol' (Transport) is checked before 'asda' (Groceries),
   so "ASDA PETROL" correctly becomes Transport.
   You can extend any of these lists freely. */
/* Each rule is [category, [keywords]] OR
   [category, [keywords], minAmount].
   If a minAmount is given, the rule only matches when the
   transaction amount is GREATER than that figure. This is how
   "payments to these people OVER £150" works for child maintenance.

   ORDER MATTERS: rules are checked top to bottom, first match
   wins. So more specific rules go higher - e.g. Streaming is
   above Shopping so "AMAZON PRIME" becomes Streaming, while a
   normal "AMAZON" purchase still falls through to Shopping. */
const CATEGORY_RULES = [
  // Child maintenance: ONLY when the payment is over £150 (the 3rd value).
  ['Child Maintenance',      ['jana', 'mariya', 'christina'], 150],

  ['Rent',                   ['rylton', 'hougasian', 'rent']],

  // Streaming - above Shopping so "amazon prime" lands here while
  // a plain Amazon purchase still goes to Shopping below.
  ['Streaming Services',     ['disney', 'netflix', 'prime video',
                              'amazon prime', ' prime', 'apple']],

  ['Loan Repayments',        ['118118', '118 money', 'drafty', 'oodle', 'loan']],

  // Telecoms - phone, broadband, TV providers. 'ee' is matched
  // only as a standalone word so it can't match words like 'coffee'.
  ['Telecoms',               ['virgin media', 'ee limited', ' ee ', 'ee&',
                              ' sky ', 'sky digital', 'vodafone', 'broadband']],

  // Utilities - energy, water, council tax, TV licence.
  ['Utilities',              ['edf', 'british gas', 'e.on', 'octopus energy',
                              'water', 'council tax', 'tv licence']],

  ['Transport',              ['tfl', 'travel ch', 'uber', 'bolt', 'trainline',
                              'train', 'rail', 'petrol', 'fuel', 'shell',
                              'esso', ' bp ', 'parking', 'oyster']],

  // Credit cards (renamed from "Debt repayment" for consistency
  // with "Loan Repayments").
  ['Credit Card Repayments', ['capital one', 'link financial', 'zable',
                              'lowell', 'klarna', 'clearpay', 'vanquis',
                              'aqua', 'marbles', 'credit']],

  ['Entertainment',          ['spotify', 'google play', 'playstation', 'xbox',
                              'nintendo', 'steam', 'cinema', 'vue ', 'odeon',
                              'cineworld']],

  ['Eating out',             ['burger king', 'mcdonald', ' kfc', 'nando',
                              'greggs', 'costa', 'starbucks', 'pret', 'subway',
                              'domino', 'pizza', 'deliveroo', 'just eat',
                              'ubereats', 'restaurant', 'cafe', 'chicken']],

  ['Groceries',              ['tesco', 'sainsbury', 'asda', 'aldi', 'lidl',
                              'morrison', 'waitrose', 'iceland', 'co-op',
                              'coop', 'ocado', 'farmfoods']],

  ['Shopping',               ['amazon', 'ebay', 'argos', 'ikea', 'primark',
                              'asos', 'next ', 'h&m', 'clintons', 'boots',
                              'superdrug', 'sports direct']],

  ['Health',                 ['pharmacy', 'dentist', 'nhs', 'gym', 'optician']],

  ['Transfer',               ['transfer', 'faster payment', 'revolut',
                              'ekperigin', 'outward']]
];

/* Given a description AND amount, return the best category guess.
   Falls back to 'Other' if nothing matches. */
function autoCategory(text, amount) {
  const lower = (' ' + text + ' ').toLowerCase();
  for (let i = 0; i < CATEGORY_RULES.length; i++) {
    const category  = CATEGORY_RULES[i][0];
    const keywords  = CATEGORY_RULES[i][1];
    const minAmount = CATEGORY_RULES[i][2];   // may be undefined

    // skip an amount-gated rule when we're at or below its threshold
    if (minAmount !== undefined && !(amount > minAmount)) continue;

    for (let j = 0; j < keywords.length; j++) {
      if (lower.indexOf(keywords[j]) !== -1) return category;
    }
  }
  return 'Other';
}

/* Turn a cell value into an ISO date string "YYYY-MM-DD".
   Handles two cases:
   - a real Date object (Excel files often store dates this way)
   - a text string like "30/01/2026" (UK day/month/year order)
   Returns null if it can't make sense of the value. */
function parseDateValue(value) {
  if (value instanceof Date && !isNaN(value)) {
    // read the parts directly (NOT toISOString, which uses UTC
    // and could shift the date by a day depending on timezone)
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  const text = String(value).trim();

  // UK format: DD/MM/YYYY or DD-MM-YYYY
  let m = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let day = m[1], month = m[2], year = m[3];
    if (year.length === 2) year = '20' + year;     // 26 -> 2026
    day   = day.padStart(2, '0');
    month = month.padStart(2, '0');
    return year + '-' + month + '-' + day;
  }
  // Already ISO format: YYYY-MM-DD
  m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  }
  return null;
}

/* Turn a cell value into a number. Strips "£" and commas first.
   Returns 0 for blank cells. */
function parseAmount(value) {
  if (value === undefined || value === null || value === '') return 0;
  const cleaned = String(value).replace(/[£,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/* STAGE 1 - the file has been picked: read and parse it */
function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      // SheetJS reads the file's raw bytes and gives us a workbook
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });

      // take the first sheet, convert to an array of rows.
      // header:1 means "give me plain arrays, row 0 is the header"
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      importRows = XLSX.utils.sheet_to_json(sheet,
        { header: 1, raw: false, blankrows: false });

      if (importRows.length < 2) {
        alert('That file has no data rows.');
        return;
      }
      showMapping();
    } catch (err) {
      alert('Sorry, that file could not be read. Is it a valid '
          + 'CSV or Excel file?');
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

/* Look through the header names for one that matches any keyword.
   Returns the column's index, or 0 if nothing matches. */
function guessColumn(headers, keywords) {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i]).toLowerCase();
    for (let k = 0; k < keywords.length; k++) {
      if (h.indexOf(keywords[k]) !== -1) return i;
    }
  }
  return 0;
}

/* Build a <select> of column names, pre-selecting one index */
function columnDropdown(id, headers, selectedIndex) {
  let html = '<select id="' + id + '">';
  headers.forEach(function (name, i) {
    const label = name ? name : '(column ' + (i + 1) + ')';
    const sel = (i === selectedIndex) ? ' selected' : '';
    html += '<option value="' + i + '"' + sel + '>' + label + '</option>';
  });
  return html + '</select>';
}

/* STAGE 2 - show the column-mapping dropdowns */
function showMapping() {
  const headers = importRows[0];
  const area = document.getElementById('importArea');

  // auto-detect each column from its header name
  const dateGuess = guessColumn(headers, ['date']);
  const descGuess = guessColumn(headers, ['detail', 'description',
                                          'narrative', 'reference', 'name']);
  const outGuess  = guessColumn(headers, ['out', 'debit', 'paid out',
                                          'withdraw', 'amount']);
  const inGuess   = guessColumn(headers, ['in', 'credit', 'paid in',
                                          'deposit', 'income']);

  // Build a column dropdown that ALSO has a "(none)" option at the
  // top - used for the optional money-in column.
  function columnDropdownOptional(id, headers, selectedIndex) {
    let html = '<select id="' + id + '">';
    html += '<option value="-1">(none - no income column)</option>';
    headers.forEach(function (name, i) {
      const label = name ? name : '(column ' + (i + 1) + ')';
      const sel = (i === selectedIndex) ? ' selected' : '';
      html += '<option value="' + i + '"' + sel + '>' + label + '</option>';
    });
    return html + '</select>';
  }

  area.innerHTML =
    '<div class="map-grid">' +
      '<p class="map-note">Found ' + (importRows.length - 1) +
        ' rows. Check the columns below are matched correctly.</p>' +
      '<label>Date column</label>' +
      columnDropdown('mapDate', headers, dateGuess) +
      '<label>Description column</label>' +
      columnDropdown('mapDesc', headers, descGuess) +
      '<label>Amount / money-out column</label>' +
      columnDropdown('mapAmount', headers, outGuess) +
      '<label>Money-in (income) column - optional</label>' +
      columnDropdownOptional('mapIncome', headers, inGuess) +
      '<div class="checkbox-row">' +
        '<input type="checkbox" id="mapNegative" />' +
        '<label for="mapNegative" style="margin:0">' +
          'My statement uses ONE amount column where spending ' +
          'shows as a negative number. ' +
          '(Leave unticked for separate money-out / money-in columns.)' +
        '</label>' +
      '</div>' +
      '<button id="previewBtn">Preview transactions</button>' +
    '</div>';

  document.getElementById('previewBtn')
    .addEventListener('click', buildPreview);
}

/* STAGE 3a - read the mapping and build the proposed transactions.
   We now capture BOTH spending (Out column) and, optionally, income
   (In column or positive values in negative-mode). Each preview row
   carries its own 'type' field so the user can see at a glance. */
function buildPreview() {
  const dateCol   = parseInt(document.getElementById('mapDate').value, 10);
  const descCol   = parseInt(document.getElementById('mapDesc').value, 10);
  const amtCol    = parseInt(document.getElementById('mapAmount').value, 10);
  const incomeCol = parseInt(document.getElementById('mapIncome').value, 10);
  const negativeMode = document.getElementById('mapNegative').checked;
  const hasIncomeColumn = incomeCol !== -1;

  importPreview = [];

  for (let i = 1; i < importRows.length; i++) {
    const row = importRows[i];
    if (!row || row.length === 0) continue;

    const date = parseDateValue(row[dateCol]);
    if (!date) continue;

    let desc = row[descCol] ? String(row[descCol]).trim() : '';
    if (!desc) desc = 'Transaction';
    desc = desc.replace(/^Card Purchase\s+/i, '');

    // --- Spending side ---
    let amount = parseAmount(row[amtCol]);
    let isExpenseRow = false;
    if (negativeMode) {
      // one signed column: negative = spend, positive = income
      if (amount < 0) {
        amount = Math.abs(amount);
        isExpenseRow = true;
      }
    } else {
      if (amount > 0) isExpenseRow = true;
    }

    if (isExpenseRow) {
      importPreview.push({
        date: date,
        note: desc,
        amount: amount,
        type: 'expense',
        category: autoCategory(desc, amount),
        include: true
      });
    }

    // --- Income side ---
    // In negative-mode we re-read the same amount column for positives.
    // In separate-columns mode we read the optional income column.
    let incomeAmount = 0;
    if (negativeMode) {
      const signed = parseAmount(row[amtCol]);
      if (signed > 0) incomeAmount = signed;
    } else if (hasIncomeColumn) {
      const v = parseAmount(row[incomeCol]);
      if (v > 0) incomeAmount = v;
    }

    if (incomeAmount > 0) {
      importPreview.push({
        date: date,
        note: desc,
        amount: incomeAmount,
        type: 'income',
        category: 'Income',          // income doesn't use spending categories
        include: true
      });
    }
  }

  if (importPreview.length === 0) {
    alert('No transactions were found with those columns. '
        + 'Try adjusting the column choices.');
    return;
  }
  showPreview();
}

/* STAGE 3b - draw the preview list with editable categories */
function showPreview() {
  const area = document.getElementById('importArea');

  // build the rows
  let rowsHtml = '';
  importPreview.forEach(function (t, index) {
    const isIncome = t.type === 'income';

    // Build a category dropdown - but income rows don't really have
    // a "category" in the spending sense, so we show a fixed label
    // for them instead of a dropdown.
    let categoryCell;
    if (isIncome) {
      categoryCell = '<div class="pv-type">Income</div>';
    } else {
      let catOptions = '';
      CATEGORIES.forEach(function (c) {
        const sel = (c === t.category) ? ' selected' : '';
        catOptions += '<option value="' + c + '"' + sel + '>' + c + '</option>';
      });
      categoryCell = '<select class="pv-cat">' + catOptions + '</select>';
    }

    const amountText = (isIncome ? '+' : '') + formatMoney(t.amount);

    rowsHtml +=
      '<div class="preview-row' + (isIncome ? ' income' : '') +
            '" data-index="' + index + '">' +
        '<input type="checkbox" class="pv-include" ' +
               (t.include ? 'checked' : '') + ' />' +
        '<div class="pv-info">' +
          '<div class="pv-name">' + t.note + '</div>' +
          '<div class="pv-date">' + formatDate(t.date) + '</div>' +
        '</div>' +
        categoryCell +
        '<div class="pv-amt">' + amountText + '</div>' +
      '</div>';
  });

  area.innerHTML =
    '<div class="map-grid">' +
      '<p class="map-note">Review below. Untick anything you ' +
        'don\u2019t want, and fix any category. Nothing is saved ' +
        'until you press Import.</p>' +
      '<div class="preview-box">' + rowsHtml + '</div>' +
      '<div class="import-summary" id="importCount"></div>' +
      '<button id="confirmImportBtn">Import transactions</button>' +
      '<button id="cancelImportBtn" class="ghost">Cancel</button>' +
    '</div>';

  // --- wire up the live controls ---

  // category change: update our data when a dropdown changes
  area.querySelectorAll('.pv-cat').forEach(function (sel) {
    sel.addEventListener('change', function () {
      const index = sel.closest('.preview-row').dataset.index;
      importPreview[index].category = sel.value;
    });
  });

  // include checkbox: update data, dim the row, refresh the count
  area.querySelectorAll('.pv-include').forEach(function (box) {
    box.addEventListener('change', function () {
      const rowEl = box.closest('.preview-row');
      const index = rowEl.dataset.index;
      importPreview[index].include = box.checked;
      rowEl.classList.toggle('skip', !box.checked);
      updateImportCount();
    });
  });

  document.getElementById('confirmImportBtn')
    .addEventListener('click', confirmImport);
  document.getElementById('cancelImportBtn')
    .addEventListener('click', cancelImport);

  updateImportCount();
}

/* Update the "X transactions, £Y total" line under the preview */
function updateImportCount() {
  const chosen = importPreview.filter(function (t) { return t.include; });
  let total = 0;
  chosen.forEach(function (t) { total += t.amount; });
  document.getElementById('importCount').textContent =
    chosen.length + ' transaction' + (chosen.length === 1 ? '' : 's') +
    ' selected · ' + formatMoney(total) + ' total';
}

/* STAGE 3c - import the ticked rows into the real transactions list.
   We skip exact duplicates (same date + amount + description) so
   importing the same file twice doesn't double everything up. */
function confirmImport() {
  const chosen = importPreview.filter(function (t) { return t.include; });
  if (chosen.length === 0) {
    alert('Nothing is ticked to import.');
    return;
  }

  let added = 0;
  let skipped = 0;

  chosen.forEach(function (t) {
    const isDuplicate = transactions.some(function (existing) {
      return existing.date === t.date
          && existing.amount === t.amount
          && existing.note === t.note;
    });
    if (isDuplicate) {
      skipped++;
      return;
    }
    transactions.push({
      id: Date.now().toString() + '-' + added,  // unique id
      amount: t.amount,
      date: t.date,
      type: t.type || 'expense',                // income or expense
      category: t.category,
      note: t.note
    });
    added++;
  });

  save();
  render();        // redraw list + charts + savings verdict

  // clear the import area and tell the user what happened
  cancelImport();
  let message = 'Imported ' + added + ' transaction'
              + (added === 1 ? '' : 's') + '.';
  if (skipped > 0) {
    message += ' Skipped ' + skipped + ' that looked like '
             + 'duplicates already in your list.';
  }
  alert(message);
}

/* Clear the import area and reset the file input */
function cancelImport() {
  document.getElementById('importArea').innerHTML = '';
  document.getElementById('fileInput').value = '';
  importRows = [];
  importPreview = [];
}

/* --------------------------------------------------------------
   STEP 11 - Start the app

   The router decides which 'view' is shown at any moment. Each
   view is a <section class="view"> in the HTML; we toggle the
   'active' class on the chosen one. The choice is remembered so
   that reloading the page keeps you on the same view.
   -------------------------------------------------------------- */
const VIEW_KEY = 'spending-tracker-view';
let currentView = 'home';

const VIEW_TITLES = {
  'home':    'Dashboard',
  'upload':  'Statement upload',
  'savings': 'Savings tracker'
};

function showView(name) {
  if (!VIEW_TITLES[name]) name = 'home';   // safety: unknown -> home
  currentView = name;
  localStorage.setItem(VIEW_KEY, name);

  // Show only the matching section; hide the others.
  ['home', 'upload', 'savings'].forEach(function (v) {
    const el = document.getElementById('view-' + v);
    el.classList.toggle('active', v === name);
  });

  // Highlight the matching menu item, and update header title.
  document.querySelectorAll('.menu-item').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.view === name);
  });
  document.getElementById('headerTitle').textContent = VIEW_TITLES[name];

  // Close the menu after a selection
  closeMenu();

  // Scrolling back to top feels right when changing pages
  window.scrollTo(0, 0);
}

function openMenu()   { document.getElementById('menuPanel').classList.add('open'); }
function closeMenu()  { document.getElementById('menuPanel').classList.remove('open'); }
function toggleMenu() { document.getElementById('menuPanel').classList.toggle('open'); }

/* --- Wire up buttons --- */
document.getElementById('menuBtn')
  .addEventListener('click', function (e) {
    e.stopPropagation();   // don't immediately trigger the "click outside"
    toggleMenu();
  });

// Each menu item knows its view via the data-view attribute
document.querySelectorAll('.menu-item').forEach(function (btn) {
  btn.addEventListener('click', function () {
    showView(btn.dataset.view);
  });
});

// Click anywhere outside the menu to close it
document.addEventListener('click', function (e) {
  const panel = document.getElementById('menuPanel');
  if (panel.classList.contains('open') && !panel.contains(e.target)) {
    closeMenu();
  }
});

document.getElementById('addBtn')
  .addEventListener('click', addTransaction);
document.getElementById('planBtn')
  .addEventListener('click', savePlanFromForm);
document.getElementById('billBtn')
  .addEventListener('click', addBill);
document.getElementById('fileInput')
  .addEventListener('change', handleFile);

// category view toggle buttons (pie/bar/list)
document.getElementById('viewPie')
  .addEventListener('click', function () { setCatView('pie'); });
document.getElementById('viewBar')
  .addEventListener('click', function () { setCatView('bar'); });
document.getElementById('viewList')
  .addEventListener('click', function () { setCatView('list'); });

// month-picker dropdown on the dashboard
document.getElementById('monthSelect')
  .addEventListener('change', function (e) {
    setSelectedMonth(e.target.value);
  });

// default the manual-entry date box to today
document.getElementById('date').valueAsDate = new Date();

/* Fill the manual-entry category dropdown from CATEGORIES, so there's
   only ONE place to add a category (the COLOURS map). */
function populateCategoryDropdown() {
  const select = document.getElementById('category');
  select.innerHTML = CATEGORIES.map(function (name) {
    return '<option value="' + name + '">' + name + '</option>';
  }).join('');
}
populateCategoryDropdown();

/* --- Load saved state, then draw the screen --- */
load();
loadPlan();
loadBills();
loadCatView();
loadSelectedMonth();
fillPlanForm();
updateToggleButtons();

// Remember which view the user was last on
const savedView = localStorage.getItem(VIEW_KEY) || 'home';
showView(savedView);

render();
renderPlan();
renderBills();
