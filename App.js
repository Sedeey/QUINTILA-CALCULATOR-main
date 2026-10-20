import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

const HISTORY_KEY = 'calculator-history-v1';
const THEME_KEY = 'quintila-calculator-theme-v1';
const HISTORY_LIMIT = 8;
const THEMES = [
  { id: 'blue', label: 'Blue Theme', color: '#398bff', background: '#080d1b', surface: 'rgba(20,31,57,0.88)', panel: 'rgba(13,22,43,0.82)', button: '#192746', buttonHover: '#23365c', ink: '#eff5ff', muted: '#9baaca', border: 'rgba(111,157,255,0.2)', glow: 'rgba(57,139,255,0.35)', gradient: ['#398bff', '#805bff'] },
  { id: 'purple', label: 'Purple Theme', color: '#b17aff', background: '#100a1c', surface: 'rgba(34,22,55,0.88)', panel: 'rgba(23,15,39,0.82)', button: '#302344', buttonHover: '#44305e', ink: '#f7efff', muted: '#b6a5ca', border: 'rgba(193,139,255,0.2)', glow: 'rgba(169,105,255,0.34)', gradient: ['#a455ff', '#ec64cd'] },
  { id: 'green', label: 'Green Theme', color: '#35dfa0', background: '#071511', surface: 'rgba(16,39,31,0.88)', panel: 'rgba(11,29,23,0.82)', button: '#18372d', buttonHover: '#24513f', ink: '#edfff7', muted: '#9ab8aa', border: 'rgba(76,232,169,0.2)', glow: 'rgba(43,215,143,0.3)', gradient: ['#24d596', '#71df8b'] },
  { id: 'orange', label: 'Orange Theme', color: '#ff9d52', background: '#19100b', surface: 'rgba(48,31,21,0.9)', panel: 'rgba(33,22,15,0.84)', button: '#3b2a20', buttonHover: '#59402d', ink: '#fff5eb', muted: '#c3a991', border: 'rgba(255,166,95,0.2)', glow: 'rgba(255,137,62,0.32)', gradient: ['#ff9d52', '#ff5f72'] },
  { id: 'light', label: 'Light Theme', color: '#5b72ed', background: '#edf1fa', surface: 'rgba(255,255,255,0.96)', panel: '#f4f6fc', button: '#edf0f8', buttonHover: '#e2e7f5', ink: '#1a2340', muted: '#73809f', border: 'rgba(83,107,179,0.16)', glow: 'rgba(91,114,237,0.2)', gradient: ['#6479f2', '#9570ed'] },
];
const KEY_ROWS = [
  [
    { label: 'C', action: 'clear', style: 'dark' },
    { label: '⌫', action: 'backspace', accessibilityLabel: 'Backspace' },
    { label: '%', value: '%', accessibilityLabel: 'Percent' },
    { label: '÷', value: '/', accessibilityLabel: 'Divide' },
  ],
  [
    { label: '7', value: '7', style: 'number' },
    { label: '8', value: '8', style: 'number' },
    { label: '9', value: '9', style: 'number' },
    { label: '×', value: '*', accessibilityLabel: 'Multiply' },
  ],
  [
    { label: '4', value: '4', style: 'number' },
    { label: '5', value: '5', style: 'number' },
    { label: '6', value: '6', style: 'number' },
    { label: '−', value: '-', accessibilityLabel: 'Subtract' },
  ],
  [
    { label: '1', value: '1', style: 'number' },
    { label: '2', value: '2', style: 'number' },
    { label: '3', value: '3', style: 'number' },
    { label: '+', value: '+', accessibilityLabel: 'Add' },
  ],
  [
    { label: '0', value: '0', style: 'number', wide: true },
    { label: '.', value: '.', style: 'number' },
    { label: '=', action: 'equals', style: 'dark' },
  ],
];

function tokenize(source) {
  const tokens = [];
  let offset = 0;

  while (offset < source.length) {
    const character = source[offset];
    if (/\s/.test(character)) {
      offset += 1;
      continue;
    }
    if ('()+-*/%'.includes(character)) {
      tokens.push({ type: character });
      offset += 1;
      continue;
    }
    const number = source.slice(offset).match(/^(?:\d+\.?\d*|\.\d+)/);
    if (!number) throw new Error('Check the expression.');
    tokens.push({ type: 'number', value: Number(number[0]) });
    offset += number[0].length;
  }

  return tokens;
}

