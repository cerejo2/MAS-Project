// ============================================================
// loop.localStorage.ts
// Camada centralizada de LocalStorage para o projeto Loop
// Compatível com AuthContext.tsx e CartContext.tsx existentes
// ============================================================

import type { CartItem } from "../context/CartContext";

// ─── CHAVES (nunca escrever strings à mão no código) ────────
export const KEYS = {
  // Autenticação / Utilizador
  USER:             "loop_user",
  REGISTERED_USERS: "loop_registered_users",

  // Carrinho (já usado em CartContext.tsx)
  CART:             "loop_cart",

  // Favoritos por utilizador (já usado em AuthContext.tsx)
  favorites: (userId: string) => `loop_favorites_${userId}`,

  // Carteira por utilizador (já usado em AuthContext.tsx)
  wallet: (userId: string) => `loop_wallet_${userId}`,

  // Encomendas confirmadas por utilizador
  orders: (userId: string) => `loop_orders_${userId}`,

  // Dados de entrega do checkout (reutilizados no próximo checkout)
  DELIVERY:         "loop_delivery",

  // Última encomenda confirmada (para página de confirmação)
  LAST_ORDER:       "loop_last_order",

  // Filtros ativos no catálogo (persistir entre navegações)
  CATALOG_FILTERS:  "loop_catalog_filters",
} as const;

// ─── TIPOS ──────────────────────────────────────────────────

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  isAdmin?: boolean;
  isPartner?: boolean;
  dateOfBirth?: string;
}

export interface StoredRegisteredUser extends StoredUser {
  password: string; // apenas na lista de registados, nunca em loop_user
}

export interface WalletData {
  balance: number;
  transactions: WalletTransaction[];
}

export interface WalletTransaction {
  id: string;
  amount: number;
  description: string;
  date: string;        // ISO 8601
  type: "credit" | "debit";
}

export interface FavoriteProduct {
  id: number;
  name: string;
  price: number;
  image: string;
  category: string;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  image: string;
}

export interface Order {
  id: string;                        // ex: "ORD-1748376000000"
  date: string;                      // ISO 8601
  status: "Enviada" | "Em Processamento" | "Entregue";
  total: number;
  items: OrderItem[];
  delivery: DeliveryData;
  paymentMethod: string;
}

export interface DeliveryData {
  fullName: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  shippingMethod: "standard" | "express";
  shippingCost: number;
  estimatedDays: number;
}

export interface CatalogFilters {
  brand: string[];
  condition: string[];
  storage: string[];
  category: string[];
  priceMin: number;
  priceMax: number;
  searchQuery: string;
}

// ─── HELPER GENÉRICO ────────────────────────────────────────

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    console.error(`[Loop LS] Erro ao ler "${key}"`);
    return null;
  }
}

function lsSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.error(`[Loop LS] Erro ao escrever "${key}"`);
  }
}

function lsRemove(key: string): void {
  localStorage.removeItem(key);
}

// ─── UTILIZADOR ─────────────────────────────────────────────

export const UserStorage = {
  /** Devolve o utilizador com sessão ativa (sem password) */
  get: (): StoredUser | null =>
    lsGet<StoredUser>(KEYS.USER),

  /** Guarda utilizador em sessão (sem password) */
  set: (user: StoredUser): void =>
    lsSet(KEYS.USER, user),

  /** Remove sessão (logout) */
  clear: (): void =>
    lsRemove(KEYS.USER),

  /** Devolve todos os utilizadores registados (com password) */
  getRegistered: (): StoredRegisteredUser[] =>
    lsGet<StoredRegisteredUser[]>(KEYS.REGISTERED_USERS) ?? [],

  /** Adiciona um novo utilizador à lista de registados */
  addRegistered: (user: StoredRegisteredUser): void => {
    const list = UserStorage.getRegistered();
    list.push(user);
    lsSet(KEYS.REGISTERED_USERS, list);
  },

  /** Atualiza dados de um utilizador registado (ex: updateProfile) */
  updateRegistered: (userId: string, data: Partial<StoredRegisteredUser>): void => {
    const list = UserStorage.getRegistered();
    const idx = list.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...data };
      lsSet(KEYS.REGISTERED_USERS, list);
    }
  },

  /** Verifica se email já existe (registo) */
  emailExists: (email: string, mockEmails: string[] = []): boolean => {
    const registered = UserStorage.getRegistered().some((u) => u.email === email);
    return registered || mockEmails.includes(email);
  },
};

// ─── CARRINHO ───────────────────────────────────────────────
// Nota: CartContext.tsx já usa loop_cart diretamente.
// Este módulo serve como fonte de verdade para leituras fora do contexto
// (ex: página de confirmação de encomenda sem contexto React disponível).

export const CartStorage = {
  get: (): CartItem[] =>
    lsGet<CartItem[]>(KEYS.CART) ?? [],

  set: (cart: CartItem[]): void =>
    lsSet(KEYS.CART, cart),

  clear: (): void =>
    lsRemove(KEYS.CART),

  /** Total de itens no carrinho */
  count: (): number =>
    CartStorage.get().reduce((n, i) => n + i.quantity, 0),

  /** Valor total do carrinho (produto + garantia) */
  total: (): number =>
    CartStorage.get().reduce(
      (sum, i) => sum + (i.price + i.warrantyPrice) * i.quantity,
      0
    ),
};

