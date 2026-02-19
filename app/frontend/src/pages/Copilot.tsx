import ChatInterface from '../components/ChatInterface'

export default function Copilot() {
  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <h2 className="text-xl font-bold text-gray-900">Copilot</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          AI-powered NEM market analyst — ask anything about Australian energy markets
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <ChatInterface />
      </div>
    </div>
  )
}
