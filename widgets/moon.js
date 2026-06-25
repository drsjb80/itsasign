import { createCard, reportWidgetError } from './utils.js';

export const type = 'moon';

const NASA_SVS_BASE = 'https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005587/frames/730x730_1x1_30p/moon.';
const SYNODIC_MONTH_DAYS = 29.53058867;
const REFERENCE_NEW_MOON_JD = 2451550.1; // 2000-01-06 18:14 UTC

export function create(widget) {
  const el = createCard(widget.title || 'Moon');

  const image = document.createElement('img');
  image.className = 'moon-image';
  image.alt = 'Current moon appearance';

  const date = document.createElement('div');
  date.className = 'moon-date';
  date.textContent = 'Loading...';

  const age = document.createElement('div');
  age.className = 'moon-age';
  age.textContent = '';

  const error = document.createElement('div');
  error.className = 'moon-error';
  error.style.display = 'none';

  el.append(image, date, age, error);

  function render() {
    const now = new Date();
    const frameNum = calculateFrameNumber(now);
    const frameStr = String(frameNum).padStart(4, '0');
    const imageUrl = NASA_SVS_BASE + frameStr + '.jpg';

    image.src = imageUrl;
    image.onerror = () => {
      error.textContent = 'Failed to load moon image';
      error.style.display = 'block';
      reportWidgetError({
        widgetType: 'moon',
        message: `Failed to load frame ${frameStr}`,
        target: error
      });
    };

    const dateStr = formatDate(now);
    const moonAge = calculateMoonAge(now);

    date.textContent = dateStr;
    age.textContent = `Age: ${moonAge.toFixed(1)} days`;
    error.style.display = 'none';
  }

  render();
  setInterval(render, Number(widget.refreshMs) || 3600000);

  return el;
}

function calculateFrameNumber(date) {
  // Calculate day of year (1-365/366)
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000)) + 1;

  // Get hour of day (0-23)
  const hour = date.getHours();

  // Frame number = (dayOfYear - 1) × 24 + hour + 1
  // +1 at the end because frames are 1-indexed (0001 not 0000)
  return (dayOfYear - 1) * 24 + hour + 1;
}

function calculateMoonAge(date) {
  const julianDay = (date.getTime() / 86400000) + 2440587.5;
  const phaseDays = positiveModulo(julianDay - REFERENCE_NEW_MOON_JD, SYNODIC_MONTH_DAYS);
  return phaseDays;
}

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`;
}

function positiveModulo(value, mod) {
  const remainder = value % mod;
  return remainder < 0 ? remainder + mod : remainder;
}