// ─── FAVORITOS ──────────────────────────────────────────────

export const FavoritesStorage = {
  get: (userId: string): FavoriteProduct[] =>
    lsGet<FavoriteProduct[]>(KEYS.favorites(userId)) ?? [],

  add: (userId: string, product: FavoriteProduct): void => {
    const list = FavoritesStorage.get(userId);
    if (!list.find((p) => p.id === product.id)) {
      list.push(product);
      lsSet(KEYS.favorites(userId), list);
    }
  },

  remove: (userId: string, productId: number): void => {
    const list = FavoritesStorage.get(userId).filter((p) => p.id !== productId);
    lsSet(KEYS.favorites(userId), list);
  },

  isFavorite: (userId: string, productId: number): boolean =>
    FavoritesStorage.get(userId).some((p) => p.id === productId),
};

// ─── CARTEIRA ───────────────────────────────────────────────

export const WalletStorage = {
  get: (userId: string): WalletData =>
    lsGet<WalletData>(KEYS.wallet(userId)) ?? { balance: 0, transactions: [] },

  set: (userId: string, data: WalletData): void =>
    lsSet(KEYS.wallet(userId), data),

  addTransaction: (userId: string, tx: WalletTransaction): void => {
    const data = WalletStorage.get(userId);
    data.balance += tx.amount;
    data.transactions = [tx, ...data.transactions];
    WalletStorage.set(userId, data);
  },
};

// ─── ENCOMENDAS ─────────────────────────────────────────────

export const OrderStorage = {
  getAll: (userId: string): Order[] =>
    lsGet<Order[]>(KEYS.orders(userId)) ?? [],

  /** Adiciona uma nova encomenda ao histórico do utilizador */
  add: (userId: string, order: Order): void => {
    const list = OrderStorage.getAll(userId);
    list.unshift(order); // mais recente primeiro
    lsSet(KEYS.orders(userId), list);
  },

  /** Guarda a última encomenda (para página de confirmação) */
  setLast: (order: Order): void =>
    lsSet(KEYS.LAST_ORDER, order),

  /** Lê a última encomenda confirmada */
  getLast: (): Order | null =>
    lsGet<Order>(KEYS.LAST_ORDER),

  /** Limpa a última encomenda (após mostrar página de confirmação) */
  clearLast: (): void =>
    lsRemove(KEYS.LAST_ORDER),

  /** Gera um ID de encomenda único */
  generateId: (): string =>
    `ORD-${Date.now()}`,
};

// ─── CHECKOUT / ENTREGA ─────────────────────────────────────

export const DeliveryStorage = {
  get: (): DeliveryData | null =>
    lsGet<DeliveryData>(KEYS.DELIVERY),

  /** Pré-preenche dados de entrega para o próximo checkout */
  set: (data: DeliveryData): void =>
    lsSet(KEYS.DELIVERY, data),

  clear: (): void =>
    lsRemove(KEYS.DELIVERY),
};

// ─── FILTROS DO CATÁLOGO ────────────────────────────────────

const DEFAULT_FILTERS: CatalogFilters = {
  brand:       [],
  condition:   [],
  storage:     [],
  category:    [],
  priceMin:    0,
  priceMax:    9999,
  searchQuery: "",
};

export const FiltersStorage = {
  get: (): CatalogFilters =>
    lsGet<CatalogFilters>(KEYS.CATALOG_FILTERS) ?? DEFAULT_FILTERS,

  set: (filters: CatalogFilters): void =>
    lsSet(KEYS.CATALOG_FILTERS, filters),

  reset: (): void =>
    lsSet(KEYS.CATALOG_FILTERS, DEFAULT_FILTERS),
};

// ─── UTILITÁRIO: CONFIRMAR ENCOMENDA (fluxo completo) ───────
/**
 * Chama esta função no final do checkout (US6).
 * Ela:
 *  1. Cria o objeto Order
 *  2. Guarda no histórico do utilizador
 *  3. Guarda como última encomenda (para confirmação)
 *  4. Limpa o carrinho
 *  5. Limpa os dados de entrega temporários
 */
export function confirmOrder(
  userId: string,
  cartItems: CartItem[],
  delivery: DeliveryData,
  paymentMethod: string
): Order {
  const order: Order = {
    id:     OrderStorage.generateId(),
    date:   new Date().toISOString(),
    status: "Em Processamento",
    total:  CartStorage.total() + delivery.shippingCost,
    items:  cartItems.map((i) => ({
      id:       String(i.id),
      name:     i.name,
      quantity: i.quantity,
      price:    i.price + i.warrantyPrice,
      image:    i.image,
    })),
    delivery,
    paymentMethod,
  };

  OrderStorage.add(userId, order);
  OrderStorage.setLast(order);
  CartStorage.clear();
  DeliveryStorage.clear();

  return order;
}
