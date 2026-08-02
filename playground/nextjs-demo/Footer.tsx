import { formatDate } from "./lib";

export function Footer() {
  return <footer>Published {formatDate(new Date())}</footer>;
}
