"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import {
  ArrowRight,
  Check,
  MessageCircleMore,
  Play,
  RotateCcw,
  Pause,
} from "lucide-react";
import s from "@/app/landing.module.css";

const stages = [
  {
    title: "The conversation",
    text: "A customer asks, chooses, and places an order in Messenger.",
  },
  {
    title: "Your review",
    text: "Assisted extraction prepares the details. You check the catalog, quantities, and fulfillment.",
  },
  {
    title: "One order queue",
    text: "After you confirm, the order joins your queue alongside QR and link orders.",
  },
];

export function OrderJourney() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { amount: 0.15 });

  useEffect(() => {
    if (!playing || !inView || reduced) return;
    const timer = window.setTimeout(() => {
      if (step < 2) setStep(step + 1);
      else setPlaying(false);
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [playing, step, inView, reduced]);

  useEffect(() => {
    const pause = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, []);

  function select(index: number) {
    setPlaying(false);
    setStep(index);
  }

  return (
    <div ref={root} className={s.journey}>
      <div className={s.journeyControls}>
        <div
          className={s.journeySteps}
          role="group"
          aria-label="Example stages"
        >
          {stages.map((stage, index) => (
            <button
              key={stage.title}
              type="button"
              onClick={() => select(index)}
              aria-pressed={step === index}
              className={s.journeyStep}
            >
              <span>{index + 1}</span>
              {stage.title}
            </button>
          ))}
        </div>
        {!reduced && (
          <button
            className={s.playButton}
            type="button"
            onClick={() => {
              if (playing) setPlaying(false);
              else {
                if (step === 2) setStep(0);
                setPlaying(true);
              }
            }}
          >
            {playing ? (
              <Pause size={16} aria-hidden="true" />
            ) : step === 2 ? (
              <RotateCcw size={16} aria-hidden="true" />
            ) : (
              <Play size={16} aria-hidden="true" />
            )}
            {playing
              ? "Pause"
              : step === 2
                ? "Replay example"
                : step > 0
                  ? "Continue example"
                  : "Play example"}
          </button>
        )}
      </div>
      <div className={s.journeyStage}>
        <div className={s.journeyDescription}>
          <span className={s.exampleLabel}>
            Step {step + 1} of {stages.length} · Fictional example
          </span>
          <div className={s.descriptionStates}>
            {stages.map((stage, index) => (
              <div key={stage.title} aria-hidden={step !== index}>
                <h3>{stage.title}</h3>
                <p>{stage.text}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={s.nextStage}
            onClick={() => select((step + 1) % 3)}
          >
            {step === 2 ? "Back to the conversation" : "Next step"}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
        <div className={s.demoViewport} aria-live="polite" aria-atomic="true">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              className={s.demoPaper}
              initial={{ opacity: 0, x: reduced ? 0 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reduced ? 0 : -16 }}
              transition={{
                duration: reduced ? 0 : 0.28,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className={s.demoTopline}>
                <strong>
                  {step === 0
                    ? "Messenger conversation"
                    : step === 1
                      ? "Draft · Needs your review"
                      : "Confirmed order"}
                </strong>
                <MessageCircleMore size={18} aria-hidden="true" />
              </div>
              <div className={s.demoBody}>
                <div className={s.chatBubbles} aria-hidden={step !== 0}>
                  <p className={s.customerBubble}>
                    Hi po! Available pa yung soy candle?
                  </p>
                  <p className={s.storeBubble}>Yes po, available pa.</p>
                  <p className={s.customerBubble}>
                    Sige, 2 candles and 1 gift bag. Pickup po this afternoon.
                  </p>
                </div>
                <div className={s.draftBody} aria-hidden={step === 0}>
                  <div className={s.draftRow}>
                    <span>Soy candle</span>
                    <strong>× 2</strong>
                  </div>
                  <div className={s.draftRow}>
                    <span>Gift bag</span>
                    <strong>× 1</strong>
                  </div>
                  <div className={s.draftFulfillment}>
                    <span>Fulfillment</span>
                    <strong>Pickup</strong>
                  </div>
                  <div className={s.draftReview}>
                    <Check size={17} aria-hidden="true" />
                    {step === 1
                      ? "Check items and prices against your catalog."
                      : "Confirmed by the owner. Ready to prepare."}
                  </div>
                </div>
              </div>
              <div className={s.demoBottom}>
                {step === 0
                  ? "Possible order"
                  : step === 1
                    ? "Owner confirmation required"
                    : "In your store’s order queue"}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
