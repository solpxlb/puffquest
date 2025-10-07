import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";

const Index = () => {
  return <div className="min-h-screen">
      <Navbar />
      
      {/* Hero Section */}
      <section 
        className="flex min-h-screen items-center justify-start bg-background bg-cover bg-center md:bg-right bg-no-repeat px-4 md:px-16"
        style={{ backgroundImage: 'url(https://xgisixdxffyvwsfsnjsu.supabase.co/storage/v1/object/public/assets/puffquest_hero.svg)' }}
      >
        <div className="max-w-2xl space-y-6">
          <h1 className="text-white text-4xl md:text-6xl lg:text-7xl font-bold leading-tight">
            ENTER THE WORLD OF SMOKERNOMICS
          </h1>
          <p className="text-white text-lg md:text-xl">
            MONEY FOR NOTHING. PUFFS FOR FREE.
          </p>
          <Button 
            size="lg"
            className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-black text-lg px-12 py-6 h-auto"
          >
            START NOW
          </Button>
        </div>
      </section>
    </div>;
};
export default Index;