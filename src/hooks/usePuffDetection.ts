import { useRef, useEffect, useCallback } from 'react';
import { setupMediaPipe, analyzePuffSequence, type PuffAnalysis } from '@/lib/MediaPipeSetup';
import { FaceLandmarker } from '@mediapipe/tasks-vision';

interface UsePuffDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  onPuffDetected: (analysis: PuffAnalysis) => void;
}

export const usePuffDetection = ({ 
  videoRef, 
  isActive, 
  onPuffDetected 
}: UsePuffDetectionProps) => {
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const isInitializedRef = useRef(false);
  const animationFrameRef = useRef<number>();
  const lastDetectionTimeRef = useRef<number>(0);

  // Initialize MediaPipe on mount
  useEffect(() => {
    const initMediaPipe = async () => {
      if (!isInitializedRef.current) {
        try {
          const landmarker = await setupMediaPipe();
          faceLandmarkerRef.current = landmarker;
          isInitializedRef.current = true;
        } catch (error) {
          console.error('Failed to initialize MediaPipe:', error);
        }
      }
    };

    initMediaPipe();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Detection loop
  const detectPuffs = useCallback(() => {
    if (!isActive || !videoRef.current || !faceLandmarkerRef.current) {
      return;
    }

    const video = videoRef.current;
    if (video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detectPuffs);
      return;
    }

    try {
      const results = faceLandmarkerRef.current.detectForVideo(
        video,
        performance.now()
      );

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        const blendshapes = results.faceBlendshapes;
        const puffAnalysis = analyzePuffSequence(landmarks, blendshapes);

        // Check for puff detection with cooldown
        if (puffAnalysis.isPuff) {
          const now = Date.now();
          if (now - lastDetectionTimeRef.current > 4000) { // 4 second cooldown
            lastDetectionTimeRef.current = now;
            onPuffDetected(puffAnalysis);
            console.log(`🤖 AI detected puff! Confidence: ${puffAnalysis.confidence.toFixed(1)}%`);
          }
        }
      }
    } catch (error) {
      console.error('Detection error:', error);
    }

    animationFrameRef.current = requestAnimationFrame(detectPuffs);
  }, [isActive, videoRef, onPuffDetected]);

  // Start/stop detection based on isActive
  useEffect(() => {
    if (isActive && faceLandmarkerRef.current) {
      detectPuffs();
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, detectPuffs]);
};
