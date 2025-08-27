# ChatBot Widget

Un chatbot modern și interactiv construit cu React, TypeScript și Tailwind CSS, care poate fi integrat în orice proiect web.

## 🚀 Caracteristici

- **Design modern** cu gradient-uri și animații
- **Complet configurabil** - teme, poziții, dimensiuni
- **Responsive** și adaptabil la orice proiect
- **Integrare simplă** în React, Vue, vanilla JS
- **Backend independent** cu Node.js și Supabase
- **API flexibil** pentru personalizare

## 🛠️ Tehnologii folosite

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express
- **Database**: Supabase
- **Package Manager**: pnpm

## 📦 Instalare

### Opțiunea 1: Ca pachet npm (Recomandat)
```bash
npm install @your-username/chatbot-widget
# sau
pnpm add @your-username/chatbot-widget
```

### Opțiunea 2: Ca component local
```bash
# Copiază ChatWidget.tsx în proiectul tău
# Instalează dependințele necesare
```

## 🔧 Utilizare

### În React/Next.js:
```tsx
import ChatWidget from '@your-username/chatbot-widget'

function MyApp() {
  return (
    <div>
      {/* Conținutul tău */}
      <ChatWidget 
        apiBase="https://api.mysite.com"
        siteId="my-project"
        theme="dark"
        position="bottom-left"
        size="large"
        title="Support Chat"
        primaryColor="from-blue-600 to-purple-600"
        secondaryColor="from-green-500 to-blue-500"
      />
    </div>
  )
}
```

### În Vue.js:
```vue
<template>
  <div>
    <!-- Conținutul tău -->
    <div id="chatbot-mount"></div>
  </div>
</template>

<script>
import { createApp } from 'vue'
import ChatWidget from '@your-username/chatbot-widget'

export default {
  mounted() {
    const app = createApp(ChatWidget, {
      apiBase: 'https://api.mysite.com',
      siteId: 'my-project',
      theme: 'light'
    })
    app.mount('#chatbot-mount')
  }
}
</script>
```

### În vanilla JavaScript:
```html
<script src="https://unpkg.com/@your-username/chatbot-widget/dist/index.js"></script>
<div id="chatbot"></div>

<script>
  const chatbot = new ChatWidget({
    apiBase: 'https://api.mysite.com',
    siteId: 'my-project',
    theme: 'dark'
  })
  chatbot.mount('#chatbot')
</script>
```

## ⚙️ Configurare

### Props disponibile:

| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| `apiBase` | string | `''` | URL-ul către backend-ul tău |
| `siteId` | string | `'default'` | ID-ul site-ului pentru tracking |
| `theme` | `'light' \| 'dark'` | `'light'` | Tema chatbot-ului |
| `position` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | Poziția pe ecran |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | Dimensiunea butonului |
| `title` | string | `'AI Assistant'` | Titlul în header |
| `primaryColor` | string | `'from-purple-600 via-blue-600 to-indigo-600'` | Gradient-ul principal |
| `secondaryColor` | string | `'from-purple-600 to-blue-600'` | Gradient-ul secundar |

### Exemple de culori:
```tsx
// Tema albastră
primaryColor="from-blue-600 to-indigo-600"
secondaryColor="from-blue-500 to-cyan-500"

// Tema verde
primaryColor="from-green-600 to-emerald-600"
secondaryColor="from-green-500 to-teal-500"

// Tema roșie
primaryColor="from-red-600 to-pink-600"
secondaryColor="from-red-500 to-rose-500"
```

## 🚀 Backend Setup

Pentru ca chatbot-ul să funcționeze, ai nevoie de un backend care să răspundă la:

- `POST /api/chat` - pentru mesaje
- `POST /api/session/reset` - pentru reset sesiune
- `GET /api/health` - pentru health check

### Variabile de mediu necesare:
```env
OPENROUTER_API_KEY=your_openrouter_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE=your_supabase_key
PORT=8787
```

## 📱 Responsive Design

Chatbot-ul se adaptează automat la:
- **Mobile**: `w-[95vw]` pentru lățime completă
- **Desktop**: `max-w-md` pentru lățime optimă
- **Înălțime**: `h-[50vh]` (50% din ecran)

## 🎨 Personalizare avansată

### CSS Custom:
```css
/* Personalizează scrollbar-ul */
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #your-color;
}

/* Personalizează animațiile */
.chat-widget {
  --animation-duration: 0.5s;
}
```

### JavaScript Events:
```tsx
<ChatWidget 
  onMessage={(message) => console.log('New message:', message)}
  onOpen={() => console.log('Chat opened')}
  onClose={() => console.log('Chat closed')}
/>
```

## 🔒 Securitate

- **CORS** configurat pentru orice origin
- **Rate limiting** opțional
- **Session management** cu TTL
- **Input sanitization** pentru mesaje

## 📊 Analytics

Chatbot-ul trimite automat:
- Numărul de mesaje per sesiune
- Timpul de răspuns
- Rate-ul de succes
- Metrica de utilizare

## 🤝 Contribuții

Contribuțiile sunt binevenite! Te rog să creezi un issue sau un pull request.

## 📄 Licență

Acest proiect este licențiat sub [MIT License](LICENSE).

## 🆘 Suport

Pentru suport tehnic:
- Creează un issue pe GitHub
- Contactează-mă la beniamidumitriu@gmail.com
