'use client'

import { useRouter } from 'next/navigation'

export default function TopPage() {
  const router = useRouter()

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 py-12 bg-gradient-to-b from-gray-900 to-gray-800">
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold text-white mb-3 tracking-tight">
          🎊 Pocket Bingo
        </h1>
        <p className="text-gray-400 text-lg">
          イベント用ビンゴゲーム
        </p>
      </div>

      <div className="flex flex-col gap-5 w-full max-w-sm">
        <button
          onClick={() => router.push('/host')}
          className="w-full py-5 px-6 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xl font-bold rounded-2xl shadow-lg transition-colors duration-150"
        >
          🎤 主催者として始める
        </button>

        <button
          onClick={() => router.push('/join')}
          className="w-full py-5 px-6 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xl font-bold rounded-2xl shadow-lg transition-colors duration-150"
        >
          🙋 参加者として入る
        </button>
      </div>
    </main>
  )
}
