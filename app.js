// --- XSS Protection ---

function escapeHtml(str) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// --- Veri Yonetimi (localStorage) ---

var STORAGE_KEY = 'bdo-barter-stock';

function getStock() {
  try {
    var data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
}

function saveStock(stock) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stock));
}

function getItemStock(id) {
  return getStock()[id] || 0;
}

function setItemStock(id, qty) {
  var stock = getStock();
  if (qty <= 0) {
    delete stock[id];
  } else {
    stock[id] = qty;
  }
  saveStock(stock);
}

// --- Stok Islemleri (global scope for onclick) ---

function updateStock(id, value) {
  var qty = Math.max(0, parseInt(value, 10) || 0);
  setItemStock(id, qty);
  updateItemCard(id, qty);
  updateSummary();
}

function changeStock(id, delta) {
  var current = getItemStock(id);
  var newQty = Math.max(0, current + delta);
  setItemStock(id, newQty);
  updateItemCard(id, newQty);
  updateSummary();
}

// Update a single item card without re-rendering the entire grid
function updateItemCard(id, qty) {
  var card = document.querySelector('[data-item-id="' + id + '"]');
  if (!card) return;

  var input = card.querySelector('.stock-input');
  if (input && input !== document.activeElement) {
    input.value = qty;
  }

  card.classList.toggle('has-stock', qty > 0);
  card.classList.toggle('stock-empty', qty === 0);
  card.classList.toggle('stock-low', qty >= 1 && qty <= 10);
  card.classList.toggle('stock-ok', qty > 10);

  // Manage warning icon
  var existingWarn = card.querySelector('.stock-warn');
  if (qty <= 10 && !existingWarn) {
    var tooltip = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[currentLang])
      ? TRANSLATIONS[currentLang].lowStockTooltip : 'Low stock!';
    var warn = document.createElement('span');
    warn.className = 'stock-warn';
    warn.setAttribute('data-tooltip', tooltip);
    warn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    var controls = card.querySelector('.stock-controls');
    card.insertBefore(warn, controls);
  } else if (qty > 10 && existingWarn) {
    existingWarn.remove();
  }
}

// --- State ---

var activeLevels = new Set();
var searchQuery = '';
var currentSort = 'default';
var currentTheme = localStorage.getItem('bdo-theme') || 'dark';
var currentLang = localStorage.getItem('bdo-lang') || 'tr';

// --- Theme ---

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('bdo-theme', theme);

  var iconSun = document.querySelector('.icon-sun');
  var iconMoon = document.querySelector('.icon-moon');
  if (iconSun && iconMoon) {
    if (theme === 'dark') {
      iconSun.style.display = '';
      iconMoon.style.display = 'none';
    } else {
      iconSun.style.display = 'none';
      iconMoon.style.display = '';
    }
  }
}

function toggleTheme() {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

// --- Language ---

function applyTranslations() {
  var translations = (typeof TRANSLATIONS !== 'undefined') ? TRANSLATIONS : {};
  var langData = translations[currentLang] || {};

  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    if (langData[key] !== undefined) {
      el.textContent = langData[key];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
    var key = el.getAttribute('data-i18n-placeholder');
    if (langData[key] !== undefined) {
      el.placeholder = langData[key];
    }
  });
}

function applyLanguage(lang) {
  currentLang = lang;
  document.documentElement.setAttribute('data-lang', lang);
  localStorage.setItem('bdo-lang', lang);

  var langBtn = document.getElementById('langToggle');
  if (langBtn) {
    langBtn.textContent = lang.toUpperCase();
  }

  applyTranslations();
}

function toggleLanguage() {
  applyLanguage(currentLang === 'tr' ? 'en' : 'tr');
  renderGrid(true);
}

// --- Summary ---

