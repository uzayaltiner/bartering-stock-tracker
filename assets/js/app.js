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

  // Flash animation on stock change
  var card = document.querySelector('[data-item-id="' + id + '"]');
  if (card) {
    var input = card.querySelector('.stock-input');
    if (input) {
      input.classList.remove('flash');
      void input.offsetWidth;
      input.classList.add('flash');
    }
  }
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

  // Manage warning icon with fade animation
  var existingWarn = card.querySelector('.stock-warn');
  if (qty <= 10 && !existingWarn) {
    var tooltip = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[currentLang])
      ? TRANSLATIONS[currentLang].lowStockTooltip : 'Low stock!';
    var warn = document.createElement('span');
    warn.className = 'stock-warn';
    warn.setAttribute('data-tooltip', tooltip);
    warn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    warn.style.opacity = '0';
    var controls = card.querySelector('.stock-controls');
    card.insertBefore(warn, controls);
    requestAnimationFrame(function() { warn.style.opacity = '1'; });
  } else if (qty > 10 && existingWarn) {
    existingWarn.style.opacity = '0';
    setTimeout(function() { if (existingWarn.parentNode) existingWarn.remove(); }, 200);
  }
}

// --- State ---

var activeLevels = new Set();
var searchQuery = '';
var searchTimeout = null;
var currentSort = localStorage.getItem('bdo-sort') || 'default';
var currentTheme = localStorage.getItem('bdo-theme') || 'dark';
var currentLang = localStorage.getItem('bdo-lang') || 'tr';

// --- UI Helpers ---

function closeWithFade(el, callback) {
  el.classList.add('closing');
  setTimeout(function() {
    el.classList.add('hidden');
    el.classList.remove('closing');
    if (callback) callback();
  }, 150);
}

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
  var sorted = items.slice();

  if (currentSort === 'default') {
    // Default: within each tier, low stock (< 10) floats to top
    sorted.sort(function(a, b) {
      if (a.level !== b.level) return a.level - b.level;
      var qtyA = stock[a.id] || 0;
      var qtyB = stock[b.id] || 0;
      var lowA = qtyA < 10 ? 0 : 1;
      var lowB = qtyB < 10 ? 0 : 1;
      if (lowA !== lowB) return lowA - lowB;
      return qtyA - qtyB;
    });
    return sorted;
  }

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
  localStorage.setItem('bdo-sort', 'default');
  clearTimeout(searchTimeout);
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
  if (menu.classList.contains('hidden')) {
    menu.classList.remove('closing');
    menu.classList.remove('hidden');
  } else if (!menu.classList.contains('closing')) {
    closeWithFade(menu);
  }
}

function setSort(sortType) {
  currentSort = sortType;
  localStorage.setItem('bdo-sort', sortType);
  document.querySelectorAll('.sort-option').forEach(function(o) {
    o.classList.toggle('active', o.dataset.sort === sortType);
  });
  var sortBtn = document.getElementById('sortBtn');
  sortBtn.classList.toggle('active', sortType !== 'default');
  closeWithFade(document.getElementById('sortMenu'));

  var clearFilterBtn = document.getElementById('clearFilter');
  clearFilterBtn.classList.toggle('hidden', activeLevels.size === 0 && !searchQuery && currentSort === 'default');
  renderGrid(true);
}

// --- Settings Menu ---

function toggleSettingsMenu() {
  var menu = document.getElementById('settingsMenu');
  var btn = document.getElementById('settingsBtn');
  if (menu.classList.contains('hidden')) {
    menu.classList.remove('closing');
    menu.classList.remove('hidden');
    btn.classList.add('active');
  } else if (!menu.classList.contains('closing')) {
    btn.classList.remove('active');
    closeWithFade(menu);
  }
}

function closeSettingsMenu() {
  var menu = document.getElementById('settingsMenu');
  var btn = document.getElementById('settingsBtn');
  if (menu && !menu.classList.contains('hidden') && !menu.classList.contains('closing')) {
    if (btn) btn.classList.remove('active');
    closeWithFade(menu);
  }
}

// --- Export / Import / Clear ---

