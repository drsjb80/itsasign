import { createCard } from './utils.js';

export const type = 'moon';

const SYNODIC_MONTH_DAYS = 29.53058867;
const REFERENCE_NEW_MOON_JD = 2451550.1; // 2000-01-06 18:14 UTC

export function create(widget) {
  const el = createCard(widget.title || 'Moon');

  const image = document.createElement('img');
  image.className = 'moon-image';
  image.alt = 'Current moon phase icon';

  const phaseName = document.createElement('div');
  phaseName.className = 'moon-phase-name';
  phaseName.textContent = 'Loading moon phase...';

  const age = document.createElement('div');
  age.className = 'moon-age';
  age.textContent = '-- days old';

  el.append(image, phaseName, age);

  function render() {
    const now = new Date();
    const phase = calculateMoonPhase(now);
    const details = phaseDetails(phase.ageDays);

    image.src = details.imageUrl;
    image.alt = details.name;
    phaseName.textContent = details.name;
    age.textContent = `${phase.ageDays.toFixed(1)} days old`;
  }

  render();
  setInterval(render, Number(widget.refreshMs) || 3600000);

  return el;
}

function calculateMoonPhase(date) {
  const julianDay = (date.getTime() / 86400000) + 2440587.5;
  const phaseDays = positiveModulo(julianDay - REFERENCE_NEW_MOON_JD, SYNODIC_MONTH_DAYS);
  const fraction = phaseDays / SYNODIC_MONTH_DAYS;

  return {
    ageDays: phaseDays,
    fraction
  };
}

function phaseDetails(ageDays) {
  const dayIndex = Math.min(Math.round(ageDays), 28);
  const padded = String(dayIndex).padStart(2, '0');
  const imageUrl = `./images/moon-${padded}.jpg`;

  const fraction = ageDays / SYNODIC_MONTH_DAYS;
  let name;
  if (fraction < 0.0625 || fraction >= 0.9375) name = 'New Moon';
  else if (fraction < 0.1875) name = 'Waxing Crescent';
  else if (fraction < 0.3125) name = 'First Quarter';
  else if (fraction < 0.4375) name = 'Waxing Gibbous';
  else if (fraction < 0.5625) name = 'Full Moon';
  else if (fraction < 0.6875) name = 'Waning Gibbous';
  else if (fraction < 0.8125) name = 'Last Quarter';
  else name = 'Waning Crescent';

  return { name, imageUrl };
}

function positiveModulo(value, mod) {
  const remainder = value % mod;
  return remainder < 0 ? remainder + mod : remainder;
}
