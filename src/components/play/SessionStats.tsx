import { Clock, Flame, Coins, Zap } from "lucide-react";

interface SessionStatsProps {
  puffCount: number;
  smoke: number;
  duration: number; // in seconds
  smokePerPuff?: number;
  multiplier?: number;
}

export const SessionStats = ({ puffCount, smoke, duration, smokePerPuff = 20, multiplier = 1 }: SessionStatsProps) => {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="bg-gray-700 rounded-lg p-6 border-2 border-gray-600 hover:border-gray-500 transition-colors">
      <h3 className="text-white text-xl font-bold uppercase mb-6 border-b-2 border-gray-600 pb-2">
        Session Stats (demo mode)
      </h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Flame className="w-6 h-6 text-orange-500" />
            <span className="text-gray-300 text-sm uppercase">Puffs</span>
          </div>
          <span className="text-white text-3xl font-bold">{puffCount}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Coins className="w-6 h-6 text-orange-500" />
            <span className="text-gray-300 text-sm uppercase">$SMOKE Earned</span>
          </div>
          <span className="text-orange-400 text-3xl font-bold">{smoke.toFixed(2)}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-blue-500" />
            <span className="text-gray-300 text-sm uppercase">Time</span>
          </div>
          <span className="text-white text-2xl font-bold">{formatDuration(duration)}</span>
        </div>

        <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-600">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-purple-500" />
            <span className="text-gray-300 text-xs uppercase">$SMOKE/Puff</span>
          </div>
          <div className="text-right">
            <span className="text-white text-xl font-bold">{smokePerPuff}</span>
            {multiplier > 1 && (
              <span className="ml-2 text-purple-400 text-sm">×{multiplier}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};