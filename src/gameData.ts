// ============ TYPES ============
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type GamePhase = 'menu' | 'shop' | 'unbox' | 'clean' | 'sell' | 'upgrades' | 'tutorial' | 'info';
export type BoxType = 'cardboard' | 'wooden' | 'safe' | 'pirate_chest';
export type ToolType = 'rag' | 'brush' | 'polisher';

export interface Item {
  id: string;
  name: { ru: string; en: string };
  rarity: Rarity;
  basePrice: number;
  category: string;
  emoji: string;
}

export interface BoxDef {
  id: BoxType;
  name: { ru: string; en: string };
  price: number;
  emoji: string;
  rarityWeights: Record<Rarity, number>;
  possibleItems: string[];
}

export interface ToolDef {
  id: ToolType;
  name: { ru: string; en: string };
  emoji: string;
  cleanPower: number; // 1-3
  price: number;
}

export interface UpgradeDef {
  id: string;
  name: { ru: string; en: string };
  emoji: string;
  description: { ru: string; en: string };
  basePrice: number;
  maxLevel: number;
}

// ============ LOCALIZATION ============
export const L = {
  ru: {
    title: 'Барахолка',
    subtitle: 'Найди Сокровище!',
    play: 'Играть',
    upgradesBtn: 'Улучшения',
    tutorial: 'Как играть',
    info: 'Правила',
    settings: 'Настройки',
    coins: 'Монеты',
    buy: 'Купить',
    clean: 'Очистить',
    sell: 'Продать',
    next: 'Далее',
    back: 'Назад',
    close: 'Закрыть',
    x2reward: 'x2 Монеты!',
    newBox: 'Новая коробка!',
    found: 'Найдено!',
    sold: 'Продано!',
    rarity: {
      common: 'Обычный',
      uncommon: 'Необычный',
      rare: 'Редкий',
      epic: 'Эпический',
      legendary: 'Легендарный',
    },
    tutorial1: 'Покупай загадочные коробки на барахолке',
    tutorial2: 'Очищай предметы от грязи и ржавчины',
    tutorial3: 'Продавай находки покупателям!',
    step: 'Шаг',
    of: 'из',
    boxTypes: {
      cardboard: 'Картонная коробка',
      wooden: 'Деревянный ящик',
      safe: 'Старый сейф',
      pirate_chest: 'Сундук пирата',
    },
    toolNames: {
      rag: 'Тряпка',
      brush: 'Щётка',
      polisher: 'Полировальная машина',
    },
    upgrades: {
      display: { name: 'Витрина', desc: 'Покупатели платят больше' },
      helper: { name: 'Помощник', desc: 'Бесплатная коробка каждые 5 продаж' },
      reputation: { name: 'Репутация', desc: 'Больше редких предметов' },
      speed: { name: 'Мастерство', desc: 'Быстрее очистка' },
    },
    buyerThoughts: {
      want: 'Хочу это!',
      maybe: 'Неплохо...',
      no: 'Не нужно',
    },
    level: 'Ур.',
    price: 'Цена',
    maxLevel: 'МАКС',
    dirtLayer: 'Слой грязи',
    swipeToClean: 'Води пальцем чтобы очистить!',
    tapToOpen: 'Тапай чтобы открыть!',
    locked: 'Заперто!',
    freeBox: 'Бесплатная коробка!',
    noMoney: 'Недостаточно монет!',
    language: 'Язык',
    sound: 'Звук',
    totalEarned: 'Всего заработано',
    itemsFound: 'Предметов найдено',
    boxesOpened: 'Коробок открыто',
  },
  en: {
    title: 'Flea Market',
    subtitle: 'Find the Treasure!',
    play: 'Play',
    upgradesBtn: 'Upgrades',
    tutorial: 'How to Play',
    info: 'Rules',
    settings: 'Settings',
    coins: 'Coins',
    buy: 'Buy',
    clean: 'Clean',
    sell: 'Sell',
    next: 'Next',
    back: 'Back',
    close: 'Close',
    x2reward: 'x2 Coins!',
    newBox: 'New Box!',
    found: 'Found!',
    sold: 'Sold!',
    rarity: {
      common: 'Common',
      uncommon: 'Uncommon',
      rare: 'Rare',
      epic: 'Epic',
      legendary: 'Legendary',
    },
    tutorial1: 'Buy mysterious boxes at the flea market',
    tutorial2: 'Clean items from dirt and rust',
    tutorial3: 'Sell your finds to buyers!',
    step: 'Step',
    of: 'of',
    boxTypes: {
      cardboard: 'Cardboard Box',
      wooden: 'Wooden Crate',
      safe: 'Old Safe',
      pirate_chest: 'Pirate Chest',
    },
    toolNames: {
      rag: 'Rag',
      brush: 'Brush',
      polisher: 'Polishing Machine',
    },
    upgrades: {
      display: { name: 'Display', desc: 'Buyers pay more' },
      helper: { name: 'Helper', desc: 'Free box every 5 sales' },
      reputation: { name: 'Reputation', desc: 'More rare items' },
      speed: { name: 'Mastery', desc: 'Faster cleaning' },
    },
    buyerThoughts: {
      want: 'I want this!',
      maybe: 'Not bad...',
      no: "Don't need it",
    },
    level: 'Lv.',
    price: 'Price',
    maxLevel: 'MAX',
    dirtLayer: 'Dirt Layer',
    swipeToClean: 'Swipe to clean!',
    tapToOpen: 'Tap to open!',
    locked: 'Locked!',
    freeBox: 'Free Box!',
    noMoney: 'Not enough coins!',
    language: 'Language',
    sound: 'Sound',
    totalEarned: 'Total Earned',
    itemsFound: 'Items Found',
    boxesOpened: 'Boxes Opened',
  },
};

