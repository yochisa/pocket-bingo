'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { checkBingo } from '@/lib/bingo'
import type { Room, Player, DrawnNumber } from '@/types'

const COLUMN_HEADERS = ['B', 'I', 'N', 'G', 'O']

function getColumnLabel(num: number): string {
  if (num >= 1 && num <= 15) return 'B'
  if (num >= 16 && num <= 30) return 'I'
  if (num >= 31 && num <= 45) return 'N'
  if (num >= 46 && num <= 60) return 'G'
  return 'O'
}

export default function PlayerRoomPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const roomCode = params.roomCode as string
  const playerIdFromQuery = searchParams.get('playerId')

  const [room, setRoom] = useState<Room | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [drawnNumbers, setDrawnNumbers] = useState<DrawnNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showBingoEffect, setShowBingoEffect] = useState(false)
  const processingRef = useRef(false)

  const playerId = playerIdFromQuery || (typeof window !== 'undefined' ? localStorage.getItem('ebingo_player_id') : null)

  // Load initial data
  useEffect(() => {
    if (!playerId) {
      setError('プレイヤーIDが見つかりません。再度参加してください。')
      setLoading(false)
      return
    }

    const loadData = async () => {
      // Load room
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

      // Load this player
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .limit(1)

      if (playerError || !playerData || playerData.length === 0) {
        setError('プレイヤーデータが見つかりません')
        setLoading(false)
        return
      }

      const p = playerData[0] as Player
      setPlayer(p)

      // Load all players in room
      const { data: allPlayers } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', r.id)
        .order('joined_at', { ascending: true })

      setPlayers((allPlayers as Player[]) || [])

      // Load drawn numbers
      const { data: drawnData } = await supabase
        .from('drawn_numbers')
        .select('*')
        .eq('room_id', r.id)
        .order('drawn_at', { ascending: true })

      setDrawnNumbers((drawnData as DrawnNumber[]) || [])
      setLoading(false)
    }

    loadData()
  }, [roomCode, playerId])

  // Process newly drawn number: update opened_numbers, check bingo/reach
  const processNewDrawn = useCallback(
    async (updatedDrawnNumbers: DrawnNumber[], currentPlayer: Player) => {
      if (processingRef.current) return
      if (currentPlayer.is_bingo) return // already bingo, nothing to do
      processingRef.current = true

      try {
        const openedSet = new Set(currentPlayer.opened_numbers)
        const card = currentPlayer.card
        const allDrawnNums = updatedDrawnNumbers.map((d) => d.number)

        // Compute new opened_numbers
        const newOpenedNumbers: number[] = []
        for (const n of allDrawnNums) {
          if (card.includes(n) || n === 0) {
            newOpenedNumbers.push(n)
          }
        }
        // Include FREE (0) always
        const openedForCheck = newOpenedNumbers.filter((n) => n > 0)

        // Add FREE in check by passing the card (which has 0 at index 12)
        const { isBingo, isReach } = checkBingo(card, openedForCheck)

        const wasAlreadyBingo = currentPlayer.is_bingo
        const newlyBingo = isBingo && !wasAlreadyBingo

        let bingoRank = currentPlayer.bingo_rank
        if (newlyBingo) {
          // Count how many players already have bingo to determine rank
          const { count } = await supabase
            .from('players')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', currentPlayer.room_id)
            .eq('is_bingo', true)

          bingoRank = (count ?? 0) + 1

          setShowBingoEffect(true)
        }

        // Only update if something changed
        const openedChanged =
          JSON.stringify(openedForCheck.sort()) !==
          JSON.stringify([...openedSet].sort())
        const reachChanged = isReach !== currentPlayer.is_reach
        const bingoChanged = isBingo !== currentPlayer.is_bingo

        if (openedChanged || reachChanged || bingoChanged) {
          const { data: updated, error: updateError } = await supabase
            .from('players')
            .update({
              opened_numbers: openedForCheck,
              is_reach: isReach,
              is_bingo: isBingo,
              bingo_rank: newlyBingo ? bingoRank : currentPlayer.bingo_rank,
            })
            .eq('id', currentPlayer.id)
            .select()

          if (!updateError && updated && updated.length > 0) {
            setPlayer(updated[0] as Player)
          }
        }
      } finally {
        processingRef.current = false
      }
    },
    []
  )

  // Realtime subscriptions
  useEffect(() => {
    if (!room || !player) return

    const ch = supabase
      .channel(`player-room-${room.id}-${player.id}`)
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
          supabase
            .from('players')
            .select('*')
            .eq('room_id', room.id)
            .order('joined_at', { ascending: true })
            .then(({ data }) => {
              if (data) setPlayers(data as Player[])
            })
          // Refresh this player's data
          supabase
            .from('players')
            .select('*')
            .eq('id', player.id)
            .limit(1)
            .then(({ data }) => {
              if (data && data.length > 0) setPlayer(data[0] as Player)
            })
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'drawn_numbers', filter: `room_id=eq.${room.id}` },
        (payload) => {
          const newDrawn = payload.new as DrawnNumber
          setDrawnNumbers((prev) => {
            const updated = [...prev, newDrawn]
            // Use the latest player state at time of event
            setPlayer((currentPlayer) => {
              if (currentPlayer) {
                processNewDrawn(updated, currentPlayer)
              }
              return currentPlayer
            })
            return updated
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [room?.id, player?.id, processNewDrawn])

  // Process drawn numbers on initial load if playing
  useEffect(() => {
    if (room?.status === 'playing' && player && drawnNumbers.length > 0 && !loading) {
      processNewDrawn(drawnNumbers, player)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gray-900">
        <p className="text-gray-400 text-xl">読み込み中...</p>
      </main>
    )
  }

  if (error || !room || !player) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-gray-900 gap-4 px-6">
        <p className="text-red-400 text-lg text-center">{error || 'エラーが発生しました'}</p>
        <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white">
          トップに戻る
        </button>
      </main>
    )
  }

  const isWaiting = room.status === 'waiting'
  const isPlaying = room.status === 'playing'

  return (
    <main className="min-h-screen bg-gray-900 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-gray-500 text-xs">ルームコード</p>
          <p className="text-white font-mono font-bold text-sm tracking-wider">{room.room_code}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-500 text-xs">プレイヤー</p>
          <p className="text-white font-medium">{player.nickname}</p>
        </div>
      </div>

      {/* Bingo effect overlay */}
      {showBingoEffect && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowBingoEffect(false)}
        >
          <div className="text-center">
            <p className="text-8xl mb-4">🎉</p>
            <p className="text-white text-5xl font-bold mb-2">ビンゴ！</p>
            {player.bingo_rank && (
              <p className="text-yellow-400 text-3xl font-bold">第{player.bingo_rank}位</p>
            )}
            <p className="text-gray-400 mt-6 text-sm">タップして閉じる</p>
          </div>
        </div>
      )}

      {/* Waiting phase */}
      {isWaiting && (
        <div className="text-center py-8">
          <p className="text-4xl mb-4">⏳</p>
          <p className="text-white text-xl font-bold mb-2">
            主催者がゲームを開始するまでお待ちください
          </p>
          <p className="text-gray-400 text-sm mb-8">
            参加者: {players.length}人
          </p>
          <div className="flex flex-col gap-2 text-left">
            {players.map((p) => (
              <div
                key={p.id}
                className={`rounded-xl px-4 py-3 ${
                  p.id === player.id
                    ? 'bg-emerald-700/40 border border-emerald-500'
                    : 'bg-gray-800'
                }`}
              >
                <span className="text-white">{p.nickname}</span>
                {p.id === player.id && (
                  <span className="ml-2 text-emerald-400 text-xs">（あなた）</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Playing phase */}
      {isPlaying && (
        <div>
          {/* Status banners */}
          {player.is_bingo && (
            <div className="bg-yellow-500 text-gray-900 rounded-2xl px-4 py-4 text-center mb-4">
              <p className="text-2xl font-bold">🎉 ビンゴ！ 第{player.bingo_rank}位</p>
            </div>
          )}
          {player.is_reach && !player.is_bingo && (
            <div className="bg-orange-500/20 border-2 border-orange-500 rounded-2xl px-4 py-3 text-center mb-4">
              <p className="text-orange-400 text-xl font-bold">🔥 リーチ！</p>
            </div>
          )}

          {/* Bingo card */}
          <div className="mb-6">
            {/* Column headers */}
            <div className="grid grid-cols-5 gap-1 mb-1">
              {COLUMN_HEADERS.map((h) => (
                <div
                  key={h}
                  className="text-center text-indigo-400 font-bold text-lg py-1"
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Card cells */}
            <div className="grid grid-cols-5 gap-1">
              {Array.from({ length: 5 }).map((_, row) =>
                Array.from({ length: 5 }).map((_, col) => {
                  const idx = row * 5 + col
                  const value = player.card[idx]
                  const isFree = value === 0
                  const isOpen =
                    isFree || player.opened_numbers.includes(value)

                  return (
                    <div
                      key={idx}
                      className={`
                        aspect-square flex flex-col items-center justify-center rounded-xl text-center
                        transition-all duration-300 select-none
                        ${isOpen
                          ? 'bg-emerald-600 shadow-lg shadow-emerald-900/50'
                          : 'bg-gray-700'
                        }
                      `}
                    >
                      {isFree ? (
                        <div className="flex flex-col items-center">
                          <span className="text-white text-lg font-bold leading-none">★</span>
                          <span className="text-emerald-200 text-xs">FREE</span>
                        </div>
                      ) : (
                        <span
                          className={`font-bold ${
                            isOpen ? 'text-white text-xl' : 'text-gray-200 text-xl'
                          }`}
                        >
                          {value}
                        </span>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Drawn numbers history */}
          {drawnNumbers.length > 0 && (
            <div>
              <h2 className="text-gray-300 font-semibold mb-2 text-sm">
                引いた番号
                <span className="text-gray-500 ml-2">({drawnNumbers.length}/75)</span>
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {[...drawnNumbers].reverse().map((d, i) => {
                  const isOnCard =
                    player.card.includes(d.number)
                  return (
                    <span
                      key={d.id}
                      className={`text-xs font-mono px-2 py-1 rounded-lg ${
                        i === 0
                          ? 'bg-yellow-500 text-gray-900 font-bold'
                          : isOnCard
                          ? 'bg-emerald-700 text-white'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {getColumnLabel(d.number)}{d.number}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Other players status */}
          {players.length > 1 && (
            <div className="mt-4">
              <h2 className="text-gray-300 font-semibold mb-2 text-sm">参加者の状況</h2>
              <div className="flex flex-col gap-2">
                {players
                  .sort((a, b) => (a.bingo_rank ?? 99) - (b.bingo_rank ?? 99))
                  .map((p) => (
                    <div
                      key={p.id}
                      className={`rounded-xl px-3 py-2 flex items-center justify-between text-sm
                        ${p.id === player.id ? 'bg-gray-700 border border-gray-500' : 'bg-gray-800'}
                      `}
                    >
                      <span className="text-white">
                        {p.nickname}
                        {p.id === player.id && <span className="text-gray-400 text-xs ml-1">（あなた）</span>}
                      </span>
                      {p.is_bingo ? (
                        <span className="bg-yellow-500 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full">
                          🎉 第{p.bingo_rank}位
                        </span>
                      ) : p.is_reach ? (
                        <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          🔥 リーチ
                        </span>
                      ) : (
                        <span className="text-gray-500 text-xs">プレイ中</span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {room.status === 'finished' && (
        <div className="text-center py-12">
          <p className="text-4xl mb-4">🏆</p>
          <p className="text-white text-2xl font-bold mb-2">ゲーム終了！</p>
          {player.is_bingo && (
            <p className="text-yellow-400 text-xl">第{player.bingo_rank}位でビンゴ！おめでとう！</p>
          )}
          <button onClick={() => router.push('/')} className="mt-6 text-gray-400 hover:text-white">
            トップに戻る
          </button>
        </div>
      )}
    </main>
  )
}
