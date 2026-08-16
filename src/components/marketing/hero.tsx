"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { HeroDemo } from "@/components/marketing/hero-demo";
import { LiquidMesh } from "@/components/motion/backgrounds";
import { RevealItem, RevealGroup } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { Magnetic } from "@/components/motion/magnetic";

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)",
        }}
      />
      <LiquidMesh />

      <div className="relative z-10 mx-auto grid max-w-6xl gap-16 px-6 pb-24 pt-24 sm:pt-32 lg:grid-cols-2 lg:items-center">
        <RevealGroup className="text-center lg:text-left" stagger={0.12}>
          <SplitHeading
            as="h1"
            text={"Stop Guessing.\nStart Growing."}
            className="text-4xl font-light tracking-tight text-[var(--color-text-primary)] sm:text-6xl"
            wordClassName={(i) => (i === 3 ? "text-gradient-signature" : "")}
          />
          <RevealItem>
            <p className="mx-auto mt-6 max-w-xl text-lg text-[var(--color-text-secondary)] lg:mx-0">
              Outrun understands your business, finds your best opportunities, builds
              your growth strategy, and prepares campaigns before you even start
              working.
            </p>
          </RevealItem>
          <RevealItem>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <Magnetic>
                <Link href="/sign-up" className={cn(buttonVariants({ size: "lg" }), "group relative overflow-hidden")}>
                  <span className="relative z-10">Start Now</span>
                  <span
                    aria-hidden
                    className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                  />
                </Link>
              </Magnetic>
              <Magnetic strength={0.15}>
                <a
                  href="#wow-demo"
                  className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
                >
                  Watch Demo
                </a>
              </Magnetic>
            </div>
          </RevealItem>
        </RevealGroup>

        <motion.div
          initial={{ opacity: 0, y: reduceMotion ? 0 : 24, scale: reduceMotion ? 1 : 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            animate={reduceMotion ? undefined : { y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="drop-shadow-[0_0_60px_rgba(110,86,207,0.25)]"
          >
            <HeroDemo />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
