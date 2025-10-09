import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@solana/wallet-adapter-react";

interface Session {
  id: string;
  started_at: string;
  puff_count: number;
  points_earned: number;
  duration_seconds: number | null;
}

export const SessionsTable = () => {
  const { publicKey } = useWallet();
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!publicKey) return;

      const { data: sessionsData } = await supabase
        .from("puff_sessions")
        .select("id, started_at, duration_seconds, puff_count, points_earned")
        .eq("user_id", publicKey.toString())
        .order("started_at", { ascending: false })
        .limit(10);

      if (!sessionsData) return;

      setSessions(sessionsData.map(session => ({
        id: session.id,
        started_at: session.started_at,
        puff_count: session.puff_count,
        points_earned: session.points_earned,
        duration_seconds: session.duration_seconds,
      })));
    };

    fetchSessions();
  }, [publicKey]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };

  return (
    <div className="bg-gray-800 rounded-lg border-2 border-gray-700 overflow-hidden">
      <div className="p-6 border-b-2 border-gray-700">
        <h3 className="text-white text-xl font-bold uppercase">Recent Sessions</h3>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-900">
              <th className="text-left text-gray-400 text-xs uppercase font-bold p-4">Date</th>
              <th className="text-left text-gray-400 text-xs uppercase font-bold p-4">Puffs</th>
              <th className="text-left text-gray-400 text-xs uppercase font-bold p-4">Points</th>
              <th className="text-left text-gray-400 text-xs uppercase font-bold p-4">Duration</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-gray-500 p-8">
                  No sessions yet. Start tracking to see your history!
                </td>
              </tr>
            ) : (
              sessions.map((session, index) => (
                <tr
                  key={session.id}
                  className={`hover:bg-gray-700 transition-colors ${
                    index % 2 === 0 ? "bg-gray-800/50" : "bg-gray-800"
                  }`}
                >
                  <td className="text-white p-4">{formatDate(session.started_at)}</td>
                  <td className="text-white p-4 font-bold">{session.puff_count}</td>
                  <td className="text-white p-4 font-bold">{session.points_earned}</td>
                  <td className="text-white p-4">{formatDuration(session.duration_seconds)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-gray-700">
        {sessions.length === 0 ? (
          <div className="text-center text-gray-500 p-8">
            No sessions yet. Start tracking to see your history!
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="p-4 hover:bg-gray-700 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className="text-white font-bold">{formatDate(session.started_at)}</span>
                <span className="text-gray-400 text-sm">{formatDuration(session.duration_seconds)}</span>
              </div>
              <div className="flex gap-4">
                <div>
                  <span className="text-gray-400 text-xs uppercase">Puffs</span>
                  <p className="text-white text-xl font-bold">{session.puff_count}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs uppercase">Points</span>
                  <p className="text-white text-xl font-bold">{session.points_earned}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
