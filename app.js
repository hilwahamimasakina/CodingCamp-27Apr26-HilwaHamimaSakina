(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  const CATEGORY_COLORS = {
    Food:      '#C9956C',
    Transport: '#A8C5A0',
    Fun:       '#B5A8D4',
  };

  const VALID_CATEGORIES = ['Food', 'Transport', 'Fun'];

  // ---------------------------------------------------------------------------
  // State — single source of truth
  // ---------------------------------------------------------------------------

  let transactions = [];

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /**
   * Generates a unique identifier for a transaction.
   * Uses crypto.randomUUID() when available; falls back to a timestamp +
   * random-string combination for older browsers.
   *
   * @returns {string}
   */
  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return Date.now().toString() + Math.random().toString(36).slice(2);
  }

  // ---------------------------------------------------------------------------
  // StorageManager — localStorage persistence
  // ---------------------------------------------------------------------------

  /**
   * Shows a non-blocking warning banner appended to <body>.
   * Uses role="alert" so screen readers announce it.
   * Only one banner is shown at a time (idempotent).
   *
   * @param {string} message
   */
  function showStorageWarning(message) {
    var BANNER_ID = 'storage-warning-banner';
    if (document.getElementById(BANNER_ID)) {
      return; // already visible
    }
    var banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.setAttribute('role', 'alert');
    banner.style.cssText = [
      'position:fixed',
      'bottom:1rem',
      'left:50%',
      'transform:translateX(-50%)',
      'background:#f5c6cb',
      'color:#721c24',
      'padding:0.75rem 1.25rem',
      'border-radius:0.375rem',
      'font-size:0.875rem',
      'z-index:9999',
      'box-shadow:0 2px 8px rgba(0,0,0,0.15)',
    ].join(';');
    banner.textContent = message;
    document.body.appendChild(banner);
  }

  var StorageManager = {
    STORAGE_KEY: 'expense_transactions',

    /**
     * Reads and parses the transaction list from localStorage.
     * Returns an empty array on any error (missing key, malformed JSON,
     * or localStorage unavailable) and shows a warning banner.
     *
     * @returns {Transaction[]}
     */
    load: function () {
      try {
        var raw = localStorage.getItem(this.STORAGE_KEY);
        if (raw === null) {
          return [];
        }
        var parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          throw new Error('Stored data is not an array');
        }
        return parsed;
      } catch (err) {
        showStorageWarning(
          'Your transaction history could not be loaded from local storage. ' +
          'The app will start with an empty list.'
        );
        return [];
      }
    },

    /**
     * Serializes the transaction list and writes it to localStorage.
     * Catches quota-exceeded and unavailable errors, showing a non-blocking
     * warning banner so the app can continue with in-memory state.
     *
     * @param {Transaction[]} txList
     */
    save: function (txList) {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(txList));
      } catch (err) {
        showStorageWarning(
          'Your transactions could not be saved to local storage ' +
          '(storage may be full or unavailable). Changes will be lost on refresh.'
        );
      }
    },
  };

  // ---------------------------------------------------------------------------
  // Validator — form input validation
  // ---------------------------------------------------------------------------

  var Validator = {
    /**
     * Validates the three transaction form fields.
     *
     * @param {string} name     - The item name value from the form
     * @param {string} amount   - The raw amount string from the form
     * @param {string} category - The selected category value from the form
     * @returns {{ valid: boolean, errors: { name?: string, amount?: string, category?: string } }}
     */
    validate: function (name, amount, category) {
      var errors = {};

      // Name must be non-empty and not whitespace-only
      if (typeof name !== 'string' || name.trim() === '') {
        errors.name = 'Item name is required.';
      }

      // Amount must parse to a finite, positive number
      var parsed = parseFloat(amount);
      if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) {
        errors.amount = 'Amount must be a positive number.';
      }

      // Category must be one of the valid values
      if (VALID_CATEGORIES.indexOf(category) === -1) {
        errors.category = 'Please select a valid category.';
      }

      return {
        valid: Object.keys(errors).length === 0,
        errors: errors,
      };
    },
  };

  // ---------------------------------------------------------------------------
  // Balance — computation and rendering
  // ---------------------------------------------------------------------------

  /**
   * Computes the total balance by summing all transaction amounts.
   *
   * @param {Transaction[]} txList
   * @returns {number}
   */
  function computeBalance(txList) {
    return txList.reduce(function (sum, tx) {
      return sum + tx.amount;
    }, 0);
  }

  /**
   * Reads the current transactions, computes the balance, and updates
   * the #balance-display element with a formatted dollar amount.
   */
  function renderBalance() {
    var total = computeBalance(transactions);
    var display = document.getElementById('balance-display');
    if (display) {
      display.textContent = '$' + total.toFixed(2);
    }
  }

  // ---------------------------------------------------------------------------
  // Transaction List — rendering
  // ---------------------------------------------------------------------------

  /**
   * Clears and rebuilds #transaction-list from the transactions array,
   * sorted newest-first by timestamp. Shows a placeholder when empty.
   */
  function renderList() {
    var list = document.getElementById('transaction-list');
    if (!list) return;

    // Clear existing items
    list.innerHTML = '';

    if (transactions.length === 0) {
      var empty = document.createElement('li');
      empty.className = 'tx-empty';
      empty.textContent = 'No transactions yet. Add one above!';
      list.appendChild(empty);
      return;
    }

    // Sort newest-first (descending by timestamp)
    var sorted = transactions.slice().sort(function (a, b) {
      return b.timestamp - a.timestamp;
    });

    sorted.forEach(function (tx) {
      var li = document.createElement('li');

      // Item name
      var nameSpan = document.createElement('span');
      nameSpan.className = 'tx-name';
      nameSpan.textContent = tx.name;

      // Amount
      var amountSpan = document.createElement('span');
      amountSpan.className = 'tx-amount';
      amountSpan.textContent = '$' + tx.amount.toFixed(2);

      // Category badge
      var categorySpan = document.createElement('span');
      categorySpan.className = 'tx-category';
      categorySpan.setAttribute('data-category', tx.category);
      categorySpan.textContent = tx.category;

      // Delete button
      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'tx-delete';
      deleteBtn.setAttribute('data-id', tx.id);
      deleteBtn.setAttribute('aria-label', 'Delete ' + tx.name);
      deleteBtn.textContent = 'Delete';

      li.appendChild(nameSpan);
      li.appendChild(amountSpan);
      li.appendChild(categorySpan);
      li.appendChild(deleteBtn);
      list.appendChild(li);
    });
  }

  // ---------------------------------------------------------------------------
  // Pie Chart — computation and rendering
  // ---------------------------------------------------------------------------

  /**
   * Groups transactions by category and computes per-category totals.
   *
   * @param {Transaction[]} txList
   * @returns {{ [category: string]: number }}
   */
  function computeCategoryTotals(txList) {
    var totals = {};
    VALID_CATEGORIES.forEach(function (cat) {
      totals[cat] = 0;
    });
    txList.forEach(function (tx) {
      if (totals.hasOwnProperty(tx.category)) {
        totals[tx.category] += tx.amount;
      }
    });
    return totals;
  }

  /**
   * Computes the slice angle (in radians) for each category that has data.
   * Returns an array of { category, angle } objects.
   *
   * @param {Transaction[]} txList
   * @returns {{ category: string, angle: number }[]}
   */
  function computeSliceAngles(txList) {
    var totals = computeCategoryTotals(txList);
    var grandTotal = computeBalance(txList);
    if (grandTotal === 0) return [];

    return VALID_CATEGORIES
      .filter(function (cat) { return totals[cat] > 0; })
      .map(function (cat) {
        return {
          category: cat,
          angle: (totals[cat] / grandTotal) * 2 * Math.PI,
        };
      });
  }

  /**
   * Draws the pie chart on #pie-chart canvas and rebuilds #chart-legend.
   * Shows #chart-empty-msg when there are no transactions.
   */
  function renderChart() {
    var canvas = document.getElementById('pie-chart');
    var legend = document.getElementById('chart-legend');
    var emptyMsg = document.getElementById('chart-empty-msg');
    if (!canvas || !legend || !emptyMsg) return;

    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;
    var centerX = width / 2;
    var centerY = height / 2;
    var radius = Math.min(centerX, centerY) - 10;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (transactions.length === 0) {
      emptyMsg.hidden = false;
      legend.innerHTML = '';
      return;
    }

    emptyMsg.hidden = true;

    var slices = computeSliceAngles(transactions);
    var startAngle = -Math.PI / 2; // start at 12 o'clock

    slices.forEach(function (slice) {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + slice.angle);
      ctx.closePath();
      ctx.fillStyle = CATEGORY_COLORS[slice.category];
      ctx.fill();
      startAngle += slice.angle;
    });

    // Rebuild legend
    legend.innerHTML = '';
    slices.forEach(function (slice) {
      var li = document.createElement('li');

      var swatch = document.createElement('span');
      swatch.className = 'legend-swatch';
      swatch.style.backgroundColor = CATEGORY_COLORS[slice.category];

      var label = document.createElement('span');
      label.textContent = slice.category;

      li.appendChild(swatch);
      li.appendChild(label);
      legend.appendChild(li);
    });
  }

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  /**
   * Handles the transaction form submit event.
   * Validates input, creates a transaction, persists, and re-renders.
   *
   * @param {Event} event
   */
  function handleFormSubmit(event) {
    event.preventDefault();

    var nameInput = document.getElementById('item-name');
    var amountInput = document.getElementById('item-amount');
    var categoryInput = document.getElementById('item-category');
    var formError = document.getElementById('form-error');

    var name = nameInput ? nameInput.value : '';
    var amount = amountInput ? amountInput.value : '';
    var category = categoryInput ? categoryInput.value : '';

    var result = Validator.validate(name, amount, category);

    if (!result.valid) {
      var messages = [];
      if (result.errors.name) messages.push(result.errors.name);
      if (result.errors.amount) messages.push(result.errors.amount);
      if (result.errors.category) messages.push(result.errors.category);
      if (formError) formError.textContent = messages.join(' ');
      return;
    }

    // Clear error
    if (formError) formError.textContent = '';

    // Create transaction
    var tx = {
      id: generateId(),
      name: name.trim(),
      amount: parseFloat(amount),
      category: category,
      timestamp: Date.now(),
    };

    transactions.push(tx);
    StorageManager.save(transactions);

    renderBalance();
    renderList();
    renderChart();

    // Reset form
    if (nameInput) nameInput.value = '';
    if (amountInput) amountInput.value = '';
    if (categoryInput) categoryInput.value = '';
  }

  /**
   * Removes the transaction with the given id from state, persists, and re-renders.
   *
   * @param {string} id
   */
  function handleDeleteClick(id) {
    transactions = transactions.filter(function (tx) {
      return tx.id !== id;
    });
    StorageManager.save(transactions);
    renderBalance();
    renderList();
    renderChart();
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', function () {
    // Load persisted transactions
    transactions = StorageManager.load();

    // Initial render
    renderBalance();
    renderList();
    renderChart();

    // Form submit listener
    var form = document.getElementById('transaction-form');
    if (form) {
      form.addEventListener('submit', handleFormSubmit);
    }

    // Delegated delete listener on the transaction list
    var list = document.getElementById('transaction-list');
    if (list) {
      list.addEventListener('click', function (event) {
        var target = event.target;
        if (target && target.classList.contains('tx-delete')) {
          var id = target.getAttribute('data-id');
          if (id) {
            handleDeleteClick(id);
          }
        }
      });
    }
  });

})();
