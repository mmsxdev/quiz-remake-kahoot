import type { Metadata } from 'next'
import { Inter, Outfit } from 'next/font/google'
import './globals.css'
import { QuizProvider } from '@/lib/quiz-context'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'QuizDida — Competência ou Capacidade? | SENAI',
  description:
    'Quiz interativo de formação docente baseado na Metodologia SENAI de Educação Profissional (MSEP). Identifique e diferencie Competências e Capacidades na perspectiva da MSEP.',
  keywords: ['SENAI', 'MSEP', 'competência', 'capacidade', 'formação docente', 'educação profissional'],
  authors: [{ name: 'SENAI' }],
  openGraph: {
    title: 'QuizDida — Competência ou Capacidade?',
    description:
      'Quiz interativo de formação docente para docentes e coordenadores do SENAI.',
    type: 'website',
    locale: 'pt_BR',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <QuizProvider>{children}</QuizProvider>
      </body>
    </html>
  )
}
