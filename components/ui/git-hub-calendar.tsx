"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns"

interface ContributionDay {
  date: string
  count: number
}

interface GitHubCalendarProps {
  data: ContributionDay[]
  colors?: string[]
}

const GitHubCalendar = ({
  data,
  colors = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
}: GitHubCalendarProps) => {
  const [contributions, setContributions] = useState<ContributionDay[]>([])
  const { theme } = useTheme()
  const today = new Date()
  const weeks = 26 // Display last 26 weeks (6 months)

  useEffect(() => {
    setContributions(data)
  }, [data])

  const getColor = (count: number) => {
    // 使用基于主题的颜色
    const isDarkMode = theme === 'dark'
    
    // 深色模式颜色（使用用户提供的RGB值转换的十六进制）
    if (isDarkMode) {
      if (count === 0) return '#242526' // 36, 37, 38
      if (count < 100) return '#1a4a33' // 26, 74, 51
      if (count < 500) return '#228150' // 34, 129, 80
      if (count < 1000) return '#2bb96e' // 43, 185, 110
      return '#32f08c' // 50, 240, 140
    }
    
    // 浅色模式颜色
    if (count === 0) return colors[0]
    if (count < 100) return colors[1]
    if (count < 500) return colors[2]
    if (count < 1000) return colors[3]
    return colors[4] || colors[colors.length - 1]
  }

  const renderWeeks = () => {
    const weeksArray = []
    // Start from today's week's Monday, go back 25 weeks
    let currentWeekStart = startOfWeek(today, { weekStartsOn: 1 }) // 1 = Monday

    // Go back 25 weeks to have 26 total weeks (including current week)
    for (let i = 0; i < weeks - 1; i++) {
      currentWeekStart = addDays(currentWeekStart, -7)
    }

    // Render 26 weeks forward
    for (let i = 0; i < weeks; i++) {
      const weekDays = eachDayOfInterval({
        start: currentWeekStart,
        end: endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
      })

      weeksArray.push(
        <div key={i} className="flex flex-col gap-1">
          {weekDays.map((day, index) => {
            const contribution = contributions.find((c) => isSameDay(new Date(c.date), day))
            const color = getColor(contribution?.count || 0)

            return (
              <div
                key={index}
                className={`w-3 h-3 rounded-[4px]`}
                style={{ backgroundColor: color }}
                title={`${format(day, "PPP")}, ${contribution?.count || 0} contributions`}
              />
            )
          })}
        </div>,
      )
      currentWeekStart = addDays(currentWeekStart, 7)
    }

    return weeksArray
  }

  const renderMonthLabels = () => {
    const months = []
    // Get the first week's Monday (same as renderWeeks)
    let currentWeekStart = startOfWeek(today, { weekStartsOn: 1 })
    for (let i = 0; i < weeks - 1; i++) {
      currentWeekStart = addDays(currentWeekStart, -7)
    }

    // 计算每个月应该占据的周数
    const monthsArray = []
    let currentDate = currentWeekStart
    
    // 获取过去6个月的月份名称
    for (let i = 0; i < 6; i++) {
      const monthName = format(currentDate, "MMM")
      monthsArray.push(monthName)
      currentDate = addDays(currentDate, 30)
    }
    
    return monthsArray.map((month, index) => (
      <span key={index} className="text-xs text-gray-500 w-12 text-center">
        {month}
      </span>
    ))
  }

  const dayLabels = ["M", "", "W", "", "F", "", "S"]

  return (
    <div className="p-0 rounded-lg border-0">
      <div className="flex">
        <div className="flex flex-col justify-between mt-5.5 mr-2">
          {dayLabels.map((day, index) => (
            <span key={index} className="text-xs text-muted-foreground h-3 text-center">
              {day}
            </span>
          ))}
        </div>
        <div>
          <div className="flex w-full justify-between gap-4 mb-2">
            <span className="text-xs text-muted-foreground">Jul</span>
            <span className="text-xs text-muted-foreground">Aug</span>
            <span className="text-xs text-muted-foreground">Sep</span>
            <span className="text-xs text-muted-foreground">Oct</span>
            <span className="text-xs text-muted-foreground">Nov</span>
            <span className="text-xs text-muted-foreground">Dec</span>
          </div>
          <div className="flex gap-1">{renderWeeks()}</div>
        </div>
      </div>
    </div>
  )
}

export { GitHubCalendar }
