import Navbar from "@/components/Navbar";
import HowToPlay from "@/components/HowToPlay";
import Footer from "@/components/Footer";
import { useNavigate } from "react-router-dom";
import { Twitter } from "lucide-react";


const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <Navbar />
      {/* Hero Section */}
      <section 
        className="relative flex min-h-screen items-center justify-center bg-background bg-cover bg-center bg-no-repeat px-4 sm:px-6 lg:px-8"
        style={{ backgroundImage: 'url(https://xgisixdxffyvwsfsnjsu.supabase.co/storage/v1/object/public/assets/puffquest_hero_bg.svg)' }}
      >
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Content */}
            <div className="text-left space-y-6 lg:space-y-8 z-10">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/30 rounded-full px-4 py-2 backdrop-blur-sm">
                <span className="text-white text-sm sm:text-base font-semibold uppercase tracking-wide">
                  BETA
                </span>
                <span className="text-white/60">•</span>
                <span className="text-white/90 text-xs sm:text-sm">
                  Live on Solana Devnet
                </span>
              </div>
              <h1 className="text-white text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight uppercase">
                Enter the World of<br />Smokernomics
              </h1>
              <p className="text-white text-lg sm:text-xl lg:text-2xl font-medium">
                Money for nothing. Puffs for free.
              </p>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate('/play')}
                  className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-black transition-all px-8 py-3 text-lg sm:text-xl font-bold uppercase tracking-wider"
                >
                  Start Now
                </button>
                <a
                  href="https://x.com/puffquest"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-black transition-all p-3 flex items-center justify-center"
                  aria-label="Follow us on X"
                >
                  <Twitter className="w-6 h-6 sm:w-7 sm:h-7" />
                </a>
                <a
                  href="https://discord.gg/puffquest"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-black transition-all p-3 flex items-center justify-center"
                  aria-label="Join our Discord"
                >
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Right Character Image */}
            <div className="flex justify-center lg:justify-end z-10">
              <img 
                src="https://xgisixdxffyvwsfsnjsu.supabase.co/storage/v1/object/public/assets/puffquest_hero_char.svg" 
                alt="Puff Quest Character"
                className="w-full max-w-md lg:max-w-lg xl:max-w-xl h-auto object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How to Play Section */}
      <HowToPlay />

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Index;
