"use client"

import { useState, useEffect } from "react"
import { GitHubCalendar } from "@/components/ui/git-hub-calendar"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { TimeRangeSelector } from "@/components/ui/time-range-selector"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from "recharts"
import { loadCsv, parseClientFile, saveToLocalStorage, loadFromLocalStorage, clearLocalStorage } from "@/lib/csv-parser"
import { aggregateDashboardData, formatForHeatmap, formatForTrendChart, TrendChartDatum } from "@/lib/data-aggregator"
import { Upload } from "lucide-react"

// Generate continuous date sequence from start to end
function generateDateSequence(startDate: Date, days: number): string[] {
  const dates: string[] = []
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() - (days - 1) + i)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    dates.push(`${year}-${month}-${day}`)
  }
  return dates
}

// Fill missing dates in the data sequence
function fillMissingDates(data: TrendChartDatum[], dateSequence: string[]): TrendChartDatum[] {
  const dataMap = new Map(data.map(item => [item.date, item]))
  let lastTotalWords = 0
  let foundFirstData = false
  
  return dateSequence.map(date => {
    const existingData = dataMap.get(date)
    if (existingData) {
      foundFirstData = true
      lastTotalWords = existingData.totalWords
      return existingData
    } else {
      if (foundFirstData) {
        return {
          date,
          dailyWords: 0,
          totalWords: lastTotalWords
        }
      } else {
        // 第一个有数据日期之前的数据设为 null，这样折线图就会跳过这些点
        return {
          date,
          dailyWords: 0,
          totalWords: null as any
        }
      }
    }
  })
}

