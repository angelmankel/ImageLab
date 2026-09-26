import { useState } from 'react';
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import { nextRating } from '@/lib/modelLibrary';

/**
 * Five clickable stars. Clicking the current rating again clears it (0 = unrated). Each star is
 * its own button with a 28px hit area, so a thumb can land on one.
 */
export function StarRating({ value, onChange, size = 16 }: { value: number; onChange: (n: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex shrink-0 items-center" role="group" aria-label={`Rating: ${value ? `${value} of 5` : 'unrated'}`}
      onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= shown;
        const Icon = on ? IconStarFilled : IconStar;
        return (
          <button
            key={n}
            type="button"
            className="flex h-7 w-6 items-center justify-center rounded text-[var(--mantine-color-yellow-5)] hover:bg-bg-card-on focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--color-accent)]"
            style={{ opacity: on ? 1 : 0.45 }}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(nextRating(value, n))}
            aria-label={value === n ? `Clear rating (${n} star${n === 1 ? '' : 's'})` : `Rate ${n} star${n === 1 ? '' : 's'}`}
            aria-pressed={n <= value}
            title={value === n ? 'Click again to clear' : `${n} star${n === 1 ? '' : 's'}`}
          >
            <Icon size={size} />
          </button>
        );
      })}
    </div>
  );
}
