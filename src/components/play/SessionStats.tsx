import { Clock, Flame, Star } from "lucide-react";

interface SessionStatsProps {
  puffCount: number;
  points: number;
  duration: number; // in seconds
}

export const SessionStats = ({ puffCount, points, duration }: SessionStatsProps) => {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="bg-gray-700 rounded-lg p-6 border-2 border-gray-600 hover:border-gray-500 transition-colors">
      <h3 className="text-white text-xl font-bold uppercase mb-6 border-b-2 border-gray-600 pb-2">
        Session Stats
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
            <Star className="w-6 h-6 text-yellow-500" />
            <span className="text-gray-300 text-sm uppercase">Points</span>
          </div>
          <span className="text-white text-3xl font-bold">{points}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-blue-500" />
            <span className="text-gray-300 text-sm uppercase">Time</span>
          </div>
          <span className="text-white text-2xl font-bold">{formatDuration(duration)}</span>
        </div>
      </div>
    </div>
  );
};
