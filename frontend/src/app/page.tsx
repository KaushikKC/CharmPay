"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import PrismaticBurst from "@/components/ui/PrismaticBurst";
import BlurText from "@/components/ui/BlurText";

export default function Home() {
  return (
    <div className="min-h-screen bg-black relative">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <PrismaticBurst
          animationType="rotate3d"
          intensity={2}
          speed={0.5}
          distort={1.0}
          paused={false}
          offset={{ x: 0, y: 0 }}
          hoverDampness={0.25}
          rayCount={24}
          mixBlendMode="lighten"
          colors={[
            "#00f5ff",
            "#ff00ff",
            "#ff0080",
            "#8b00ff",
            "#00ff88",
          ]}
        />
      </div>

      {/* Hero Section */}
      <section className="relative w-full bg-transparent" style={{ minHeight: "700px" }}>
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 md:py-32">
          <div className="text-center space-y-6">
            <div className="flex flex-col items-center">
              <BlurText
                text="Programmable Bitcoin"
                delay={150}
                animateBy="words"
                direction="top"
                className="text-5xl md:text-7xl font-bold justify-center w-full"
              />
              <BlurText
                text="Subscriptions"
                delay={150}
                animateBy="words"
                direction="top"
                className="text-5xl md:text-7xl font-bold justify-center w-full"
              />
            </div>

            <p className="text-xl text-white/60 max-w-2xl mx-auto font-light">
              Create automated, trustless Bitcoin payment schedules. Lock funds
              once, execute payments automatically.
            </p>

            <div className="pt-6">
              <Link href="/connect">
                <Button
                  variant="primary"
                  className="text-lg px-8 py-4 relative z-10"
                >
                  Launch Application
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
