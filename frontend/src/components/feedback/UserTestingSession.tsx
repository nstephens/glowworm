import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Pause, 
  Square, 
  CheckCircle, 
  Clock, 
  User, 
  Target,
  MessageSquare,
  Camera,
  Mic,
  MicOff,
  Video,
  VideoOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticPatterns } from '@/utils/hapticFeedback';

export interface TestingTask {
  id: string;
  title: string;
  description: string;
  instructions: string[];
  expectedOutcome: string;
  timeLimit?: number; // in seconds
  category: 'navigation' | 'upload' | 'gallery' | 'settings' | 'playlist' | 'device';
  difficulty: 'easy' | 'medium' | 'hard';
  successCriteria: string[];
}

export interface TestingSession {
  id: string;
  userId: string;
  sessionId: string;
  startTime: number;
  endTime?: number;
  tasks: TestingTask[];
  currentTaskIndex: number;
  status: 'not_started' | 'in_progress' | 'paused' | 'completed';
  results: TaskResult[];
}

export interface TaskResult {
  taskId: string;
  startTime: number;
  endTime?: number;
  completed: boolean;
  success: boolean;
  timeSpent: number; // in seconds
  attempts: number;
  errors: string[];
  observations: string[];
  screenshots?: string[];
  recordings?: string[];
  rating: number; // 1-5 difficulty rating
  feedback: string;
}

export interface UserTestingSessionProps {
  session: TestingSession;
  onTaskComplete: (taskId: string, result: Omit<TaskResult, 'taskId'>) => void;
  onSessionComplete: (session: TestingSession) => void;
  onSessionPause: (session: TestingSession) => void;
  onSessionResume: (session: TestingSession) => void;
  onSessionStop: (session: TestingSession) => void;
  className?: string;
}

/**
 * User testing session component for conducting structured user tests
 * Features: Task management, progress tracking, recording, observations
 */