// ============ ITEMS ============
export const ITEMS: Item[] = [
  // Common
  { id: 'rusty_nail', name: { ru: 'Ржавый гвоздь', en: 'Rusty Nail' }, rarity: 'common', basePrice: 5, category: 'metal', emoji: '🔩' },
  { id: 'old_button', name: { ru: 'Старая пуговица', en: 'Old Button' }, rarity: 'common', basePrice: 8, category: 'fabric', emoji: '🔘' },
  { id: 'broken_glass', name: { ru: 'Битое стекло', en: 'Broken Glass' }, rarity: 'common', basePrice: 3, category: 'glass', emoji: '💎' },
  { id: 'old_key', name: { ru: 'Старый ключ', en: 'Old Key' }, rarity: 'common', basePrice: 12, category: 'metal', emoji: '🔑' },
  { id: 'dusty_book', name: { ru: 'Пыльная книга', en: 'Dusty Book' }, rarity: 'common', basePrice: 15, category: 'paper', emoji: '📖' },
  { id: 'tin_soldier', name: { ru: 'Оловянный солдатик', en: 'Tin Soldier' }, rarity: 'common', basePrice: 20, category: 'toy', emoji: '🪖' },
  // Uncommon
  { id: 'silver_coin', name: { ru: 'Серебряная монета', en: 'Silver Coin' }, rarity: 'uncommon', basePrice: 50, category: 'metal', emoji: '🪙' },
  { id: 'crystal_vial', name: { ru: 'Хрустальный флакон', en: 'Crystal Vial' }, rarity: 'uncommon', basePrice: 65, category: 'glass', emoji: '🧪' },
  { id: 'silk_scarf', name: { ru: 'Шёлковый шарф', en: 'Silk Scarf' }, rarity: 'uncommon', basePrice: 80, category: 'fabric', emoji: '🧣' },
  { id: 'brass_compass', name: { ru: 'Латунный компас', en: 'Brass Compass' }, rarity: 'uncommon', basePrice: 90, category: 'metal', emoji: '🧭' },
  { id: 'old_watch', name: { ru: 'Старинные часы', en: 'Vintage Watch' }, rarity: 'uncommon', basePrice: 100, category: 'metal', emoji: '⌚' },
  // Rare
  { id: 'gold_ring', name: { ru: 'Золотое кольцо', en: 'Gold Ring' }, rarity: 'rare', basePrice: 200, category: 'metal', emoji: '💍' },
  { id: 'ancient_map', name: { ru: 'Древняя карта', en: 'Ancient Map' }, rarity: 'rare', basePrice: 250, category: 'paper', emoji: '🗺️' },
  { id: 'jade_figurine', name: { ru: 'Нефритовая статуэтка', en: 'Jade Figurine' }, rarity: 'rare', basePrice: 300, category: 'stone', emoji: '🗿' },
  { id: 'pearl_necklace', name: { ru: 'Жемчужное ожерелье', en: 'Pearl Necklace' }, rarity: 'rare', basePrice: 350, category: 'jewelry', emoji: '📿' },
  // Epic
  { id: 'roman_coin', name: { ru: 'Римская монета', en: 'Roman Coin' }, rarity: 'epic', basePrice: 800, category: 'metal', emoji: '🏛️' },
  { id: 'faberge_egg', name: { ru: 'Яйцо Фаберже', en: 'Fabergé Egg' }, rarity: 'epic', basePrice: 1200, category: 'jewelry', emoji: '🥚' },
  { id: 'viking_axe', name: { ru: 'Топор викинга', en: 'Viking Axe' }, rarity: 'epic', basePrice: 1500, category: 'metal', emoji: '🪓' },
  // Legendary
  { id: 'pharaoh_crown', name: { ru: 'Корона фараона', en: "Pharaoh's Crown" }, rarity: 'legendary', basePrice: 5000, category: 'jewelry', emoji: '👑' },
  { id: 'dragon_ruby', name: { ru: 'Рубин дракона', en: 'Dragon Ruby' }, rarity: 'legendary', basePrice: 8000, category: 'stone', emoji: '❤️‍🔥' },
  { id: 'golden_idol', name: { ru: 'Золотой идол', en: 'Golden Idol' }, rarity: 'legendary', basePrice: 10000, category: 'metal', emoji: '🏆' },
];

