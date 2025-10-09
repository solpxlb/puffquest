import { FaceLandmarker, FilesetResolver, NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface PuffAnalysis {
  isPuff: boolean;
  confidence: number;
  reason: string;
  metrics: {
    mouthHeight: number;
    mouthWidth: number;
    aspectRatio: number;
    lipPursing: number;
    cheekPuff: number;
    mouthPucker: number;
    jawOpen: number;
    timestamp: number;
  };
  details: {
    maxAspectRatio: string;
    maxPursing: string;
    maxCheekPuff: string;
    maxMouthPucker: string;
    sequenceScore: number;
  };
}

// Mouth landmark indices for MediaPipe Face Mesh
const MOUTH_LANDMARKS = {
  upperLipCenter: 13,
  lowerLipCenter: 14,
  leftCorner: 61,
  rightCorner: 291,
};

const mouthShapeHistory: any[] = [];

// Calculate distance between two landmarks
const calculateDistance = (landmark1: NormalizedLandmark, landmark2: NormalizedLandmark) => {
  const dx = landmark1.x - landmark2.x;
  const dy = landmark1.y - landmark2.y;
  const dz = landmark1.z - landmark2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

export const setupMediaPipe = async (): Promise<FaceLandmarker> => {
  try {
    console.log('🤖 Initializing MediaPipe Face Mesh...');
    
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    
    console.log('✅ MediaPipe vision FilesetResolver loaded');
    
    const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false
    });
    
    console.log('✅ Face Landmarker initialized successfully');
    return faceLandmarker;
  } catch (error: any) {
    console.error('❌ MediaPipe initialization failed:', error);
    
    // Fallback to CPU if GPU fails
    if (error.message && (error.message.includes('GPU') || error.message.includes('WebGL'))) {
      console.log('🔄 Retrying with CPU delegate...');
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      
      const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "CPU"
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false
      });
      
      console.log('✅ Face Landmarker initialized with CPU fallback');
      return faceLandmarker;
    }
    throw error;
  }
};