export const UserTestingSession: React.FC<UserTestingSessionProps> = ({
  session,
  onTaskComplete,
  onSessionComplete,
  onSessionPause,
  onSessionResume,
  onSessionStop,
  className
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [observations, setObservations] = useState<string[]>([]);
  const [currentObservation, setCurrentObservation] = useState('');
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const currentTask = session.tasks[session.currentTaskIndex];
  const progress = ((session.currentTaskIndex + 1) / session.tasks.length) * 100;
  const sessionDuration = Math.floor((Date.now() - session.startTime) / 1000);

  // Start timer
  useEffect(() => {
    if (session.status === 'in_progress') {
      timerRef.current = setInterval(() => {
        setCurrentTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [session.status]);

  // Handle task completion
  const handleTaskComplete = (success: boolean, feedback: string, rating: number) => {
    const taskResult: Omit<TaskResult, 'taskId'> = {
      startTime: currentTime,
      endTime: Date.now(),
      completed: true,
      success,
      timeSpent: currentTime,
      attempts: 1, // This would be tracked more accurately in a real implementation
      errors: [], // This would be populated based on actual errors
      observations,
      rating,
      feedback
    };

    onTaskComplete(currentTask.id, taskResult);
    
    // Move to next task or complete session
    if (session.currentTaskIndex < session.tasks.length - 1) {
      setCurrentTime(0);
      setObservations([]);
      setCurrentObservation('');
    } else {
      onSessionComplete(session);
    }
  };

  // Handle session control
  const handleStart = () => {
    hapticPatterns.medium();
    // Session start logic would be handled by parent
  };

  const handlePause = () => {
    hapticPatterns.light();
    onSessionPause(session);
  };

  const handleResume = () => {
    hapticPatterns.light();
    onSessionResume(session);
  };

  const handleStop = () => {
    hapticPatterns.medium();
    onSessionStop(session);
  };

  // Handle recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      const chunks: Blob[] = [];
      mediaRecorderRef.current.ondataavailable = (event) => {
        chunks.push(event.data);
      };
      
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        // In a real implementation, you would upload this blob
        console.log('Recording saved:', blob);
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      hapticPatterns.medium();
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setIsRecording(false);
      hapticPatterns.light();
    }
  };

  // Handle observations
  const addObservation = () => {
    if (currentObservation.trim()) {
      setObservations(prev => [...prev, currentObservation.trim()]);
      setCurrentObservation('');
      hapticPatterns.light();
    }
  };

  const removeObservation = (index: number) => {
    setObservations(prev => prev.filter((_, i) => i !== index));
    hapticPatterns.light();
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get difficulty color
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'navigation': return <Target className="h-4 w-4" />;
      case 'upload': return <Camera className="h-4 w-4" />;
      case 'gallery': return <MessageSquare className="h-4 w-4" />;
      case 'settings': return <User className="h-4 w-4" />;
      case 'playlist': return <Play className="h-4 w-4" />;
      case 'device': return <Target className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  if (session.status === 'not_started') {
    return (
      <Card className={cn('w-full max-w-2xl mx-auto', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Testing Session
          </CardTitle>
          <CardDescription>
            Ready to start testing session with {session.tasks.length} tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">Session Overview</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Tasks:</span>
                <span className="ml-2 font-medium">{session.tasks.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Estimated Time:</span>
                <span className="ml-2 font-medium">
                  {Math.ceil(session.tasks.length * 5)} minutes
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Tasks Preview</h3>
            <div className="space-y-2">
              {session.tasks.slice(0, 3).map((task, index) => (
                <div key={task.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <span className="text-sm font-medium">{index + 1}.</span>
                  <span className="text-sm">{task.title}</span>
                  <Badge className={getDifficultyColor(task.difficulty)}>
                    {task.difficulty}
                  </Badge>
                </div>
              ))}
              {session.tasks.length > 3 && (
                <div className="text-sm text-muted-foreground">
                  ... and {session.tasks.length - 3} more tasks
                </div>
              )}
            </div>
          </div>

          <Button onClick={handleStart} className="w-full">
            <Play className="h-4 w-4 mr-2" />
            Start Testing Session
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full max-w-4xl mx-auto', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Testing Session
            </CardTitle>
            <CardDescription>
              Task {session.currentTaskIndex + 1} of {session.tasks.length}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(sessionDuration)}
            </Badge>
            <Badge className={getDifficultyColor(currentTask.difficulty)}>
              {currentTask.difficulty}
            </Badge>
          </div>
        </div>
        
        <Progress value={progress} className="w-full" />
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Current Task */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{currentTask.title}</h3>
            <div className="flex items-center gap-2">
              {getCategoryIcon(currentTask.category)}
              <span className="text-sm text-muted-foreground capitalize">
                {currentTask.category}
              </span>
            </div>
          </div>
          
          <p className="text-muted-foreground">{currentTask.description}</p>
          
          <div className="space-y-2">
            <h4 className="font-medium">Instructions:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              {currentTask.instructions.map((instruction, index) => (
                <li key={index}>{instruction}</li>
              ))}
            </ol>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Expected Outcome:</h4>
            <p className="text-sm text-muted-foreground">{currentTask.expectedOutcome}</p>
          </div>

          {currentTask.timeLimit && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Time limit: {formatTime(currentTask.timeLimit)}
            </div>
          )}
        </div>

        {/* Observations */}
        <div className="space-y-4">
          <h4 className="font-medium">Observations</h4>
          
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={currentObservation}
                onChange={(e) => setCurrentObservation(e.target.value)}
                placeholder="Add observation..."
                className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyPress={(e) => e.key === 'Enter' && addObservation()}
              />
              <Button onClick={addObservation} size="sm">
                Add
              </Button>
            </div>
            
            <div className="space-y-1">
              {observations.map((observation, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <span className="text-sm flex-1">{observation}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeObservation(index)}
                    className="h-6 w-6 p-0"
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recording Controls */}
        <div className="flex items-center gap-4">
          <Button
            variant={isRecording ? "destructive" : "outline"}
            onClick={isRecording ? stopRecording : startRecording}
            size="sm"
          >
            {isRecording ? (
              <>
                <Square className="h-4 w-4 mr-2" />
                Stop Recording
              </>
            ) : (
              <>
                <Video className="h-4 w-4 mr-2" />
                Start Recording
              </>
            )}
          </Button>
          
          <span className="text-sm text-muted-foreground">
            {isRecording ? 'Recording in progress...' : 'Optional screen recording'}
          </span>
        </div>

        {/* Task Completion */}
        <div className="space-y-4">
          <h4 className="font-medium">Task Completion</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => handleTaskComplete(true, '', 3)}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Task Completed Successfully
            </Button>
            
            <Button
              onClick={() => handleTaskComplete(false, '', 3)}
              variant="destructive"
            >
              <Square className="h-4 w-4 mr-2" />
              Task Failed
            </Button>
          </div>
        </div>

        {/* Session Controls */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            {session.status === 'in_progress' ? (
              <Button onClick={handlePause} variant="outline" size="sm">
                <Pause className="h-4 w-4 mr-2" />
                Pause Session
              </Button>
            ) : (
              <Button onClick={handleResume} size="sm">
                <Play className="h-4 w-4 mr-2" />
                Resume Session
              </Button>
            )}
            
            <Button onClick={handleStop} variant="destructive" size="sm">
              <Square className="h-4 w-4 mr-2" />
              Stop Session
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            Session time: {formatTime(sessionDuration)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};




