import type { FloorStackOffset } from './floorStack';

export type FlightLanding = FloorStackOffset;

export function elementForMatchFlight(root: ParentNode | null, flight: { cardId: string; offset: FlightLanding } | null) {
  if (!root || !flight) return null;
  const element = [...root.querySelectorAll<HTMLElement>('[data-card-id]')]
    .find(node => node.dataset.cardId === flight.cardId);
  if (!element) return null;
  return { element, landing: flight.offset };
}

export async function animateCardFlight(
  source: Element | null,
  target: Element | null,
  rotate = -5,
  duration = 280,
  landing?: FlightLanding
) {
  if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) return;
  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const clone = source.cloneNode(true) as HTMLElement;
  clone.classList.add('flying-card');
  Object.assign(clone.style, { left: `${sourceRect.left}px`, top: `${sourceRect.top}px`, width: `${sourceRect.width}px`, height: `${sourceRect.height}px` });
  document.body.append(clone);
  const shiftX = landing ? targetRect.width * landing.x / 100 : 0;
  const shiftY = landing ? targetRect.height * landing.y / 100 : 0;
  const deltaX = targetRect.left + targetRect.width / 2 - sourceRect.left - sourceRect.width / 2;
  const deltaY = targetRect.top + targetRect.height / 2 - sourceRect.top - sourceRect.height / 2;
  const endRotate = landing ? landing.rotate : -rotate / 2;
  const animation = clone.animate([
    { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)' },
    { transform: `translate3d(${deltaX * .55 + shiftX * .35}px,${deltaY * .35 - 34 + shiftY * .2}px,0) rotate(${rotate}deg) scale(1.08)`, offset: .55 },
    { transform: `translate3d(${deltaX + shiftX}px,${deltaY + shiftY}px,0) rotate(${endRotate}deg) scale(.96)` }
  ], { duration, easing: 'cubic-bezier(.2,.75,.18,1)', fill: 'forwards' });
  await animation.finished.catch(() => undefined);
  if (landing) await settleBehindMatch(clone, target, landing);
  else clone.remove();
  target.animate([
    { transform: 'scale(1)', filter: 'brightness(1)' },
    { transform: 'scale(1.025)', filter: 'brightness(1.2)', offset: .34 },
    { transform: 'scale(1)', filter: 'brightness(1)' }
  ], { duration: 170, easing: 'ease-out' });
}

async function settleBehindMatch(clone: HTMLElement, target: HTMLElement, landing: FlightLanding) {
  const parent = target.parentElement;
  if (!parent) { clone.remove(); return; }
  clone.getAnimations().forEach(item => item.cancel());
  clone.classList.remove('flying-card');
  clone.classList.add('landed-behind-card');
  Object.assign(clone.style, {
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    transform: `translate(${landing.x}%, ${landing.y}%) rotate(${landing.rotate}deg)`
  });
  const previousZ = target.style.zIndex;
  target.style.zIndex = '3';
  parent.insertBefore(clone, target);
  await new Promise(resolve => window.setTimeout(resolve, 160));
  clone.remove();
  target.style.zIndex = previousZ;
}

export async function animateCapturedCardTransfers(cardIds: string[], sourceRack: Element | null, targetRack: Element | null) {
  if (!sourceRack || !targetRack) return;
  for (const cardId of cardIds) {
    const source = [...sourceRack.querySelectorAll<HTMLElement>('[data-card-id]')]
      .find(element => element.dataset.cardId === cardId);
    await animateCardFlight(source ?? null, targetRack, -9, 360);
  }
}