// ============ BOXES ============
export const BOXES: BoxDef[] = [
  {
    id: 'cardboard',
    name: { ru: 'Картонная коробка', en: 'Cardboard Box' },
    price: 20,
    emoji: '📦',
    rarityWeights: { common: 60, uncommon: 30, rare: 8, epic: 2, legendary: 0 },
    possibleItems: ['rusty_nail', 'old_button', 'broken_glass', 'old_key', 'dusty_book', 'silver_coin', 'old_watch'],
  },
  {
    id: 'wooden',
    name: { ru: 'Деревянный ящик', en: 'Wooden Crate' },
    price: 75,
    emoji: '🪵',
    rarityWeights: { common: 30, uncommon: 45, rare: 20, epic: 5, legendary: 0 },
    possibleItems: ['old_key', 'dusty_book', 'tin_soldier', 'silver_coin', 'crystal_vial', 'silk_scarf', 'brass_compass', 'old_watch', 'gold_ring', 'ancient_map'],
  },
  {
    id: 'safe',
    name: { ru: 'Старый сейф', en: 'Old Safe' },
    price: 250,
    emoji: '🔐',
    rarityWeights: { common: 10, uncommon: 30, rare: 40, epic: 18, legendary: 2 },
    possibleItems: ['brass_compass', 'old_watch', 'gold_ring', 'ancient_map', 'jade_figurine', 'pearl_necklace', 'roman_coin', 'faberge_egg'],
  },
  {
    id: 'pirate_chest',
    name: { ru: 'Сундук пирата', en: 'Pirate Chest' },
    price: 800,
    emoji: '🏴‍☠️',
    rarityWeights: { common: 0, uncommon: 15, rare: 40, epic: 35, legendary: 10 },
    possibleItems: ['jade_figurine', 'pearl_necklace', 'roman_coin', 'faberge_egg', 'viking_axe', 'pharaoh_crown', 'dragon_ruby', 'golden_idol'],
  },
];

