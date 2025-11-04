'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Send, Upload, Trash2, FileText, X, Download } from 'lucide-react'

interface Document {
  id: string
  name: string
  size: number
  pages: number
  uploadDate: string
  uploadProgress?: number
}

interface Citation {
  document_name?: string
  page_number?: number
  excerpt?: string
  relevance_score?: number
}

interface SearchResponse {
  answer?: string
  citations?: Citation[]
  documents_referenced?: string[]
  confidence?: number
  follow_up_suggestions?: string[]
  metadata?: {
    search_queries_used?: string[]
    total_passages_retrieved?: number
    processing_time?: string
  }
}

interface ChatMessage {
  id: string
  type: 'user' | 'agent'
  content: string
  response?: SearchResponse
  timestamp: string
}

export default function HomePage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: number }>({})
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chatMessages])

  const handleFileSelect = async (files: FileList) => {
    const selectedFiles = Array.from(files).filter(file => file.type === 'application/pdf')

    for (const file of selectedFiles) {
      const fileId = `${file.name}-${Date.now()}`
      setUploadingFiles(prev => ({ ...prev, [fileId]: 0 }))

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadingFiles(prev => {
          const current = prev[fileId] || 0
          if (current >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return { ...prev, [fileId]: current + Math.random() * 40 }
        })
      }, 500)

      // Simulate document processing
      await new Promise(resolve => setTimeout(resolve, 2000))
      clearInterval(progressInterval)

      const newDoc: Document = {
        id: fileId,
        name: file.name,
        size: file.size,
        pages: Math.floor(Math.random() * 100) + 10,
        uploadDate: new Date().toLocaleDateString(),
      }

      setDocuments(prev => [newDoc, ...prev])
      setUploadingFiles(prev => {
        const updated = { ...prev }
        delete updated[fileId]
        return updated
      })
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleDeleteDocument = async (docId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== docId))
    setDeleteConfirm(null)
  }

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || loading) return

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      type: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString(),
    }

    setChatMessages(prev => [...prev, userMessage])
    setQuery('')
    setLoading(true)

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          agent_id: '6909a9b15d0b2c2413178b1e',
        }),
      })

      const data = await response.json()

      let agentResponse: SearchResponse = {
        answer: 'No documents found matching your query. Please upload documents to get started.',
        citations: [],
        documents_referenced: [],
        confidence: 0,
        follow_up_suggestions: [],
        metadata: {
          search_queries_used: [],
          total_passages_retrieved: 0,
          processing_time: '0s',
        },
      }

      if (data.success && data.response) {
        const parsedResponse = typeof data.response === 'string'
          ? JSON.parse(data.response)
          : data.response

        agentResponse = {
          answer: parsedResponse.answer ?? agentResponse.answer,
          citations: parsedResponse.citations ?? agentResponse.citations,
          documents_referenced: parsedResponse.documents_referenced ?? agentResponse.documents_referenced,
          confidence: parsedResponse.confidence ?? agentResponse.confidence,
          follow_up_suggestions: parsedResponse.follow_up_suggestions ?? agentResponse.follow_up_suggestions,
          metadata: parsedResponse.metadata ?? agentResponse.metadata,
        }
      }

      const agentMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        type: 'agent',
        content: agentResponse.answer,
        response: agentResponse,
        timestamp: new Date().toLocaleTimeString(),
      }

      setChatMessages(prev => [...prev, agentMessage])
    } catch (err) {
      console.error('Error querying agent:', err)
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        type: 'agent',
        content: 'An error occurred while processing your query. Please try again.',
        timestamp: new Date().toLocaleTimeString(),
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleFollowUp = (suggestion: string) => {
    setQuery(suggestion)
  }

  const totalSize = documents.reduce((sum, doc) => sum + doc.size, 0)
  const totalPages = documents.reduce((sum, doc) => sum + doc.pages, 0)

  return (
    <div className="h-screen flex bg-slate-50">
      {/* Sidebar - Document Library */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col overflow-hidden`}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
            <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf"
            onChange={e => e.target.files && handleFileSelect(e.target.files)}
            className="hidden"
          />
          <Button onClick={handleUploadClick} className="w-full bg-blue-600 hover:bg-blue-700">
            <Upload className="w-4 h-4 mr-2" />
            Upload PDFs
          </Button>
        </div>

        <div className="px-6 py-3 bg-gray-50">
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="text-lg font-semibold text-gray-900">{documents.length}</div>
              <div className="text-xs text-gray-500">Files</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">{totalPages}</div>
              <div className="text-xs text-gray-500">Pages</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">{(totalSize / (1024 * 1024)).toFixed(1)}MB</div>
              <div className="text-xs text-gray-500">Size</div>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-3">
            {documents.length === 0 && !Object.keys(uploadingFiles).length && (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No documents yet</p>
                <p className="text-xs text-gray-400">Upload your first document to get started</p>
              </div>
            )}

            {Object.entries(uploadingFiles).map(([fileId, progress]) => (
              <Card key={fileId} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{fileId.split('-')[0]}</p>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                        <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{Math.round(progress)}% uploading</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {documents.map(doc => (
              <Card key={doc.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">{doc.pages} pages</Badge>
                          <Badge variant="secondary" className="text-xs">{(doc.size / (1024 * 1024)).toFixed(1)}MB</Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{doc.uploadDate}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteConfirm(doc.id)}
                      className="p-2 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded">
                <FileText className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">Document Search</h1>
              <p className="text-xs text-gray-500">Ask anything about your documents</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{documents.length} documents</p>
            <p className="text-xs text-gray-500">{totalPages} pages</p>
          </div>
        </div>

        {/* Chat Messages */}
        <ScrollArea className="flex-1 p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {chatMessages.length === 0 && (
              <div className="text-center py-20">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Start Searching Your Documents</h2>
                <p className="text-gray-500 mb-8">Upload PDFs and ask questions to get started</p>
              </div>
            )}

            {chatMessages.map(message => (
              <div key={message.id}>
                {message.type === 'user' ? (
                  <div className="flex justify-end mb-4">
                    <Card className="bg-blue-600 text-white max-w-2xl">
                      <CardContent className="p-4">
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs opacity-75 mt-2">{message.timestamp}</p>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Card className="bg-gray-50 max-w-3xl">
                      <CardContent className="p-6">
                        <p className="text-sm text-gray-900 leading-relaxed mb-4">{message.content}</p>

                        {message.response && (
                          <div className="space-y-4">
                            {message.response.citations && message.response.citations.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Sources</p>
                                <div className="flex flex-wrap gap-2">
                                  {message.response.citations.map((citation, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => setSelectedCitation(citation)}
                                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-full hover:bg-blue-50 hover:border-blue-300 transition-colors text-xs"
                                    >
                                      <FileText className="w-3 h-3 text-blue-600" />
                                      <span className="text-gray-700">{citation.document_name}</span>
                                      <span className="text-gray-500">p.{citation.page_number}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {message.response.citations && message.response.citations.length > 0 && <Separator />}

                            <div className="grid grid-cols-3 gap-4 text-center text-xs">
                              <div>
                                <p className="font-semibold text-gray-900">{Math.round((message.response.confidence ?? 0) * 100)}%</p>
                                <p className="text-gray-500">Confidence</p>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{message.response.documents_referenced?.length ?? 0}</p>
                                <p className="text-gray-500">Documents</p>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{message.response.metadata?.total_passages_retrieved ?? 0}</p>
                                <p className="text-gray-500">Passages</p>
                              </div>
                            </div>

                            {message.response.follow_up_suggestions && message.response.follow_up_suggestions.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Follow-up Questions</p>
                                <div className="space-y-2">
                                  {message.response.follow_up_suggestions.slice(0, 3).map((suggestion, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => handleFollowUp(suggestion)}
                                      className="w-full text-left text-xs p-2 rounded border border-gray-300 hover:bg-gray-100 text-gray-700 transition-colors"
                                    >
                                      {suggestion}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            <p className="text-xs text-gray-500 mt-4">Processed in {message.response.metadata?.processing_time ?? '0s'}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <Card className="bg-gray-50">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-6">
          <form onSubmit={handleQuery} className="max-w-4xl mx-auto">
            <div className="flex gap-3">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Ask anything about your documents..."
                disabled={loading || documents.length === 0}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
              />
              <Button
                type="submit"
                disabled={loading || !query.trim() || documents.length === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            {documents.length === 0 && (
              <p className="text-xs text-gray-500 mt-2">Upload documents to enable searching</p>
            )}
          </form>
        </div>
      </div>

      {/* Citation Detail Modal */}
      <Dialog open={!!selectedCitation} onOpenChange={() => setSelectedCitation(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedCitation?.document_name}</DialogTitle>
            <DialogDescription>Page {selectedCitation?.page_number}</DialogDescription>
          </DialogHeader>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-900 leading-relaxed italic">{selectedCitation?.excerpt}</p>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Relevance:</span>
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${(selectedCitation?.relevance_score ?? 0) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-700">{Math.round((selectedCitation?.relevance_score ?? 0) * 100)}%</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Document</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this document? This action cannot be undone. The document will be removed from your knowledge base.
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteDocument(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
