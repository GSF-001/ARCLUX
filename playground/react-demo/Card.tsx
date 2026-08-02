import { Button } from "./Button";
import { formatPrice } from "./utils";

interface CardProps {
  title: string;
  priceCents: number;
}

export function Card({ title, priceCents }: CardProps) {
  return (
    <div>
      <h3>{title}</h3>
      <p>{formatPrice(priceCents)}</p>
      <Button label="Buy" onClick={() => {}} />
    </div>
  );
}
