import { Card } from "./Card";
import { truncate } from "./utils";

export function App() {
  return (
    <div>
      <Card title={truncate("Widget Pro Max", 10)} priceCents={999} />
    </div>
  );
}