function calculateExpression(source) {
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
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 10 }).format(value);
}

export default function App() {
  const { width } = useWindowDimensions();
  const wideLayout = width >= 760;
  const [themeId, setThemeId] = useState('blue');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expression, setExpression] = useState('');
  const [lastValue, setLastValue] = useState(0);
  const [lastExpression, setLastExpression] = useState('');
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const keyboardActions = useRef({});
  const themeTouched = useRef(false);
  const theme = THEMES.find(item => item.id === themeId) || THEMES[0];

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_KEY)
      .then(saved => {
        if (active && !themeTouched.current && THEMES.some(item => item.id === saved)) setThemeId(saved);
      })
      .catch(() => {
        if (active) setMessage('Theme preference could not be loaded.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(HISTORY_KEY)
      .then(saved => {
        if (!active || !saved) return;
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setHistory(parsed.filter(item => typeof item?.expression === 'string' && Number.isFinite(item?.result)).slice(0, HISTORY_LIMIT));
        }
      })
      .catch(() => {
        if (active) setMessage('Calculation history could not be loaded.');
      });
    return () => { active = false; };
  }, []);

  const saveHistory = nextHistory => {
    setHistory(nextHistory);
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory)).catch(() => setMessage('Calculation history could not be saved.'));
  };

  const selectTheme = selectedTheme => {
    themeTouched.current = true;
    setThemeId(selectedTheme);
    AsyncStorage.setItem(THEME_KEY, selectedTheme).catch(() => setMessage('Theme preference could not be saved.'));
  };

  const clear = () => {
    setExpression('');
    setLastValue(0);
    setLastExpression('');
    setJustEvaluated(false);
    setMessage('');
  };

  const removeLast = () => {
    setExpression(current => current.slice(0, -1));
    setJustEvaluated(false);
    setMessage('');
  };

  const append = value => {
    const isOperator = /^[+\-*/%]$/.test(value);
    if (expression.length >= 120) {
      setMessage('Expression is too long.');
      return;
    }
    setExpression(current => {
      let next = current;
      if (justEvaluated) next = isOperator ? String(lastValue) : '';
      if (value === '.') {
        const currentNumber = next.split(/[()+\-*/%]/).at(-1);
        if (currentNumber.includes('.')) return next;
        if (!currentNumber) next += '0';
      }
      if (next.length >= 120) return next;
      return next + value;
    });
    setJustEvaluated(false);
    setMessage('');
  };

  const evaluate = () => {
    try {
      const source = expression;
      const result = calculateExpression(source);
      const nextHistory = [{ expression: source, result }, ...history].slice(0, HISTORY_LIMIT);
      setLastValue(result);
      setLastExpression(source);
      setExpression(String(result));
      setJustEvaluated(true);
      setMessage('');
      saveHistory(nextHistory);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const clearHistory = () => saveHistory([]);

  const copyResult = async () => {
    let value = lastValue;
    try {
      if (expression) value = calculateExpression(expression);
    } catch (error) {
      setMessage(error.message);
      return;
    }
    try {
      await Clipboard.setStringAsync(String(value));
      setMessage('Result copied.');
    } catch {
      setMessage('Clipboard access is unavailable.');
    }
  };

  const restoreHistory = source => {
    setExpression(source);
    setJustEvaluated(false);
    setMessage('');
  };

  keyboardActions.current = { append, clear, evaluate, removeLast };
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const handleKeyDown = event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const actions = keyboardActions.current;
      if (/^[0-9.+\-*/()%]$/.test(event.key)) {
        event.preventDefault();
        actions.append(event.key);
      } else if (event.key === 'Enter' || event.key === '=') {
        event.preventDefault();
        actions.evaluate();
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        actions.removeLast();
      } else if (event.key === 'Escape' || event.key.toLowerCase() === 'c') {
        actions.clear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  let preview = null;
  if (expression) {
    try {
      preview = calculateExpression(expression);
    } catch {
      preview = null;
    }
  }
  const resultText = expression ? (preview === null ? '...' : formatNumber(preview)) : '0';
  const shownExpression = justEvaluated ? `${lastExpression} =` : (expression || '0');

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.id === 'light' ? 'dark-content' : 'light-content'} backgroundColor={theme.background} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.background }]}>
        <View style={[styles.shell, wideLayout && styles.shellWide]}>
          <View style={styles.masthead}>
            <View style={styles.headerRow}>
              <View style={styles.brand}>
                <Text style={styles.calculatorIcon}>▦</Text>
                <View>
                  <Text style={[styles.eyebrow, { color: theme.muted }]}>EVERYDAY MATH, MADE CLEAR</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[styles.title, { color: theme.ink }]}>QUINTILA<Text style={{ color: theme.color }}> CALCULATOR</Text></Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={settingsOpen ? 'Close theme settings' : 'Open theme settings'}
                accessibilityState={{ expanded: settingsOpen }}
                onPress={() => setSettingsOpen(open => !open)}
                style={[styles.settingsButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <Text style={[styles.settingsIcon, { color: theme.ink }]}>⚙</Text>
              </Pressable>
            </View>
          </View>

          {settingsOpen && (
            <View style={[styles.themePanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.themeTitle, { color: theme.ink }]}>Choose Your Color</Text>
              <Text style={[styles.themeDescription, { color: theme.muted }]}>Switch between different themes to match your style.</Text>
              <View style={styles.themeOptions}>
                {THEMES.map(option => (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected: themeId === option.id }}
                    onPress={() => selectTheme(option.id)}
                    style={[
                      styles.themeOption,
                      { borderColor: themeId === option.id ? option.color : theme.border },
                      themeId === option.id && { backgroundColor: option.glow },
                    ]}
                  >
                    <View style={[styles.themeSwatch, { backgroundColor: option.color }]} />
                    <Text style={[styles.themeOptionText, { color: theme.ink }]}>{option.label.replace(' Theme', '')}</Text>
                    {themeId === option.id && <Text style={[styles.themeCheck, { color: option.color }]}>✓</Text>}
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={[styles.card, wideLayout && styles.cardWide, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.color }]}>
            <View style={styles.workbench}>
              <View style={styles.display}>
                <View style={styles.displayTopline}>
                  <Text style={[styles.displayLabel, { color: theme.muted }]}>DISPLAY</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Copy result" onPress={copyResult} hitSlop={8}>
                    <Text style={[styles.textButton, { color: theme.color }]}>Copy result</Text>
                  </Pressable>
                </View>
                <Text numberOfLines={1} style={[styles.expression, { color: theme.muted }]}>{shownExpression}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.result, { color: theme.ink }]}>{resultText}</Text>
              </View>

              <View style={styles.keypad}>
                {KEY_ROWS.map((row, rowIndex) => (
                  <View key={`row-${rowIndex}`} style={styles.keyRow}>
                    {row.map(key => {
                      const dark = key.style === 'dark';
                      const number = key.style === 'number';
                      const onPress = key.action === 'clear' ? clear : key.action === 'equals' ? evaluate : key.action === 'backspace' ? removeLast : () => append(key.value);
                      return (
                        <Pressable
                          key={key.label}
                          accessibilityRole="button"
                          accessibilityLabel={key.action === 'clear' ? 'Clear all' : key.action === 'equals' ? 'Equals' : key.accessibilityLabel || key.label}
                          onPress={onPress}
                          style={({ pressed }) => [
                            styles.key,
                            { backgroundColor: dark ? undefined : (key.value && /^[+\-*/%]$/.test(key.value) ? theme.glow : theme.button), borderColor: theme.border },
                            number && styles.numberKey,
                            dark && styles.darkKey,
                            dark && { backgroundColor: theme.color, shadowColor: theme.color },
                            key.wide && styles.wideKey,
                            pressed && styles.keyPressed,
                          ]}
                        >
                          <Text style={[styles.keyText, { color: theme.ink }, dark && styles.darkText]}>{key.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
              <Text accessibilityRole="alert" style={[styles.message, { color: theme.id === 'light' ? '#b02e4b' : '#ff8295' }]}>{message}</Text>
            </View>

            <View style={[styles.historyPane, wideLayout ? styles.historyWide : styles.historyMobile, { backgroundColor: theme.panel, borderColor: theme.border }]}>
              <View style={styles.historyHeading}>
                <View>
                  <Text style={[styles.displayLabel, { color: theme.muted }]}>RECENT WORK</Text>
                  <Text style={[styles.historyTitle, { color: theme.ink }]}>History</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Clear history" onPress={clearHistory} hitSlop={8}>
                  <Text style={[styles.textButton, { color: theme.color }]}>Clear</Text>
                </Pressable>
              </View>
              {history.length === 0 ? (
                <Text style={[styles.emptyHistory, { color: theme.muted }]}>Your calculations will appear here.</Text>
              ) : (
                <ScrollView style={styles.historyList} nestedScrollEnabled>
                  {history.map((item, index) => (
                    <Pressable
                      key={`${item.expression}-${index}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.expression} equals ${formatNumber(item.result)}`}
                      onPress={() => restoreHistory(item.expression)}
                      style={[styles.historyEntry, { borderColor: theme.border }]}
                    >
                      <Text numberOfLines={1} style={[styles.historyExpression, { color: theme.muted }]}>{item.expression} =</Text>
                      <Text style={[styles.historyValue, { color: theme.ink }]}>{formatNumber(item.result)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
          <Text style={[styles.footer, { color: theme.muted }]}>A LITTLE SPACE FOR BIG NUMBERS · QUINTILA</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 30 },
  shell: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 18 },
  shellWide: { maxWidth: 1060, paddingHorizontal: 28 },
  masthead: { marginBottom: 18, paddingHorizontal: 5 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  calculatorIcon: { color: '#72a7ff', fontSize: 30, fontWeight: '800' },
  eyebrow: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 9, fontWeight: '500', letterSpacing: 1.5 },
  title: { marginTop: 6, fontSize: 19, fontWeight: '800', letterSpacing: 1, lineHeight: 25 },
  settingsButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 14 },
  settingsIcon: { fontSize: 21 },
  themePanel: { marginBottom: 16, padding: 18, borderWidth: 1, borderRadius: 18 },
  themeTitle: { fontSize: 16, fontWeight: '800' },
  themeDescription: { marginTop: 5, fontSize: 12, lineHeight: 18 },
  themeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  themeOption: { minWidth: 100, flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 9, paddingHorizontal: 10, borderWidth: 1, borderRadius: 11 },
  themeSwatch: { width: 12, height: 12, borderRadius: 6 },
  themeOptionText: { fontSize: 12, fontWeight: '700' },
  themeCheck: { marginLeft: 'auto', fontWeight: '800' },
  card: { overflow: 'hidden', borderWidth: 1, borderRadius: 18, elevation: 12, shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.2, shadowRadius: 25 },
  cardWide: { flexDirection: 'row' },
  workbench: { minWidth: 0, flex: 1, padding: 22 },
  display: { minHeight: 150, justifyContent: 'flex-end', alignItems: 'flex-end', paddingHorizontal: 2, paddingBottom: 20 },
  displayTopline: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  displayLabel: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 10, fontWeight: '500', letterSpacing: 1 },
  textButton: { paddingVertical: 5, paddingLeft: 8, fontSize: 12, fontWeight: '700' },
  expression: { width: '100%', minHeight: 23, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 15, textAlign: 'right' },
  result: { width: '100%', fontSize: 54, fontWeight: '700', lineHeight: 68, textAlign: 'right' },
  keypad: { gap: 8 },
  keyRow: { flexDirection: 'row', gap: 8 },
  key: { minWidth: 0, flex: 1, aspectRatio: 1.48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 14, elevation: 2 },
  wideKey: { flex: 2, aspectRatio: 2.96 },
  numberKey: {},
  darkKey: { shadowOpacity: 0.5, shadowRadius: 14, elevation: 8 },
  keyPressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  keyText: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 20, fontWeight: '600' },
  numberText: {},
  darkText: { color: '#ffffff' },
  message: { minHeight: 22, marginTop: 8, fontSize: 12, textAlign: 'right' },
  historyPane: { minWidth: 0 },
  historyWide: { width: '34%', padding: 27, borderLeftWidth: 1 },
  historyMobile: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 15, borderTopWidth: 1 },
  historyHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  historyTitle: { marginTop: 7, fontSize: 20, fontWeight: '800' },
  emptyHistory: { paddingVertical: 18, fontSize: 13, lineHeight: 20 },
  historyList: { maxHeight: 360, marginTop: 12 },
  historyEntry: { alignItems: 'flex-end', gap: 5, paddingVertical: 13, borderTopWidth: 1 },
  historyExpression: { maxWidth: '100%', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 11 },
  historyValue: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 17, fontWeight: '500' },
  footer: { marginTop: 15, paddingHorizontal: 5, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 10, fontWeight: '500', letterSpacing: 1, textAlign: 'right' },
});