export interface Room {
  id: string
  room_code: string
  host_id: string
  status: 'waiting' | 'playing' | 'finished'
  max_winners: number
  entry_deadline: string | null
  created_at: string
}

export interface Player {
  id: string
  room_id: string
  nickname: string
  card: number[]
  opened_numbers: number[]
  is_reach: boolean
  is_bingo: boolean
  bingo_rank: number | null
  joined_at: string
}

export interface DrawnNumber {
  id: string
  room_id: string
  number: number
  drawn_at: string
}
