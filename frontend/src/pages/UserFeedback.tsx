import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FeedbackWidget, 
  UserTestingSession, 
  FeedbackDashboard,
  FeedbackData,
  TestingSession,
  TestingTask
} from '@/components/feedback';
import { 
  MessageSquare, 
  Users, 
  BarChart3, 
  Play,
  Settings
} from 'lucide-react';

/**
 * User Feedback Page
 * Comprehensive showcase of feedback collection and user testing system
 */
const UserFeedback: React.FC = () => {
  const [feedbackData, setFeedbackData] = useState<FeedbackData[]>([]);
  const [testingSession, setTestingSession] = useState<TestingSession | null>(null);
  const [activeTab, setActiveTab] = useState('widget');

  // Sample feedback data
  useEffect(() => {
    const sampleFeedback: FeedbackData[] = [
      {
        id: '1',
        rating: 5,
        category: 'general',
        message: 'Great mobile experience! The new navigation is much better.',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
        url: 'https://example.com/images',
        timestamp: Date.now() - 86400000, // 1 day ago
        userId: 'user1',
        sessionId: 'session1',
        deviceInfo: {
          platform: 'iPhone',
          screenSize: '375x812',
          orientation: 'portrait'
        }
      },
      {
        id: '2',
        rating: 3,
        category: 'bug',
        message: 'Upload button is hard to see on mobile. Maybe make it more prominent?',
        userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G975F)',
        url: 'https://example.com/upload',
        timestamp: Date.now() - 172800000, // 2 days ago
        userId: 'user2',
        sessionId: 'session2',
        deviceInfo: {
          platform: 'Android',
          screenSize: '360x760',
          orientation: 'portrait'
        }
      },
      {
        id: '3',
        rating: 4,
        category: 'feature',
        message: 'Would love to have batch upload functionality for multiple images at once.',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
        url: 'https://example.com/images',
        timestamp: Date.now() - 259200000, // 3 days ago
        userId: 'user3',
        sessionId: 'session3',
        deviceInfo: {
          platform: 'iPhone',
          screenSize: '414x896',
          orientation: 'portrait'
        }
      },
      {
        id: '4',
        rating: 5,
        category: 'ui',
        message: 'The new image gallery layout is perfect! Much easier to browse on mobile.',
        userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5)',
        url: 'https://example.com/gallery',
        timestamp: Date.now() - 345600000, // 4 days ago
        userId: 'user4',
        sessionId: 'session4',
        deviceInfo: {
          platform: 'Android',
          screenSize: '393x851',
          orientation: 'portrait'
        }
      },
      {
        id: '5',
        rating: 2,
        category: 'performance',
        message: 'App is slow when loading large images. Takes forever to open.',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)',
        url: 'https://example.com/images/123',
        timestamp: Date.now() - 432000000, // 5 days ago
        userId: 'user5',
        sessionId: 'session5',
        deviceInfo: {
          platform: 'iPhone',
          screenSize: '375x667',
          orientation: 'portrait'
        }
      }
    ];

    setFeedbackData(sampleFeedback);
  }, []);

  // Sample testing tasks
  const sampleTasks: TestingTask[] = [
    {
      id: 'task1',
      title: 'Upload a new image',
      description: 'Upload a single image to the gallery',
      instructions: [
        'Navigate to the images page',
        'Tap the upload button',
        'Select an image from your device',
        'Wait for upload to complete'
      ],
      expectedOutcome: 'Image should be uploaded and visible in the gallery',
      timeLimit: 120,
      category: 'upload',
      difficulty: 'easy',
      successCriteria: [
        'Upload button is visible and accessible',
        'Image selection works correctly',
        'Upload completes successfully',
        'Image appears in gallery'
      ]
    },
    {
      id: 'task2',
      title: 'Create a new playlist',
      description: 'Create a playlist and add images to it',
      instructions: [
        'Navigate to the playlists page',
        'Tap the create playlist button',
        'Enter a name for the playlist',
        'Add at least 3 images to the playlist',
        'Save the playlist'
      ],
      expectedOutcome: 'New playlist should be created with selected images',
      timeLimit: 180,
      category: 'playlist',
      difficulty: 'medium',
      successCriteria: [
        'Create playlist button is accessible',
        'Form inputs work correctly',
        'Image selection for playlist works',
        'Playlist is saved successfully'
      ]
    },
    {
      id: 'task3',
      title: 'Configure device settings',
      description: 'Update device display settings',
      instructions: [
        'Navigate to the devices page',
        'Select a device from the list',
        'Tap on settings for that device',
        'Change the display brightness',
        'Update the device name',
        'Save the changes'
      ],
      expectedOutcome: 'Device settings should be updated and saved',
      timeLimit: 240,
      category: 'device',
      difficulty: 'hard',
      successCriteria: [
        'Device list is accessible',
        'Settings form loads correctly',
        'Form inputs work properly',
        'Changes are saved successfully'
      ]
    }
  ];

  // Handle feedback submission
  const handleFeedbackSubmit = async (feedback: Omit<FeedbackData, 'id' | 'timestamp'>) => {
    try {
      // In a real implementation, this would send to your backend
      console.log('Feedback submitted:', feedback);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Add to local state for demo
      const newFeedback: FeedbackData = {
        ...feedback,
        id: Date.now().toString(),
        timestamp: Date.now()
      };
      
      setFeedbackData(prev => [newFeedback, ...prev]);
      
      // Show success message
      alert('Thank you for your feedback!');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error;
    }
  };

  // Handle testing session start
  const handleStartTestingSession = () => {
    const newSession: TestingSession = {
      id: Date.now().toString(),
      userId: 'test-user',
      sessionId: 'test-session',
      startTime: Date.now(),
      tasks: sampleTasks,
      currentTaskIndex: 0,
      status: 'not_started',
      results: []
    };
    
    setTestingSession(newSession);
    setActiveTab('testing');
  };

  // Handle task completion
  const handleTaskComplete = (taskId: string, result: any) => {
    if (!testingSession) return;
    
    const updatedSession = {
      ...testingSession,
      results: [...testingSession.results, { taskId, ...result }],
      currentTaskIndex: testingSession.currentTaskIndex + 1
    };
    
    setTestingSession(updatedSession);
  };

  // Handle session events
  const handleSessionComplete = (session: TestingSession) => {
    console.log('Testing session completed:', session);
    setTestingSession({ ...session, status: 'completed', endTime: Date.now() });
  };

  const handleSessionPause = (session: TestingSession) => {
    setTestingSession({ ...session, status: 'paused' });
  };

  const handleSessionResume = (session: TestingSession) => {
    setTestingSession({ ...session, status: 'in_progress' });
  };

  const handleSessionStop = (session: TestingSession) => {
    setTestingSession({ ...session, status: 'completed', endTime: Date.now() });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-3xl font-bold">User Feedback & Testing System</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Comprehensive system for collecting user feedback, conducting A/B tests, 
            and managing user testing sessions to improve the mobile experience.
          </p>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="widget">Feedback Widget</TabsTrigger>
            <TabsTrigger value="testing">User Testing</TabsTrigger>
            <TabsTrigger value="dashboard">Analytics Dashboard</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Feedback Widget Tab */}
          <TabsContent value="widget" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  In-App Feedback Widget
                </CardTitle>
                <CardDescription>
                  Interactive feedback collection widget with rating system and categorization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border-2 border-dashed border-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-4">
                    The feedback widget is positioned in the bottom-right corner of the screen.
                    Click the button to open the feedback form and try submitting feedback.
                  </p>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Features:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• 5-star rating system with visual feedback</li>
                      <li>• Category selection (General, Bug, Feature, UI/UX, Performance)</li>
                      <li>• Optional message input with character count</li>
                      <li>• Haptic feedback for interactions</li>
                      <li>• Mobile-optimized touch targets</li>
                      <li>• Real-time validation and error handling</li>
                      <li>• Success confirmation with auto-close</li>
                    </ul>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Recent Feedback:</h4>
                    <div className="space-y-2">
                      {feedbackData.slice(0, 3).map(feedback => (
                        <div key={feedback.id} className="p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{feedback.category}</span>
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <span key={i} className={i < feedback.rating ? 'text-yellow-500' : 'text-gray-300'}>
                                  ⭐
                                </span>
                              ))}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{feedback.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Feedback Statistics:</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Total Feedback:</span>
                        <span className="text-sm font-medium">{feedbackData.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Average Rating:</span>
                        <span className="text-sm font-medium">
                          {(feedbackData.reduce((sum, f) => sum + f.rating, 0) / feedbackData.length).toFixed(1)}/5
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Bug Reports:</span>
                        <span className="text-sm font-medium">
                          {feedbackData.filter(f => f.category === 'bug').length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Feature Requests:</span>
                        <span className="text-sm font-medium">
                          {feedbackData.filter(f => f.category === 'feature').length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Testing Tab */}
          <TabsContent value="testing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Testing Sessions
                </CardTitle>
                <CardDescription>
                  Structured user testing with task management and progress tracking
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!testingSession ? (
                  <div className="text-center space-y-4">
                    <div className="p-8 border-2 border-dashed border-muted rounded-lg">
                      <h3 className="text-lg font-semibold mb-2">Start a Testing Session</h3>
                      <p className="text-muted-foreground mb-4">
                        Begin a structured user testing session with predefined tasks
                      </p>
                      <Button onClick={handleStartTestingSession} className="w-full max-w-xs">
                        <Play className="h-4 w-4 mr-2" />
                        Start Testing Session
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {sampleTasks.map(task => (
                        <div key={task.id} className="p-4 border rounded-lg">
                          <h4 className="font-medium mb-2">{task.title}</h4>
                          <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              task.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                              task.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {task.difficulty}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {task.timeLimit}s limit
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <UserTestingSession
                    session={testingSession}
                    onTaskComplete={handleTaskComplete}
                    onSessionComplete={handleSessionComplete}
                    onSessionPause={handleSessionPause}
                    onSessionResume={handleSessionResume}
                    onSessionStop={handleSessionStop}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <FeedbackDashboard
              feedbackData={feedbackData}
              abTestResults={{}}
            />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Feedback System Settings
                </CardTitle>
                <CardDescription>
                  Configure feedback collection and testing parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Feedback Widget Settings</h4>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span className="text-sm">Enable feedback widget</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span className="text-sm">Enable haptic feedback</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm">Enable screen recording</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">A/B Testing Settings</h4>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span className="text-sm">Enable A/B testing</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm">Enable automatic variant selection</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Analytics Settings</h4>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span className="text-sm">Enable Google Analytics</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm">Enable Mixpanel</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm">Enable Amplitude</span>
                      </label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Feedback Widget - Always visible */}
        <FeedbackWidget
          onSubmit={handleFeedbackSubmit}
          userId="demo-user"
          sessionId="demo-session"
          position="bottom-right"
        />
      </div>
    </div>
  );
};

export default UserFeedback;