function updateSummary() {
  var stock = getStock();
  var levelTotals = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  ITEMS.forEach(function(item) {
    var qty = stock[item.id] || 0;
    levelTotals[item.level] += qty;
  });

  document.getElementById('level1Count').textContent = levelTotals[1];
  document.getElementById('level2Count').textContent = levelTotals[2];
  document.getElementById('level3Count').textContent = levelTotals[3];
  document.getElementById('level4Count').textContent = levelTotals[4];
  document.getElementById('level5Count').textContent = levelTotals[5];
}

// --- Grid Render ---

function applySorting(items, stock) {
  if (currentSort === 'default') return items;

  var sorted = items.slice();
  sorted.sort(function(a, b) {
    switch (currentSort) {
      case 'tier-asc':
        return a.level - b.level;
      case 'tier-desc':
        return b.level - a.level;
      case 'stock-asc':
        return (stock[a.id] || 0) - (stock[b.id] || 0);
      case 'stock-desc':
        return (stock[b.id] || 0) - (stock[a.id] || 0);
      default:
        return 0;
    }
  });
  return sorted;
}

function renderGrid(animate) {
  var itemGrid = document.getElementById('itemGrid');
  var emptyState = document.getElementById('emptyState');
  var stock = getStock();

  var filtered = ITEMS;

  if (activeLevels.size > 0) {
    filtered = filtered.filter(function(item) {
      return activeLevels.has(item.level);
    });
  }

  if (searchQuery) {
    var q = searchQuery.toLowerCase();
    filtered = filtered.filter(function(item) {
      return item.name_tr.toLowerCase().indexOf(q) !== -1 ||
             item.name_en.toLowerCase().indexOf(q) !== -1;
    });
  }

  filtered = applySorting(filtered, stock);

  if (filtered.length === 0) {
    itemGrid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  var tooltipText = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[currentLang])
    ? TRANSLATIONS[currentLang].lowStockTooltip : 'Low stock!';

  var html = filtered.map(function(item) {
    var qty = stock[item.id] || 0;
    var hasStock = qty > 0;
    var classes = ['item-card'];
    if (hasStock) classes.push('has-stock');
    if (qty === 0) classes.push('stock-empty');
    else if (qty <= 10) classes.push('stock-low');
    else classes.push('stock-ok');
    var primaryName = (currentLang === 'tr') ? item.name_tr : item.name_en;

    var warnIcon = qty <= 10
      ? '<span class="stock-warn" data-tooltip="' + escapeHtml(tooltipText) + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
        '</span>'
      : '';

    return '<div class="' + classes.join(' ') + '" data-item-id="' + item.id + '" style="--tier-color:var(--tier-' + item.level + ')">' +
      '<img src="' + escapeHtml(item.icon) + '" alt="' + escapeHtml(primaryName) + '" class="item-icon" loading="lazy" onerror="this.style.display=\'none\'">' +
      '<div class="item-info">' +
        '<div class="item-name">' +
          '<span class="tier-prefix">[+' + item.level + ']</span>' +
          '<span>' + escapeHtml(primaryName) + '</span>' +
        '</div>' +
      '</div>' +
      warnIcon +
      '<div class="stock-controls">' +
        '<button class="qty-btn minus" onclick="changeStock(\'' + item.id + '\', -1)">\u2212</button>' +
        '<input type="number" class="stock-input" min="0" value="' + qty + '" onchange="updateStock(\'' + item.id + '\', this.value)">' +
        '<button class="qty-btn plus" onclick="changeStock(\'' + item.id + '\', 1)">+</button>' +
      '</div>' +
    '</div>';
  }).join('');

  if (animate) {
    itemGrid.classList.add('animate');
  } else {
    itemGrid.classList.remove('animate');
  }

  itemGrid.innerHTML = html;

  if (animate) {
    setTimeout(function() { itemGrid.classList.remove('animate'); }, 200);
  }
}

// --- Filtreleme ---

