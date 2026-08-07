import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-10 gap-10">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>

      <div className="flex-1 flex flex-col justify-between gap-10">
        <div className="space-y-1">
          <h1 className="font-display text-4xl leading-none tracking-wide">
            YOU DON&apos;T
            <br />
            JUST SIGN UP.
          </h1>
          <h1 className="font-display text-4xl leading-none tracking-wide text-stamp-red">
            SOMEONE LETS
            <br />
            YOU IN.
          </h1>
          <p className="text-sm text-kraft leading-relaxed max-w-xs pt-4">
            No open registration. Get invited by someone already inside, then
            scan their stamp in person to join.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="w-40 h-40 rounded-full border-2 border-ink/80 flex items-center justify-center -rotate-2">
            <div className="grid grid-cols-5 grid-rows-5 gap-1 w-24 h-24">
              <div className="col-span-2 row-span-2 bg-ink rounded-[2px]" />
              <div className="bg-ink rounded-[2px]" />
              <div className="col-span-2 row-span-2 bg-ink rounded-[2px]" />
              <div className="bg-ink rounded-[2px]" />
              <div className="bg-ink rounded-[2px]" />
              <div className="bg-ink rounded-[2px]" />
              <div className="bg-ink rounded-[2px]" />
              <div className="col-span-2 row-span-2 bg-ink rounded-[2px]" />
              <div className="bg-ink rounded-[2px]" />
              <div className="bg-stamp-red rounded-[2px]" />
              <div className="bg-ink rounded-[2px]" />
              <div className="col-span-2 row-span-2 bg-ink rounded-[2px]" />
            </div>
          </div>
          <p className="font-mono text-[11px] text-kraft tracking-wide">
            every stamp is one-time and unique to who&apos;s giving it
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button className="bg-ink text-btn-on-ink rounded-[2px] py-3.5 text-sm font-medium">
            Scan an invite stamp
          </button>
          <button className="text-kraft font-mono text-xs py-1.5">
            Have a code instead? Enter it manually
          </button>
        </div>
      </div>
    </main>
  );
}
