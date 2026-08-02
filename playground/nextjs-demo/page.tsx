import { Header } from "./Header";
import { Footer } from "./Footer";
import { slugify } from "./lib";

export default function Page() {
  const slug = slugify("Hello World");
  return (
    <>
      <Header />
      <main>slug: {slug}</main>
      <Footer />
    </>
  );
}