function filterByLevel(level) {
  if (level === 'all') {
    activeLevels.clear();
  } else {
    if (activeLevels.has(level)) {
      activeLevels.delete(level);
    } else {
      activeLevels.add(level);
    }
  }

  updateFilterButtons();
  var clearFilterBtn = document.getElementById('clearFilter');
  clearFilterBtn.classList.toggle('hidden', activeLevels.size === 0 && !searchQuery && currentSort === 'default');
  renderGrid(true);
}

function updateFilterButtons() {
  var allBtn = document.querySelector('[data-level="all"]');
  if (allBtn) {
    allBtn.classList.toggle('active', activeLevels.size === 0);
  }

  document.querySelectorAll('.level-card[data-level]:not([data-level="all"])').forEach(function(card) {
    var cardLevel = parseInt(card.dataset.level, 10);
    card.classList.toggle('active', activeLevels.has(cardLevel));
  });
}

function clearAllFilters() {
  activeLevels.clear();
  searchQuery = '';
  currentSort = 'default';
  var searchInput = document.getElementById('search');
  if (searchInput) {
    searchInput.value = '';
  }
  updateFilterButtons();
  document.querySelectorAll('.sort-option').forEach(function(o) {
    o.classList.remove('active');
  });
  var defaultOpt = document.querySelector('[data-sort="default"]');
  if (defaultOpt) defaultOpt.classList.add('active');
  var sortBtn = document.getElementById('sortBtn');
  if (sortBtn) sortBtn.classList.remove('active');
  var clearFilterBtn = document.getElementById('clearFilter');
  clearFilterBtn.classList.add('hidden');
  renderGrid(true);
}

// --- Sort ---

function toggleSortMenu() {
  var menu = document.getElementById('sortMenu');
  menu.classList.toggle('hidden');
}

function setSort(sortType) {
  currentSort = sortType;
  document.querySelectorAll('.sort-option').forEach(function(o) {
    o.classList.toggle('active', o.dataset.sort === sortType);
  });
  var sortBtn = document.getElementById('sortBtn');
  sortBtn.classList.toggle('active', sortType !== 'default');
  document.getElementById('sortMenu').classList.add('hidden');

  var clearFilterBtn = document.getElementById('clearFilter');
  clearFilterBtn.classList.toggle('hidden', activeLevels.size === 0 && !searchQuery && currentSort === 'default');
  renderGrid(true);
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', function() {
  applyTheme(currentTheme);
  applyLanguage(currentLang);

  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('langToggle').addEventListener('click', toggleLanguage);

  document.getElementById('search').addEventListener('input', function(e) {
    searchQuery = e.target.value;
    var clearFilterBtn = document.getElementById('clearFilter');
    clearFilterBtn.classList.toggle('hidden', activeLevels.size === 0 && !searchQuery && currentSort === 'default');
    renderGrid(false);
  });

  document.getElementById('clearFilter').addEventListener('click', clearAllFilters);

  document.querySelectorAll('.level-card').forEach(function(card) {
    card.addEventListener('click', function() {
      var levelStr = card.dataset.level;
      if (levelStr === 'all') {
        filterByLevel('all');
      } else {
        filterByLevel(parseInt(levelStr, 10));
      }
    });
  });

  // Sort dropdown
  document.getElementById('sortBtn').addEventListener('click', function(e) {
    e.stopPropagation();
    toggleSortMenu();
  });

  document.querySelectorAll('.sort-option').forEach(function(opt) {
    opt.addEventListener('click', function() {
      setSort(opt.dataset.sort);
    });
  });

  // Close sort menu on outside click
  document.addEventListener('click', function() {
    var menu = document.getElementById('sortMenu');
    if (menu && !menu.classList.contains('hidden')) {
      menu.classList.add('hidden');
    }
  });

  document.querySelector('.sort-dropdown').addEventListener('click', function(e) {
    e.stopPropagation();
  });

  // Set default sort option as active
  var defaultOpt = document.querySelector('[data-sort="default"]');
  if (defaultOpt) defaultOpt.classList.add('active');

  applyTranslations();
  renderGrid(true);
  updateSummary();
});
