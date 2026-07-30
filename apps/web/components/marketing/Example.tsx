export function Example() {
  return (
    <section className="border-t px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-lg border bg-zinc-950 text-zinc-100 shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-zinc-800 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          </div>
          <pre className="overflow-x-auto p-5 text-sm leading-relaxed">
            <code>{`$ aries analyze .

1,204 files · 312 modules · 847ms

3 circular deps
12 unused exports
3 layer violations

Run \`aries impact src/api/client.ts\` to trace its consumers.`}</code>
          </pre>
        </div>
      </div>
    </section>
  )
}
