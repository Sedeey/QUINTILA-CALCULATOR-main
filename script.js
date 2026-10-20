'use strict';

(() => {
  const expressionNode = document.querySelector('#expression');
  const resultNode = document.querySelector('#result');
  const statusNode = document.querySelector('#status');
  const historyNode = document.querySelector('#history-list');
  const keypad = document.querySelector('.keypad');
  const copyButton = document.querySelector('[data-action="copy"]');
  const settingsButton = document.querySelector('[data-action="settings"]');
  const themePanel = document.querySelector('#theme-panel');
  const themeButtons = document.querySelectorAll('[data-theme]');
  const storageKey = 'calculator-history-v1';
  const themeStorageKey = 'quintila-calculator-theme-v1';
  const themes = new Set(['blue', 'purple', 'green', 'orange', 'light']);
  let expression = '';
  let shownResult = 0;
  let justEvaluated = false;
  let storageError = '';
  let history = loadHistory();

  function tokenize(source) {
    const tokens = [];
    const tokenPattern = /\s*(?:(\d+(?:\.\d*)?|\.\d+)|([()+\-*/%]))/y;
    let offset = 0;

    while (offset < source.length) {
      tokenPattern.lastIndex = offset;
      const match = tokenPattern.exec(source);
      if (!match) throw new Error('Check the expression.');
      tokens.push(match[1] !== undefined ? { type: 'number', value: Number(match[1]) } : { type: match[2] });
      offset = tokenPattern.lastIndex;
    }

    return tokens;
  }

  function calculate(source) {
    if (source.length > 120) throw new Error('Expression is too long.');
    const tokens = tokenize(source);
    let position = 0;

    function primary() {
      const token = tokens[position++];
      if (!token) throw new Error('Finish the expression.');
      if (token.type === 'number') return token.value;
      if (token.type === '(') {
        const value = sum();
        if (tokens[position]?.type !== ')') throw new Error('Close the parenthesis.');
        position += 1;
        return value;
      }
      throw new Error('Check the expression.');
    }

    function postfix() {
      let value = primary();
      while (tokens[position]?.type === '%') {
        position += 1;
        value /= 100;
      }
      return value;
    }

    function unary() {
      if (tokens[position]?.type === '+') {
        position += 1;
        return unary();
      }
      if (tokens[position]?.type === '-') {
        position += 1;
        return -unary();
      }
      return postfix();
    }

    function product() {
      let value = unary();
      while (tokens[position]?.type === '*' || tokens[position]?.type === '/') {
        const operator = tokens[position++].type;
        const right = unary();
        if (operator === '/' && right === 0) throw new Error('Cannot divide by zero.');
        value = operator === '*' ? value * right : value / right;
      }
      return value;
    }

    function sum() {
      let value = product();
      while (tokens[position]?.type === '+' || tokens[position]?.type === '-') {
        const operator = tokens[position++].type;
        const right = product();
        value = operator === '+' ? value + right : value - right;
      }
      return value;
    }

    if (tokens.length === 0) throw new Error('Enter a calculation.');
    const value = sum();
    if (position !== tokens.length) throw new Error('Check the expression.');
    if (!Number.isFinite(value)) throw new Error('Result is out of range.');
    return Object.is(value, -0) ? 0 : value;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 10, useGrouping: true }).format(value);
  }

  function render() {
    expressionNode.textContent = expression || '0';
    statusNode.textContent = '';
    if (!expression) {
      shownResult = 0;
      resultNode.textContent = '0';
      return;
    }
    try {
      shownResult = calculate(expression);
      resultNode.textContent = formatNumber(shownResult);
    } catch {
      resultNode.textContent = '...';
    }
  }

  function append(value) {
    const isOperator = /^[+\-*/%]$/.test(value);
    if (justEvaluated && !isOperator && value !== ')') expression = '';
    if (justEvaluated && isOperator) expression = String(shownResult);
    justEvaluated = false;

    if (value === '.') {
      const currentNumber = expression.split(/[()+\-*/%]/).at(-1);
      if (currentNumber.includes('.')) return;
      if (!currentNumber) expression += '0';
    }
    if (expression.length >= 120) {
      statusNode.textContent = 'Expression is too long.';
      return;
    }
    expression += value;
    render();
  }

  function clear() {
    expression = '';
    justEvaluated = false;
    render();
  }

  function removeLast() {
    expression = expression.slice(0, -1);
    justEvaluated = false;
    render();
  }

  function evaluate() {
    try {
      const original = expression;
      const value = calculate(original);
      shownResult = value;
      resultNode.textContent = formatNumber(value);
      expressionNode.textContent = `${original} =`;
      expression = String(value);
      justEvaluated = true;
      addHistory(original, value);
      statusNode.textContent = '';
    } catch (error) {
      statusNode.textContent = error.message;
    }
  }

  function loadHistory() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(saved) ? saved.filter(item => typeof item?.expression === 'string' && Number.isFinite(item?.result)).slice(0, 8) : [];
    } catch {
      storageError = 'Calculation history could not be loaded.';
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(history));
    } catch {
      statusNode.textContent = 'Calculation history could not be saved.';
    }
  }

  function setTheme(theme) {
    document.body.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#edf1fa' : ({
      blue: '#080d1b',
      purple: '#100a1c',
      green: '#071511',
      orange: '#19100b',
    })[theme];
    themeButtons.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.theme === theme));
    });
  }

  function loadTheme() {
    try {
      const saved = localStorage.getItem(themeStorageKey);
      if (saved && themes.has(saved)) setTheme(saved);
    } catch {
      storageError = storageError || 'Theme preference could not be loaded.';
    }
  }

  function saveTheme(theme) {
    setTheme(theme);
    try {
      localStorage.setItem(themeStorageKey, theme);
      statusNode.textContent = '';
    } catch {
      statusNode.textContent = 'Theme preference could not be saved.';
    }
  }

  function addHistory(source, value) {
    history.unshift({ expression: source, result: value });
    history = history.slice(0, 8);
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    historyNode.replaceChildren();
    if (history.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'history-empty';
      empty.textContent = 'Your calculations will appear here.';
      historyNode.append(empty);
      return;
    }
    history.forEach(item => {
      const row = document.createElement('li');
      row.className = 'history-item';
      const button = document.createElement('button');
      button.className = 'history-entry';
      button.type = 'button';
      button.dataset.historyExpression = item.expression;
      const source = document.createElement('span');
      source.className = 'history-expression';
      source.textContent = `${item.expression} =`;
      const value = document.createElement('span');
      value.className = 'history-value';
      value.textContent = formatNumber(item.result);
      button.append(source, value);
      row.append(button);
      historyNode.append(row);
    });
  }

  async function copyResult() {
    let value;
    try {
      value = expression ? calculate(expression) : shownResult;
    } catch (error) {
      statusNode.textContent = error.message;
      return;
    }
    try {
      await navigator.clipboard.writeText(String(value));
      statusNode.textContent = 'Result copied.';
    } catch {
      statusNode.textContent = 'Clipboard access is unavailable.';
    }
  }

  function handleKeypadClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.action === 'clear') clear();
    else if (button.dataset.action === 'backspace') removeLast();
    else if (button.dataset.action === 'equals') evaluate();
    else if (button.dataset.value) append(button.dataset.value);
  }

  function toggleThemePanel() {
    const open = settingsButton.getAttribute('aria-expanded') !== 'true';
    settingsButton.setAttribute('aria-expanded', String(open));
    settingsButton.setAttribute('aria-label', open ? 'Close theme settings' : 'Open theme settings');
    themePanel.hidden = !open;
  }

  function handleDocumentClick(event) {
    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    const button = target?.closest('[data-action="clear-history"]');
    if (!button) return;
    history = [];
    saveHistory();
    renderHistory();
  }

  keypad.addEventListener('click', handleKeypadClick);
  settingsButton.addEventListener('click', toggleThemePanel);
  themeButtons.forEach(button => {
    button.addEventListener('click', () => saveTheme(button.dataset.theme));
  });
  document.addEventListener('click', handleDocumentClick);

  historyNode.addEventListener('click', event => {
    const button = event.target.closest('[data-history-expression]');
    if (!button) return;
    expression = button.dataset.historyExpression;
    justEvaluated = false;
    render();
  });

  copyButton.addEventListener('click', copyResult);

  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^[0-9.+\-*/()%]$/.test(event.key)) {
      event.preventDefault();
      append(event.key);
    } else if (event.key === 'Enter' || event.key === '=') {
      event.preventDefault();
      evaluate();
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      removeLast();
    } else if (event.key === 'Escape' || event.key.toLowerCase() === 'c') {
      clear();
    }
  });

  loadTheme();
  render();
  renderHistory();
  if (storageError) statusNode.textContent = storageError;
})();
