'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { generateCard } from '@/lib/bingo'

export default function JoinPage() {
  const router = useRouter()
  const [roomCode, setRoomCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const trimmedCode = roomCode.trim().toUpperCase()
    const trimmedNickname = nickname.trim()

    if (trimmedCode.length !== 6) {
      setError('ルームコードは6桁で入力してください')
      setLoading(false)
      return
    }

    if (!trimmedNickname) {
      setError('ニックネームを入力してください')
      setLoading(false)
      return
    }

    try {
      // Look up room
      const { data: rooms, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', trimmedCode)
        .limit(1)

      if (roomError) throw new Error(roomError.message)
      if (!rooms || rooms.length === 0) {
        throw new Error('ルームが見つかりません。ルームコードを確認してください。')
      }

      const room = rooms[0]

      if (room.status === 'finished') {
        throw new Error('このゲームはすでに終了しています。')
      }

      // Check entry deadline
      if (room.entry_deadline) {
        const deadline = new Date(room.entry_deadline)
        if (new Date() > deadline) {
          throw new Error('参加受付時間が終了しています。')
        }
      }

      // Check if player already joined this room from this browser
      const existingPlayerId = localStorage.getItem('ebingo_player_id')
      if (existingPlayerId) {
        const { data: existingPlayer } = await supabase
          .from('players')
          .select('id, room_id')
          .eq('id', existingPlayerId)
          .limit(1)

        if (existingPlayer && existingPlayer.length > 0 && existingPlayer[0].room_id === room.id) {
          // Already in this room, redirect to player page
          router.push(`/room/${trimmedCode}/player?playerId=${existingPlayerId}`)
          return
        }
      }

      // Generate bingo card
      const card = generateCard()

      // Insert player
      const { data: players, error: playerError } = await supabase
        .from('players')
        .insert({
          room_id: room.id,
          nickname: trimmedNickname,
          card: card,
          opened_numbers: [],
          is_reach: false,
          is_bingo: false,
          bingo_rank: null,
        })
        .select()

      if (playerError) throw new Error(playerError.message)
      if (!players || players.length === 0) {
        throw new Error('参加登録に失敗しました。もう一度お試しください。')
      }

      const player = players[0]
      localStorage.setItem('ebingo_player_id', player.id)

      router.push(`/room/${trimmedCode}/player?playerId=${player.id}`)
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

        <h1 className="text-3xl font-bold text-white mb-2">ゲームに参加</h1>
        <p className="text-gray-400 mb-8">ルームコードとニックネームを入力してください</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-gray-300 font-medium" htmlFor="roomCode">
              ルームコード
            </label>
            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              maxLength={6}
              className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white text-2xl font-mono tracking-widest text-center focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
              required
              inputMode="numeric"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-gray-300 font-medium" htmlFor="nickname">
              ニックネーム
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 20))}
              placeholder="あなたの名前"
              maxLength={20}
              className="bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-xl px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xl font-bold rounded-2xl shadow-lg transition-colors duration-150 mt-2"
          >
            {loading ? '参加中...' : 'ゲームに参加する'}
          </button>
        </form>
      </div>
    </main>
  )
}
