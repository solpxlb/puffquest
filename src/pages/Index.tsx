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
