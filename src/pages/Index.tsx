import Navbar from "@/components/Navbar";

const Index = () => {
  return <div className="min-h-screen">
      <Navbar />
      
      {/* Hero Section */}
      <section
        className="flex min-h-screen items-center justify-center bg-background bg-cover bg-center md:bg-right bg-no-repeat"
        style={{ backgroundImage: 'url(https://xgisixdxffyvwsfsnjsu.supabase.co/storage/v1/object/public/assets/puffquest_hero.svg)' }}
      >
        
      </section>
    </div>;
};
export default Index;