import { floorStackBehindOffset } from '../lib/floorStack';
import HwatuCard from './HwatuCard';

export default function FloorCardStack({ cardIds }: { cardIds: string[] }) {
  return <span className="floor-card-stack">
    {cardIds.map((cardId, index) => {
      const behind = index > 0 ? floorStackBehindOffset(index) : null;
      return <span
        className={`floor-card-position${behind ? ' stacked-behind' : ''}`}
        key={cardId}
        style={behind
          ? { transform: `translate(${behind.x}%, ${behind.y}%) rotate(${behind.rotate}deg)`, zIndex: 1 }
          : { zIndex: 3 }}
      >
        <HwatuCard cardId={cardId} />
      </span>;
    })}
  </span>;
}
