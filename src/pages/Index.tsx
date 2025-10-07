import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";

const Index = () => {
  return <div className="min-h-screen">
      <Navbar />
      
      {/* Hero Section */}
      <section 
        className="relative flex h-screen items-center bg-background bg-contain bg-right bg-no-repeat px-[5vw] md:px-[8vw] max-w-[2000px] mx-auto"
        style={{ backgroundImage: 'url(https://xgisixdxffyvwsfsnjsu.supabase.co/storage/v1/object/public/assets/puffquest_hero.svg)' }}
      >
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent pointer-events-none" />
        
        <div className="relative z-10 max-w-[45%] space-y-[clamp(1rem,2vw,2rem)]">
          <h1 className="text-white font-bold leading-tight" style={{ fontSize: 'clamp(2rem, 4.5vw, 5rem)' }}>
            ENTER THE WORLD OF SMOKERNOMICS
          </h1>
          <p className="text-white" style={{ fontSize: 'clamp(1rem, 1.5vw, 1.5rem)' }}>
            MONEY FOR NOTHING. PUFFS FOR FREE.
          </p>
          <Button 
            size="lg"
            className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-black h-auto"
            style={{ 
              fontSize: 'clamp(1rem, 1.2vw, 1.25rem)',
              padding: 'clamp(0.75rem, 1.5vw, 1.5rem) clamp(2rem, 3vw, 3rem)'
            }}
          >
            START NOW
          </Button>
        </div>
      </section>
    </div>;
};
export default Index;