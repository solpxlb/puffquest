import { Button } from "@/components/ui/button";

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Logo/Brand */}
          <div className="text-white text-xl md:text-2xl font-bold">
            Puff Quest
          </div>

          {/* Center: Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <Button variant="ghost" className="text-white hover:text-white/80 hover:bg-white/10">
              Home
            </Button>
            <Button variant="ghost" className="text-white hover:text-white/80 hover:bg-white/10">
              Play
            </Button>
            <Button variant="ghost" className="text-white hover:text-white/80 hover:bg-white/10">
              About
            </Button>
          </div>

          {/* Right: Connect Wallet Button */}
          <Button 
            variant="outline" 
            className="bg-transparent border-white/30 hover:bg-white/10 text-white hover:text-white"
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
