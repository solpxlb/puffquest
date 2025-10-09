import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, Play, Square } from "lucide-react";
import { usePuffDetection } from "@/hooks/usePuffDetection";
import type { PuffAnalysis } from "@/lib/MediaPipeSetup";

interface CameraTrackerProps {
  onPuffDetected: (analysis: PuffAnalysis) => void;
  isActive: boolean;
  onStartSession: () => void;
  onEndSession: () => void;
}

export const CameraTracker = ({
  onPuffDetected,
  isActive,
  onStartSession,
  onEndSession,
}: CameraTrackerProps) => {
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraInitializing, setCameraInitializing] = useState(false);
  const [error, setError] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // AI Puff Detection Hook
  usePuffDetection({
    videoRef,
    canvasRef,
    isActive,
    onPuffDetected,
  });

  const enableCamera = async () => {
    setCameraInitializing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Small delay to let video element process the stream
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Ensure video starts playing
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.warn("Video autoplay blocked:", playError);
        }
        
        setCameraEnabled(true);
        setError("");
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Unable to access camera. Please grant camera permissions.");
      throw err;
    } finally {
      setCameraInitializing(false);
    }
  };

  const disableCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraEnabled(false);
  };

  useEffect(() => {
    return () => {
      disableCamera();
    };
  }, []);

  const handleStartTracking = async () => {
    if (!cameraEnabled) {
      try {
        await enableCamera();
      } catch (err) {
        return;
      }
    }
    onStartSession();
  };

  const handleStopTracking = () => {
    onEndSession();
    disableCamera();
  };

  return (
    <div className="relative overflow-hidden rounded-lg border-2 border-white bg-gray-900/50 backdrop-blur-sm">
      {/* Video Feed */}
      <div className="aspect-video w-full flex items-center justify-center bg-black relative">
        {/* Video - always in DOM */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${cameraEnabled ? 'block' : 'hidden'}`}
        />
        
        {/* Canvas overlay for AI visualization */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full ${cameraEnabled && isActive ? 'block' : 'hidden'}`}
        />
        
        {/* Placeholder - shown when camera is off */}
        {!cameraEnabled && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <CameraOff className="w-16 h-16 text-gray-600" />
            <p className="text-gray-400 text-lg uppercase">
              {cameraInitializing ? "Initializing Camera..." : "Camera Feed Inactive"}
            </p>
            {error && (
              <p className="text-red-400 text-sm max-w-md">{error}</p>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-center gap-4">
          {!isActive ? (
            <Button
              onClick={handleStartTracking}
              size="lg"
              disabled={cameraInitializing}
              className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-black text-lg px-8 uppercase font-bold disabled:opacity-50"
            >
              <Play className="w-5 h-5 mr-2" />
              {cameraInitializing ? "Initializing Camera..." : "Start Tracking"}
            </Button>
          ) : (
            <Button
              onClick={handleStopTracking}
              size="lg"
              className="bg-red-600 border-2 border-red-400 text-white hover:bg-red-500 text-lg px-8 uppercase font-bold"
            >
              <Square className="w-5 h-5 mr-2" />
              Stop Session
            </Button>
          )}

          {!isActive && (
            <Button
              onClick={cameraEnabled ? disableCamera : enableCamera}
              size="lg"
              variant="outline"
              className="border-2 border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              {cameraEnabled ? (
                <CameraOff className="w-5 h-5" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Active Indicator */}
      {isActive && (
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-full font-bold uppercase text-sm">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          Recording
        </div>
      )}
    </div>
  );
};
