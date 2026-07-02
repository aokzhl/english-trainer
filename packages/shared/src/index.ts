export * from './auth'
export * from './courses'

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrLevel = (typeof CEFR_LEVELS)[number]

export const DECKS = ['words', 'phrasal', 'idioms'] as const
export type Deck = (typeof DECKS)[number]

/** Интервалы Лейтнера в днях, индекс = SRS-уровень карточки */
export const SRS_INTERVALS_DAYS = [0, 1, 2, 4, 7, 15, 30] as const
export const SRS_MAX_LEVEL = 6

export const SESSION_SIZE = 15
