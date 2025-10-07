import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useSolanaAuth } from "@/hooks/useSolanaAuth";

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { setVisible } = useWalletModal();
  const { user, session, connected, publicKey, signIn, signOut, isAuthenticating } = useSolanaAuth();

  const isAuthenticated = !!user && !!session;

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Play", href: "/play" },
    { name: "About", href: "#" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo - Left */}
          <div className="flex-shrink-0">
            <h1 className="text-white text-xl sm:text-2xl font-bold tracking-wider">
              Puff Quest
            </h1>
          </div>

          {/* Desktop Navigation - Center */}
          <div className="hidden md:flex items-center justify-center flex-1">
            <div className="flex items-center space-x-8">
              {navLinks.map((link) =>
                link.href.startsWith("#") ? (
                  <a
                    key={link.name}
                    href={link.href}
                    className="text-white hover:text-white/80 transition-colors text-base lg:text-lg font-medium"
                  >
                    {link.name}
                  </a>
                ) : (
                  <Link
                    key={link.name}
                    to={link.href}
                    className="text-white hover:text-white/80 transition-colors text-base lg:text-lg font-medium"
                  >
                    {link.name}
                  </Link>
                )
              )}
            </div>
          </div>

          {/* Connect Wallet Button - Right (Desktop) */}
          <div className="hidden md:flex items-center">
            {!connected ? (
              <Button
                onClick={() => setVisible(true)}
                variant="outline"
                className="bg-transparent border-2 border-white text-white hover:bg-white/10 hover:text-white hover:border-white transition-all px-6 py-2 text-base"
              >
                Connect Wallet
              </Button>
            ) : !isAuthenticated ? (
              <Button
                onClick={signIn}
                disabled={isAuthenticating}
                variant="outline"
                className="bg-transparent border-2 border-white text-white hover:bg-white/10 hover:text-white hover:border-white transition-all px-6 py-2 text-base"
              >
                {isAuthenticating ? "Signing..." : "Sign In"}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-white text-sm">
                  {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                </span>
                <Button
                  onClick={signOut}
                  variant="outline"
                  className="bg-transparent border-2 border-white text-white hover:bg-white/10 hover:text-white hover:border-white transition-all px-6 py-2 text-base"
                >
                  Disconnect
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-white hover:text-white/80 transition-colors p-2"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-black/90 backdrop-blur-sm rounded-lg mt-2 py-4 px-4">
            <div className="flex flex-col space-y-4">
              {navLinks.map((link) =>
                link.href.startsWith("#") ? (
                  <a
                    key={link.name}
                    href={link.href}
                    className="text-white hover:text-white/80 transition-colors text-base font-medium py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.name}
                  </a>
                ) : (
                  <Link
                    key={link.name}
                    to={link.href}
                    className="text-white hover:text-white/80 transition-colors text-base font-medium py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.name}
                  </Link>
                )
              )}
              {!connected ? (
                <Button
                  onClick={() => setVisible(true)}
                  variant="outline"
                  className="bg-transparent border-2 border-white text-white hover:bg-white/10 hover:text-white hover:border-white transition-all w-full mt-2"
                >
                  Connect Wallet
                </Button>
              ) : !isAuthenticated ? (
                <Button
                  onClick={signIn}
                  disabled={isAuthenticating}
                  variant="outline"
                  className="bg-transparent border-2 border-white text-white hover:bg-white/10 hover:text-white hover:border-white transition-all w-full mt-2"
                >
                  {isAuthenticating ? "Signing..." : "Sign In"}
                </Button>
              ) : (
                <div className="flex flex-col gap-2 mt-2">
                  <span className="text-white text-sm text-center">
                    {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                  </span>
                  <Button
                    onClick={signOut}
                    variant="outline"
                    className="bg-transparent border-2 border-white text-white hover:bg-white/10 hover:text-white hover:border-white transition-all w-full"
                  >
                    Disconnect
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
