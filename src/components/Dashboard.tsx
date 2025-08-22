'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  User, 
  LogOut, 
  Calendar, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw,
  Zap,
  Brain
} from 'lucide-react';

interface Conversation {
  id: number;
  date: string;
  transcript: string;
  analysis: {
    mainPoints: string[];
    actionItems: string[];
    nextSteps: string[];
  };
  title: string;
  isAnalyzing?: boolean;
  analysisError?: boolean;
  tokenUsage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface User {
  email: string;
  name: string;
}

interface AnalysisResponse {
  success: boolean;
  analysis: {
    mainPoints: string[];
    actionItems: string[];
    nextSteps: string[];
  };
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
}

const Dashboard = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiStatus, setApiStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [totalTokensUsed, setTotalTokensUsed] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);

  // Get user data from localStorage
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Load user data from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }

    // Load conversations from localStorage
    const savedConversations = localStorage.getItem('conversations');
    if (savedConversations) {
      try {
        const parsed = JSON.parse(savedConversations);
        setConversations(parsed);
        
        // Calculate total tokens used
        const totalTokens = parsed.reduce((sum: number, conv: Conversation) => {
          return sum + (conv.tokenUsage?.total_tokens || 0);
        }, 0);
        setTotalTokensUsed(totalTokens);
      } catch (error) {
        console.error('Error loading conversations:', error);
      }
    }
  }, []);

  // Save conversations to localStorage whenever conversations change
  useEffect(() => {
    localStorage.setItem('conversations', JSON.stringify(conversations));
    
    // Update total tokens
    const totalTokens = conversations.reduce((sum, conv) => {
      return sum + (conv.tokenUsage?.total_tokens || 0);
    }, 0);
    setTotalTokensUsed(totalTokens);
  }, [conversations]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setCurrentTranscript(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setErrorMessage(`Speech recognition error: ${event.error}`);
        setApiStatus('error');
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  const startRecording = () => {
    if (recognitionRef.current) {
      setCurrentTranscript('');
      setErrorMessage('');
      setApiStatus('idle');
      
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Error starting recording:', error);
        setErrorMessage('Failed to start recording. Please check microphone permissions.');
        setApiStatus('error');
      }
    } else {
      setErrorMessage('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      setApiStatus('error');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      
      if (currentTranscript.trim()) {
        saveConversation(currentTranscript);
      }
    }
  };

  const analyzeWithOpenAI = async (transcript: string, conversationId: number): Promise<{
    mainPoints: string[];
    actionItems: string[];
    nextSteps: string[];
    tokenUsage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }> => {
    setIsAnalyzing(true);
    setApiStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript }),
      });

      const data: AnalysisResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API request failed with status ${response.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Analysis was not successful');
      }

      setApiStatus('success');
      
      return {
        ...data.analysis,
        tokenUsage: data.usage
      };

    } catch (error) {
      console.error('Error analyzing transcript:', error);
      setApiStatus('error');
      
      let errorMsg = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMsg = error.message;
      }
      
      setErrorMessage(errorMsg);
      
      // Mark conversation as having an error
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, analysisError: true, isAnalyzing: false }
            : conv
        )
      );
      
      // Return fallback analysis
      return {
        mainPoints: ['❌ Analysis failed - OpenAI API error'],
        actionItems: ['🔧 Check your API key and try again'],
        nextSteps: ['⚠️ Verify OpenAI account credits and permissions']
      };
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveConversation = async (transcript: string) => {
    const tempId = Date.now();
    const title = transcript.substring(0, 50) + (transcript.length > 50 ? '...' : '');
    
    // Create temporary conversation with loading state
    const tempConversation: Conversation = {
      id: tempId,
      date: new Date().toLocaleString(),
      transcript,
      analysis: {
        mainPoints: ['🤖 Analyzing with GPT-4o...'],
        actionItems: ['⏳ Processing...'],
        nextSteps: ['🔄 Please wait...']
      },
      title,
      isAnalyzing: true,
      analysisError: false
    };

    setConversations(prev => [tempConversation, ...prev]);
    setSelectedConversation(tempConversation);
    setCurrentTranscript('');

    // Perform OpenAI analysis
    const analysisResult = await analyzeWithOpenAI(transcript, tempId);

    // Update conversation with analysis results
    const finalConversation: Conversation = {
      ...tempConversation,
      analysis: {
        mainPoints: analysisResult.mainPoints,
        actionItems: analysisResult.actionItems,
        nextSteps: analysisResult.nextSteps
      },
      isAnalyzing: false,
      analysisError: apiStatus === 'error',
      tokenUsage: analysisResult.tokenUsage
    };

    setConversations(prev => 
      prev.map(conv => conv.id === tempId ? finalConversation : conv)
    );
    setSelectedConversation(finalConversation);
  };

  const deleteConversation = (id: number) => {
    setConversations(prev => prev.filter(conv => conv.id !== id));
    if (selectedConversation && selectedConversation.id === id) {
      setSelectedConversation(null);
    }
  };

  const retryAnalysis = async (conversation: Conversation) => {
    if (conversation.isAnalyzing) return;

    // Update conversation to show analyzing state
    const updatedConversation = { 
      ...conversation, 
      isAnalyzing: true, 
      analysisError: false 
    };
    
    setConversations(prev => 
      prev.map(conv => conv.id === conversation.id ? updatedConversation : conv)
    );
    setSelectedConversation(updatedConversation);

    // Perform analysis again
    const analysisResult = await analyzeWithOpenAI(conversation.transcript, conversation.id);

    // Update with new results
    const finalConversation = { 
      ...updatedConversation, 
      analysis: {
        mainPoints: analysisResult.mainPoints,
        actionItems: analysisResult.actionItems,
        nextSteps: analysisResult.nextSteps
      },
      isAnalyzing: false,
      analysisError: apiStatus === 'error',
      tokenUsage: analysisResult.tokenUsage
    };
    
    setConversations(prev => 
      prev.map(conv => conv.id === conversation.id ? finalConversation : conv)
    );
    setSelectedConversation(finalConversation);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('conversations');
    window.location.href = '/';
  };

  const formatTokenUsage = (tokens: number): string => {
    if (tokens < 1000) return `${tokens} tokens`;
    return `${(tokens / 1000).toFixed(1)}K tokens`;
  };

  const estimateCost = (tokens: number): string => {
    // GPT-4o pricing: ~$0.005 per 1K input tokens, ~$0.015 per 1K output tokens
    // Using average cost of ~$0.01 per 1K tokens for estimation
    const cost = (tokens / 1000) * 0.01;
    return cost < 0.01 ? '<$0.01' : `$${cost.toFixed(2)}`;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading user data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Mic className="w-8 h-8 text-indigo-600 mr-3" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Voice Analytics Dashboard</h1>
                <div className="flex items-center text-xs text-gray-500 mt-1">
                  <Brain className="w-3 h-3 mr-1" />
                  <span>Powered by GPT-4o</span>
                  {totalTokensUsed > 0 && (
                    <>
                      <span className="mx-2">•</span>
                      <span>{formatTokenUsage(totalTokensUsed)} used</span>
                      <span className="mx-2">•</span>
                      <span>~{estimateCost(totalTokensUsed)} cost</span>
                    </>
                  )}
                </div>
              </div>
              {isAnalyzing && (
                <div className="ml-4 flex items-center text-sm text-indigo-600">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing with GPT-4o...
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4">
              {/* API Status Indicator */}
              {apiStatus === 'success' && (
                <div className="flex items-center text-green-600 text-sm">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Analysis Complete
                </div>
              )}
              {apiStatus === 'error' && (
                <div className="flex items-center text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Analysis Error
                </div>
              )}
              <div className="flex items-center text-sm text-gray-600">
                <User className="w-4 h-4 mr-2" />
                {user.name}
              </div>
              <button 
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700 p-2 rounded-md hover:bg-gray-100 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Error Message */}
      {errorMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                <strong>Error:</strong> {errorMessage}
                {errorMessage.includes('API') && (
                  <div className="mt-2 text-xs">
                    <p>Common solutions:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Check your OpenAI API key in .env.local</li>
                      <li>Ensure you have sufficient credits</li>
                      <li>Verify GPT-4o model access</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Recording Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Record Conversation</h2>
              
              <div className="text-center">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isAnalyzing}
                  className={`w-20 h-20 rounded-full flex items-center justify-center text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isRecording 
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                      : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105'
                  }`}
                >
                  {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </button>
                
                <p className="mt-4 text-sm text-gray-600">
                  {isAnalyzing 
                    ? 'Analyzing previous recording with GPT-4o...' 
                    : isRecording 
                      ? 'Recording... Click to stop' 
                      : 'Click to start recording'
                  }
                </p>

                {isRecording && (
                  <div className="mt-2 text-xs text-red-600 animate-pulse">
                    ● REC
                  </div>
                )}
              </div>

              {currentTranscript && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Zap className="w-4 h-4 mr-1" />
                    Live Transcript:
                  </h3>
                  <p className="text-sm text-gray-900 leading-relaxed">{currentTranscript}</p>
                </div>
              )}
            </div>

            {/* Conversations List */}
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Recent Conversations ({conversations.length})
              </h2>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="text-center py-8">
                    <Mic className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No conversations yet.</p>
                    <p className="text-gray-400 text-xs">Start recording to see them here.</p>
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                        selectedConversation?.id === conv.id 
                          ? 'bg-indigo-50 border border-indigo-200 shadow-sm' 
                          : 'bg-gray-50 hover:bg-gray-100 hover:shadow-sm'
                      }`}
                      onClick={() => setSelectedConversation(conv)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {conv.title}
                            </p>
                            {conv.isAnalyzing && (
                              <Loader2 className="w-3 h-3 ml-2 animate-spin text-indigo-500" />
                            )}
                            {conv.analysisError && (
                              <AlertCircle className="w-3 h-3 ml-2 text-red-500" />
                            )}
                            {!conv.isAnalyzing && !conv.analysisError && (
                              <CheckCircle className="w-3 h-3 ml-2 text-green-500" />
                            )}
                          </div>
                          <div className="flex items-center text-xs text-gray-500 mt-1">
                            <Calendar className="w-3 h-3 mr-1" />
                            {conv.date}
                            {conv.tokenUsage && (
                              <>
                                <span className="mx-2">•</span>
                                <span>{formatTokenUsage(conv.tokenUsage.total_tokens)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conv.id);
                          }}
                          className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            {selectedConversation ? (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Conversation Details</h2>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <span>{selectedConversation.date}</span>
                      {selectedConversation.isAnalyzing && (
                        <div className="flex items-center text-indigo-600">
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          Analyzing...
                        </div>
                      )}
                      {selectedConversation.tokenUsage && !selectedConversation.isAnalyzing && (
                        <div className="flex items-center text-green-600">
                          <Brain className="w-4 h-4 mr-1" />
                          {formatTokenUsage(selectedConversation.tokenUsage.total_tokens)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <h3 className="text-md font-medium text-gray-700 mb-2">Full Transcript</h3>
                    <div className="p-4 bg-gray-50 rounded-lg border">
                      <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
                        {selectedConversation.transcript}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Analysis Tables */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-md font-semibold text-blue-700 flex items-center">
                        <Brain className="w-4 h-4 mr-2" />
                        Main Points
                      </h3>
                      {selectedConversation.isAnalyzing && (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      )}
                    </div>
                    <ul className="space-y-2">
                      {selectedConversation.analysis.mainPoints.map((point, idx) => (
                        <li key={idx} className="text-sm text-gray-700 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-200">
                          {point.trim() || 'No main points identified'}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-md font-semibold text-green-700 flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Action Items
                      </h3>
                      {selectedConversation.isAnalyzing && (
                        <Loader2 className="w-4 h-4 animate-spin text-green-500" />
                      )}
                    </div>
                    <ul className="space-y-2">
                      {selectedConversation.analysis.actionItems.map((item, idx) => (
                        <li key={idx} className="text-sm text-gray-700 p-3 bg-green-50 rounded-lg border-l-4 border-green-200">
                          {item.trim() || 'No action items identified'}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-md font-semibold text-purple-700 flex items-center">
                        <Zap className="w-4 h-4 mr-2" />
                        Next Steps
                      </h3>
                      {selectedConversation.isAnalyzing && (
                        <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                      )}
                    </div>
                    <ul className="space-y-2">
                      {selectedConversation.analysis.nextSteps.map((step, idx) => (
                        <li key={idx} className="text-sm text-gray-700 p-3 bg-purple-50 rounded-lg border-l-4 border-purple-200">
                          {step.trim() || 'No next steps identified'}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Retry Analysis Button */}
                {selectedConversation.analysisError && !selectedConversation.isAnalyzing && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="text-center">
                      <div className="mb-4">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                        <h3 className="text-lg font-medium text-gray-900 mb-1">Analysis Failed</h3>
                        <p className="text-sm text-gray-600">
                          The GPT-4o analysis encountered an error. You can retry the analysis.
                        </p>
                      </div>
                      <button
                        onClick={() => retryAnalysis(selectedConversation)}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition duration-200 flex items-center mx-auto"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry Analysis with GPT-4o
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <div className="flex items-center justify-center mb-6">
                  <div className="relative">
                    <Mic className="w-16 h-16 text-gray-300" />
                    <Brain className="w-6 h-6 text-indigo-600 absolute -top-1 -right-1 bg-white rounded-full p-1" />
                  </div>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to Voice Analytics</h3>
                <p className="text-gray-600 mb-6">
                  Start by recording a conversation or select an existing one from the sidebar to view detailed AI analysis.
                </p>
                <div className="text-sm text-gray-500">
                  <div className="inline-flex items-center bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full mb-4">
                    <Brain className="w-4 h-4 mr-1" />
                    <strong>Powered by GPT-4o</strong>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-left max-w-md mx-auto">
                    <ul className="space-y-1">
                      <li>• Real-time speech-to-text</li>
                      <li>• AI-powered main points</li>
                    </ul>
                    <ul className="space-y-1">
                      <li>• Smart action items</li>
                      <li>• Intelligent next steps</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;