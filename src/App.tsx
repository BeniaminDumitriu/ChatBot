import { ChatWidget } from './components/ChatWidget'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold">ChatBot Demo</h1>
        <p className="mt-2 text-gray-600">
          Apasă butonul de chat din dreapta-jos pentru a deschide conversația.
        </p>
      </div>

      <ChatWidget />
    </div>
  )
}




