"use client";

import { motion, useReducedMotion } from "framer-motion";

// docs/outrun/01 — headline text splits word-by-word and rises in with a
// slight blur-to-focus, rather than fading in as a single block. Used for
// every section H2/H1 so the copy itself feels alive, not just the
// decoration around it.
export function SplitHeading({
  text,
  as: Tag = "h2",
  className = "",
  wordClassName = "",
  delay = 0,
}: {
  /** Use "\n" for an explicit line break between stacked lines. */
  text: string;
  as?: "h1" | "h2" | "h3";
  className?: string;
  /** Called with the word's flat index across the whole heading, so a
   * specific word can be targeted (e.g. `(i) => i === 3 ? "text-gradient-signature" : ""`). */
  wordClassName?: string | ((flatIndex: number) => string);
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  const lines = text.split("\n").map((line) => line.split(" "));
  const lineStartIndex = lines.reduce<number[]>((acc, words, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1]! + lines[i - 1]!.length);
    return acc;
  }, []);

  return (
    <Tag className={className}>
      <motion.span
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: delay } } }}
      >
        {lines.map((words, lineI) => (
          <span className="block" key={lineI}>
            {words.map((word, i) => {
              const flatIndex = lineStartIndex[lineI]! + i;
              const wc = typeof wordClassName === "function" ? wordClassName(flatIndex) : wordClassName;
              return (
                // A literal space (not just a margin) between each animated
                // word span — without it, the rendered text content has no
                // whitespace between words at all ("StopGuessing." instead
                // of "Stop Guessing."), which is wrong for screen readers,
                // copy-paste, and anything else reading the real text.
                <span key={i}>
                  <motion.span
                    className={`inline-block ${wc}`}
                    variants={{
                      hidden: { opacity: 0, y: reduceMotion ? 0 : 16, filter: reduceMotion ? "none" : "blur(6px)" },
                      show: {
                        opacity: 1,
                        y: 0,
                        filter: "blur(0px)",
                        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
                      },
                    }}
                  >
                    {word}
                  </motion.span>
                  {i < words.length - 1 ? " " : ""}
                </span>
              );
            })}
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}
