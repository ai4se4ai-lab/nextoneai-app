'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, User, LogOut, Calendar, Trash2 } from 'lucide-react';

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
}

interface User {
  email: string;
  name: string;
}

const Dashboard = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);

  // Mock user data - replace with your authentication system
  const user: User = { email: 'user@example.com', name: 'Demo User' };

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
      };
    }
  }, []);

  const startRecording = () => {
    if (recognitionRef.current) {
      setCurrentTranscript('');
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      
      if (currentTranscript.trim()) {
        saveConversation(currentTranscript);
      }
    }
  };

  const analyzeTranscript = (transcript: string) => {
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim());
    
    // Simple keyword-based analysis
    const mainPoints = sentences.filter(sentence => 
      sentence.toLowerCase().includes('important') || 
      sentence.toLowerCase().includes('key') ||
      sentence.toLowerCase().includes('main') ||
      sentence.toLowerCase().includes('significant')
    ).slice(0, 3);

    const actionItems = sentences.filter(sentence => 
      sentence.toLowerCase().includes('need to') || 
      sentence.toLowerCase().includes('should') ||
      sentence.toLowerCase().includes('must') ||
      sentence.toLowerCase().includes('action') ||
      sentence.toLowerCase().includes('todo') ||
      sentence.toLowerCase().includes('task')
    ).slice(0, 3);

    const nextSteps = sentences.filter(sentence => 
      sentence.toLowerCase().includes('next') || 
      sentence.toLowerCase().includes('follow up') ||
      sentence.toLowerCase().includes('continue') ||
      sentence.toLowerCase().includes('plan') ||
      sentence.toLowerCase().includes('schedule')
    ).slice(0, 3);

    return {
      mainPoints: mainPoints.length ? mainPoints : ['No specific main points identified'],
      actionItems: actionItems.length ? actionItems : ['No action items identified'],
      nextSteps: nextSteps.length ? nextSteps : ['No next steps identified']
    };
  };

  const saveConversation = (transcript: string) => {
    const analysis = analyzeTranscript(transcript);
    const newConversation: Conversation = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      transcript,
      analysis,
      title: transcript.substring(0, 50) + (transcript.length > 50 ? '...' : '')
    };
    
    setConversations(prev => [newConversation, ...prev]);
    setCurrentTranscript('');
  };

  const deleteConversation = (id: number) => {
    setConversations(prev => prev.filter(conv => conv.id !== id));
    if (selectedConversation && selectedConversation.id === id) {
      setSelectedConversation(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Mic className="w-8 h-8 text-indigo-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Voice Analytics Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-600">
                <User className="w-4 h-4 mr-2" />
                {user.name}
              </div>
              <button className="text-gray-500 hover:text-gray-700 p-2">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Recording Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Record Conversation</h2>
              
              <div className="text-center">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-20 h-20 rounded-full flex items-center justify-center text-white transition-all duration-200 ${
                    isRecording 
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </button>
                
                <p className="mt-4 text-sm text-gray-600">
                  {isRecording ? 'Recording... Click to stop' : 'Click to start recording'}
                </p>
              </div>

              {currentTranscript && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Live Transcript:</h3>
                  <p className="text-sm text-gray-900">{currentTranscript}</p>
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
                  <p className="text-gray-500 text-sm">No conversations yet. Start recording to see them here.</p>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedConversation?.id === conv.id 
                          ? 'bg-indigo-50 border border-indigo-200' 
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                      onClick={() => setSelectedConversation(conv)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {conv.title}
                          </p>
                          <div className="flex items-center text-xs text-gray-500 mt-1">
                            <Calendar className="w-3 h-3 mr-1" />
                            {conv.date}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conv.id);
                          }}
                          className="text-gray-400 hover:text-red-500 p-1"
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
                    <span className="text-sm text-gray-500">{selectedConversation.date}</span>
                  </div>
                  
                  <div className="mb-6">
                    <h3 className="text-md font-medium text-gray-700 mb-2">Full Transcript</h3>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-gray-900 leading-relaxed">{selectedConversation.transcript}</p>
                    </div>
                  </div>
                </div>

                {/* Analysis Tables */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-md font-semibold text-blue-700 mb-4">Main Points</h3>
                    <ul className="space-y-2">
                      {selectedConversation.analysis.mainPoints.map((point, idx) => (
                        <li key={idx} className="text-sm text-gray-700 p-2 bg-blue-50 rounded">
                          {point.trim() || 'No main points identified'}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-md font-semibold text-green-700 mb-4">Action Items</h3>
                    <ul className="space-y-2">
                      {selectedConversation.analysis.actionItems.map((item, idx) => (
                        <li key={idx} className="text-sm text-gray-700 p-2 bg-green-50 rounded">
                          {item.trim() || 'No action items identified'}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-md font-semibold text-purple-700 mb-4">Next Steps</h3>
                    <ul className="space-y-2">
                      {selectedConversation.analysis.nextSteps.map((step, idx) => (
                        <li key={idx} className="text-sm text-gray-700 p-2 bg-purple-50 rounded">
                          {step.trim() || 'No next steps identified'}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <Mic className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to Voice Analytics</h3>
                <p className="text-gray-600 mb-6">
                  Start by recording a conversation or select an existing one from the sidebar to view detailed analysis.
                </p>
                <div className="text-sm text-gray-500">
                  <p>Features:</p>
                  <ul className="mt-2 space-y-1">
                    <li>• Real-time speech-to-text transcription</li>
                    <li>• Automatic extraction of main points</li>
                    <li>• Action item identification</li>
                    <li>• Next steps planning</li>
                  </ul>
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