// ============ TOOLS ============
export const TOOLS: ToolDef[] = [
  { id: 'rag', name: { ru: 'Тряпка', en: 'Rag' }, emoji: '🧹', cleanPower: 1, price: 0 },
  { id: 'brush', name: { ru: 'Щётка', en: 'Brush' }, emoji: '🪥', cleanPower: 2, price: 200 },
  { id: 'polisher', name: { ru: 'Полировальная машина', en: 'Polishing Machine' }, emoji: '⚙️', cleanPower: 3, price: 800 },
];

// ============ UPGRADES ============
export const UPGRADES: UpgradeDef[] = [
  { id: 'display', name: { ru: 'Витрина', en: 'Display' }, emoji: '🪟', description: { ru: 'Покупатели платят +20% за уровень', en: 'Buyers pay +20% per level' }, basePrice: 100, maxLevel: 10 },
  { id: 'helper', name: { ru: 'Помощник', en: 'Helper' }, emoji: '🧑‍🔧', description: { ru: 'Бесплатная коробка каждые N продаж', en: 'Free box every N sales' }, basePrice: 300, maxLevel: 5 },
  { id: 'reputation', name: { ru: 'Репутация', en: 'Reputation' }, emoji: '⭐', description: { ru: '+10% шанс редких предметов', en: '+10% rare item chance' }, basePrice: 500, maxLevel: 5 },
  { id: 'speed', name: { ru: 'Мастерство', en: 'Mastery' }, emoji: '💪', description: { ru: 'Очистка быстрее на 15%', en: '15% faster cleaning' }, basePrice: 150, maxLevel: 8 },
];

// ============ RARITY COLORS ============
export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#9CA3AF',
  uncommon: '#34D399',
  rare: '#60A5FA',
  epic: '#A78BFA',
  legendary: '#FBBF24',
};

export const RARITY_BG: Record<Rarity, string> = {
  common: 'from-gray-600 to-gray-800',
  uncommon: 'from-emerald-500 to-emerald-700',
  rare: 'from-blue-500 to-blue-700',
  epic: 'from-purple-500 to-purple-700',
  legendary: 'from-amber-400 to-amber-600',
};

export const RARITY_GLOW: Record<Rarity, string> = {
  common: 'shadow-gray-400/50',
  uncommon: 'shadow-emerald-400/50',
  rare: 'shadow-blue-400/50',
  epic: 'shadow-purple-400/50',
  legendary: 'shadow-amber-400/70',
};

// ============ HELPERS ============
export function getItemById(id: string): Item | undefined {
  return ITEMS.find(i => i.id === id);
}

export function getBoxById(id: BoxType): BoxDef | undefined {
  return BOXES.find(b => b.id === id);
}

export function rollItemFromBox(box: BoxDef, reputationLevel: number): Item {
  const weights = { ...box.rarityWeights };
  // Reputation bonus: shift weights towards rarer items
  if (reputationLevel > 0) {
    const bonus = reputationLevel * 5;
    weights.common = Math.max(0, weights.common - bonus);
    weights.uncommon = Math.max(0, weights.uncommon - Math.floor(bonus / 2));
    weights.rare += Math.floor(bonus / 2);
    weights.epic += Math.floor(bonus / 3);
    weights.legendary += Math.floor(bonus / 4);
  }

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  let selectedRarity: Rarity = 'common';

  for (const [rarity, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) {
      selectedRarity = rarity as Rarity;
      break;
    }
  }

  const possibleItems = box.possibleItems
    .map(id => getItemById(id))
    .filter((item): item is Item => item !== undefined && item.rarity === selectedRarity);

  if (possibleItems.length === 0) {
    // Fallback: pick any item from box
    const fallback = box.possibleItems
      .map(id => getItemById(id))
      .filter((item): item is Item => item !== undefined);
    return fallback[Math.floor(Math.random() * fallback.length)];
  }

  return possibleItems[Math.floor(Math.random() * possibleItems.length)];
}

export function getUpgradePrice(basePrice: number, level: number): number {
  return Math.floor(basePrice * Math.pow(1.5, level));
}