function exportData() {
  closeSettingsMenu();
  var stock = getStock();
  var payload = {
    version: 1,
    date: new Date().toISOString(),
    stock: stock
  };
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'bdo-barter-stock-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData(file) {
  closeSettingsMenu();
  var lang = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[currentLang]) ? TRANSLATIONS[currentLang] : {};
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      if (!data || typeof data.stock !== 'object') {
        showToast(lang.importError || 'Invalid file format.', 'error');
        return;
      }
      if (!confirm(lang.importConfirm || 'Your current data will be replaced. Do you want to continue?')) {
        return;
      }
      saveStock(data.stock);
      renderGrid(true);
      updateSummary();
      showToast(lang.importSuccess || 'Data imported successfully!', 'success');
    } catch (err) {
      showToast(lang.importError || 'Invalid file format.', 'error');
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  closeSettingsMenu();
  var lang = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[currentLang]) ? TRANSLATIONS[currentLang] : {};
  if (!confirm(lang.clearConfirm || 'All stock data will be deleted. Are you sure?')) {
    return;
  }
  saveStock({});
  renderGrid(true);
  updateSummary();
  showToast(lang.clearSuccess || 'All data cleared.', 'success');
}

function showToast(message, type) {
  var existing = document.querySelector('.toast');
  if (existing) existing.remove();

  var toast = document.createElement('div');
  toast.className = 'toast toast-' + (type || 'info');
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(function() {
    toast.classList.add('toast-show');
  });

  setTimeout(function() {
    toast.classList.remove('toast-show');
    setTimeout(function() { toast.remove(); }, 300);
  }, 3500);
}

function updateLangPills() {
  var pills = document.querySelectorAll('.lang-pill');
  var bg = document.getElementById('langPillBg');
  pills.forEach(function(p) {
    p.classList.toggle('active', p.dataset.lang === currentLang);
  });
  if (bg) {
    bg.classList.toggle('right', currentLang === 'en');
  }
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', function() {
  applyTheme(currentTheme);
  applyLanguage(currentLang);

  // Settings menu
  document.getElementById('settingsBtn').addEventListener('click', function(e) {
    e.stopPropagation();
    toggleSettingsMenu();
  });

  document.querySelector('.settings-dropdown').addEventListener('click', function(e) {
    e.stopPropagation();
  });

  // Theme toggle switch
  document.getElementById('themeToggle').addEventListener('click', function() {
    toggleTheme();
  });

  // Language pills
  document.querySelectorAll('.lang-pill').forEach(function(pill) {
    pill.addEventListener('click', function() {
      var lang = pill.dataset.lang;
      if (lang !== currentLang) {
        applyLanguage(lang);
        updateLangPills();
        renderGrid(false);
      }
    });
  });

  // Export / Import / Clear
  document.getElementById('exportBtn').addEventListener('click', exportData);

  document.getElementById('importFile').addEventListener('change', function(e) {
    if (e.target.files && e.target.files[0]) {
      importData(e.target.files[0]);
      e.target.value = '';
    }
  });

  document.getElementById('clearAllBtn').addEventListener('click', clearAllData);

  updateLangPills();

  document.getElementById('search').addEventListener('input', function(e) {
    var value = e.target.value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function() {
      searchQuery = value;
      var clearFilterBtn = document.getElementById('clearFilter');
      clearFilterBtn.classList.toggle('hidden', activeLevels.size === 0 && !searchQuery && currentSort === 'default');
      renderGrid(false);
    }, 200);
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

  // Close menus on outside click
  document.addEventListener('click', function() {
    var sortMenu = document.getElementById('sortMenu');
    if (sortMenu && !sortMenu.classList.contains('hidden') && !sortMenu.classList.contains('closing')) {
      closeWithFade(sortMenu);
    }
    closeSettingsMenu();
  });

  document.querySelector('.sort-dropdown').addEventListener('click', function(e) {
    e.stopPropagation();
  });

  // Restore sort state from localStorage
  document.querySelectorAll('.sort-option').forEach(function(o) {
    o.classList.toggle('active', o.dataset.sort === currentSort);
  });
  var sortBtn = document.getElementById('sortBtn');
  if (sortBtn) {
    sortBtn.classList.toggle('active', currentSort !== 'default');
  }
  var initClearBtn = document.getElementById('clearFilter');
  if (initClearBtn) initClearBtn.classList.toggle('hidden', activeLevels.size === 0 && !searchQuery && currentSort === 'default');

  applyTranslations();
  renderGrid(true);
  updateSummary();

  // Remove FOUC guard after init
  document.documentElement.classList.remove('app-loading');
});
