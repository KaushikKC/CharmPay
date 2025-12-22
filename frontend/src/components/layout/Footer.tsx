"use client";

import { motion } from "motion/react";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 mt-20 bg-black">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-7xl mx-auto px-6 py-8"
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-white/60">
            © 2025 CharmPay. Programmable Bitcoin subscriptions.
          </p>
          <div className="flex gap-6 text-sm text-white/60">
            <a href="#" className="hover:text-white transition-colors">
              Docs
            </a>
            <a href="#" className="hover:text-white transition-colors">
              GitHub
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Twitter
            </a>
          </div>
        </div>
      </motion.div>
    </footer>
  );
}