export default function WritingDashboard() {
  const [heatmapData, setHeatmapData] = useState<Array<{ date: string; count: number }>>([])
  const [monthlyData, setMonthlyData] = useState<TrendChartDatum[]>([])
  const [recentSaves, setRecentSaves] = useState<Array<{ filename: string; date: string; time: string; wordCount: number }>>([])
  const [latestTotal, setLatestTotal] = useState(0)
  const [latestNetChange, setLatestNetChange] = useState(0)
  const [writingStreak, setWritingStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  // 统一更新所有数据状态的函数
  const updateAllDataStates = (aggregatedData: ReturnType<typeof aggregateDashboardData>, currentTimeRange: 'week' | 'month' | 'year' = timeRange) => {
    // Update heatmap
    setHeatmapData(formatForHeatmap(aggregatedData.daily))

    // Update trend data
    let days: number
    switch (currentTimeRange) {
      case 'week':
        days = 7
        break
      case 'month':
        days = 30
        break
      case 'year':
        days = 180
        break
      default:
        days = 30
    }
    const endDate = new Date()
    const dateSequence = generateDateSequence(endDate, days)
    const rawTrendData = formatForTrendChart(aggregatedData.daily)
    const filteredData = rawTrendData.filter(item =>
      dateSequence.includes(item.date)
    )
    const filledData = fillMissingDates(filteredData, dateSequence)
    setMonthlyData(filledData)

    // Update recent saves
    setRecentSaves(
      aggregatedData.recentSaves.map(record => {
        const [date, time] = record.timestamp.split(' ')
        return {
          filename: record.filename,
          date,
          time,
          wordCount: record.total_words
        }
      })
    )

    // Update stats
    setLatestTotal(aggregatedData.latestTotal)
    setLatestNetChange(aggregatedData.latestNetChange)
    setWritingStreak(aggregatedData.writingStreak)
  }

  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true)

        // 先尝试从localStorage加载
        const cachedData = loadFromLocalStorage('writingData')

        if (cachedData && cachedData.length > 0) {
          // 使用缓存数据
          const aggregatedData = aggregateDashboardData(cachedData)
          updateAllDataStates(aggregatedData)
        } else {
          // 没有缓存，加载默认示例数据
          const rawData = await loadCsv('/data/writing_data.csv')
          const aggregatedData = aggregateDashboardData(rawData)
          updateAllDataStates(aggregatedData)
        }

        setLoading(false)
      } catch (err) {
        console.error('Data loading error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
        setLoading(false)
      }
    }

    initializeData()
  }, [])

  // 监听 timeRange 变化，重新计算趋势图数据
  useEffect(() => {
    const updateDataForTimeRange = async () => {
      try {
        const cachedData = loadFromLocalStorage('writingData')
        
        if (cachedData && cachedData.length > 0) {
          // 从本地存储加载数据
          const aggregatedData = aggregateDashboardData(cachedData)
          updateAllDataStates(aggregatedData, timeRange)
        } else {
          // 本地存储为空，加载默认示例数据
          const rawData = await loadCsv('/data/writing_data.csv')
          const aggregatedData = aggregateDashboardData(rawData)
          updateAllDataStates(aggregatedData, timeRange)
        }
      } catch (error) {
        console.error('Error updating data for time range:', error)
      }
    }

    updateDataForTimeRange()
  }, [timeRange])

  // Handle file upload - 纯客户端处理
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadSuccess(false)

    try {
      // 直接在客户端解析文件
      const rawData = await parseClientFile(file)
      const aggregatedData = aggregateDashboardData(rawData)

      // 保存到localStorage
      saveToLocalStorage('writingData', rawData)

      // 更新所有状态
      updateAllDataStates(aggregatedData)

      // 显示成功消息
      setUploadSuccess(true)
      event.target.value = '' // 重置文件输入
      setTimeout(() => setUploadSuccess(false), 3000)
    } catch (error) {
      console.error('File parse error:', error)
      alert('CSV解析失败，请检查文件格式')
    } finally {
      setIsUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="text-gray-600">加载数据中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="text-red-500">错误: {error}</div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-background text-foreground overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto py-6 px-8">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* 主题切换按钮和文件上传 */}
          <div className="flex justify-between items-center mb-2 gap-3">
            <div className="flex gap-2">
              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Button
                  variant="default"
                  size="sm"
                  disabled={isUploading}
                  className="bg-neutral-700 text-white hover:bg-accent text-xs !px-3"
                >
                  <Upload className="h-3 w-3 mr-1.5" />
                  {isUploading ? '上传中...' : '上传 CSV'}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearLocalStorage('writingData')
                  window.location.reload()
                }}
                className="text-muted-foreground hover:bg-accent text-xs !px-3"
              >
                清除缓存
              </Button>
            </div>
            <div className="flex items-center gap-3">
              {uploadSuccess && (
                <div className="text-sm text-green-500 dark:text-green-400">
                  上传成功！
                </div>
              )}
              <ThemeToggle />
            </div>
          </div>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground mb-1 font-normal">文件名</div>
                  <div className="text-xl font-semibold text-neutral-600 dark:text-white">{recentSaves[0]?.filename || '无数据'}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">已连续写作</div>
                  <div className="font-bold text-lg text-neutral-600 dark:text-white">{writingStreak} 天</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">最近新增</div>
                  <div className={`font-bold text-lg ${latestNetChange >= 0 ? 'text-[#4ade80] dark:text-[#4ade80]' : 'text-red-400 dark:text-red-300'}`}>
                    {latestNetChange >= 0 ? '+' : ''}{latestNetChange} 字
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground mb-1">总字数</div>
                  <div className="text-xl font-semibold text-[#30a14e] dark:text-[#4ade80]">{latestTotal.toLocaleString()} 字</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-11 gap-2">
            <Card className="bg-card border-border lg:col-span-6 leading-6 py-4 gap-3">
              <CardHeader className="pb-0">
                <CardTitle className="text-base text-neutral-500 dark:text-white">写作天数</CardTitle>
                <CardDescription className="text-gray-500 text-xs">每日写作字数分布</CardDescription>
              </CardHeader>
              <CardContent className="pb-0">
                <div className="w-full">
                    <GitHubCalendar data={heatmapData} colors={["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"]} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border lg:col-span-5 py-4 gap-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-neutral-500 dark:text-white">最近保存</CardTitle>
                <CardDescription className="text-gray-500 text-xs">显示最近三次保存记录</CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="space-y-4">
                  {recentSaves.map((save, index) => (
                    <div
                      key={index}
                      className={`border-l-4 pl-3 py-1.5 flex items-center justify-between ${index === 0 ? "border-[#30a14e]" : "border-gray-300"}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 dark:text-white truncate">{save.filename}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {save.date} {save.time}
                        </span>
                        <span className={`font-semibold text-xs ${index === 0 ? "text-[#30a14e]" : "text-gray-500"} whitespace-nowrap`}>
                          {save.wordCount.toLocaleString()}字
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-neutral-500 dark:text-white">写作统计</CardTitle>
                  <CardDescription className="text-gray-500 text-xs">每日新增字数与累计总字数</CardDescription>
                </div>
                <TimeRangeSelector
                  value={timeRange}
                  onValueChange={setTimeRange}
                />
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="transparent" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: "currentColor", fontSize: 11 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      switch (timeRange) {
                        case 'week':
                        case 'month':
                          return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
                        case 'year':
                          return date.toLocaleDateString('zh-CN', { month: 'short' });
                        default:
                          return value;
                      }
                    }}
                    interval={timeRange === 'year' ? 30 : timeRange === 'month' ? 4 : 0}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: "currentColor", fontSize: 11 }}
                    label={{
                      value: "每日字数",
                      angle: -90,
                      position: "insideLeft",
                      style: { fill: "currentColor", fontSize: 11 },
                    }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: "currentColor", fontSize: 11 }}
                    label={{
                      value: "累计字数",
                      angle: 90,
                      position: "insideRight",
                      style: { fill: "currentColor", fontSize: 11 },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "11px",
                      lineHeight: "1.2",
                      padding: "8px 10px",
                      color: "currentColor"
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", color: "currentColor" }} />
                  <Bar
                    yAxisId="left"
                    dataKey="dailyWords"
                    fill="#d1d5db"
                    name="每日新增"
                    radius={[0, 0, 0, 0]}
                    barSize={8}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="totalWords"
                    stroke="#4ade80"
                    strokeWidth={2} // 稍微加粗曲线
                    name="累计总字数"
                    dot={false}
                    activeDot={{ r: 4 }} // 鼠标悬停时显示小圆点
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      <footer className="text-center py-4 text-xs text-muted-foreground bg-card border-t border-border">
        U-Word · 2026 © tuanzi
      </footer>
    </div>
  )
}
