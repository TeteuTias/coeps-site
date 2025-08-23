/**
 * @abstract usado para ver se a data de hoje está entre uma data de início e uma data de fim
 * @param startDate Data de início
 * @param endDate Data de fim
 * @returns Retorna true se data de hoje estiver dentro de intervalo de início e fim, caso contrário, retorna false
 */
export function isTodayBetweenDates(startDate, endDate, timezoneOffset = -3) {

  // Pega a data de hoje e ajusta para o fuso horário de Brasília
  const todayUTC = new Date();
  const todayBrazil = new Date(
    todayUTC.getUTCFullYear(),
    todayUTC.getUTCMonth(),
    todayUTC.getUTCDate(),
    todayUTC.getUTCHours() + timezoneOffset,
    todayUTC.getUTCMinutes(),
    todayUTC.getUTCSeconds()
  );

  todayBrazil.setHours(0, 0, 0, 0);

  // Cria as datas de início e fim. O JS já entende o fuso `-03:00`
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Compara os timestamps UTC para garantir precisão
  return todayBrazil.getTime() >= start.getTime() && todayBrazil.getTime() <= end.getTime();
}
