export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs sm:text-sm text-white/60 text-center md:text-left">
            © 2025 CharmPay. Programmable Bitcoin subscriptions.
          </p>
          <div className="flex gap-4 sm:gap-6 text-xs sm:text-sm text-white/60">
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
      </div>
    </footer>
  );
}

