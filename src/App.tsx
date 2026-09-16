import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GamePhase, Item, BoxDef, NPCDef, Rarity,
  L, BOXES, TOOLS, UPGRADES, NPCS,
  RARITY_COLORS, RARITY_BG, RARITY_GLOW,
  rollItemFromBox, getUpgradePrice, rollNPC, getPassiveIncome, getPriceBonusFromRep,
} from './gameData';
import {
  playBrushSound, playDingSound, playCoinSound,
  playBoxOpenSound, playTapSound, playSuccessSound,
  playClickSound, playPolishSound,
  setSoundEnabled,
} from './sounds';
import DirtCanvas from './DirtCanvas';

type Lang = 'ru' | 'en';
type Translations = typeof L.ru;

// ============ GAME STATE ============
interface GameState {
  coins: number;
  totalEarned: number;
  itemsFound: number;
  boxesOpened: number;
  salesCount: number;
  reputation: number;
  currentTool: number;
  upgradeLevels: Record<string, number>;
  lang: Lang;
  soundOn: boolean;
}

const DEFAULT_STATE: GameState = {
  coins: 100,
  totalEarned:0,
  itemsFound: 0,
  boxesOpened: 0,
  salesCount: 0,
  reputation: 0,
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
  const [gs, setGs] = useState<GameState>(loadState());
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [currentBox, setCurrentBox] = useState<BoxDef | null>(null);
  const [currentItem, setCurrentItem] = useState<Item | null>(null);
  const [currentNPC, setCurrentNPC] = useState<NPCDef | null>(null);
  const [npcMood, setNpcMood] = useState<'low' | 'mid' | 'high'>('mid');
  const [showReward, setShowReward] = useState(false);
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

  // Passive income - works everywhere EXCEPT unbox, clean, minigame
  useEffect(() => {
    const activePhases: GamePhase[] = ['unbox', 'clean', 'minigame'];
    if (!activePhases.includes(phase)) {
      const interval = setInterval(() => {
        const income = getPassiveIncome(gs.reputation);
        setGs(prev => ({ ...prev, coins: prev.coins + income, totalEarned: prev.totalEarned + income }));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [phase, gs.reputation]);

  const showNotif = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2000);
  }, []);

  const upd = useCallback((u: Partial<GameState>) => {
    setGs(prev => ({ ...prev, ...u }));
  }, []);

  const buyBox = useCallback((box: BoxDef) => {
    if (gs.reputation < box.requiredRep) {
      showNotif(t.repRequired.replace('{n}', box.requiredRep.toString()));
      playTapSound();
      return;
    }
    if (gs.coins < box.price) { showNotif(t.noMoney); playTapSound(); return; }
    playClickSound();
    upd({ coins: gs.coins - box.price });
    setCurrentBox(box);
    setPhase('unbox');
  }, [gs.coins, gs.reputation, upd, showNotif, t.noMoney, t.repRequired]);

  const openBox = useCallback(() => {
    if (!currentBox) return;
    playBoxOpenSound();
    const item = rollItemFromBox(currentBox, gs.upgradeLevels.reputation);
    setCurrentItem(item);
    upd({ boxesOpened: gs.boxesOpened + 1, itemsFound: gs.itemsFound + 1 });
    setPhase('clean');
  }, [currentBox, gs.upgradeLevels.reputation, gs.boxesOpened, gs.itemsFound, upd]);

  const cleanComplete = useCallback(() => {
    playSuccessSound();
    const npc = rollNPC(gs.reputation);
    setCurrentNPC(npc);
    const moodRoll = Math.random();
    setNpcMood(moodRoll < 0.33 ? 'low' : moodRoll < 0.66 ? 'mid' : 'high');
    setPhase('sell');
  }, [gs.reputation]);

  const sellToNPC = useCallback((priceLevel: 'low' | 'mid' | 'high') => {
    if (!currentItem || !currentNPC) return;
    const basePrice = currentItem.basePrice * getPriceBonusFromRep(gs.reputation);
    const displayBonus = 1 + gs.upgradeLevels.display * 0.2;
    const price = basePrice * displayBonus;

    let multiplier = 1.0;
    if (priceLevel === 'low') multiplier = 1.0;
    else if (priceLevel === 'mid') multiplier = 1.3;
    else multiplier = 1.6;

    const offerPrice = Math.floor(price * multiplier);
    const npcMaxMultiplier = npcMood === 'low' ? 1.0 : npcMood === 'mid' ? 1.4 : 1.8;
    const npcMax = Math.floor(price * npcMaxMultiplier);

    if (offerPrice > npcMax) {
      // Too expensive
      playTapSound();
      showNotif(t.tooExpensive);
      // Try next NPC
      const newNpc = rollNPC(gs.reputation);
      setCurrentNPC(newNpc);
      const moodRoll = Math.random();
      setNpcMood(moodRoll < 0.33 ? 'low' : moodRoll < 0.66 ? 'mid' : 'high');
      return;
    }

    // Deal!
    playCoinSound();
    const finalPrice = Math.floor(offerPrice * currentNPC.priceMultiplier);
    const repChange = currentNPC.repChange;
    upd({
      coins: gs.coins + finalPrice,
      totalEarned: gs.totalEarned + finalPrice,
      reputation: Math.max(0, gs.reputation + repChange),
      salesCount: gs.salesCount + 1,
    });
    setShowReward(true);

    // Check for free box from helper
    const helperLevel = gs.upgradeLevels.helper;
    if (helperLevel > 0) {
      const interval = Math.max(2, 6 - helperLevel);
      if ((gs.salesCount + 1) % interval === 0) {
        setTimeout(() => { showNotif(t.freeBox); upd({ coins: gs.coins + finalPrice + BOXES[0].price }); }, 1500);
      }
    }
  }, [currentItem, currentNPC, gs, npcMood, upd, showNotif, t.tooExpensive, t.freeBox]);

  const scrapItem = useCallback(() => {
    upd({ coins: gs.coins + 5, totalEarned: gs.totalEarned + 5 });
    playCoinSound();
    setPhase('shop');
  }, [gs.coins, gs.totalEarned, upd]);

  const doubleReward = useCallback(() => {
    if (!currentItem || !currentNPC) return;
    const basePrice = currentItem.basePrice * getPriceBonusFromRep(gs.reputation);
    const displayBonus = 1 + gs.upgradeLevels.display * 0.2;
    const bonus = Math.floor(basePrice * displayBonus * currentNPC.priceMultiplier);
    upd({ coins: gs.coins + bonus, totalEarned: gs.totalEarned + bonus });
    playCoinSound();
    setShowReward(false);
    setPhase('shop');
  }, [currentItem, currentNPC, gs, upd]);

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

  const minigameReward = useCallback((earned: number) => {
    upd({ coins: gs.coins + earned, totalEarned: gs.totalEarned + earned });
    playCoinSound();
    setPhase('menu');
  }, [gs.coins, gs.totalEarned, upd]);

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

      {phase !== 'menu' && phase !== 'tutorial' && phase !== 'info' && phase !== 'minigame' && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-800/90 text-white shrink-0">
          <button onClick={() => { playClickSound(); setPhase('menu'); }} className="text-2xl p-2">←</button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-amber-900/50 rounded-full px-3 py-1">
              <span className="text-lg">🪙</span>
              <span className="font-bold">{gs.coins.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1 bg-purple-900/50 rounded-full px-3 py-1">
              <span className="text-lg">⭐</span>
              <span className="font-bold text-sm">{gs.reputation}</span>
            </div>
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
            <UnboxScreen key="unbox" box={currentBox} t={t} lang={lang} onOpen={openBox} />
          )}
          {phase === 'clean' && currentItem && (
            <CleanScreen key="clean" item={currentItem} t={t} lang={lang} onComplete={cleanComplete} />
          )}
          {phase === 'sell' && currentItem && currentNPC && (
            <SellScreen key="sell" item={currentItem} npc={currentNPC} mood={npcMood} gs={gs} t={t} lang={lang}
              onSell={sellToNPC} onDouble={doubleReward} onScrap={scrapItem}
              showReward={showReward} setShowReward={setShowReward}
              onNext={() => { setShowReward(false); setPhase('shop'); }} />
          )}
          {phase === 'upgrades' && (
            <UpgradesScreen key="upgrades" gs={gs} t={t} lang={lang} buyUpgrade={buyUpgrade} buyTool={buyTool} setPhase={setPhase} />
          )}
          {phase === 'minigame' && (
            <MinigameScreen key="minigame" t={t} lang={lang} onComplete={minigameReward} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============ MENU ============
function MenuScreen({ gs, upd, setPhase }: { gs: GameState; upd: (u: Partial<GameState>) => void; setPhase: (p: GamePhase) => void }) {
  const t = L[gs.lang];
  const passiveIncome = getPassiveIncome(gs.reputation);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center gap-4 p-6 w-full h-full overflow-y-auto">
      <div className="text-center mb-2">
        <motion.div animate={{ rotate: [0, -5, 5, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="text-6xl mb-2">🏺</motion.div>
        <h1 className="text-3xl font-black text-amber-900">{t.title}</h1>
        <p className="text-lg text-amber-700 font-semibold">{t.subtitle}</p>
      </div>

      <div className="bg-white/60 rounded-2xl p-4 w-full max-w-xs space-y-2">
        <div className="flex justify-between text-sm text-amber-800">
          <span>🪙 {gs.coins.toLocaleString()}</span>
          <span>📦 {gs.boxesOpened}</span>
          <span>🔍 {gs.itemsFound}</span>
        </div>
        <div className="flex justify-between text-sm text-purple-700">
          <span>⭐ {gs.reputation}</span>
          <span className="text-green-600">+{passiveIncome}/с</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-xs">
        <BigBtn emoji="🎮" text={t.play} onClick={() => { playClickSound(); setPhase('shop'); }} primary />
        <BigBtn emoji="💼" text={t.minigame} onClick={() => { playClickSound(); setPhase('minigame'); }} />
        <BigBtn emoji="⬆️" text={t.upgradesBtn} onClick={() => { playClickSound(); setPhase('upgrades'); }} />
        <BigBtn emoji="❓" text={t.tutorial} onClick={() => { playClickSound(); setPhase('tutorial'); }} />
        <BigBtn emoji="📋" text={t.info} onClick={() => { playClickSound(); setPhase('info'); }} />
      </div>

      <button onClick={() => { playClickSound(); upd({ lang: gs.lang === 'ru' ? 'en' : 'ru' }); }}
        className="mt-2 px-4 py-2 bg-amber-200 rounded-full text-amber-800 font-bold text-sm">
        {t.language}: {gs.lang === 'ru' ? '🇷🇺 Русский' : '🇬🇧 English'}
      </button>
    </motion.div>
  );
}

function BigBtn({ emoji, text, onClick, primary }: { emoji: string; text: string; onClick: () => void; primary?: boolean }) {
  return (
    <motion.button whileTap={{ scale: 0.95 }} onClick={onClick}
      className={`flex items-center gap-3 px-5 py-3 rounded-2xl font-bold text-base shadow-lg ${
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
      <h2 className="text-2xl font-bold text-amber-900 mt-4">{t.info}</h2>
      <div className="bg-white/80 rounded-2xl p-5 w-full max-w-sm text-sm text-gray-700 space-y-2">
        <p>🎮 {isRu ? 'Покупайте коробки, очищайте предметы, торгуйтесь с покупателями!' : 'Buy boxes, clean items, bargain with buyers!'}</p>
        <p>⭐ {isRu ? 'Репутация открывает новые коробки и NPC' : 'Reputation unlocks new boxes and NPCs'}</p>
        <p>🧹 {isRu ? 'Свайпайте по грязи, чтобы очистить предмет' : 'Swipe dirt to clean the item'}</p>
        <p>💼 {isRu ? 'Мини-игра "Подработка" для заработка' : 'Minigame "Side Job" to earn coins'}</p>
        <p>💰 {isRu ? 'Торгуйтесь: низкая/средняя/высокая цена' : 'Bargain: low/medium/high price'}</p>
      </div>
      <button onClick={() => { playClickSound(); setPhase('menu'); }}
        className="mt-2 px-6 py-3 bg-amber-500 text-white rounded-xl font-bold shadow">{t.close}</button>
    </motion.div>
  );
}

// ============ SHOP ============
function ShopScreen({ gs, t, lang, buyBox, setPhase }: { gs: GameState; t: Translations; lang: Lang; buyBox: (b: BoxDef) => void; setPhase: (p: GamePhase) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-3 p-4 w-full h-full overflow-y-auto">
      <h2 className="text-2xl font-bold text-amber-900">{lang === 'ru' ? '🏪 Барахолка' : '🏪 Flea Market'}</h2>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {BOXES.map(box => {
          const locked = gs.reputation < box.requiredRep;
          return (
            <motion.button key={box.id} whileTap={{ scale: 0.95 }} onClick={() => buyBox(box)}
              className={`flex items-center gap-3 p-3 rounded-2xl shadow-lg border-2 ${
                locked ? 'bg-gray-200 border-gray-400 opacity-60' :
                gs.coins >= box.price ? 'bg-white border-amber-300' : 'bg-gray-100 border-gray-300 opacity-70'}`}>
              <span className="text-4xl">{box.emoji}</span>
              <div className="flex-1 text-left">
                <p className="font-bold text-amber-900 text-sm">{box.name[lang]}</p>
                {locked && <p className="text-xs text-red-600">{t.repRequired.replace('{n}', box.requiredRep.toString())}</p>}
                <div className="flex gap-1 mt-1">
                  {(Object.entries(box.rarityWeights) as [Rarity, number][]).map(([r, w]) =>
                    w > 0 ? <div key={r} className="w-2 h-2 rounded-full" style={{ backgroundColor: RARITY_COLORS[r], opacity: w / 60 }} /> : null
                  )}
                </div>
              </div>
              {!locked && (
                <div className="flex items-center gap-1">
                  <span>🪙</span>
                  <span className={`font-bold ${gs.coins >= box.price ? 'text-amber-700' : 'text-red-500'}`}>{box.price}</span>
                </div>
              )}
              {locked && <span className="text-2xl">🔒</span>}
            </motion.button>
          );
        })}
      </div>
      <button onClick={() => { playClickSound(); setPhase('upgrades'); }}
        className="mt-2 px-6 py-3 bg-purple-500 text-white rounded-xl font-bold shadow-lg">⬆️ {t.upgradesBtn}</button>
    </motion.div>
  );
}

// ============ UNBOX (with tape + flaps) ============
function UnboxScreen({ box, t, lang, onOpen }: { box: BoxDef; t: Translations; lang: Lang; onOpen: () => void }) {
  const [tapeTorn, setTapeTorn] = useState(false);
  const [tapeProgress, setTapeProgress] = useState(0);
  const [flaps, setFlaps] = useState([false, false, false, false]); // top, right, bottom, left
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleTapeSwipe = useCallback((cx: number, cy: number) => {
    if (tapeTorn) return;
    if (lastPosRef.current) {
      const dx = cx - lastPosRef.current.x;
      const dy = cy - lastPosRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 5) {
        const newProgress = Math.min(100, tapeProgress + dist * 0.8);
        setTapeProgress(newProgress);
        playBrushSound();
        if (newProgress >= 100) {
          setTapeTorn(true);
          playBoxOpenSound();
        }
      }
    }
    lastPosRef.current = { x: cx, y: cy };
  }, [tapeTorn, tapeProgress]);

  const handleFlapSwipe = useCallback((flapIndex: number, direction: 'up' | 'right' | 'down' | 'left') => {
    if (!tapeTorn || flaps[flapIndex]) return;
    playTapSound();
    const newFlaps = [...flaps];
    newFlaps[flapIndex] = true;
    setFlaps(newFlaps);

    if (newFlaps.every(f => f)) {
      setTimeout(() => onOpen(), 500);
    }
  }, [tapeTorn, flaps, onOpen]);

  const allFlapsOpen = flaps.every(f => f);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      className="flex flex-col items-center justify-center gap-4 p-6 w-full h-full">
      <h2 className="text-xl font-bold text-amber-900">{t.newBox}</h2>

      {!tapeTorn ? (
        <>
          <p className="text-amber-700 text-sm">{t.tearTape}</p>
          <div className="w-full max-w-xs">
            <div className="bg-gray-300 rounded-full h-3 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all" style={{ width: `${tapeProgress}%` }} />
            </div>
          </div>
          <div className="relative w-56 h-56 flex items-center justify-center"
            onPointerDown={e => { lastPosRef.current = { x: e.clientX, y: e.clientY }; }}
            onPointerMove={e => { if (e.buttons > 0) handleTapeSwipe(e.clientX, e.clientY); }}
            onPointerUp={() => { lastPosRef.current = null; }}>
            <span className="text-8xl">{box.emoji}</span>
            {/* Tape overlay */}
            <div className="absolute top-1/2 left-0 right-0 h-8 bg-gray-400/80 -translate-y-1/2 flex items-center justify-center">
              <div className="w-full h-full relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-500 to-transparent"
                  style={{ clipPath: `inset(0 ${100 - tapeProgress}% 0 0)` }} />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                  {t.tape}
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="text-amber-700 text-sm">{t.openAllFlaps}</p>
          <div className="relative w-56 h-56" style={{ perspective: '600px' }}>
            {/* Box base */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-8xl">{box.emoji}</span>
            </div>

            {/* Flaps with proper transform-origin */}
            {/* Top flap - hinges at top edge */}
            <div
              className="absolute top-0 left-1/2 w-24 h-14 cursor-pointer"
              style={{
                transformOrigin: 'center top',
                transform: flaps[0] ? 'rotateX(-130deg)' : 'rotateX(0deg)',
                transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                marginLeft: '-48px',
              }}
              onClick={() => handleFlapSwipe(0, 'up')}
            >
              <div className="w-full h-full bg-amber-700 rounded-t-lg border-2 border-amber-900 flex items-center justify-center text-white font-bold text-lg shadow-md">
                {flaps[0] ? '✓' : '↑'}
              </div>
            </div>

            {/* Right flap - hinges at right edge */}
            <div
              className="absolute top-1/2 right-0 w-14 h-24 cursor-pointer"
              style={{
                transformOrigin: 'right center',
                transform: flaps[1] ? 'rotateY(130deg)' : 'rotateY(0deg)',
                transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                marginTop: '-48px',
              }}
              onClick={() => handleFlapSwipe(1, 'right')}
            >
              <div className="w-full h-full bg-amber-700 rounded-r-lg border-2 border-amber-900 flex items-center justify-center text-white font-bold text-lg shadow-md">
                {flaps[1] ? '✓' : '→'}
              </div>
            </div>

            {/* Bottom flap - hinges at bottom edge */}
            <div
              className="absolute bottom-0 left-1/2 w-24 h-14 cursor-pointer"
              style={{
                transformOrigin: 'center bottom',
                transform: flaps[2] ? 'rotateX(130deg)' : 'rotateX(0deg)',
                transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                marginLeft: '-48px',
              }}
              onClick={() => handleFlapSwipe(2, 'down')}
            >
              <div className="w-full h-full bg-amber-700 rounded-b-lg border-2 border-amber-900 flex items-center justify-center text-white font-bold text-lg shadow-md">
                {flaps[2] ? '✓' : '↓'}
              </div>
            </div>

            {/* Left flap - hinges at left edge */}
            <div
              className="absolute top-1/2 left-0 w-14 h-24 cursor-pointer"
              style={{
                transformOrigin: 'left center',
                transform: flaps[3] ? 'rotateY(-130deg)' : 'rotateY(0deg)',
                transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                marginTop: '-48px',
              }}
              onClick={() => handleFlapSwipe(3, 'left')}
            >
              <div className="w-full h-full bg-amber-700 rounded-l-lg border-2 border-amber-900 flex items-center justify-center text-white font-bold text-lg shadow-md">
                {flaps[3] ? '✓' : '←'}
              </div>
            </div>
          </div>

          {allFlapsOpen && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-4xl">✨</motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}

// ============ CLEAN (Canvas-based) ============
function CleanScreen({ item, t, lang, onComplete }: { item: Item; t: Translations; lang: Lang; onComplete: () => void }) {
  const [cleanPercent, setCleanPercent] = useState(0);
  const [completed, setCompleted] = useState(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClean = (percent: number) => {
    setCleanPercent(percent);
  };

  const handleComplete = useCallback(() => {
    if (!completed) {
      setCompleted(true);
      playDingSound();
      // Auto-transition after 1 second
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      autoTimerRef.current = setTimeout(() => {
        onComplete();
      }, 1000);
    }
  }, [completed, onComplete]);

  // Fallback: if player cleaned 80%+ but algorithm didn't trigger, allow manual finish
  const handleManualComplete = () => {
    if (cleanPercent >= 80 && !completed) {
      handleComplete();
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center gap-3 p-4 w-full h-full">
      <h2 className="text-xl font-bold text-amber-900">{t.found}</h2>

      <div className="w-full max-w-xs">
        <div className="flex justify-between text-sm text-amber-700 mb-1">
          <span>{t.dirtLayer}</span>
          <span>{Math.round(cleanPercent)}%</span>
        </div>
        <div className="bg-gray-300 rounded-full h-4 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
            animate={{ width: `${cleanPercent}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
      </div>

      <div className="relative">
        <DirtCanvas emoji={item.emoji} size={200} onClean={handleClean} onComplete={handleComplete} />
      </div>

      {cleanPercent > 50 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="px-3 py-1 rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: RARITY_COLORS[item.rarity] }}>
          {t.rarity[item.rarity]}
        </motion.div>
      )}

      <p className="text-amber-700 text-sm">{t.swipeToClean}</p>

      {/* Fallback button - appears at 80%+ */}
      {cleanPercent >= 80 && !completed && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleManualComplete}
          className="px-6 py-2 bg-green-500 text-white rounded-xl font-bold text-sm shadow-lg animate-pulse"
        >
          ✓ {lang === 'ru' ? 'Завершить' : 'Finish'}
        </motion.button>
      )}

      {/* Completed state */}
      {completed && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-4xl">✨</motion.div>
      )}
    </motion.div>
  );
}

// ============ SELL (with bargaining) ============
function SellScreen({ item, npc, mood, gs, t, lang, onSell, onDouble, onScrap, showReward, setShowReward, onNext }: {
  item: Item; npc: NPCDef; mood: 'low' | 'mid' | 'high'; gs: GameState; t: Translations; lang: Lang;
  onSell: (level: 'low' | 'mid' | 'high') => void; onDouble: () => void; onScrap: () => void;
  showReward: boolean; setShowReward: (v: boolean) => void; onNext: () => void;
}) {
  const basePrice = Math.floor(item.basePrice * getPriceBonusFromRep(gs.reputation) * (1 + gs.upgradeLevels.display * 0.2));
  const lowPrice = basePrice;
  const midPrice = Math.floor(basePrice * 1.3);
  const highPrice = Math.floor(basePrice * 1.6);

  if (showReward) {
    const finalPrice = Math.floor(basePrice * npc.priceMultiplier);
    return (
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
        className="flex flex-col items-center justify-center gap-6 p-6 w-full h-full">
        <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="text-7xl">🪙</motion.div>
        <h2 className="text-3xl font-black text-amber-900">+{finalPrice}</h2>
        <p className="text-amber-700">{t.sold}</p>
        {npc.repChange !== 0 && (
          <p className={`text-sm font-bold ${npc.repChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {npc.repChange > 0 ? t.repGain.replace('{n}', npc.repChange.toString()) : t.repLoss.replace('{n}', Math.abs(npc.repChange).toString())}
          </p>
        )}
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
      className="flex flex-col items-center justify-center gap-3 p-4 w-full h-full overflow-y-auto">
      {/* NPC */}
      <motion.div initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-col items-center">
        <div className="relative">
          <span className="text-6xl">{npc.emoji}</span>
          <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -top-14 -right-10 bg-white rounded-2xl px-3 py-2 shadow-lg text-xs font-bold text-gray-700 max-w-[140px] text-center">
            {npc.moods[mood][lang]}
            <div className="absolute -bottom-2 left-4 w-4 h-4 bg-white rotate-45" />
          </motion.div>
        </div>
        <p className="text-sm font-bold text-amber-900 mt-1">{npc.name[lang]}</p>
      </motion.div>

      {/* Item */}
      <motion.div className={`relative p-4 rounded-3xl bg-gradient-to-br ${RARITY_BG[item.rarity]} shadow-xl ${RARITY_GLOW[item.rarity]}`}
        animate={{ scale: [1, 1.02, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
        <span className="text-6xl">{item.emoji}</span>
      </motion.div>

      <div className="text-center">
        <h3 className="text-lg font-bold text-amber-900">{item.name[lang]}</h3>
        <div className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white mt-1"
          style={{ backgroundColor: RARITY_COLORS[item.rarity] }}>{t.rarity[item.rarity]}</div>
      </div>

      {/* Price buttons */}
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => { playClickSound(); onSell('low'); }}
          className="px-4 py-3 bg-green-500 text-white rounded-xl font-bold shadow">
          {t.lowPrice} 🪙{lowPrice}
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => { playClickSound(); onSell('mid'); }}
          className="px-4 py-3 bg-blue-500 text-white rounded-xl font-bold shadow">
          {t.midPrice} 🪙{midPrice}
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => { playClickSound(); onSell('high'); }}
          className="px-4 py-3 bg-purple-500 text-white rounded-xl font-bold shadow">
          {t.highPrice} 🪙{highPrice}
        </motion.button>
      </div>

      {/* Scrap button */}
      <button onClick={() => { playClickSound(); onScrap(); }}
        className="px-4 py-2 bg-gray-400 text-white rounded-xl font-bold text-sm shadow">
        🗑️ {t.scrapValue}
      </button>
    </motion.div>
  );
}

// ============ UPGRADES ============
function UpgradesScreen({ gs, t, lang, buyUpgrade, buyTool, setPhase }: {
  gs: GameState; t: Translations; lang: Lang; buyUpgrade: (id: string) => void; buyTool: (i: number) => void; setPhase: (p: GamePhase) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-3 p-4 w-full h-full overflow-y-auto pb-8">
      <h2 className="text-2xl font-bold text-amber-900">⬆️ {t.upgradesBtn}</h2>

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
                  <p className="font-bold text-amber-900 text-sm">{tool.name[lang]}</p>
                  <p className="text-xs text-gray-600">{lang === 'ru' ? 'Сила' : 'Power'}: {'⭐'.repeat(tool.cleanPower)}</p>
                </div>
                {owned && <span className="text-green-600 font-bold">✓</span>}
                {canBuy && <button onClick={() => buyTool(idx)} className="px-3 py-1 bg-amber-500 text-white rounded-lg font-bold text-sm">🪙{tool.price}</button>}
                {!owned && !canBuy && <span className="text-gray-400">🔒</span>}
              </div>
            );
          })}
        </div>
      </div>

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
                  <p className="font-bold text-amber-900 text-sm">{upg.name[lang]}</p>
                  <p className="text-xs text-gray-600">{upg.description[lang]}</p>
                  <div className="flex gap-1 mt-1">
                    {Array.from({ length: upg.maxLevel }).map((_, i) => (
                      <div key={i} className={`w-3 h-2 rounded-full ${i < lvl ? 'bg-amber-500' : 'bg-gray-300'}`} />
                    ))}
                  </div>
                </div>
                {isMax
                  ? <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded-lg font-bold text-xs">{t.maxLevel}</span>
                  : <button onClick={() => buyUpgrade(upg.id)}
                      className={`px-3 py-1 rounded-lg font-bold text-sm ${canAfford ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                      🪙{price}
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

// ============ MINIGAME ============
interface ConveyorItem {
  id: number;
  emoji: string;
  isTrash: boolean;
  x: number;
  tapped: boolean;
}

function MinigameScreen({ t, lang, onComplete }: { t: Translations; lang: Lang; onComplete: (earned: number) => void }) {
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [items, setItems] = useState<ConveyorItem[]>([]);
  const [slowdown, setSlowdown] = useState(false);
  const itemIdRef = useRef(0);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trashEmojis = ['🍎', '👟', '🗑️', '🧦', '📰'];
  const valuableEmojis = ['⌚', '🏺', '💎', '🖼️', '📿'];

  useEffect(() => {
    if (!started) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimeout(() => onComplete(Math.max(0, score)), 500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [started, score, onComplete]);

  useEffect(() => {
    if (!started || timeLeft <= 0) return;

    const spawner = setInterval(() => {
      const isTrash = Math.random() < 0.6;
      const emojis = isTrash ? trashEmojis : valuableEmojis;
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      setItems(prev => [...prev, {
        id: itemIdRef.current++,
        emoji,
        isTrash,
        x: 100,
        tapped: false,
      }]);
    }, 800);

    return () => clearInterval(spawner);
  }, [started, timeLeft]);

  useEffect(() => {
    if (!started || timeLeft <= 0) return;

    const mover = setInterval(() => {
      const speed = slowdown ? 0.8 : 2; // Slower when slowdown active
      setItems(prev => prev
        .map(item => ({ ...item, x: item.x - speed }))
        .filter(item => item.x > -20)
      );
    }, 50);

    return () => clearInterval(mover);
  }, [started, timeLeft, slowdown]);

  const tapItem = (id: number, isTrash: boolean) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, tapped: true } : item));
    if (isTrash) {
      setScore(prev => prev + 1);
      playClickSound();
    } else {
      setScore(prev => prev - 2);
      playTapSound();
    }

    // Slowdown conveyor for 0.2s
    setSlowdown(true);
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    slowTimerRef.current = setTimeout(() => setSlowdown(false), 200);

    setTimeout(() => {
      setItems(prev => prev.filter(item => item.id !== id));
    }, 200);
  };

  if (!started) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="flex flex-col items-center justify-center gap-6 p-6 w-full h-full">
        <h2 className="text-2xl font-bold text-amber-900">💼 {t.minigameTitle}</h2>
        <p className="text-amber-700 text-center">{t.minigameDesc}</p>
        <div className="flex gap-4 text-4xl">
          <span>🍎</span><span>👟</span><span>= ✓</span>
        </div>
        <div className="flex gap-4 text-4xl">
          <span>⌚</span><span>💎</span><span>= ✗</span>
        </div>
        <button onClick={() => { playClickSound(); setStarted(true); }}
          className="px-8 py-4 bg-green-500 text-white rounded-2xl font-bold text-xl shadow-xl">
          {t.minigameStart}
        </button>
      </motion.div>
    );
  }

  if (timeLeft <= 0) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
        className="flex flex-col items-center justify-center gap-6 p-6 w-full h-full">
        <h2 className="text-2xl font-bold text-amber-900">{t.minigameEnd}</h2>
        <div className="text-6xl">🪙</div>
        <p className="text-3xl font-black text-amber-800">+{Math.max(0, score)}</p>
        <p className="text-amber-700">{t.minigameScore}</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-4 p-4 w-full h-full">
      <div className="flex justify-between w-full max-w-sm">
        <div className="bg-amber-100 rounded-full px-4 py-2 font-bold text-amber-800">⏱️ {timeLeft}s</div>
        <div className="bg-green-100 rounded-full px-4 py-2 font-bold text-green-800">🪙 {score}</div>
      </div>

      {/* Conveyor */}
      <div className="relative w-full max-w-sm h-64 bg-gray-200 rounded-2xl overflow-hidden border-4 border-gray-400">
        {/* Conveyor belt lines */}
        <div className="absolute inset-0 flex flex-col justify-around opacity-30">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-1 bg-gray-500" />
          ))}
        </div>

        {/* Items with enlarged hitbox */}
        {items.filter(item => !item.tapped).map(item => (
          <motion.button
            key={item.id}
            className="absolute flex items-center justify-center"
            style={{
              left: `${item.x}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '80px',  // Much larger than emoji
              height: '80px', // Much larger than emoji
            }}
            onClick={() => tapItem(item.id, item.isTrash)}
            whileTap={{ scale: 0.9 }}
          >
            <span className="text-4xl pointer-events-none">{item.emoji}</span>
          </motion.button>
        ))}
      </div>

      <p className="text-amber-700 text-sm text-center">{t.minigameDesc}</p>
    </motion.div>
  );
}
