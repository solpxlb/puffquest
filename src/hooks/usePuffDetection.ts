import { useRef, useEffect, useCallback } from 'react';
import { setupMediaPipe, analyzePuffSequence, type PuffAnalysis } from '@/lib/MediaPipeSetup';
import { FaceLandmarker } from '@mediapipe/tasks-vision';

interface UsePuffDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isActive: boolean;
  onPuffDetected: (analysis: PuffAnalysis) => void;
}

export const usePuffDetection = ({ 
  videoRef, 
  canvasRef,
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
    const canvas = canvasRef.current;
    
    if (video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detectPuffs);
      return;
    }

    // Set canvas dimensions to match video
    if (canvas && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    try {
      const results = faceLandmarkerRef.current.detectForVideo(
        video,
        performance.now()
      );

      // Clear canvas
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        const blendshapes = results.faceBlendshapes;
        const puffAnalysis = analyzePuffSequence(landmarks, blendshapes);

        // Draw visualization on canvas
        if (canvas) {
          drawLandmarks(canvas, landmarks);
          drawMetrics(canvas, puffAnalysis);
        }

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
  }, [isActive, videoRef, canvasRef, onPuffDetected]);

  // Drawing functions
  const drawLandmarks = (canvas: HTMLCanvasElement, landmarks: any[]) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Mouth landmark indices
    const mouthIndices = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 13, 14, 78, 95, 88, 308, 324, 318, 402];

    landmarks.forEach((landmark, index) => {
      const x = landmark.x * width;
      const y = landmark.y * height;

      // Different colors for mouth vs face
      if (mouthIndices.includes(index)) {
        ctx.fillStyle = 'rgba(255, 50, 50, 0.8)';
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.9)';
      } else {
        ctx.fillStyle = 'rgba(0, 255, 100, 0.3)';
        ctx.strokeStyle = 'rgba(0, 255, 100, 0.4)';
      }

      ctx.beginPath();
      ctx.arc(x, y, mouthIndices.includes(index) ? 3 : 1.5, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  const drawMetrics = (canvas: HTMLCanvasElement, analysis: PuffAnalysis) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const padding = 15;
    const barWidth = 250;
    const barHeight = 25;
    const x = padding;
    const y = canvas.height - 140;

    // Semi-transparent background panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(x - 5, y - 35, barWidth + 10, 130);

    // Confidence label
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('AI DETECTION', x, y - 10);

    // Confidence bar background
    ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
    ctx.fillRect(x, y, barWidth, barHeight);

    // Confidence bar fill (color-coded)
    const fillWidth = (analysis.confidence / 100) * barWidth;
    if (analysis.confidence >= 90) {
      ctx.fillStyle = 'rgba(255, 50, 50, 0.9)';
    } else if (analysis.confidence >= 70) {
      ctx.fillStyle = 'rgba(255, 220, 0, 0.9)';
    } else if (analysis.confidence >= 50) {
      ctx.fillStyle = 'rgba(255, 165, 0, 0.9)';
    } else {
      ctx.fillStyle = 'rgba(0, 255, 100, 0.9)';
    }
    ctx.fillRect(x, y, fillWidth, barHeight);

    // Threshold line at 90%
    const thresholdX = x + (90 / 100) * barWidth;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(thresholdX, y);
    ctx.lineTo(thresholdX, y + barHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // Confidence percentage text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`${analysis.confidence.toFixed(1)}%`, x + barWidth + 10, y + 18);

    // Metrics text
    ctx.font = '13px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(`Aspect: ${analysis.metrics.aspectRatio.toFixed(3)}`, x, y + 45);
    ctx.fillText(`Pursing: ${analysis.metrics.lipPursing.toFixed(3)}`, x, y + 65);
    ctx.fillText(`Cheek: ${analysis.metrics.cheekPuff.toFixed(3)}`, x, y + 85);

    // Puff detection flash
    if (analysis.isPuff) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('🔥 PUFF DETECTED!', canvas.width - 250, 40);
    }
  };

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
