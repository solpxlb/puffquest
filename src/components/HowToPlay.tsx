import { Gamepad2, Coins, Trophy, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HowToPlay = () => {
  const navigate = useNavigate();
  
  const steps = [
    {
      icon: Gamepad2,
      title: "CONNECT",
      description: "Connect your wallet to enter the PuffQuest ecosystem and begin your journey.",
    },
    {
      icon: Coins,
      title: "EARN PUFFS",
      description: "Complete quests, participate in challenges, and earn PUFF tokens through gameplay.",
    },
    {
      icon: Trophy,
      title: "COMPETE",
      description: "Battle other players, climb the leaderboard, and prove you're the ultimate puffer.",
    },
    {
      icon: Users,
      title: "BUILD",
      description: "Join forces with others, form alliances, and build your smokernomics empire.",
    },
  ];

  return (
    <section className="bg-black py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto">
        {/* Section Title */}
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-white text-4xl sm:text-5xl lg:text-6xl font-bold uppercase mb-4">
            How to Play
          </h2>
          <div className="w-24 h-1 bg-white mx-auto"></div>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-12 lg:mb-16">
          {steps.map((step, index) => (
            <div
              key={index}
              className="bg-gray-700 p-8 rounded-lg text-center hover:bg-gray-600 transition-colors"
            >
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                  <step.icon className="w-10 h-10 text-black" strokeWidth={2} />
                </div>
              </div>

              {/* Title */}
              <h3 className="text-white text-xl sm:text-2xl font-bold uppercase mb-4">
                {step.title}
              </h3>

              {/* Description */}
              <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <div className="text-center">
          <button 
            onClick={() => navigate('/play')}
            className="bg-white text-black hover:bg-gray-200 transition-all px-12 py-4 text-lg sm:text-xl font-bold uppercase tracking-wider"
          >
            Enter the Game
          </button>
        </div>
      </div>
    </section>
  );
};

export default HowToPlay;
