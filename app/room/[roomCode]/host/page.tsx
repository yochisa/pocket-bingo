'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Room, Player, DrawnNumber } from '@/types'

export default function HostRoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = params.roomCode as string

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [drawnNumbers, setDrawnNumbers] = useState<DrawnNumber[]>([])
  const [drawing, setDrawing] = useState(false)
  const [lastDrawn, setLastDrawn] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isHost, setIsHost] = useState(false)

  // Load initial data
  useEffect(() => {
    const hostId = localStorage.getItem('ebingo_host_id')

    const loadRoom = async () => {
      const { data: rooms, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', roomCode)
        .limit(1)

      if (roomError || !rooms || rooms.length === 0) {
        setError('ルームが見つかりません')
        setLoading(false)
        return
      }

      const r = rooms[0] as Room
      setRoom(r)
      setIsHost(r.host_id === hostId)

      // Load players
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', r.id)
        .order('joined_at', { ascending: true })

      setPlayers((playersData as Player[]) || [])

      // Load drawn numbers
      const { data: drawnData } = await supabase
        .from('drawn_numbers')
        .select('*')
        .eq('room_id', r.id)
        .order('drawn_at', { ascending: true })

      const drawn = (drawnData as DrawnNumber[]) || []
      setDrawnNumbers(drawn)
      if (drawn.length > 0) {
        setLastDrawn(drawn[drawn.length - 1].number)
      }

      setLoading(false)
    }

    loadRoom()
  }, [roomCode])

  // Realtime subscriptions
  useEffect(() => {
    if (!room) return

    const roomChannel = supabase
      .channel(`host-room-${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => {
          if (payload.new) {
            setRoom(payload.new as Room)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` },
        () => {
          // Reload all players on any change
          supabase
            .from('players')
            .select('*')
            .eq('room_id', room.id)
            .order('joined_at', { ascending: true })
            .then(({ data }) => {
              if (data) setPlayers(data as Player[])
            })
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'drawn_numbers', filter: `room_id=eq.${room.id}` },
        (payload) => {
          const newDrawn = payload.new as DrawnNumber
          setDrawnNumbers((prev) => [...prev, newDrawn])
          setLastDrawn(newDrawn.number)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(roomChannel)
    }
  }, [room?.id])

  const startGame = useCallback(async () => {
    if (!room) return
    const deadline = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    const { error: updateError } = await supabase
      .from('rooms')
      .update({ status: 'playing', entry_deadline: deadline })
      .eq('id', room.id)

    if (updateError) {
      setError(updateError.message)
    }
  }, [room])

  const drawNumber = useCallback(async () => {
    if (!room || drawing) return
    setDrawing(true)
    setError(null)

    try {
      const drawnSet = new Set(drawnNumbers.map((d) => d.number))
      const available: number[] = []
      for (let n = 1; n <= 75; n++) {
        if (!drawnSet.has(n)) available.push(n)
      }

      if (available.length === 0) {
        setError('すべての番号が引かれました')
        setDrawing(false)
        return
      }

      const picked = available[Math.floor(Math.random() * available.length)]

      const { error: insertError } = await supabase.from('drawn_numbers').insert({
        room_id: room.id,
        number: picked,
      })

      if (insertError) throw new Error(insertError.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setDrawing(false)
    }
  }, [room, drawnNumbers, drawing])

  const getColumnLabel = (num: number): string => {
    if (num >= 1 && num <= 15) return 'B'
    if (num >= 16 && num <= 30) return 'I'
    if (num >= 31 && num <= 45) return 'N'
    if (num >= 46 && num <= 60) return 'G'
    return 'O'
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gray-900">
        <p className="text-gray-400 text-xl">読み込み中...</p>
      </main>
    )
  }

  if (error && !room) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-gray-900 gap-4">
        <p className="text-red-400 text-xl">{error}</p>
        <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white">
          トップに戻る
        </button>
      </main>
    )
  }

  if (!room) return null

  const isWaiting = room.status === 'waiting'
  const isPlaying = room.status === 'playing'

  const bingoed = players.filter((p) => p.is_bingo).sort((a, b) => (a.bingo_rank ?? 99) - (b.bingo_rank ?? 99))
  const reached = players.filter((p) => p.is_reach && !p.is_bingo)
  const others = players.filter((p) => !p.is_reach && !p.is_bingo)

  return (
    <main className="min-h-screen bg-gray-900 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white text-sm">
          ← トップ
        </button>
        <span className="text-gray-400 text-sm">
          {isWaiting ? '待機中' : isPlaying ? 'ゲーム中' : '終了'}
        </span>
      </div>

      {/* Room code display */}
      <div className="text-center mb-8">
        <p className="text-gray-400 text-sm mb-1">ルームコード</p>
        <div className="text-5xl font-mono font-bold text-white tracking-widest bg-gray-800 rounded-2xl py-4 px-6 inline-block">
          {room.room_code}
        </div>
        <p className="text-gray-500 text-sm mt-2">参加者にこのコードを共有してください</p>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-xl px-4 py-3 text-red-300 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Waiting phase */}
      {isWaiting && (
        <div>
          <div className="mb-6">
            <h2 className="text-gray-300 font-semibold mb-3 flex items-center gap-2">
              参加者
              <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                {players.length}人
              </span>
            </h2>
            {players.length === 0 ? (
              <p className="text-gray-500 text-center py-8">まだ誰も参加していません</p>
            ) : (
              <div className="flex flex-col gap-2">
                {players.map((p) => (
                  <div key={p.id} className="bg-gray-800 rounded-xl px-4 py-3 text-white">
                    {p.nickname}
                  </div>
                ))}
              </div>
            )}
          </div>

          {isHost && (
            <button
              onClick={startGame}
              disabled={players.length === 0}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-xl font-bold rounded-2xl shadow-lg transition-colors"
            >
              🎮 ゲーム開始
            </button>
          )}
        </div>
      )}

      {/* Playing phase */}
      {isPlaying && (
        <div>
          {/* Current number */}
          <div className="text-center mb-6">
            {lastDrawn ? (
              <div className="bg-gray-800 rounded-2xl py-6 px-4 mb-4">
                <p className="text-gray-400 text-sm mb-2">現在の番号</p>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-indigo-400 text-3xl font-bold">{getColumnLabel(lastDrawn)}</span>
                  <span className="text-white text-8xl font-bold leading-none">{lastDrawn}</span>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-2xl py-6 px-4 mb-4">
                <p className="text-gray-400">まだ番号が引かれていません</p>
              </div>
            )}

            {isHost && (
              <button
                onClick={drawNumber}
                disabled={drawing || drawnNumbers.length >= 75}
                className="w-full py-5 bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-gray-900 text-2xl font-bold rounded-2xl shadow-lg transition-colors mb-4"
              >
                {drawing ? '引いています...' : '🎱 番号を引く'}
              </button>
            )}
          </div>

          {/* Drawn numbers history */}
          {drawnNumbers.length > 0 && (
            <div className="mb-6">
              <h2 className="text-gray-300 font-semibold mb-3">
                引いた番号
                <span className="text-gray-500 text-sm ml-2">({drawnNumbers.length}/75)</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {[...drawnNumbers].reverse().map((d) => (
                  <span
                    key={d.id}
                    className="bg-gray-700 text-white text-sm font-mono px-2 py-1 rounded-lg"
                  >
                    {getColumnLabel(d.number)}{d.number}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Player status */}
          <div>
            <h2 className="text-gray-300 font-semibold mb-3">参加者の状況</h2>
            <div className="flex flex-col gap-2">
              {bingoed.map((p) => (
                <div key={p.id} className="bg-yellow-500/20 border border-yellow-500 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-white font-medium">{p.nickname}</span>
                  <div className="flex items-center gap-2">
                    <span className="bg-yellow-500 text-gray-900 text-xs font-bold px-2 py-1 rounded-full">
                      🎉 第{p.bingo_rank}位
                    </span>
                    <span className="bg-yellow-400 text-gray-900 text-xs font-bold px-2 py-1 rounded-full">BINGO</span>
                  </div>
                </div>
              ))}
              {reached.map((p) => (
                <div key={p.id} className="bg-orange-500/10 border border-orange-500/50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-white font-medium">{p.nickname}</span>
                  <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">リーチ</span>
                </div>
              ))}
              {others.map((p) => (
                <div key={p.id} className="bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-white">{p.nickname}</span>
                  <span className="text-gray-500 text-xs">プレイ中</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {room.status === 'finished' && (
        <div className="text-center py-12">
          <p className="text-4xl mb-4">🏆</p>
          <p className="text-white text-2xl font-bold mb-2">ゲーム終了</p>
          <button onClick={() => router.push('/')} className="mt-6 text-gray-400 hover:text-white">
            トップに戻る
          </button>
        </div>
      )}
    </main>
  )
}
