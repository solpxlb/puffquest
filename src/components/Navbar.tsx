import { Button } from "@/components/ui/button";

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div className="max-w-[2000px] mx-auto px-[5vw] md:px-[8vw]" style={{ paddingTop: 'clamp(1rem, 2vh, 1.5rem)', paddingBottom: 'clamp(1rem, 2vh, 1.5rem)' }}>
        <div className="flex items-center justify-between">
          {/* Left: Logo/Brand */}
          <div className="text-white font-bold" style={{ fontSize: 'clamp(1.25rem, 1.5vw, 1.75rem)' }}>
            Puff Quest
          </div>

          {/* Center: Navigation Links */}
          <div className="hidden md:flex items-center" style={{ gap: 'clamp(1rem, 2vw, 2rem)' }}>
            <Button variant="ghost" className="text-white hover:text-white/80 hover:bg-white/10" style={{ fontSize: 'clamp(0.875rem, 1vw, 1rem)' }}>
              Home
            </Button>
            <Button variant="ghost" className="text-white hover:text-white/80 hover:bg-white/10" style={{ fontSize: 'clamp(0.875rem, 1vw, 1rem)' }}>
              Play
            </Button>
            <Button variant="ghost" className="text-white hover:text-white/80 hover:bg-white/10" style={{ fontSize: 'clamp(0.875rem, 1vw, 1rem)' }}>
              About
            </Button>
          </div>

          {/* Right: Connect Wallet Button */}
          <Button 
            variant="outline" 
            className="bg-transparent border-white/30 hover:bg-white/10 text-white hover:text-white"
            style={{ fontSize: 'clamp(0.875rem, 1vw, 1rem)' }}
          >
            Connect Wallet
          </Button>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex justify-center gap-4 mt-4">
          <Button variant="ghost" size="sm" className="text-white hover:text-white/80 hover:bg-white/10">
            Home
          </Button>
          <Button variant="ghost" size="sm" className="text-white hover:text-white/80 hover:bg-white/10">
            Play
          </Button>
          <Button variant="ghost" size="sm" className="text-white hover:text-white/80 hover:bg-white/10">
            About
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
