export function formatTimeShort(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatTimePrecise(ms: number): { main: string; centis: string } {
  const safe = Math.max(0, Math.floor(ms));
  const totalSec = Math.floor(safe / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const centis = Math.floor((safe % 1000) / 10);
  return {
    main: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
    centis: `.${String(centis).padStart(2, '0')}`,
  };
}

export function formatTimeFull(ms: number): string {
  const { main, centis } = formatTimePrecise(ms);
  return `${main}${centis}`;
}
