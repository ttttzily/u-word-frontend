/**
 * Parse CSV text from the writing_data.csv file
 * CSV format: timestamp,filename,total_words,word_change
 */

export interface WritingRecord {
  timestamp: string
  filename: string
  total_words: number
  word_change: number
}

/**
 * Parse CSV text into an array of writing records
 */
export function parseCsv(csvText: string): WritingRecord[] {
  const lines = csvText.trim().split('\n')
  const headers = lines[0].split(',')

  return lines.slice(1)
    .map(line => {
      const values = line.split(',')
      if (values.length < 4) return null

      const [timestamp, filename, total_words, word_change] = values

      return {
        timestamp: timestamp.trim(),
        filename: filename.trim(),
        total_words: parseInt(total_words) || 0,
        word_change: parseInt(word_change) || 0
      }
    })
    .filter((record): record is WritingRecord => record !== null && !!record.timestamp)
}

/**
 * Load CSV from a file path
 */
export async function loadCsv(csvPath: string): Promise<WritingRecord[]> {
  const response = await fetch(csvPath)
  if (!response.ok) {
    throw new Error(`Failed to load CSV: ${response.statusText}`)
  }
  const csvText = await response.text()
  return parseCsv(csvText)
}

/**
 * Parse CSV file directly in browser
 */
export async function parseClientFile(file: File): Promise<WritingRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        resolve(parseCsv(text))
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

/**
 * Save data to localStorage
 */
export function saveToLocalStorage(key: string, data: WritingRecord[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.error('Failed to save to localStorage:', error)
  }
}

/**
 * Load data from localStorage
 */
export function loadFromLocalStorage(key: string): WritingRecord[] | null {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : null
  } catch (error) {
    console.error('Failed to load from localStorage:', error)
    return null
  }
}

/**
 * Clear data from localStorage
 */
export function clearLocalStorage(key: string): void {
  localStorage.removeItem(key)
}