export const analyzePuffSequence = (landmarks: NormalizedLandmark[], blendshapes?: any[]): PuffAnalysis => {
  if (!landmarks || landmarks.length === 0) {
    return { 
      isPuff: false, 
      confidence: 0, 
      reason: 'No face detected',
      metrics: {
        mouthHeight: 0, mouthWidth: 0, aspectRatio: 0, lipPursing: 0,
        cheekPuff: 0, mouthPucker: 0, jawOpen: 0, timestamp: performance.now()
      },
      details: {
        maxAspectRatio: '0', maxPursing: '0', maxCheekPuff: '0',
        maxMouthPucker: '0', sequenceScore: 0
      }
    };
  }

  // Get key mouth landmarks
  const upperLip = landmarks[MOUTH_LANDMARKS.upperLipCenter];
  const lowerLip = landmarks[MOUTH_LANDMARKS.lowerLipCenter];
  const leftCorner = landmarks[MOUTH_LANDMARKS.leftCorner];
  const rightCorner = landmarks[MOUTH_LANDMARKS.rightCorner];
  
  // Calculate mouth metrics
  const mouthHeight = calculateDistance(upperLip, lowerLip);
  const mouthWidth = calculateDistance(leftCorner, rightCorner);
  const aspectRatio = mouthHeight / (mouthWidth + 0.001);
  
  // Calculate lip pursing (O-shape detection)
  const lipPursing = 1 - (mouthWidth / 0.15);
  
  // Get blendshape values if available
  let cheekPuff = 0;
  let mouthPucker = 0;
  let jawOpen = 0;
  
  if (blendshapes && blendshapes.length > 0) {
    const shapes = blendshapes[0].categories;
    shapes.forEach((shape: any) => {
      if (shape.categoryName === 'cheekPuff') cheekPuff = shape.score;
      if (shape.categoryName === 'mouthPucker') mouthPucker = shape.score;
      if (shape.categoryName === 'jawOpen') jawOpen = shape.score;
      if (shape.categoryName === 'mouthFunnel') mouthPucker = Math.max(mouthPucker, shape.score);
    });
  }
  
  // Store metrics for history
  const currentMetrics = {
    mouthHeight: mouthHeight * 1000,
    mouthWidth: mouthWidth * 1000,
    aspectRatio,
    lipPursing,
    cheekPuff,
    mouthPucker,
    jawOpen,
    timestamp: performance.now()
  };
  
  // Update history
  mouthShapeHistory.push(currentMetrics);
  
  // Keep history size manageable (last 60 frames = ~2 seconds at 30fps)
  if (mouthShapeHistory.length > 60) mouthShapeHistory.shift();
  
  // Need enough history for pattern analysis
  if (mouthShapeHistory.length < 15) {
    return { 
      isPuff: false, 
      confidence: 0, 
      reason: 'Building pattern history...',
      metrics: currentMetrics,
      details: {
        maxAspectRatio: '0', maxPursing: '0', maxCheekPuff: '0',
        maxMouthPucker: '0', sequenceScore: 0
      }
    };
  }
  
  // Analyze patterns over time
  const recentHistory = mouthShapeHistory.slice(-30);
  
  // Calculate confidence score
  let confidence = 0;
  
  // Mouth opening score (0-25 points)
  const maxAspectRatio = Math.max(...recentHistory.map(h => h.aspectRatio));
  if (maxAspectRatio > 0.3) confidence += 25;
  else if (maxAspectRatio > 0.2) confidence += 20;
  else if (maxAspectRatio > 0.15) confidence += 15;
  else if (maxAspectRatio > 0.1) confidence += 10;
  
  // Lip pursing score (0-30 points)
  const maxPursing = Math.max(...recentHistory.map(h => h.lipPursing));
  if (maxPursing > 0.6) confidence += 30;
  else if (maxPursing > 0.4) confidence += 25;
  else if (maxPursing > 0.3) confidence += 20;
  else if (maxPursing > 0.2) confidence += 15;
  
  // Cheek/mouth puff score (0-35 points)
  const maxCheekPuff = Math.max(...recentHistory.map(h => h.cheekPuff));
  const maxMouthPucker = Math.max(...recentHistory.map(h => h.mouthPucker));
  if (maxCheekPuff > 0.5 || maxMouthPucker > 0.5) confidence += 35;
  else if (maxCheekPuff > 0.3 || maxMouthPucker > 0.3) confidence += 25;
  else if (maxCheekPuff > 0.15 || maxMouthPucker > 0.15) confidence += 15;
  
  // Temporal sequence bonus (0-10 points)
  const sequenceLength = Math.min(recentHistory.length, 20);
  let sequenceScore = 0;
  
  if (sequenceLength >= 10) {
    const firstThird = recentHistory.slice(0, Math.floor(sequenceLength/3));
    const lastThird = recentHistory.slice(Math.floor(2*sequenceLength/3));
    
    const firstAvgOpen = firstThird.reduce((a, b) => a + b.aspectRatio, 0) / firstThird.length;
    const lastAvgPuff = lastThird.reduce((a, b) => a + b.cheekPuff + b.mouthPucker, 0) / lastThird.length;
    
    if (firstAvgOpen > maxAspectRatio * 0.8) sequenceScore += 5;
    if (lastAvgPuff > 0.1) sequenceScore += 5;
  }
  
  confidence += sequenceScore;
  
  // Apply strict detection threshold (90%)
  const threshold = 90;
  const isPuff = confidence >= threshold;
  
  return {
    isPuff,
    confidence,
    reason: isPuff ? 
      `Puff detected (${confidence.toFixed(1)}% confidence)` :
      `Below threshold (${confidence.toFixed(1)}% < ${threshold}%)`,
    metrics: currentMetrics,
    details: {
      maxAspectRatio: maxAspectRatio.toFixed(3),
      maxPursing: maxPursing.toFixed(3),
      maxCheekPuff: maxCheekPuff.toFixed(3),
      maxMouthPucker: maxMouthPucker.toFixed(3),
      sequenceScore
    }
  };
};
