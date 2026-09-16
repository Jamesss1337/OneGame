import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GamePhase, Item, BoxDef, Rarity,
  L, BOXES, TOOLS, UPGRADES,
  RARITY_COLORS, RARITY_BG, RARITY_GLOW,
  rollItemFromBox, getUpgradePrice,
} from './gameData';
import {
  playBrushSound, playDingSound, playCoinSound,
  playBoxOpenSound, playTapSound, playSuccessSound,
  playClickSound, playPolishSound,
  setSoundEnabled,
} from './sounds';

type Lang = 'ru' | 'en';
type Translations = typeof L.ru;

// ============ GAME STATE ============
interface GameState {
  coins: number;
  totalEarned: number;
  itemsFound: number;
  boxesOpened: number;
  salesCount: number;
  currentTool: number;
  upgradeLevels: Record<string, number>;
  lang: Lang;
  soundOn: boolean;
}

const DEFAULT_STATE: GameState = {
  coins: 100,
  totalEarned: 0,
  itemsFound: 0,
  boxesOpened: 0,
  salesCount: 0,
  currentTool: 0,
  upgradeLevels: { display: 0, helper: 0, reputation: 0, speed: 0 },
  lang: 'ru',
  soundOn: true,
};

function loadState(): GameState {
  try {
    const saved = localStorage.getItem('flea_market_save');
    if (saved) return { ...DEFAULT_STATE, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return { ...DEFAULT_STATE };
}

function saveState(state: GameState) {
  localStorage.setItem('flea_market_save', JSON.stringify(state));
}

// ============ MAIN APP ============
export default function App() {
  const [gs, setGs] = useState<GameState>(loadState);
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [currentBox, setCurrentBox] = useState<BoxDef | null>(null);
  const [currentItem, setCurrentItem] = useState<Item | null>(null);
  const [dirtLevel, setDirtLevel] = useState(100);
  const [boxOpenProgress, setBoxOpenProgress] = useState(0);
  const [sellMultiplier, setSellMultiplier] = useState(1);
  const [showReward, setShowReward] = useState(false);
  const [buyerReaction, setBuyerReaction] = useState<'want' | 'maybe' | 'no'>('want');
  const [notification, setNotification] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const t: Translations = L[gs.lang];
  const lang = gs.lang;

  useEffect(() => { saveState(gs); }, [gs]);
  useEffect(() => { setSoundEnabled(gs.soundOn); }, [gs.soundOn]);

  useEffect(() => {
    const h = () => { setIsPaused(document.hidden); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);

  const showNotif = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2000);
  }, []);

  const upd = useCallback((u: Partial<GameState>) => {
    setGs(prev => ({ ...prev, ...u }));
  }, []);

  const buyBox = useCallback((box: BoxDef) => {
    if (gs.coins < box.price) { showNotif(t.noMoney); playTapSound(); return; }
    playClickSound();
    upd({ coins: gs.coins - box.price });
    setCurrentBox(box);
    setDirtLevel(100);
    setBoxOpenProgress(0);
    setPhase('unbox');
  }, [gs.coins, upd, showNotif, t.noMoney]);

  const openBox = useCallback(() => {
    if (!currentBox) return;
    playBoxOpenSound();
    const item = rollItemFromBox(currentBox, gs.upgradeLevels.reputation);
    setCurrentItem(item);
    setDirtLevel(100);
    upd({ boxesOpened: gs.boxesOpened + 1 });
    setPhase('clean');
  }, [currentBox, gs.upgradeLevels.reputation, gs.boxesOpened, upd]);

  const cleanItem = useCallback((amount: number) => {
    const toolPower = TOOLS[gs.currentTool].cleanPower;
    const speedBonus = 1 + gs.upgradeLevels.speed * 0.15;
    const newDirt = Math.max(0, dirtLevel - amount * toolPower * speedBonus);
    setDirtLevel(newDirt);
    if (newDirt <= 0) {
      playSuccessSound();
      upd({ itemsFound: gs.itemsFound + 1 });
      const r = Math.random();
      setBuyerReaction(r < 0.7 ? 'want' : r < 0.9 ? 'maybe' : 'no');
      setPhase('sell');
    }
  }, [gs.currentTool, gs.upgradeLevels.speed, dirtLevel, gs.itemsFound, upd]);

  const getPrice = useCallback(() => {
    if (!currentItem) return 0;
    const displayBonus = 1 + gs.upgradeLevels.display * 0.2;
    const reactionMult = buyerReaction === 'want' ? 1.2 : buyerReaction === 'maybe' ? 1.0 : 0.7;
    return Math.floor(currentItem.basePrice * displayBonus * reactionMult * sellMultiplier);
  }, [currentItem, gs.upgradeLevels.display, buyerReaction, sellMultiplier]);

  const sellItem = useCallback(() => {
    if (!currentItem) return;
    const price = getPrice();
    playCoinSound();
    const newSales = gs.salesCount + 1;
    upd({ coins: gs.coins + price, totalEarned: gs.totalEarned + price, salesCount: newSales });
    setShowReward(true);
    setSellMultiplier(1);

    const helperLevel = gs.upgradeLevels.helper;
    if (helperLevel > 0) {
      const interval = Math.max(2, 6 - helperLevel);
      if (newSales % interval === 0) {
        setTimeout(() => { showNotif(t.freeBox); upd({ coins: gs.coins + price + BOXES[0].price }); }, 1500);
      }
    }
  }, [currentItem, getPrice, gs, upd, showNotif, t.freeBox]);

  const doubleReward = useCallback(() => {
    const bonus = getPrice();
    upd({ coins: gs.coins + bonus, totalEarned: gs.totalEarned + bonus });
    playCoinSound();
    setShowReward(false);
    setPhase('shop');
  }, [getPrice, gs.coins, gs.totalEarned, upd]);

  const buyUpgrade = useCallback((id: string) => {
    const upg = UPGRADES.find(u => u.id === id);
    if (!upg) return;
    const lvl = gs.upgradeLevels[id] || 0;
    if (lvl >= upg.maxLevel) return;
    const price = getUpgradePrice(upg.basePrice, lvl);
    if (gs.coins < price) { showNotif(t.noMoney); playTapSound(); return; }
    playCoinSound();
    upd({ coins: gs.coins - price, upgradeLevels: { ...gs.upgradeLevels, [id]: lvl + 1 } });
  }, [gs, upd, showNotif, t.noMoney]);

  const buyTool = useCallback((idx: number) => {
    const tool = TOOLS[idx];
    if (gs.coins < tool.price) { showNotif(t.noMoney); playTapSound(); return; }
    playCoinSound();
    upd({ coins: gs.coins - tool.price, currentTool: idx });
  }, [gs.coins, upd, showNotif, t.noMoney]);

  if (isPaused) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl font-bold">⏸️ PAUSE</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-amber-50 to-orange-100 flex flex-col overflow-hidden select-none" style={{ touchAction: 'none' }}>
      <AnimatePresence>
        {notification && (
          <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-6 py-3 rounded-full font-bold shadow-lg">
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {phase !== 'menu' && phase !== 'tutorial' && phase !== 'info' && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-800/90 text-white shrink-0">
          <button onClick={() => { playClickSound(); setPhase('menu'); }} className="text-2xl p-2">←</button>
          <div className="flex items-center gap-2 bg-amber-900/50 rounded-full px-4 py-1">
            <span className="text-xl">🪙</span>
            <span className="font-bold text-lg">{gs.coins.toLocaleString()}</span>
          </div>
          <button onClick={() => { upd({ soundOn: !gs.soundOn }); playClickSound(); }} className="text-2xl p-2">
            {gs.soundOn ? '🔊' : '🔇'}
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden relative">
        <AnimatePresence mode="wait">
          {phase === 'menu' && <MenuScreen key="menu" gs={gs} upd={upd} setPhase={setPhase} />}
          {phase === 'tutorial' && <TutorialScreen key="tutorial" t={t} lang={lang} setPhase={setPhase} />}
          {phase === 'info' && <InfoScreen key="info" t={t} lang={lang} setPhase={setPhase} />}
          {phase === 'shop' && <ShopScreen key="shop" gs={gs} t={t} lang={lang} buyBox={buyBox} setPhase={setPhase} />}
          {phase === 'unbox' && currentBox && (
            <UnboxScreen key="unbox" box={currentBox} progress={boxOpenProgress} setProgress={setBoxOpenProgress} t={t} lang={lang} onOpen={openBox} />
          )}
          {phase === 'clean' && currentItem && (
            <CleanScreen key="clean" item={currentItem} dirtLevel={dirtLevel} t={t} lang={lang} tool={TOOLS[gs.currentTool]} onClean={cleanItem} />
          )}
          {phase === 'sell' && currentItem && (
            <SellScreen key="sell" item={currentItem} buyerReaction={buyerReaction} sellMultiplier={sellMultiplier}
              setSellMultiplier={setSellMultiplier} gs={gs} t={t} lang={lang} price={getPrice()}
              onSell={sellItem} onDouble={doubleReward} showReward={showReward} setShowReward={setShowReward}
              onNext={() => { setShowReward(false); setPhase('shop'); }} />
          )}
          {phase === 'upgrades' && (
            <UpgradesScreen key="upgrades" gs={gs} t={t} lang={lang} buyUpgrade={buyUpgrade} buyTool={buyTool} setPhase={setPhase} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============ MENU ============
function MenuScreen({ gs, upd, setPhase }: { gs: GameState; upd: (u: Partial<GameState>) => void; setPhase: (p: GamePhase) => void }) {
  const t = L[gs.lang];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center gap-6 p-8 w-full h-full">
      <div className="text-center mb-4">
        <motion.div animate={{ rotate: [0, -5, 5, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="text-7xl mb-4">🏺</motion.div>
        <h1 className="text-4xl font-black text-amber-900 drop-shadow-sm">{t.title}</h1>
        <p className="text-xl text-amber-700 font-semibold mt-1">{t.subtitle}</p>
      </div>
      <div className="bg-white/60 rounded-2xl p-4 w-full max-w-xs">
        <div className="flex justify-between text-sm text-amber-800">
          <span>🪙 {gs.coins.toLocaleString()}</span>
          <span>📦 {gs.boxesOpened}</span>
          <span>🔍 {gs.itemsFound}</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <BigBtn emoji="🎮" text={t.play} onClick={() => { playClickSound(); setPhase('shop'); }} primary />
        <BigBtn emoji="⬆️" text={t.upgradesBtn} onClick={() => { playClickSound(); setPhase('upgrades'); }} />
        <BigBtn emoji="❓" text={t.tutorial} onClick={() => { playClickSound(); setPhase('tutorial'); }} />
        <BigBtn emoji="📋" text={t.info} onClick={() => { playClickSound(); setPhase('info'); }} />
      </div>
      <button onClick={() => { playClickSound(); upd({ lang: gs.lang === 'ru' ? 'en' : 'ru' }); }}
        className="mt-4 px-4 py-2 bg-amber-200 rounded-full text-amber-800 font-bold text-sm">
        {t.language}: {gs.lang === 'ru' ? '🇷🇺 Русский' : '🇬🇧 English'}
      </button>
    </motion.div>
  );
}

function BigBtn({ emoji, text, onClick, primary }: { emoji: string; text: string; onClick: () => void; primary?: boolean }) {
  return (
    <motion.button whileTap={{ scale: 0.95 }} onClick={onClick}
      className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-lg shadow-lg ${
        primary ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' : 'bg-white/80 text-amber-900'}`}>
      <span className="text-2xl">{emoji}</span><span>{text}</span>
    </motion.button>
  );
}

// ============ TUTORIAL ============
function TutorialScreen({ t, lang, setPhase }: { t: Translations; lang: Lang; setPhase: (p: GamePhase) => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    { emoji: '📦', text: t.tutorial1, bg: 'from-amber-200 to-amber-300' },
    { emoji: '🧹', text: t.tutorial2, bg: 'from-blue-200 to-blue-300' },
    { emoji: '💰', text: t.tutorial3, bg: 'from-green-200 to-green-300' },
  ];
  return (
    <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
      className="flex flex-col items-center justify-center gap-8 p-8 w-full h-full">
      <motion.div key={step} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className={`bg-gradient-to-br ${steps[step].bg} rounded-3xl p-8 w-full max-w-sm text-center shadow-xl`}>
        <div className="text-8xl mb-6">{steps[step].emoji}</div>
        <p className="text-xl font-bold text-gray-800">{steps[step].text}</p>
        <p className="text-sm text-gray-600 mt-4">{t.step} {step + 1} {t.of} {steps.length}</p>
      </motion.div>
      <div className="flex gap-3">
        {step > 0 && <button onClick={() => { playClickSound(); setStep(step - 1); }}
          className="px-6 py-3 bg-white rounded-xl font-bold text-amber-800 shadow">← {t.back}</button>}
        {step < 2
          ? <button onClick={() => { playClickSound(); setStep(step + 1); }}
              className="px-6 py-3 bg-amber-500 text-white rounded-xl font-bold shadow">{t.next} →</button>
          : <button onClick={() => { playClickSound(); setPhase('menu'); }}
              className="px-6 py-3 bg-green-500 text-white rounded-xl font-bold shadow">✓ {t.play}</button>}
      </div>
    </motion.div>
  );
}

// ============ INFO ============
function InfoScreen({ t, lang, setPhase }: { t: Translations; lang: Lang; setPhase: (p: GamePhase) => void }) {
  const isRu = lang === 'ru';
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-4 p-6 w-full h-full overflow-y-auto">
      <h2 className="text-2xl font-bold text-amber-900 mt-8">{t.info}</h2>
      <div className="bg-white/80 rounded-2xl p-6 w-full max-w-sm text-sm text-gray-700 space-y-3">
        <p>🎮 {isRu ? 'Покупайте коробки на барахолке, очищайте предметы от грязи и продавайте их!' : 'Buy boxes at the flea market, clean items from dirt, and sell them!'}</p>
        <p>📦 {isRu ? 'Чем дороже коробка, тем выше шанс найти редкий предмет.' : 'The more expensive the box, the higher the chance of finding a rare item.'}</p>
        <p>🧹 {isRu ? 'Водите пальцем по экрану, чтобы очистить предметы.' : 'Swipe your finger across the screen to clean items.'}</p>
        <p>⬆️ {isRu ? 'Покупайте улучшения для лучшей прибыли!' : 'Buy upgrades for better profits!'}</p>
        <p>💎 {isRu ? 'Редкость: Обычный → Необычный → Редкий → Эпический → Легендарный' : 'Rarity: Common → Uncommon → Rare → Epic → Legendary'}</p>
      </div>
      <button onClick={() => { playClickSound(); setPhase('menu'); }}
        className="mt-4 px-6 py-3 bg-amber-500 text-white rounded-xl font-bold shadow">{t.close}</button>
    </motion.div>
  );
}

// ============ SHOP ============
function ShopScreen({ gs, t, lang, buyBox, setPhase }: { gs: GameState; t: Translations; lang: Lang; buyBox: (b: BoxDef) => void; setPhase: (p: GamePhase) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-4 p-4 w-full h-full overflow-y-auto">
      <h2 className="text-2xl font-bold text-amber-900 mt-2">{lang === 'ru' ? '🏪 Барахолка' : '🏪 Flea Market'}</h2>
      <p className="text-amber-700 text-sm">{lang === 'ru' ? 'Выберите коробку' : 'Choose a box'}</p>
      <div className="flex flex-col gap-3 w-full max-w-sm">
        {BOXES.map(box => (
          <motion.button key={box.id} whileTap={{ scale: 0.95 }} onClick={() => buyBox(box)}
            className={`flex items-center gap-4 p-4 rounded-2xl shadow-lg border-2 ${
              gs.coins >= box.price ? 'bg-white border-amber-300' : 'bg-gray-100 border-gray-300 opacity-60'}`}>
            <span className="text-5xl">{box.emoji}</span>
            <div className="flex-1 text-left">
              <p className="font-bold text-amber-900">{box.name[lang]}</p>
              <div className="flex gap-1 mt-1">
                {(Object.entries(box.rarityWeights) as [Rarity, number][]).map(([r, w]) =>
                  w > 0 ? <div key={r} className="w-3 h-3 rounded-full" style={{ backgroundColor: RARITY_COLORS[r], opacity: w / 60 }} /> : null
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-lg">🪙</span>
              <span className={`font-bold ${gs.coins >= box.price ? 'text-amber-700' : 'text-red-500'}`}>{box.price}</span>
            </div>
          </motion.button>
        ))}
      </div>
      <button onClick={() => { playClickSound(); setPhase('upgrades'); }}
        className="mt-4 px-6 py-3 bg-purple-500 text-white rounded-xl font-bold shadow-lg">⬆️ {t.upgradesBtn}</button>
    </motion.div>
  );
}

// ============ UNBOX ============
function UnboxScreen({ box, progress, setProgress, t, lang, onOpen }: { box: BoxDef; progress: number; setProgress: (v: number) => void; t: Translations; lang: Lang; onOpen: () => void }) {
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const sndTimer = useRef(0);

  const handleMove = useCallback((cx: number, cy: number) => {
    if (progress >= 100) return;
    if (lastPos.current) {
      const dx = cx - lastPos.current.x;
      const dy = cy - lastPos.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 5) {
        const np = Math.min(100, progress + dist * 0.5);
        setProgress(np);
        const now = Date.now();
        if (now - sndTimer.current > 150) { playBrushSound(); sndTimer.current = now; }
        if (np >= 100) setTimeout(onOpen, 300);
      }
    }
    lastPos.current = { x: cx, y: cy };
  }, [progress, setProgress, onOpen]);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      className="flex flex-col items-center justify-center gap-6 p-6 w-full h-full">
      <h2 className="text-xl font-bold text-amber-900">{t.newBox}</h2>
      <div className="w-full max-w-xs">
        <div className="bg-gray-300 rounded-full h-4 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-center text-sm text-amber-700 mt-2">{t.swipeToClean}</p>
      </div>
      <div className="relative w-64 h-64 flex items-center justify-center cursor-pointer"
        onPointerDown={e => { lastPos.current = { x: e.clientX, y: e.clientY }; playTapSound(); }}
        onPointerMove={e => { if (e.buttons > 0) handleMove(e.clientX, e.clientY); }}
        onPointerUp={() => { lastPos.current = null; }}
        onPointerLeave={() => { lastPos.current = null; }}>
        <motion.div animate={progress > 80 ? { y: -20, rotateX: -30 } : {}} className="text-9xl">{box.emoji}</motion.div>
        <div className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{ background: `rgba(101, 67, 33, ${(100 - progress) / 100 * 0.7})`, mixBlendMode: 'multiply' }} />
        {progress > 70 && (
          <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 0.5 }}
            className="absolute inset-0 flex items-center justify-center text-4xl pointer-events-none">✨</motion.div>
        )}
      </div>
      {progress >= 100 && (
        <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} onClick={onOpen}
          className="px-8 py-4 bg-green-500 text-white rounded-2xl font-bold text-xl shadow-xl">
          {lang === 'ru' ? '🔓 Открыть!' : '🔓 Open!'}
        </motion.button>
      )}
    </motion.div>
  );
}

// ============ CLEAN ============
function CleanScreen({ item, dirtLevel, t, lang, tool, onClean }: { item: Item; dirtLevel: number; t: Translations; lang: Lang; tool: typeof TOOLS[0]; onClean: (a: number) => void }) {
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const sndTimer = useRef(0);

  const handleMove = useCallback((cx: number, cy: number) => {
    if (lastPos.current) {
      const dx = cx - lastPos.current.x;
      const dy = cy - lastPos.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 3) {
        onClean(dist * 0.3);
        const now = Date.now();
        if (now - sndTimer.current > 120) { playPolishSound(); sndTimer.current = now; }
      }
    }
    lastPos.current = { x: cx, y: cy };
  }, [onClean]);

  const cleanPct = 100 - dirtLevel;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center gap-4 p-6 w-full h-full">
      <h2 className="text-xl font-bold text-amber-900">{t.found}</h2>
      <div className="w-full max-w-xs">
        <div className="flex justify-between text-sm text-amber-700 mb-1">
          <span>{t.dirtLayer}</span><span>{Math.round(cleanPct)}%</span>
        </div>
        <div className="bg-gray-300 rounded-full h-4 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all" style={{ width: `${cleanPct}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-2 bg-white/60 rounded-full px-4 py-2">
        <span className="text-2xl">{tool.emoji}</span>
        <span className="text-sm font-bold text-amber-800">{tool.name[lang]}</span>
      </div>
      <div className="relative w-56 h-56 flex items-center justify-center cursor-pointer"
        onPointerDown={e => { lastPos.current = { x: e.clientX, y: e.clientY }; }}
        onPointerMove={e => { if (e.buttons > 0) handleMove(e.clientX, e.clientY); }}
        onPointerUp={() => { lastPos.current = null; }}
        onPointerLeave={() => { lastPos.current = null; }}>
        <div className="text-8xl relative z-10">{item.emoji}</div>
        <div className="absolute inset-4 rounded-full pointer-events-none z-20"
          style={{ background: dirtLevel > 0 ? `radial-gradient(circle, rgba(101,67,33,${dirtLevel / 100 * 0.85}) 0%, rgba(60,40,20,${dirtLevel / 100 * 0.9}) 100%)` : 'transparent' }} />
        {cleanPct > 80 && (
          <motion.div animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute inset-0 rounded-full pointer-events-none z-0"
            style={{ boxShadow: `0 0 40px ${RARITY_COLORS[item.rarity]}` }} />
        )}
        {cleanPct > 50 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white z-30"
            style={{ backgroundColor: RARITY_COLORS[item.rarity] }}>
            {t.rarity[item.rarity]}
          </motion.div>
        )}
      </div>
      <p className="text-amber-700 text-sm">{t.swipeToClean}</p>
    </motion.div>
  );
}

// ============ SELL ============
function SellScreen({ item, buyerReaction, sellMultiplier, setSellMultiplier, gs, t, lang, price, onSell, onDouble, showReward, setShowReward, onNext }: {
  item: Item; buyerReaction: 'want' | 'maybe' | 'no'; sellMultiplier: number; setSellMultiplier: (v: number) => void;
  gs: GameState; t: Translations; lang: Lang; price: number;
  onSell: () => void; onDouble: () => void; showReward: boolean; setShowReward: (v: boolean) => void; onNext: () => void;
}) {
  const buyerEmojis = { want: '😍', maybe: '🤔', no: '😐' };
  const buyerTexts = { want: t.buyerThoughts.want, maybe: t.buyerThoughts.maybe, no: t.buyerThoughts.no };

  if (showReward) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
        className="flex flex-col items-center justify-center gap-6 p-6 w-full h-full">
        <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="text-7xl">🪙</motion.div>
        <h2 className="text-3xl font-black text-amber-900">+{price}</h2>
        <p className="text-amber-700">{t.sold}</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={onDouble}
            className="px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-bold text-lg shadow-lg">
            🎬 {t.x2reward}
          </button>
          <button onClick={onNext} className="px-6 py-3 bg-amber-500 text-white rounded-xl font-bold shadow">{t.next} →</button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center gap-4 p-6 w-full h-full">
      <motion.div initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-col items-center">
        <div className="relative">
          <span className="text-6xl">{buyerEmojis[buyerReaction]}</span>
          <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -top-12 -right-8 bg-white rounded-2xl px-3 py-1 shadow-lg text-sm font-bold text-gray-700 whitespace-nowrap">
            {buyerTexts[buyerReaction]}
            <div className="absolute -bottom-2 left-4 w-4 h-4 bg-white rotate-45" />
          </motion.div>
        </div>
      </motion.div>
      <motion.div className={`relative p-6 rounded-3xl bg-gradient-to-br ${RARITY_BG[item.rarity]} shadow-xl ${RARITY_GLOW[item.rarity]}`}
        animate={{ scale: [1, 1.02, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
        <span className="text-7xl">{item.emoji}</span>
      </motion.div>
      <div className="text-center">
        <h3 className="text-xl font-bold text-amber-900">{item.name[lang]}</h3>
        <div className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white mt-1"
          style={{ backgroundColor: RARITY_COLORS[item.rarity] }}>{t.rarity[item.rarity]}</div>
      </div>
      <div className="flex items-center gap-2 bg-white/80 rounded-2xl px-6 py-3 shadow">
        <span className="text-2xl">🪙</span>
        <span className="text-3xl font-black text-amber-800">{price}</span>
      </div>
      {sellMultiplier === 1 && (
        <button onClick={() => { playClickSound(); setSellMultiplier(2); }}
          className="px-4 py-2 bg-purple-100 text-purple-700 rounded-xl font-bold text-sm">🎬 x2</button>
      )}
      {sellMultiplier === 2 && (
        <div className="px-4 py-2 bg-purple-200 text-purple-800 rounded-xl font-bold text-sm">
          x2 {lang === 'ru' ? 'активно' : 'active'}
        </div>
      )}
      <motion.button whileTap={{ scale: 0.95 }} onClick={() => { playDingSound(); onSell(); }}
        className="px-10 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-bold text-xl shadow-xl">
        💰 {t.sell}
      </motion.button>
    </motion.div>
  );
}

// ============ UPGRADES ============
function UpgradesScreen({ gs, t, lang, buyUpgrade, buyTool, setPhase }: {
  gs: GameState; t: Translations; lang: Lang; buyUpgrade: (id: string) => void; buyTool: (i: number) => void; setPhase: (p: GamePhase) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-4 p-4 w-full h-full overflow-y-auto pb-8">
      <h2 className="text-2xl font-bold text-amber-900 mt-2">⬆️ {t.upgradesBtn}</h2>
      {/* Tools */}
      <div className="w-full max-w-sm">
        <h3 className="text-lg font-bold text-amber-800 mb-2">{lang === 'ru' ? '🔧 Инструменты' : '🔧 Tools'}</h3>
        <div className="flex flex-col gap-2">
          {TOOLS.map((tool, idx) => {
            const owned = idx <= gs.currentTool;
            const canBuy = idx === gs.currentTool + 1;
            return (
              <div key={tool.id} className={`flex items-center gap-3 p-3 rounded-xl ${owned ? 'bg-green-100 border-2 border-green-300' : 'bg-white border-2 border-gray-200'}`}>
                <span className="text-3xl">{tool.emoji}</span>
                <div className="flex-1">
                  <p className="font-bold text-amber-900">{tool.name[lang]}</p>
                  <p className="text-xs text-gray-600">{lang === 'ru' ? 'Сила' : 'Power'}: {'⭐'.repeat(tool.cleanPower)}</p>
                </div>
                {owned && <span className="text-green-600 font-bold text-sm">✓</span>}
                {canBuy && <button onClick={() => buyTool(idx)} className="px-3 py-1 bg-amber-500 text-white rounded-lg font-bold text-sm">🪙 {tool.price}</button>}
                {!owned && !canBuy && <span className="text-gray-400 text-sm">🔒</span>}
              </div>
            );
          })}
        </div>
      </div>
      {/* Upgrades */}
      <div className="w-full max-w-sm">
        <h3 className="text-lg font-bold text-amber-800 mb-2">{lang === 'ru' ? '🏪 Лавка' : '🏪 Shop'}</h3>
        <div className="flex flex-col gap-2">
          {UPGRADES.map(upg => {
            const lvl = gs.upgradeLevels[upg.id] || 0;
            const isMax = lvl >= upg.maxLevel;
            const price = isMax ? 0 : getUpgradePrice(upg.basePrice, lvl);
            const canAfford = gs.coins >= price;
            return (
              <div key={upg.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border-2 border-gray-200">
                <span className="text-3xl">{upg.emoji}</span>
                <div className="flex-1">
                  <p className="font-bold text-amber-900">{upg.name[lang]}</p>
                  <p className="text-xs text-gray-600">{upg.description[lang]}</p>
                  <div className="flex gap-1 mt-1">
                    {Array.from({ length: upg.maxLevel }).map((_, i) => (
                      <div key={i} className={`w-4 h-2 rounded-full ${i < lvl ? 'bg-amber-500' : 'bg-gray-300'}`} />
                    ))}
                  </div>
                </div>
                {isMax
                  ? <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded-lg font-bold text-xs">{t.maxLevel}</span>
                  : <button onClick={() => buyUpgrade(upg.id)}
                      className={`px-3 py-1 rounded-lg font-bold text-sm ${canAfford ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                      🪙 {price}
                    </button>}
              </div>
            );
          })}
        </div>
      </div>
      <button onClick={() => { playClickSound(); setPhase('shop'); }}
        className="mt-2 px-6 py-3 bg-amber-500 text-white rounded-xl font-bold shadow-lg">← {t.back}</button>
    </motion.div>
  );
}
