import { ApiClientError } from './client';

const knownMessages = new Map<string, string>([
  ['missing_session', 'Сессия не найдена. Попробуйте открыть приложение заново.'],
  ['invalid_session', 'Сессия истекла. Попробуйте войти заново.'],
  ['run_invalid_state', 'Состояние рана изменилось. Обновите экран и продолжайте.'],
  ['run_invalid_move', 'Этот ход недоступен. Выберите другую позицию.'],
  ['run_result_unavailable', 'Итог ещё не готов. Попробуйте ещё раз.'],
  ['review_question_mismatch', 'Очередь повторения обновилась. Загружаем актуальную карточку.'],
]);

export function describeError(error: unknown, fallback = 'Что-то пошло не так. Попробуйте ещё раз.') {
  if (error instanceof ApiClientError) {
    return knownMessages.get(error.code ?? '') ?? error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
