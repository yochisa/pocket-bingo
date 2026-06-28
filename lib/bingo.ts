/**
 * Generate a bingo card as a flat 25-element array.
 * Layout: row-major, card[row*5 + col]
 *   B column = col 0 (numbers 1-15)
 *   I column = col 1 (numbers 16-30)
 *   N column = col 2 (numbers 31-45)
 *   G column = col 3 (numbers 46-60)
 *   O column = col 4 (numbers 61-75)
 * FREE cell is at row=2, col=2 → index 12, value = 0
 */
export function generateCard(): number[] {
  const card = new Array(25).fill(0)

  const ranges: [number, number][] = [
    [1, 15],   // B (col 0)
    [16, 30],  // I (col 1)
    [31, 45],  // N (col 2)
    [46, 60],  // G (col 3)
    [61, 75],  // O (col 4)
  ]

  for (let col = 0; col < 5; col++) {
    const [min, max] = ranges[col]
    // Build pool of numbers for this column
    const pool: number[] = []
    for (let n = min; n <= max; n++) {
      pool.push(n)
    }

    // Fisher-Yates shuffle and pick 5
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const picked = pool.slice(0, 5)

    for (let row = 0; row < 5; row++) {
      const idx = row * 5 + col
      // FREE cell
      if (row === 2 && col === 2) {
        card[idx] = 0
      } else {
        card[idx] = picked[row]
      }
    }
  }

  return card
}

/**
 * Determine which lines (rows, columns, diagonals) are complete.
 * A cell is "open" if card[i] === 0 (FREE) or openedNumbers includes card[i].
 *
 * Returns isBingo (at least one complete line) and isReach (at least one line
 * that has exactly 4 of 5 cells open).
 */
export function checkBingo(
  card: number[],
  openedNumbers: number[]
): { isBingo: boolean; isReach: boolean } {
  const isOpen = (idx: number): boolean => {
    return card[idx] === 0 || openedNumbers.includes(card[idx])
  }

  // All 12 lines: 5 rows + 5 columns + 2 diagonals
  const lines: number[][] = []

  // Rows
  for (let row = 0; row < 5; row++) {
    lines.push([0, 1, 2, 3, 4].map((col) => row * 5 + col))
  }

  // Columns
  for (let col = 0; col < 5; col++) {
    lines.push([0, 1, 2, 3, 4].map((row) => row * 5 + col))
  }

  // Diagonal top-left to bottom-right
  lines.push([0, 6, 12, 18, 24])

  // Diagonal top-right to bottom-left
  lines.push([4, 8, 12, 16, 20])

  let isBingo = false
  let isReach = false

  for (const line of lines) {
    const openCount = line.filter((idx) => isOpen(idx)).length
    if (openCount === 5) {
      isBingo = true
    } else if (openCount === 4) {
      isReach = true
    }
  }

  return { isBingo, isReach }
}
