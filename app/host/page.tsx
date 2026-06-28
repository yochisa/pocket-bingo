'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function generateUUID(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function generateRoomCode(): string {
  // 6-digit numeric code
  return String(Math.floor(100000 + Math.random() * 900000))
}

export default function HostPage() {
  const router = useRouter()
  const [maxWinners, setMaxWinners] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const hostId = generateUUID()
      const roomCode = generateRoomCode()

      localStorage.setItem('ebingo_host_id', hostId)

      const { error: insertError } = await supabase.from('rooms').insert({
        room_code: roomCode,
        host_id: hostId,
        status: 'waiting',
        max_winners: maxWinners,
        entry_deadline: null,
      })

      if (insertError) {
        throw new Error(insertError.message)
      }

      router.push(`/room/${roomCode}/host`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
      setLoading(false)
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 py-12 bg-gradient-to-b from-gray-900 to-gray-800">
      <div className="w-full max-w-sm">
        <button
          onClick={() => router.push('/')}
          className="mb-8 text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
        >
          ← 戻る
        </button>

        <h1 className="text-3xl font-bold text-white mb-2">部屋を作成</h1>
        <p className="text-gray-400 mb-8">ゲーム設定を入力してください</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-gray-300 font-medium" htmlFor="maxWinners">
              ビンゴ当選人数
            </label>
            <input
              id="maxWinners"
              type="number"
              min={1}
              max={10}
              value={maxWinners}
              onChange={(e) => setMaxWinners(Number(e.target.value))}
              className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
              required
            />
            <p className="text-gray-500 text-sm">1〜10人まで設定できます</p>
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-xl px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xl font-bold rounded-2xl shadow-lg transition-colors duration-150"
          >
            {loading ? '作成中...' : '部屋を作成する'}
          </button>
        </form>
      </div>
    </main>
  )
}
