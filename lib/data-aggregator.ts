/**
 * Data aggregation utilities for writing statistics
 * Converts raw CSV records into aggregated daily/weekly/monthly data
 */

import { WritingRecord } from './csv-parser'

/**
 * Get local date string (YYYY-MM-DD) avoiding timezone issues
 */
function getLocalDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export interface AggregatedDay {
  date: string // YYYY-MM-DD
  is_active: boolean
  total_words: number
  net_change: number
  total_investment: number // Sum of absolute word changes
}

export interface AggregatedData {
  daily: AggregatedDay[]
  recentSaves: WritingRecord[]
  latestTotal: number
  latestNetChange: number // Most recent day's net_change
  writingStreak: number // Consecutive days with net_change != 0
}

/**
 * Aggregate data by day, calculating three core metrics:
 * - is_active: whether there was any writing activity
 * - net_change: today's last total_words - previous day's last total_words
 * - total_investment: sum of all |word_change| for the day
 */
export function aggregateByDay(rawData: WritingRecord[]): AggregatedDay[] {
  // Group by date
  const groupedByDate = new Map<string, WritingRecord[]>()

  rawData.forEach(record => {
    const date = record.timestamp.split(' ')[0] // Extract YYYY-MM-DD
    if (!groupedByDate.has(date)) {
      groupedByDate.set(date, [])
    }
    groupedByDate.get(date)!.push(record)
  })

  // Calculate metrics for each day
  const aggregatedDays = Array.from(groupedByDate.entries())
    .map(([date, records]) => {
      const lastRecord = records[records.length - 1]

      // Total investment: sum of absolute word changes
      const total_investment = records.reduce((sum, record) => {
        return sum + Math.abs(record.word_change)
      }, 0)

      return {
        date,
        is_active: records.length > 0,
        total_words: lastRecord.total_words,
        net_change: 0, // Temporary value, will be recalculated below
        total_investment
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  // Recalculate net_change: today's last total_words - previous day's last total_words
  for (let i = 0; i < aggregatedDays.length; i++) {
    const currentDay = aggregatedDays[i]
    const previousDay = i > 0 ? aggregatedDays[i - 1] : null

    if (previousDay) {
      currentDay.net_change = currentDay.total_words - previousDay.total_words
    } else {
      // First day: use total_investment as net_change
      currentDay.net_change = currentDay.total_investment
    }
  }

  return aggregatedDays
}

/**
 * Calculate full aggregated data for the dashboard
 */
export function aggregateDashboardData(rawData: WritingRecord[]): AggregatedData {
  const daily = aggregateByDay(rawData)
  const recentSaves = rawData.slice(-3).reverse()
  const latestTotal = rawData[rawData.length - 1]?.total_words || 0

  // Calculate latest net change (most recent day with data)
  const latestNetChange = daily.length > 0 ? daily[daily.length - 1].net_change : 0

  // Calculate writing streak (consecutive days with net_change != 0)
  const writingStreak = calculateWritingStreak(daily)

  return {
    daily,
    recentSaves,
    latestTotal,
    latestNetChange,
    writingStreak
  }
}

/**
 * Calculate writing streak based on calendar days:
 * - Start from the most recent date with data
 * - Count consecutive calendar days backwards
 * - Stop at the first day with no data or net_change == 0
 */
function calculateWritingStreak(daily: AggregatedDay[]): number {
  if (daily.length === 0) return 0

  // Create a map for quick date lookup
  const dateMap = new Map<string, AggregatedDay>()
  daily.forEach(day => dateMap.set(day.date, day))

  // Get the most recent date with data
  const mostRecentDay = daily[daily.length - 1]
  let currentDate = new Date(mostRecentDay.date)
  let streak = 0

  // Start counting consecutive calendar days
  while (true) {
    const dateString = getLocalDateStringFromDate(currentDate)
    const dayData = dateMap.get(dateString)

    if (dayData && dayData.net_change !== 0) {
      // Day has data and net change != 0, continue streak
      streak++
      // Move to previous calendar day
      currentDate.setDate(currentDate.getDate() - 1)
    } else {
      // Day has no data or net change == 0, stop streak
      break
    }
  }

  return streak
}

/**
 * Helper function to convert Date object to local date string (YYYY-MM-DD)
 */
function getLocalDateStringFromDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format aggregated data for GitHub-style calendar heatmap
 * Returns array of { date, count } where count is total_investment
 */
export function formatForHeatmap(daily: AggregatedDay[]): Array<{ date: string; count: number }> {
  return daily.map(day => ({
    date: day.date,
    count: day.total_investment
  }))
}

/**
 * Format aggregated data for trend chart
 * Returns array of objects with date, dailyWords, and totalWords for Recharts
 */
export interface TrendChartDatum {
  date: string
  dailyWords: number
  totalWords: number
}

export function formatForTrendChart(daily: AggregatedDay[]): TrendChartDatum[] {
  return daily.map(d => ({
    date: d.date,
    dailyWords: d.net_change,
    totalWords: d.total_words
  }))
}
